/**
 * Storyplay-rrweb — dependency preflight.
 *
 * Never installs anything unless explicitly asked (`--install-deps`), which the
 * agent must only use after the user confirms. `--check-deps` prints a compact
 * report (or JSON) with the exact commands.
 */
import * as fs from 'fs'
import * as path from 'path'
import {
  Log, findUp, pythonBin, resolveBin, run, runSync, scriptsDir, skillDir, tail,
} from './util'

export interface DepCheck {
  ok: boolean
  detail: string
}

export interface InstallStep {
  cmd: string[]
  cwd?: string
}

export interface DepReport {
  ok: boolean
  checks: Record<string, DepCheck>
  install: Record<string, InstallStep>
}

export class MissingDepsError extends Error {
  constructor(readonly report: DepReport) {
    super('dependências ausentes')
  }
}

function installCommands(): Record<string, InstallStep> {
  const platform = process.platform
  const ffmpegCmd =
    platform === 'win32'
      ? ['winget', 'install', 'Gyan.FFmpeg', '--silent', '--accept-source-agreements', '--accept-package-agreements']
      : platform === 'darwin'
        ? ['brew', 'install', 'ffmpeg']
        : ['sudo', 'apt-get', 'install', '-y', 'ffmpeg']

  return {
    ffmpeg: { cmd: ffmpegCmd },
    edge_tts: { cmd: [pythonBin(), '-m', 'pip', 'install', '--upgrade', 'edge-tts'] },
    playwright: { cmd: ['pnpm', 'add', 'playwright', 'rrweb'], cwd: skillDir() },
    chromium: { cmd: ['npx', 'playwright', 'install', 'chromium'], cwd: skillDir() },
  }
}

async function chromiumExecutable(): Promise<string | null> {
  try {
    const mod = (await import('playwright')) as typeof import('playwright')
    const executable = mod.chromium.executablePath()
    return executable && fs.existsSync(executable) ? executable : null
  } catch {
    return null
  }
}

export async function checkDeps(): Promise<DepReport> {
  const checks: Record<string, DepCheck> = {}

  for (const binary of ['ffmpeg', 'ffprobe']) {
    const found = resolveBin(binary)
    checks[binary] = { ok: Boolean(found), detail: found ?? 'não encontrado no PATH' }
  }

  const python = pythonBin()
  const pythonProbe = runSync(python, ['-c', 'import edge_tts, sys; print(edge_tts.__version__ if hasattr(edge_tts, "__version__") else "ok")'], {
    timeoutMs: 60000,
  })
  checks.edge_tts = {
    ok: pythonProbe.code === 0,
    detail: pythonProbe.code === 0
      ? `${python} (edge-tts ${pythonProbe.stdout.trim() || 'ok'})`
      : `${python}: edge-tts ausente`,
  }

  const playwrightPkg = findUp(scriptsDir(), 'node_modules/playwright/package.json')
  const rrwebPkg = findUp(scriptsDir(), 'node_modules/rrweb/package.json')
  checks.playwright = {
    ok: Boolean(playwrightPkg),
    detail: playwrightPkg ? path.dirname(path.dirname(playwrightPkg)) : 'pacote playwright não instalado',
  }
  checks.rrweb = {
    ok: Boolean(rrwebPkg),
    detail: rrwebPkg ? path.dirname(path.dirname(rrwebPkg)) : 'pacote rrweb não instalado',
  }

  const chromium = await chromiumExecutable()
  checks.chromium = {
    ok: Boolean(chromium),
    detail: chromium ?? 'chromium do Playwright não instalado (npx playwright install chromium)',
  }

  return {
    ok: Object.values(checks).every((check) => check.ok),
    checks,
    install: installCommands(),
  }
}

export function printDepReport(report: DepReport, asJson: boolean): void {
  if (asJson) {
    console.log(JSON.stringify(report, null, 2))
    return
  }
  const missing = Object.entries(report.checks).filter(([, check]) => !check.ok).map(([name]) => name)
  if (missing.length === 0) {
    console.log(`deps OK: ${Object.keys(report.checks).join(', ')}`)
    return
  }
  console.log(`deps AUSENTES: ${missing.join(', ')}`)
  for (const name of missing) {
    const step = report.install[name]
    if (step) console.log(`  ${name}: ${step.cmd.join(' ')}${step.cwd ? `   (cwd: ${step.cwd})` : ''}`)
  }
}

export async function installDeps(report: DepReport, log: Log): Promise<void> {
  const missing = Object.entries(report.checks).filter(([, check]) => !check.ok).map(([name]) => name)
  for (const name of missing) {
    const step = report.install[name] ?? report.install[name === 'ffprobe' ? 'ffmpeg' : name]
    if (!step) continue
    log.line(`instalando ${name}: ${step.cmd.join(' ')}`, true)
    const result = await run(step.cmd[0], step.cmd.slice(1), { cwd: step.cwd ?? process.cwd() })
    for (const line of tail(`${result.stdout}\n${result.stderr}`, 4)) log.line(`  ${line}`)
    if (result.code !== 0) log.error(`instalação de ${name} falhou (exit ${result.code})`)
  }
}

export async function ensureDeps(options: { install: boolean; log: Log }): Promise<DepReport> {
  let report = await checkDeps()
  if (report.ok) return report
  if (!options.install) return report
  await installDeps(report, options.log)
  report = await checkDeps()
  return report
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const asJson = args.includes('--json')
  const install = args.includes('--install-deps')
  const log = new Log(true)
  const report = await ensureDeps({ install, log })
  printDepReport(report, asJson)
  process.exit(report.ok ? 0 : 4)
}

if (process.argv[1] && /preflight\.(ts|js)$/i.test(process.argv[1])) {
  void main()
}
