/**
 * Storyplay-rrweb — narration (edge-tts) + subtitle cues.
 *
 * Uses the edge-tts CLI (`--file`/`--write-subtitles`) so we get the engine's
 * real SentenceBoundary windows, then builds readable 1-2 line cues *inside*
 * each real sentence window. This is the same strategy as storyplay's
 * narration.py (mirrored on purpose: each skill stays self-contained).
 */
import * as fs from 'fs'
import * as path from 'path'
import { Log, probeDurationMs, pythonBin, run } from './util'

export interface Cue {
  start: number
  end: number
  text: string
}

export interface NarrationResult {
  mp3: string
  vtt: string | null
  durationMs: number
  cues: Cue[]
}

const MAX_LINE = 42
const MAX_LINES = 2
const MIN_CUE_MS = 420
const MAX_CUE_MS = 7000

export function fmtTimestamp(ms: number, separator = ','): string {
  const total = Math.max(0, Math.round(ms))
  const h = Math.floor(total / 3600000)
  const m = Math.floor((total % 3600000) / 60000)
  const s = Math.floor((total % 60000) / 1000)
  const milli = total % 1000
  const pad = (n: number, size = 2) => String(n).padStart(size, '0')
  return `${pad(h)}:${pad(m)}:${pad(s)}${separator}${pad(milli, 3)}`
}

function wrapLine(text: string, width = MAX_LINE): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    if (!current) current = word
    else if (current.length + 1 + word.length <= width) current = `${current} ${word}`
    else {
      lines.push(current)
      current = word
    }
  }
  if (current) lines.push(current)
  return lines
}

function wrapCue(text: string): string {
  const lines = wrapLine(text)
  if (lines.length <= MAX_LINES) return lines.join('\n')
  // Too long for 2 lines: balance the words across exactly two lines. Never
  // truncate (`.slice(0, 2)` used to silently drop the sentence tail).
  const words = text.split(/\s+/).filter(Boolean)
  if (words.length < 2) return text
  const mid = Math.max(1, Math.min(words.length - 1, Math.ceil(words.length / 2)))
  return [words.slice(0, mid).join(' '), words.slice(mid).join(' ')].join('\n')
}

function splitClauses(text: string, maxChars: number): string[] {
  const clean = text.trim()
  if (!clean) return []
  if (clean.length <= maxChars) return [clean]
  const parts = clean.split(/(?<=[,;:])\s+|\s+[—–]\s+/)
  const out: string[] = []
  for (const part of parts) {
    let rest = part.trim()
    if (!rest) continue
    while (rest.length > maxChars) {
      let cut = rest.lastIndexOf(' ', maxChars)
      if (cut <= 0) cut = maxChars
      out.push(rest.slice(0, cut).trim())
      rest = rest.slice(cut).trim()
    }
    if (rest) out.push(rest)
  }
  return out
}

interface Window {
  start: number
  end: number
  text: string
}

