/**
 * Storyplay-rrweb — shared utilities.
 *
 * Everything here is dependency-free (node builtins only) so the pipeline can
 * preflight itself before Playwright/rrweb are even installed.
 */
import { spawn, spawnSync, type SpawnOptions } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'

export const SKILL_VERSION = '2.0.0'
export const DEFAULT_OUT_ROOT = '.ultraskills/storyplay-rrweb'

/* ------------------------------------------------------------------ logging */

export class Log {
  private lines: string[] = []

  constructor(private readonly quiet = true, private readonly echoWarnings = true) {}

  line(message: string, echo = false): void {
    this.lines.push(`[${new Date().toISOString().slice(11, 19)}] ${message}`)
    if (echo || !this.quiet) console.log(message)
  }

  warn(message: string): void {
    this.lines.push(`[${new Date().toISOString().slice(11, 19)}] AVISO: ${message}`)
    if (this.echoWarnings) console.log(`AVISO: ${message}`)
  }

  error(message: string): void {
    this.lines.push(`[${new Date().toISOString().slice(11, 19)}] ERRO: ${message}`)
    console.error(`ERRO: ${message}`)
  }

  flush(file: string): void {
    try {
      fs.writeFileSync(file, `${this.lines.join('\n')}\n`, 'utf-8')
    } catch {
      /* log is best-effort */
    }
  }
}

/* ------------------------------------------------------------------- process */

export interface RunResult {
  code: number
  stdout: string
  stderr: string
}

export function runSync(cmd: string, args: string[], options: SpawnOptions & { timeoutMs?: number } = {}): RunResult {
  const result = spawnSync(cmd, args, {
    encoding: 'utf-8',
    timeout: options.timeoutMs ?? 20 * 60 * 1000,
    cwd: options.cwd as string | undefined,
    env: options.env as NodeJS.ProcessEnv | undefined,
  })
  return {
    code: result.status ?? (result.error ? 1 : 0),
    stdout: (result.stdout as string) ?? '',
    stderr: (result.stderr as string) ?? (result.error ? String(result.error) : ''),
  }
}

export function run(cmd: string, args: string[], options: SpawnOptions = {}): Promise<RunResult> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { ...options, shell: false })
    let stdout = ''
    let stderr = ''
    child.stdout?.on('data', (chunk) => {
      stdout += String(chunk)
    })
    child.stderr?.on('data', (chunk) => {
      stderr += String(chunk)
    })
    child.on('error', (error) => resolve({ code: 1, stdout, stderr: String(error) }))
    child.on('close', (code) => resolve({ code: code ?? 0, stdout, stderr }))
  })
}

export function tail(text: string, lines = 4): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0)
    .slice(-lines)
}

/* ------------------------------------------------------------------- binaries */

const EXEC_EXTS = process.platform === 'win32' ? ['.exe', '.cmd', '.bat', ''] : ['']

export function resolveBin(name: string): string | null {
  const pathEntries = (process.env.PATH || '').split(path.delimiter).filter(Boolean)
  for (const entry of pathEntries) {
    for (const ext of EXEC_EXTS) {
      const candidate = path.join(entry, `${name}${ext}`)
      if (fs.existsSync(candidate)) return candidate
    }
  }
  if (process.platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA
    if (localAppData) {
      const packages = path.join(localAppData, 'Microsoft', 'WinGet', 'Packages')
      if (fs.existsSync(packages)) {
        for (const pkg of fs.readdirSync(packages)) {
          if (!/ffmpeg/i.test(pkg)) continue
          const found = findFileRecursive(path.join(packages, pkg), `${name}.exe`, 5)
          if (found) return found
        }
      }
    }
  }
  return null
}

export function findFileRecursive(root: string, fileName: string, maxDepth: number): string | null {
  if (maxDepth < 0 || !fs.existsSync(root)) return null
  const entries = fs.readdirSync(root, { withFileTypes: true })
  for (const entry of entries) {
    if (entry.isFile() && entry.name.toLowerCase() === fileName.toLowerCase()) {
      return path.join(root, entry.name)
    }
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const found = findFileRecursive(path.join(root, entry.name), fileName, maxDepth - 1)
    if (found) return found
  }
  return null
}

