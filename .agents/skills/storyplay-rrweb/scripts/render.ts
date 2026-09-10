/**
 * Storyplay-rrweb — module 3: render.
 *
 * Frame-accurate: the rrweb Replayer is paused at each frame's exact timestamp
 * and screenshotted, so cursor motion is perfectly smooth at the target fps
 * (no screencast frame drops). Then:
 *   frames --ffmpeg--> video.mp4
 *   narration mp3s + per-scene silence pads --ffmpeg--> narration.m4a
 *   video + narration + srt --ffmpeg--> final.mp4 (soft mov_text subtitles)
 */
import { chromium } from 'playwright'
import * as fs from 'fs'
import * as path from 'path'
import type { CinematicTimeline } from './processor'
import {
  Log, ffmpegBin, probeDurationMs, resolveRrwebBundle, rmrf, run, tail,
} from './util'

export interface RenderNarration {
  id: string
  mp3: string
  narrationMs: number
}

export interface RenderOptions {
  runDir: string
  cinematicJson: string
  timeline: CinematicTimeline
  narrations: RenderNarration[]
  srt: string | null
  outMp4: string
  png: boolean
  crf: number
  keepIntermediates: boolean
  log: Log
}

const MACOS_CURSOR_CSS = `
/* The core Replayer does not inject its own .replayer-mouse rules into the host
   document, so position/z-index must be set here or the cursor stays at 0,0. */
.replayer-mouse {
  position: absolute !important;
  left: 0;
  top: 0;
  width: 26px !important;
  height: 26px !important;
  margin-left: -3px !important;
  margin-top: -2px !important;
  background-color: transparent !important;
  background-image: url("data:image/svg+xml,%3Csvg width='26' height='26' viewBox='0 0 26 26' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M6 2.5L19.5 14.2L13.2 14.9L16.6 21.4L13.9 22.8L10.4 16.3L6 20.3V2.5Z' fill='%23111' stroke='%23fff' stroke-width='1.6' stroke-linejoin='round'/%3E%3C/svg%3E") !important;
  background-size: contain !important;
  background-repeat: no-repeat !important;
  border-radius: 0 !important;
  box-shadow: 0 2px 8px rgba(0,0,0,.28) !important;
  pointer-events: none !important;
  transition: transform .12s cubic-bezier(.2,.8,.2,1) !important;
  z-index: 2147483647 !important;
}
.replayer-mouse.active { transform: scale(.84) !important; }
.replayer-mouse-tail { display: none !important; }
.replayer-wrapper { position: relative !important; overflow: hidden !important; }
`

/* ------------------------------------------------------------------ frames */