/** Parse edge-tts subtitle output (SRT-flavoured VTT: commas or dots). */
export function parseVtt(content: string): Window[] {
  const windows: Window[] = []
  const blocks = content.replace(/\r/g, '').split('\n\n')
  const pattern = /(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/
  for (const block of blocks) {
    const lines = block.split('\n').map((line) => line.trim()).filter(Boolean)
    if (lines.length === 0) continue
    const match = lines.find((line) => pattern.test(line))
    if (!match) continue
    const parts = pattern.exec(match)
    if (!parts) continue
    const toMs = (h: string, m: string, s: string, milli: string) =>
      Number(h) * 3600000 + Number(m) * 60000 + Number(s) * 1000 + Number(milli)
    const start = toMs(parts[1], parts[2], parts[3], parts[4])
    const end = toMs(parts[5], parts[6], parts[7], parts[8])
    const text = lines[lines.indexOf(match) + 1] ?? ''
    if (text) windows.push({ start, end, text })
  }
  return windows
}

function cuesForWindow(window: Window): Cue[] {
  // Leave slack for word-boundary imbalance so every chunk fits 2 lines.
  const maxChars = MAX_LINE * MAX_LINES - 8
  const clauses = splitClauses(window.text, maxChars)
  if (clauses.length === 0) return []
  const lengths = clauses.map((clause) => clause.length)
  const total = lengths.reduce((sum, value) => sum + value, 0) || 1
  const span = Math.max(window.end - window.start, 300)
  const cues: Cue[] = []
  let accumulated = 0
  let cursor = window.start
  for (let i = 0; i < clauses.length; i += 1) {
    accumulated += lengths[i]
    const end = window.start + Math.round((span * accumulated) / total)
    cues.push({ start: cursor, end: Math.max(end, cursor + 1), text: clauses[i] })
    cursor = end
  }
  return cues
}

function mergeShortCues(cues: Cue[]): Cue[] {
  const out: Cue[] = []
  const maxChars = MAX_LINE * MAX_LINES
  for (const cue of cues) {
    const previous = out[out.length - 1]
    if (previous) {
      const joined = `${previous.text} ${cue.text}`
      const tooShort = cue.end - cue.start < MIN_CUE_MS || previous.end - previous.start < MIN_CUE_MS
      if (tooShort && joined.length <= maxChars && cue.end - previous.start <= MAX_CUE_MS) {
        out[out.length - 1] = { start: previous.start, end: Math.max(previous.end, cue.end), text: joined }
        continue
      }
    }
    out.push({ ...cue })
  }
  return out
}

function fixOverlaps(cues: Cue[], totalMs: number): Cue[] {
  const sorted = [...cues].sort((a, b) => a.start - b.start || a.end - b.end)
  const fixed: Cue[] = []
  for (let i = 0; i < sorted.length; i += 1) {
    const cue = { ...sorted[i] }
    const next = sorted[i + 1]
    if (next && cue.end > next.start) {
      cue.end = next.start - cue.start >= 250 ? next.start - 20 : next.start
    }
    if (totalMs > 0 && cue.end > totalMs) cue.end = totalMs
    if (cue.end - cue.start < 120) cue.end = Math.min(cue.start + 120, totalMs > 0 ? totalMs : cue.start + 120)
    fixed.push(cue)
  }
  return fixed
}

export function buildCues(text: string, windows: Window[], totalMs: number): Cue[] {
  let cues: Cue[] = []
  for (const window of windows) {
    const content = window.text.trim()
    if (content) cues.push(...cuesForWindow({ ...window, text: content }))
  }

  if (cues.length === 0 && totalMs > 0) {
    const maxChars = MAX_LINE * MAX_LINES
    const sentences = text
      .split(/(?<=[.!?…])\s+/)
      .map((sentence) => sentence.trim())
      .filter(Boolean)
    const chunks: string[] = []
    for (const sentence of sentences) chunks.push(...splitClauses(sentence, maxChars))
    const lengths = chunks.map((chunk) => chunk.length)
    const total = lengths.reduce((sum, value) => sum + value, 0) || 1
    let accumulated = 0
    let cursor = 0
    for (let i = 0; i < chunks.length; i += 1) {
      accumulated += lengths[i]
      const end = Math.round((totalMs * accumulated) / total)
      cues.push({ start: cursor, end: Math.max(end, cursor + 1), text: chunks[i] })
      cursor = end
    }
  }

  return fixOverlaps(mergeShortCues(cues), totalMs)
}

export function writeSrt(cues: Cue[], file: string, offsetMs = 0): void {
  const blocks = cues.map((cue, index) => {
    const text = wrapCue(cue.text)
    return `${index + 1}\n${fmtTimestamp(cue.start + offsetMs)} --> ${fmtTimestamp(cue.end + offsetMs)}\n${text}\n`
  })
  fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true })
  fs.writeFileSync(file, blocks.join('\n'), 'utf-8')
}

export function writeVtt(cues: Cue[], file: string, offsetMs = 0): void {
  const blocks = cues.map((cue) => {
    const text = wrapCue(cue.text)
    return `${fmtTimestamp(cue.start + offsetMs, '.')} --> ${fmtTimestamp(cue.end + offsetMs, '.')}\n${text}\n`
  })
  fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true })
  fs.writeFileSync(file, `WEBVTT\n\n${blocks.join('\n')}`, 'utf-8')
}

export interface SynthOptions {
  voice: string
  rate: string
  volume: string
  mp3Path: string
  log: Log
  attempts?: number
}

export async function synthesize(text: string, options: SynthOptions): Promise<NarrationResult> {
  const { voice, rate, volume, mp3Path, log } = options
  const attempts = options.attempts ?? 3
  const textFile = `${mp3Path}.txt`
  const vttPath = `${mp3Path}.vtt`
  fs.mkdirSync(path.dirname(path.resolve(mp3Path)), { recursive: true })
  fs.writeFileSync(textFile, text, 'utf-8')

  const python = pythonBin()
  let lastError = ''
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const result = await run(python, [
      '-m', 'edge_tts',
      '--file', textFile,
      '--voice', voice,
      // `--rate=-4%` needs the `=` form: argparse reads a bare `-4%` as a flag.
      `--rate=${rate}`,
      `--volume=${volume}`,
      '--write-media', mp3Path,
      '--write-subtitles', vttPath,
    ])
    if (result.code === 0 && fs.existsSync(mp3Path) && fs.statSync(mp3Path).size > 0) {
      const durationMs = probeDurationMs(mp3Path) || Math.round((fs.statSync(mp3Path).size / 6000) * 1000)
      const windows = fs.existsSync(vttPath) ? parseVtt(fs.readFileSync(vttPath, 'utf-8')) : []
      const cues = buildCues(text, windows, durationMs)
      return { mp3: mp3Path, vtt: fs.existsSync(vttPath) ? vttPath : null, durationMs, cues }
    }
    lastError = `${result.stdout}\n${result.stderr}`.trim().slice(-300)
    if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, 1200 * attempt))
  }
  throw new Error(`edge-tts falhou após ${attempts} tentativa(s): ${lastError}`)
}
