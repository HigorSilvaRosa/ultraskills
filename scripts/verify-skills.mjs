#!/usr/bin/env node
/**
 * Verifica se o repo continua instalável via `npx skills add <owner>/<repo>`.
 *
 * Regras checadas (ver README do vercel-labs/skills):
 *  - NÃO pode existir SKILL.md na raiz: ele ofusca (shadow) a descoberta e o
 *    repositório passa a publicar 1 skill em vez de todas as de .agents/skills/.
 *  - Cada `.agents/skills/<nome>/SKILL.md` precisa de frontmatter com `name` e
 *    `description`, e `name` deve ser igual ao nome da pasta.
 *  - Skills listadas em skills-lock.json são consumidas do upstream e ficam
 *    fora da descoberta (não são redistribuídas por este repo).
 *
 * Uso: pnpm run skills:check
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const container = join(root, '.agents', 'skills')
const errors = []
const warnings = []

function readFrontmatter(file) {
  const text = readFileSync(file, 'utf-8')
  if (!text.startsWith('---')) return null
  const end = text.indexOf('\n---', 3)
  if (end === -1) return null
  const block = text.slice(3, end)
  const field = (key) => {
    const match = new RegExp(`^${key}:\\s*(.+)$`, 'm').exec(block)
    if (!match) return null
    return match[1].trim().replace(/^["']|["']$/g, '')
  }
  return { name: field('name'), description: field('description'), block }
}

if (existsSync(join(root, 'SKILL.md'))) {
  errors.push(
    'SKILL.md na raiz do repo: use `npx skills add . --list` para conferir — ele ofusca .agents/skills/** e publica apenas 1 skill.'
  )
}

if (!existsSync(container)) {
  errors.push('pasta .agents/skills/ não encontrada')
}

const dirs = existsSync(container)
  ? readdirSync(container).filter((entry) => statSync(join(container, entry)).isDirectory())
  : []

const lock = existsSync(join(root, 'skills-lock.json'))
  ? JSON.parse(readFileSync(join(root, 'skills-lock.json'), 'utf-8'))
  : { skills: {} }
const consumed = new Set(Object.keys(lock.skills ?? {}))

const published = []
for (const dir of dirs.sort()) {
  const skillFile = join(container, dir, 'SKILL.md')
  if (!existsSync(skillFile)) {
    errors.push(`${dir}/SKILL.md ausente`)
    continue
  }
  const fm = readFrontmatter(skillFile)
  if (!fm) {
    errors.push(`${dir}/SKILL.md sem frontmatter YAML`)
    continue
  }
  if (!fm.name) errors.push(`${dir}/SKILL.md sem "name"`)
  if (!fm.description) errors.push(`${dir}/SKILL.md sem "description"`)
  if (fm.name && fm.name !== dir) {
    errors.push(`${dir}/SKILL.md: name "${fm.name}" difere da pasta "${dir}"`)
  }
  if (fm.description && fm.description.length < 40 && !consumed.has(dir)) {
    warnings.push(`${dir}: description curta (${fm.description.length} chars) — piora o trigger do agente`)
  }
  if (fm.description && /^[>|]/.test(fm.description)) {
    warnings.push(`${dir}: description em bloco multi-linha — o CLI espera uma linha`)
  }

  const nested = readdirSync(join(container, dir), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join(container, dir, entry.name, 'SKILL.md')))
    .map((entry) => entry.name)
  if (nested.length && !consumed.has(dir)) {
    warnings.push(`${dir}: SKILL.md aninhado em ${nested.join(', ')} (descoberto como skill separada)`)
  }

  published.push({ dir, name: fm.name ?? dir, consumed: consumed.has(dir) })
}

const offered = published.filter((skill) => !skill.consumed)
const upstream = published.filter((skill) => skill.consumed)

console.log(`repo: ${relative(process.cwd(), root) || '.'}`)
console.log(`publicadas via \`npx skills add\` (${offered.length}): ${offered.map((s) => s.name).join(', ')}`)
if (upstream.length) {
  console.log(`consumidas do upstream, fora da descoberta (${upstream.length}): ${upstream.map((s) => s.name).join(', ')}`)
}
for (const warning of warnings) console.log(`AVISO: ${warning}`)
for (const error of errors) console.error(`ERRO: ${error}`)

if (errors.length) process.exit(1)
console.log('OK: repo compatível com `npx skills add <owner>/<repo>`')