function shellHtml(width: number, height: number): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8" />
<style>
  html, body { margin:0; padding:0; width:${width}px; height:${height}px; overflow:hidden; background:#0b0b0f; }
  #mount { width:${width}px; height:${height}px; overflow:hidden; }
  .replayer-wrapper { transform: none !important; width:${width}px !important; height:${height}px !important; }
  .replayer-wrapper > iframe { border:0 !important; width:${width}px !important; height:${height}px !important; }
  ${MACOS_CURSOR_CSS}
</style></head>
<body><div id="mount"></div></body></html>`
}

export async function renderFrames(options: {
  cinematicJson: string
  framesDir: string
  width: number
  height: number
  fps: number
  totalMs: number
  png: boolean
  log: Log
}): Promise<number> {
  const { cinematicJson, framesDir, width, height, fps, totalMs, png, log } = options
  rmrf(framesDir)
  fs.mkdirSync(framesDir, { recursive: true })

  const cinematic = JSON.parse(fs.readFileSync(cinematicJson, 'utf-8')) as { events: unknown[] }
  const eventsJs = path.join(framesDir, '__events.js')
  fs.writeFileSync(eventsJs, `window.__SP_EVENTS = ${JSON.stringify(cinematic.events)};\n`, 'utf-8')

  const bundle = await resolveRrwebBundle(log)
  const frameCount = Math.max(1, Math.ceil((totalMs / 1000) * fps))
  const ext = png ? 'png' : 'jpg'

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 })
  const page = await context.newPage()
  page.setDefaultTimeout(120000)

  try {
    await page.setContent(shellHtml(width, height), { waitUntil: 'load' })
    await page.addScriptTag({ path: eventsJs })
    await page.addScriptTag({ path: bundle })
    await page.addScriptTag({
      content: `
        (() => {
          const events = window.__SP_EVENTS || [];
          const rrweb = window.rrweb || {};
          const Player = rrweb.Replayer || (rrweb.default && rrweb.default.Replayer);
          if (!Player) throw new Error('rrweb.Replayer indisponível no bundle');
          window.__spReplayer = new Player(events, {
            root: document.getElementById('mount'),
            speed: 1,
            showWarning: false,
            mouseTail: false,
            triggerFocus: false,
            UNSAFE_replayCanvas: false,
          });
          window.__spReady = true;
          window.__spSetTime = (ms) => { window.__spReplayer.pause(ms); };
        })();
      `,
    })
    await page.waitForFunction('window.__spReady === true')
    await page.evaluate('document.fonts.ready.then(function () { return true })').catch(() => undefined)
    await page.waitForTimeout(400)

    const started = Date.now()
    for (let frame = 0; frame < frameCount; frame += 1) {
      const ms = (frame / fps) * 1000
      // String IIFE on purpose: tsx/esbuild injects a `__name` helper into nested
      // closures (undefined in the browser) and `evaluate("() => …")` is NOT
      // invoked — an IIFE expression is both safe and actually executed.
      await page.evaluate(
        `(function () {
          return new Promise(function (resolve) {
            window.__spSetTime(${ms});
            requestAnimationFrame(function () { requestAnimationFrame(function () { resolve(true) }) });
          });
        })()`
      )
      const file = path.join(framesDir, `f${String(frame).padStart(6, '0')}.${ext}`)
      await page.screenshot(png ? { path: file, type: 'png' } : { path: file, type: 'jpeg', quality: 95 })
      if (frame > 0 && frame % 150 === 0) {
        log.line(`  frames ${frame}/${frameCount} (~${((Date.now() - started) / frame).toFixed(0)}ms/frame)`)
      }
    }
    log.line(`frames: ${frameCount} quadros @ ${fps}fps em ${((Date.now() - started) / 1000).toFixed(0)}s`, true)
  } finally {
    await browser.close()
  }

  fs.rmSync(eventsJs, { force: true })
  return frameCount
}

/* ------------------------------------------------------------------- audio */

export async function assembleNarration(
  narrations: RenderNarration[],
  timeline: CinematicTimeline,
  outAudio: string,
  log: Log
): Promise<void> {
  const usable = narrations.filter((item) => fs.existsSync(item.mp3))
  if (usable.length === 0) throw new Error('nenhum mp3 de narração para montar a trilha')

  const byId = new Map(timeline.scenes.map((scene) => [scene.id, scene]))
  const args: string[] = ['-y']
  for (const item of usable) args.push('-i', item.mp3)

  const filters: string[] = []
  const labels: string[] = []
  usable.forEach((item, index) => {
    const scene = byId.get(item.id)
    const padSec = scene ? Math.max(0, (scene.span - item.narrationMs) / 1000) : 0
    const chain = [`[${index}:a]aresample=24000`, 'aformat=sample_fmts=fltp:channel_layouts=mono']
    if (padSec > 0.03) chain.push(`apad=pad_dur=${padSec.toFixed(3)}`)
    filters.push(`${chain.join(',')}[a${index}]`)
    labels.push(`[a${index}]`)
  })
  filters.push(`${labels.join('')}concat=n=${usable.length}:v=0:a=1[out]`)

  args.push(
    '-filter_complex', filters.join(';'),
    '-map', '[out]',
    '-c:a', 'aac', '-b:a', '160k', '-ar', '24000', '-ac', '1',
    outAudio
  )
  const result = await run(ffmpegBin(), args)
  if (result.code !== 0) {
    for (const line of tail(result.stderr, 6)) log.line(`  ffmpeg: ${line}`)
    throw new Error('falha ao montar a trilha de narração')
  }
  log.line(`áudio: ${(probeDurationMs(outAudio) / 1000).toFixed(2)}s -> ${path.basename(outAudio)}`, true)
}

/* ------------------------------------------------------------------- video */

export async function encodeVideo(options: {
  framesDir: string
  fps: number
  crf: number
  png: boolean
  outVideo: string
  log: Log
}): Promise<void> {
  const { framesDir, fps, crf, png, outVideo, log } = options
  const pattern = path.join(framesDir, `f%06d.${png ? 'png' : 'jpg'}`)
  const args = [
    '-y', '-framerate', String(fps), '-i', pattern,
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'medium', '-crf', String(crf),
    '-movflags', '+faststart', outVideo,
  ]
  const result = await run(ffmpegBin(), args)
  if (result.code !== 0) {
    for (const line of tail(result.stderr, 6)) log.line(`  ffmpeg: ${line}`)
    throw new Error('falha ao codificar o vídeo')
  }
  log.line(`vídeo: ${(probeDurationMs(outVideo) / 1000).toFixed(2)}s -> ${path.basename(outVideo)}`, true)
}

/* --------------------------------------------------------------------- mux */

export async function muxFinal(options: {
  video: string
  audio: string
  srt: string | null
  outMp4: string
  log: Log
}): Promise<void> {
  const { video, audio, srt, outMp4, log } = options
  const withSubs = Boolean(srt && fs.existsSync(srt))
  const args = ['-y', '-i', video, '-i', audio]
  if (withSubs) args.push('-i', srt as string)
  args.push('-map', '0:v:0', '-map', '1:a:0')
  if (withSubs) args.push('-map', '2:0')
  args.push('-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k')
  if (withSubs) {
    args.push('-c:s', 'mov_text', '-metadata:s:s:0', 'language=por', '-metadata:s:s:0', 'title=Português')
  }
  args.push('-movflags', '+faststart', outMp4)
  const result = await run(ffmpegBin(), args)
  if (result.code !== 0) {
    for (const line of tail(result.stderr, 8)) log.line(`  ffmpeg: ${line}`)
    throw new Error('falha ao muxar narração/legenda no vídeo final')
  }
  log.line(`final: ${outMp4} (${(probeDurationMs(outMp4) / 1000).toFixed(2)}s)`, true)
}

/* -------------------------------------------------------------------- all */

export async function renderAll(options: RenderOptions): Promise<{ durationMs: number; frames: number }> {
  const { runDir, cinematicJson, timeline, narrations, srt, outMp4, png, crf, keepIntermediates, log } = options
  const framesDir = path.join(runDir, 'frames')
  const video = path.join(runDir, 'video.mp4')
  const audio = path.join(runDir, 'narration.m4a')

  const frames = await renderFrames({
    cinematicJson,
    framesDir,
    width: timeline.width,
    height: timeline.height,
    fps: timeline.fps,
    totalMs: timeline.totalMs,
    png,
    log,
  })
  await encodeVideo({ framesDir, fps: timeline.fps, crf, png, outVideo: video, log })
  await assembleNarration(narrations, timeline, audio, log)
  await muxFinal({ video, audio, srt, outMp4, log })

  if (!keepIntermediates) {
    rmrf(framesDir)
    fs.rmSync(video, { force: true })
    fs.rmSync(audio, { force: true })
  }

  return { durationMs: probeDurationMs(outMp4), frames }
}
