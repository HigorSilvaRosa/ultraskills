/**
 * Storyplay-rrweb — declarative storyboard.
 *
 * The agent only writes ONE json file per video: scenes with narration + a
 * small action grammar. No TypeScript per run => token-cheap and reviewable.
 */
import * as fs from 'fs'
import * as path from 'path'

export interface ScrollSpec {
  to?: number
  by?: number
}

export interface FillSpec {
  target: string
  text: string
}

export interface Action {
  goto?: string
  click?: string
  hover?: string
  fill?: FillSpec
  press?: string
  type?: string
  scroll?: number | ScrollSpec
  scrollTo?: string
  wait?: number
  expect?: string
}

export interface Scene {
  id: string
  title?: string
  narration: string
  url?: string
  prep?: Action[]
  actions?: Action[]
  holdMs?: number
}

export interface Storyboard {
  slug: string
  title?: string
  baseUrl: string
  width: number
  height: number
  fps: number
  voice: string
  rate: string
  volume: string
  seed: number
  recordCanvas: boolean
  scenes: Scene[]
}

const ACTION_KEYS = ['goto', 'click', 'hover', 'fill', 'press', 'type', 'scroll', 'scrollTo', 'wait', 'expect']

export function loadStoryboard(file: string): Storyboard {
  const raw = JSON.parse(fs.readFileSync(file, 'utf-8')) as Partial<Storyboard>
  const errors: string[] = []

  if (!raw.scenes || !Array.isArray(raw.scenes) || raw.scenes.length === 0) {
    errors.push('"scenes" deve ser um array não vazio')
  }
  const scenes = (raw.scenes ?? []) as Scene[]
  const seen = new Set<string>()

  scenes.forEach((scene, index) => {
    if (!scene.id) errors.push(`scenes[${index}]: "id" obrigatório`)
    else if (seen.has(scene.id)) errors.push(`scenes[${index}]: id duplicado "${scene.id}"`)
    else seen.add(scene.id)
    if (!scene.narration || !scene.narration.trim()) {
      errors.push(`scenes[${index}] (${scene.id ?? '?'}): "narration" obrigatória`)
    }
    for (const [phase, list] of [['prep', scene.prep], ['actions', scene.actions]] as const) {
      if (!list) continue
      if (!Array.isArray(list)) {
        errors.push(`scenes[${index}].${phase} deve ser um array`)
        continue
      }
      list.forEach((action, actionIndex) => {
        const keys = Object.keys(action ?? {})
        if (keys.length !== 1 || !ACTION_KEYS.includes(keys[0])) {
          errors.push(
            `scenes[${index}].${phase}[${actionIndex}]: use exatamente uma ação por item ` +
              `(disponíveis: ${ACTION_KEYS.join(', ')}) — recebido: ${JSON.stringify(action)}`
          )
        }
      })
    }
  })

  if (errors.length) {
    throw new Error(`storyboard inválido (${path.basename(file)}):\n  - ${errors.join('\n  - ')}`)
  }

  return {
    slug: raw.slug ?? path.basename(file, path.extname(file)),
    title: raw.title,
    baseUrl: raw.baseUrl ?? 'http://localhost:3000',
    width: raw.width ?? 1600,
    height: raw.height ?? 900,
    fps: raw.fps ?? 30,
    voice: raw.voice ?? 'pt-BR-FranciscaNeural',
    rate: raw.rate ?? '-4%',
    volume: raw.volume ?? '+0%',
    seed: raw.seed ?? 0x9e3779b9,
    recordCanvas: raw.recordCanvas ?? false,
    scenes,
  }
}

export function findStoryboard(projectRoot: string, slug: string, explicit?: string): string {
  if (explicit) return path.resolve(explicit)
  const candidates = [
    path.join(projectRoot, '.ultraskills', 'storyplay-rrweb', 'storyboards', `${slug}.json`),
    path.join(projectRoot, 'e2e', 'evidence', slug, 'rrweb-storyboard.json'),
    path.join(projectRoot, 'e2e', 'evidence', slug, 'storyboard.json'),
    path.join(projectRoot, `${slug}.rrweb.json`),
  ]
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate
  }
  throw new Error(
    `storyboard não encontrado para "${slug}". Procurado em:\n  - ${candidates.join('\n  - ')}`
  )
}
