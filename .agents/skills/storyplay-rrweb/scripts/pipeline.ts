/**
 * Storyplay-rrweb — one-command pipeline (token economy: ONE invocation per video).
 *
 *   storyboard.json
 *     -> narration (edge-tts, per scene, real sentence windows)
 *     -> capture (Playwright + rrweb, humanized, scene markers)
 *     -> processor (Bézier cursor + per-scene tempo matched to narration)
 *     -> render (frame-accurate frames + narration track + soft subtitles)
 *     -> .ultraskills/storyplay-rrweb/<yyyy-mm-dd_hh-mm>_<slug>/final.mp4
 *
 * Everything the agent needs afterwards is in run.json (single small file).
 */
import * as fs from 'fs'
import * as path from 'path'
import { capture } from './capture'
import { synthesize, writeSrt, writeVtt, type Cue } from './narration'
import { checkDeps, ensureDeps, printDepReport } from './preflight'
import { processCinematic, type CinematicTimeline, type SceneNarration } from './processor'
import { renderAll, type RenderNarration } from './render'
import { findStoryboard, loadStoryboard, type Storyboard } from './storyboard'
import {
  DEFAULT_OUT_ROOT, Log, SKILL_VERSION, makeRunDir, probeDurationMs, rmrf, slugify, writeJson,
} from './util'