export function ffmpegBin(): string {
  return resolveBin('ffmpeg') ?? 'ffmpeg'
}

export function ffprobeBin(): string {
  return resolveBin('ffprobe') ?? 'ffprobe'
}

export function probeDurationMs(file: string): number {
  const result = runSync(ffprobeBin(), [
    '-v', 'error', '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1', file,
  ], { timeoutMs: 60000 })
  const value = Number.parseFloat(result.stdout.trim())
  return Number.isFinite(value) ? Math.round(value * 1000) : 0
}

export function pythonBin(): string {
  if (process.env.STORYPLAY_PYTHON) return process.env.STORYPLAY_PYTHON
  return resolveBin(process.platform === 'win32' ? 'python' : 'python3') ?? 'python'
}

/* --------------------------------------------------------------------- paths */

/** Directory of the CLI entry script (works for tsx and node alike). */
export function scriptsDir(): string {
  const entry = process.argv[1]
  if (entry && /\.(ts|js|mjs|cjs)$/i.test(entry)) return path.dirname(path.resolve(entry))
  return process.cwd()
}

export function skillDir(): string {
  return path.resolve(scriptsDir(), '..')
}

export function findUp(startDir: string, relative: string): string | null {
  let dir = path.resolve(startDir)
  for (;;) {
    const candidate = path.join(dir, relative)
    if (fs.existsSync(candidate)) return candidate
    const parent = path.dirname(dir)
    if (parent === dir) return null
    dir = parent
  }
}

/** Local rrweb UMD bundle (installed copy first, pinned CDN as last resort). */
export async function resolveRrwebBundle(log: Log): Promise<string> {
  const candidates = [
    'node_modules/rrweb/dist/rrweb.umd.cjs',
    'node_modules/rrweb/dist/rrweb.umd.min.cjs',
    'node_modules/rrweb/dist/rrweb.cjs',
  ]
  for (const relative of candidates) {
    const found = findUp(scriptsDir(), relative) ?? findUp(process.cwd(), relative)
    if (found) return found
  }
  const fallback = path.join(skillDir(), '.cache', 'rrweb.umd.cjs')
  if (fs.existsSync(fallback)) return fallback
  fs.mkdirSync(path.dirname(fallback), { recursive: true })
  log.warn('bundle local do rrweb não encontrado — baixando do CDN (pine a versão instalando rrweb no projeto)')
  const response = await fetch('https://cdn.jsdelivr.net/npm/rrweb@2.1.4/dist/rrweb.umd.cjs')
  if (!response.ok) throw new Error(`falha ao baixar rrweb do CDN: ${response.status}`)
  fs.writeFileSync(fallback, await response.text(), 'utf-8')
  return fallback
}

export function slugify(value: string): string {
  const slug = (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  return slug || 'video'
}

export function timestamp(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `_${pad(date.getHours())}-${pad(date.getMinutes())}`
  )
}

export function makeRunDir(projectRoot: string, outRoot: string, slug: string): string {
  const base = path.resolve(projectRoot, outRoot)
  let runDir = path.join(base, `${timestamp()}_${slug}`)
  let n = 2
  while (fs.existsSync(runDir)) {
    runDir = path.join(base, `${timestamp()}_${slug}-${n}`)
    n += 1
  }
  fs.mkdirSync(runDir, { recursive: true })
  return runDir
}

export function writeJson(file: string, value: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify(value, null, 2), 'utf-8')
}

export function rmrf(target: string): void {
  try {
    fs.rmSync(target, { recursive: true, force: true })
  } catch {
    /* best effort */
  }
}

/* ------------------------------------------------------------------ rng */

/** Deterministic PRNG (mulberry32) — same storyboard seed => same video. */
export function makeRng(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