interface Args {
  slug: string
  storyboard?: string
  projectRoot: string
  outRoot: string
  runDir?: string
  fps?: number
  crf: number
  png: boolean
  keepIntermediates: boolean
  quiet: boolean
  json: boolean
  checkDeps: boolean
  installDeps: boolean
  noSubtitles: boolean
  renderOnly: boolean
  fromCapture?: string
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    slug: '',
    projectRoot: process.cwd(),
    outRoot: DEFAULT_OUT_ROOT,
    crf: 18,
    png: false,
    keepIntermediates: false,
    quiet: true,
    json: false,
    checkDeps: false,
    installDeps: false,
    noSubtitles: false,
    renderOnly: false,
  }
  const value = (index: number, inline?: string): string => {
    if (inline !== undefined && inline !== '') return inline
    const next = argv[index + 1]
    if (next === undefined || next.startsWith('--')) throw new Error(`faltou valor para ${argv[index]}`)
    return next
  }
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]
    const [flag, inline] = token.includes('=') ? [token.slice(0, token.indexOf('=')), token.slice(token.indexOf('=') + 1)] : [token, undefined]
    switch (flag) {
      case '--slug': args.slug = value(i, inline); if (inline === undefined) i += 1; break
      case '--storyboard': args.storyboard = value(i, inline); if (inline === undefined) i += 1; break
      case '--project-root': args.projectRoot = path.resolve(value(i, inline)); if (inline === undefined) i += 1; break
      case '--out-root': args.outRoot = value(i, inline); if (inline === undefined) i += 1; break
      case '--run-dir': args.runDir = path.resolve(value(i, inline)); if (inline === undefined) i += 1; break
      case '--fps': args.fps = Number(value(i, inline)); if (inline === undefined) i += 1; break
      case '--crf': args.crf = Number(value(i, inline)); if (inline === undefined) i += 1; break
      case '--from-capture': args.fromCapture = path.resolve(value(i, inline)); if (inline === undefined) i += 1; break
      case '--png': args.png = true; break
      case '--keep-intermediates': args.keepIntermediates = true; break
      case '--verbose': args.quiet = false; break
      case '--json': args.json = true; break
      case '--check-deps': args.checkDeps = true; break
      case '--install-deps': args.installDeps = true; break
      case '--no-subtitles': args.noSubtitles = true; break
      case '--render-only': args.renderOnly = true; break
      case '--help':
        console.log(
          'uso: tsx scripts/pipeline.ts --slug <nome> [--storyboard <json>] [--project-root .]\n' +
            '  [--out-root .ultraskills/storyplay-rrweb] [--run-dir <dir>] [--fps 30] [--crf 18] [--png]\n' +
            '  [--from-capture raw.json] [--render-only] [--keep-intermediates] [--no-subtitles]\n' +
            '  [--check-deps] [--install-deps] [--json] [--verbose]'
        )
        process.exit(0)
        break
      default:
        if (token.startsWith('--')) throw new Error(`argumento desconhecido: ${token}`)
    }
  }
  return args
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))
  const log = new Log(args.quiet)

  if (args.checkDeps) {
    printDepReport(await checkDeps(), args.json)
    return
  }

  const deps = await ensureDeps({ install: args.installDeps, log })
  if (!deps.ok) {
    printDepReport(deps, false)
    if (!args.installDeps) {
      console.log('\nNada foi instalado. Confirme com o usuário e rode de novo com --install-deps.')
    }
    process.exitCode = 4
    return
  }

  const started = Date.now()
  const runDir = args.runDir ?? makeRunDir(args.projectRoot, args.outRoot, slugify(args.slug))

  // ---- render-only: reuse a previous cinematic timeline -------------------
  if (args.renderOnly) {
    const cinematicJson = path.join(runDir, 'cinematic.json')
    if (!fs.existsSync(cinematicJson)) throw new Error(`--render-only exige ${cinematicJson}`)
    const cinematic = JSON.parse(fs.readFileSync(cinematicJson, 'utf-8')) as {
      events: unknown[]
      timeline: CinematicTimeline
    }
    const narrations = readJson<RenderNarration[]>(path.join(runDir, 'narrations.json')) ?? []
    const srt = path.join(runDir, 'final.srt')
    const outMp4 = path.join(runDir, 'final.mp4')
    const result = await renderAll({
      runDir,
      cinematicJson,
      timeline: cinematic.timeline,
      narrations,
      srt: fs.existsSync(srt) ? srt : null,
      outMp4,
      png: args.png,
      crf: args.crf,
      keepIntermediates: args.keepIntermediates,
      log,
    })
    console.log(`OK  ${outMp4}  ${(result.durationMs / 1000).toFixed(1)}s`)
    return
  }

  const storyboardPath = findStoryboard(args.projectRoot, args.slug, args.storyboard)
  const storyboard = loadStoryboard(storyboardPath)
  if (args.fps) storyboard.fps = args.fps
  log.line(`storyboard: ${storyboardPath} (${storyboard.scenes.length} cenas)`)
  log.line(`run: ${runDir}`)

  fs.mkdirSync(runDir, { recursive: true })
  fs.copyFileSync(storyboardPath, path.join(runDir, 'storyboard.json'))

  // ---- 1. narration -------------------------------------------------------
  const narrationDir = path.join(runDir, 'narration')
  fs.mkdirSync(narrationDir, { recursive: true })
  const narrations: SceneNarration[] = []
  const renderNarrations: RenderNarration[] = []
  const cuesByScene = new Map<string, Cue[]>()

  for (const [index, scene] of storyboard.scenes.entries()) {
    const mp3 = path.join(narrationDir, `${scene.id}.mp3`)
    const result = await synthesize(scene.narration, {
      voice: storyboard.voice,
      rate: storyboard.rate,
      volume: storyboard.volume,
      mp3Path: mp3,
      log,
    })
    narrations.push({ id: scene.id, narrationMs: result.durationMs, title: scene.title })
    renderNarrations.push({ id: scene.id, mp3, narrationMs: result.durationMs })
    cuesByScene.set(scene.id, result.cues)
    log.line(
      `[narração ${index + 1}/${storyboard.scenes.length}] ${scene.id}  ` +
        `${(result.durationMs / 1000).toFixed(1)}s  cues ${result.cues.length}`,
      true
    )
  }

  // ---- 2. capture ---------------------------------------------------------
  const rawJson = args.fromCapture ?? path.join(runDir, 'raw.json')
  if (args.fromCapture) {
    log.line(`reusando capture: ${rawJson}`)
  } else {
    await capture({ storyboard, rawJson, log })
  }

  // ---- 3. process (cursor math + per-scene tempo) -------------------------
  const cinematicJson = path.join(runDir, 'cinematic.json')
  const { timeline } = processCinematic({
    rawJson,
    outJson: cinematicJson,
    narrations,
    width: storyboard.width,
    height: storyboard.height,
    fps: storyboard.fps,
    seed: storyboard.seed,
    log,
  })

  // ---- 4. subtitles (offsets from the real scene spans) -------------------
  let srtPath: string | null = null
  if (!args.noSubtitles) {
    const globalCues: Cue[] = []
    for (const scene of timeline.scenes) {
      const cues = cuesByScene.get(scene.id) ?? []
      for (const cue of cues) {
        globalCues.push({ start: scene.start + cue.start, end: scene.start + cue.end, text: cue.text })
      }
    }
    srtPath = path.join(runDir, 'final.srt')
    writeSrt(globalCues, srtPath, 0)
    writeVtt(globalCues, path.join(runDir, 'final.vtt'), 0)
    log.line(`legendas: ${globalCues.length} cues`, true)
  }

  writeJson(path.join(runDir, 'narrations.json'), renderNarrations)

  // ---- 5. render ----------------------------------------------------------
  const outMp4 = path.join(runDir, 'final.mp4')
  const result = await renderAll({
    runDir,
    cinematicJson,
    timeline,
    narrations: renderNarrations,
    srt: srtPath,
    outMp4,
    png: args.png,
    crf: args.crf,
    keepIntermediates: args.keepIntermediates,
    log,
  })

  // ---- 6. manifest + cleanup ---------------------------------------------
  const manifest = {
    skill: 'storyplay-rrweb',
    version: SKILL_VERSION,
    status: 'ok',
    slug: slugify(args.slug),
    storyboard: storyboardPath,
    run_dir: runDir,
    created_at: new Date().toISOString(),
    elapsed_sec: Number(((Date.now() - started) / 1000).toFixed(1)),
    width: storyboard.width,
    height: storyboard.height,
    fps: storyboard.fps,
    frames: result.frames,
    duration_sec: Number((result.durationMs / 1000).toFixed(2)),
    narration: { voice: storyboard.voice, rate: storyboard.rate, scenes: narrations.length },
    final_mp4: outMp4,
    srt: srtPath,
    vtt: srtPath ? path.join(runDir, 'final.vtt') : null,
    subtitles_embedded: Boolean(srtPath),
    timeline: timeline.scenes,
    warnings: timeline.warnings,
    errors: [] as string[],
  }
  writeJson(path.join(runDir, 'run.json'), manifest)
  log.flush(path.join(runDir, 'run.log'))

  if (!args.keepIntermediates) {
    rmrf(narrationDir)
    if (!args.fromCapture) fs.rmSync(rawJson, { force: true })
  }

  if (args.json) {
    console.log(JSON.stringify(manifest, null, 2))
  } else {
    for (const scene of timeline.scenes) {
      console.log(
        `[${scene.index + 1}/${timeline.scenes.length}] ${scene.id}  ` +
          `narração ${(scene.narrationMs / 1000).toFixed(1)}s  cena ${(scene.span / 1000).toFixed(1)}s  ` +
          `cliques ${scene.clicks}  tempo x${scene.tempo}`
      )
    }
    console.log(
      `OK  ${outMp4}  ${(result.durationMs / 1000).toFixed(1)}s  ${storyboard.width}x${storyboard.height}@${storyboard.fps}  ` +
        `legenda ${srtPath ? 'embutida mov_text + final.srt/.vtt' : 'desligada'}`
    )
    for (const warning of timeline.warnings) console.log(`AVISO: ${warning}`)
    console.log(`manifest: ${path.join(runDir, 'run.json')}`)
  }
}

function readJson<T>(file: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8')) as T
  } catch {
    return null
  }
}

void probeDurationMs

main().catch(async (error) => {
  console.error(`ERRO: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
})
