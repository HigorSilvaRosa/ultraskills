/**
 * Storyplay-rrweb — module 2: the math/pacing processor.
 *
 * Guarantees, in order of importance:
 *  1. Narration sync: each scene's replay span is stretched (natural dwell/hold)
 *     or gently compressed to match its narration, so audio and subtitles line
 *     up by construction. Leftover slack becomes silence at the scene tail.
 *  2. No ghost cursors: the raw MouseMove stream produced by Playwright is
 *     dropped and re-synthesized as one Bézier arc per click, with the
 *     mousedown/mouseup/click gesture kept coherent (the press feedback happens
 *     after the pointer arrives — exactly like a human).
 *  3. Frame-exact prep trim for free: everything before the first scene marker
 *     is discarded (browser start, first load, hydration, prep).
 *  4. Deterministic: same seed + same capture => same cinematic timeline.
 */
import * as fs from 'fs'
import * as path from 'path'
import { Log, makeRng, writeJson } from './util'

export const EventType = {
  DomContentLoaded: 0,
  Load: 1,
  FullSnapshot: 2,
  IncrementalSnapshot: 3,
  Meta: 4,
  Custom: 5,
} as const

export const IncrementalSource = {
  Mutation: 0,
  MouseMove: 1,
  MouseInteraction: 2,
  Scroll: 3,
  ViewportResize: 4,
  Input: 5,
} as const

export const MouseInteractions = {
  MouseUp: 0,
  MouseDown: 1,
  Click: 2,
  ContextMenu: 3,
  DblClick: 4,
  Focus: 5,
  Blur: 6,
} as const

export const SCENE_TAG = 'storyplay/scene'

export interface RRWebEvent {
  type: number
  data?: Record<string, unknown>
  timestamp: number
}

export interface SceneSpan {
  id: string
  title?: string
  index: number
  start: number
  span: number
  narrationMs: number
  naturalMs: number
  clicks: number
  tempo: number
  paddingMs: number
}

export interface CinematicTimeline {
  totalMs: number
  fps: number
  width: number
  height: number
  scenes: SceneSpan[]
  warnings: string[]
}

export interface CinematicLog {
  events: RRWebEvent[]
  timeline: CinematicTimeline
}

export interface SceneNarration {
  id: string
  narrationMs: number
  title?: string
}

export interface ProcessOptions {
  rawJson: string
  outJson: string
  narrations: SceneNarration[]
  width: number
  height: number
  fps: number
  seed: number
  log: Log
}

interface Point {
  x: number
  y: number
}

interface ClickGroup {
  members: number[]   // indices into the rebased event array (down, [up], click)
  startTs: number     // rebased timestamp of the first member
  target: Point
  nodeId: number
}

/* --------------------------------------------------------------- geometry */

export function easeInOutCubic(x: number): number {
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2
}

/** Slightly arced cubic Bézier between two points (organic, never robotic). */
export function bezierPoint(from: Point, to: Point, t: number, bendFactor: number): Point {
  const u = easeInOutCubic(t)
  const dx = to.x - from.x
  const dy = to.y - from.y
  const distance = Math.hypot(dx, dy) || 1
  const nx = -dy / distance
  const ny = dx / distance
  const c1 = { x: from.x + dx * 0.32 + nx * bendFactor, y: from.y + dy * 0.32 + ny * bendFactor }
  const c2 = { x: from.x + dx * 0.74 + nx * bendFactor * 0.35, y: from.y + dy * 0.74 + ny * bendFactor * 0.35 }
  const iu = 1 - u
  const x = iu ** 3 * from.x + 3 * iu ** 2 * u * c1.x + 3 * iu * u ** 2 * c2.x + u ** 3 * to.x
  const y = iu ** 3 * from.y + 3 * iu ** 2 * u * c1.y + 3 * iu * u ** 2 * c2.y + u ** 3 * to.y
  return { x: Math.round(x), y: Math.round(y) }
}

/** Travel time: fast enough to feel purposeful, slow enough to read. */
export function travelDuration(distance: number): number {
  return Math.round(Math.min(880, Math.max(300, distance / 1.15)))
}

/* ------------------------------------------------------------- extraction */

function isMouseInteraction(event: RRWebEvent): boolean {
  return event.type === EventType.IncrementalSnapshot && event.data?.source === IncrementalSource.MouseInteraction
}

function interactionType(event: RRWebEvent): number {
  return Number(event.data?.type ?? -1)
}

function eventPoint(event: RRWebEvent): Point | null {
  const x = event.data?.x
  const y = event.data?.y
  if (typeof x !== 'number' || typeof y !== 'number') return null
  return { x, y }
}

/**
 * Group each Click with its MouseDown/MouseUp (and the Focus/Blur in between)
 * into ONE gesture, so the press feedback is shifted together with the travel.
 *
 * The scans deliberately *skip* non-mouse events (DOM mutations are interleaved
 * all the time) and are bounded by time, not by event count.
 */
export function findClickGroups(events: RRWebEvent[]): Map<number, ClickGroup> {
  const groups = new Map<number, ClickGroup>()
  const claimed = new Set<number>()
  const isClickLike = (event: RRWebEvent) =>
    isMouseInteraction(event) &&
    (interactionType(event) === MouseInteractions.Click || interactionType(event) === MouseInteractions.DblClick)

  for (let i = 0; i < events.length; i += 1) {
    const event = events[i]
    if (!isClickLike(event) || claimed.has(i)) continue
    const point = eventPoint(event)
    if (!point) continue

    const clickTs = event.timestamp
    let downIdx = -1
    let upIdx = -1

    // backward: nearest mouseup and mousedown before the click (<= 700ms)
    for (let back = i - 1; back >= 0; back -= 1) {
      const candidate = events[back]
      if (clickTs - candidate.timestamp > 700) break
      if (!isMouseInteraction(candidate)) continue
      if (claimed.has(back)) continue
      const type = interactionType(candidate)
      if (type === MouseInteractions.MouseUp && upIdx < 0) upIdx = back
      else if (type === MouseInteractions.MouseDown && downIdx < 0) {
        downIdx = back
        break
      }
    }
    // forward: the mouseup may have been recorded after the click (rare)
    if (upIdx < 0) {
      for (let next = i + 1; next < events.length; next += 1) {
        const candidate = events[next]
        if (candidate.timestamp - clickTs > 400) break
        if (!isMouseInteraction(candidate)) continue
        if (claimed.has(next)) continue
        if (interactionType(candidate) === MouseInteractions.MouseUp) {
          upIdx = next
          break
        }
      }
    }

    const members = [downIdx, upIdx, i].filter((index) => index >= 0)
    const min = Math.min(...members)
    const max = Math.max(...members)
    // absorb focus/blur inside the gesture window so they keep the same shift
    for (let between = min + 1; between < max; between += 1) {
      const candidate = events[between]
      if (!isMouseInteraction(candidate)) continue
      const type = interactionType(candidate)
      if ((type === MouseInteractions.Focus || type === MouseInteractions.Blur) && !claimed.has(between)) {
        members.push(between)
      }
    }
    members.sort((a, b) => a - b)
    for (const member of members) claimed.add(member)
    groups.set(members[0], {
      members,
      startTs: events[members[0]].timestamp,
      target: point,
      nodeId: Number(event.data?.id ?? 0),
    })
  }

  return groups
}

/* -------------------------------------------------------------- processing */

export function processCinematic(options: ProcessOptions): CinematicLog {
  const { rawJson, outJson, narrations, width, height, fps, log } = options
  const rnd = makeRng(options.seed)
  const frameMs = 1000 / Math.max(fps, 12)
  const raw = JSON.parse(fs.readFileSync(rawJson, 'utf-8')) as RRWebEvent[]
  if (!Array.isArray(raw) || raw.length === 0) throw new Error('nenhum evento rrweb no capture')

  const warnings: string[] = []

  const markers = raw
    .filter((event) => event.type === EventType.Custom && (event.data as { tag?: string })?.tag === SCENE_TAG)
    .map((event) => {
      const payload = (event.data as { payload?: { id?: string; index?: number; title?: string } })?.payload ?? {}
      return {
        id: String(payload.id ?? ''),
        index: Number(payload.index ?? 0),
        title: payload.title,
        timestamp: event.timestamp,
      }
    })

  if (markers.length === 0) throw new Error('capture sem marcadores de cena (storyplay/scene)')

  const firstTs = markers[0].timestamp
  const narrationById = new Map(narrations.map((item) => [item.id, item]))

  // Frame-exact prep trim: drop everything before the first marker, rebase to 0.
  const kept = raw
    .filter((event) => event.timestamp >= firstTs)
    .map((event) => ({ ...event, timestamp: event.timestamp - firstTs }))

  const indexOf = new Map<RRWebEvent, number>()
  kept.forEach((event, index) => indexOf.set(event, index))

  // The Replayer needs a Meta event (viewport size) before the first snapshot.
  // It is kept from the raw log and parked at -1 so it never shifts the timeline.
  const meta = raw.find((event) => event.type === EventType.Meta)
  if (meta) {
    kept.unshift({ ...meta, timestamp: -1 })
    indexOf.clear()
    kept.forEach((event, index) => indexOf.set(event, index))
  } else {
    warnings.push('capture sem evento Meta do rrweb (tamanho do viewport pode sair errado)')
  }

  const groups = findClickGroups(kept)
  const memberOf = new Map<number, number>()
  for (const [first, group] of groups) group.members.forEach((member) => memberOf.set(member, first))

  const boundaries: number[] = markers.map((marker) => marker.timestamp - firstTs)
  boundaries.push(Number.POSITIVE_INFINITY)

  const output: RRWebEvent[] = []
  const sceneSpans: SceneSpan[] = []
  let sceneStartFinal = 0
  let pointer: Point = { x: 90, y: 90 }

  for (let sceneIndex = 0; sceneIndex < markers.length; sceneIndex += 1) {
    const localStart = boundaries[sceneIndex]
    const localEnd = boundaries[sceneIndex + 1]
    const sceneEvents = kept.filter((event) => event.timestamp >= localStart && event.timestamp < localEnd)
    const sceneId = markers[sceneIndex].id
    const narration = narrationById.get(sceneId)
    if (!narration) warnings.push(`cena ${sceneId}: sem narração (span = duração natural)`)

    // ---- 1. plan the gestures of this scene -----------------------------
    const plans: {
      group: ClickGroup
      startPos: Point
      travel: number
      dwell: number
      bend: number
    }[] = []
    const plansByFirst = new Map<number, (typeof plans)[number]>()

    for (const event of sceneEvents) {
      const absolute = indexOf.get(event)
      if (absolute === undefined) continue
      const group = groups.get(absolute)
      if (!group) continue
      const distance = Math.hypot(group.target.x - pointer.x, group.target.y - pointer.y)
      const plan = {
        group,
        startPos: { ...pointer },
        travel: travelDuration(distance),
        dwell: Math.round(140 + rnd() * 260),
        bend: Math.min(46, distance * 0.09) * (rnd() < 0.5 ? -1 : 1),
      }
      pointer = { ...group.target }
      plans.push(plan)
      plansByFirst.set(absolute, plan)
    }

    const rawSpan = Math.max(0, (sceneEvents[sceneEvents.length - 1]?.timestamp ?? localStart) - localStart)
    const gestureBudget = plans.reduce((sum, plan) => sum + plan.travel + plan.dwell, 0)
    const minTail = 420
    const target = narration?.narrationMs ?? 0
    const baseSpan = rawSpan + gestureBudget + minTail

    let tempo = 1
    let extraDwell = 0
    let tailHold = minTail
    if (target > 0) {
      if (target >= baseSpan) {
        // Slack becomes human dwell (bounded so the cursor never looks frozen)
        // and the rest becomes a closing hold on the last frame.
        const slack = target - baseSpan
        extraDwell = Math.min(650, Math.floor(slack / Math.max(1, plans.length) * 0.6))
        tailHold = minTail + (slack - extraDwell * plans.length)
      } else {
        // Narration shorter than the replay: compress dead time between gestures
        // (never the gesture itself) down to 40% before accepting an overshoot.
        const available = target - gestureBudget - minTail
        tempo = Math.max(0.4, Math.min(1, available / Math.max(rawSpan, 1)))
        tailHold = Math.max(minTail, target - gestureBudget - rawSpan * tempo)
      }
    }

    // ---- 2. transform the events of this scene --------------------------
    let shift = 0
    let cursorLocal = 0
    const transform = (rawTs: number) => (rawTs - localStart) * tempo

    for (const event of sceneEvents) {
      const absolute = indexOf.get(event)
      const firstMember = absolute === undefined ? undefined : memberOf.get(absolute)

      if (firstMember !== undefined) {
        if (absolute !== firstMember) continue // already emitted with its gesture
        const plan = plansByFirst.get(firstMember)
        if (!plan) continue

        const rawGroupStart = transform(plan.group.startTs) + shift
        const downTs = Math.max(
          rawGroupStart + plan.travel + plan.dwell + extraDwell,
          cursorLocal + plan.travel + plan.dwell + extraDwell
        )
        const moveEnd = downTs - plan.dwell - extraDwell
        const moveStart = Math.max(cursorLocal, moveEnd - plan.travel)
        const frames = Math.max(10, Math.round((moveEnd - moveStart) / frameMs))

        for (let frame = 0; frame <= frames; frame += 1) {
          const t = frame / frames
          const point = bezierPoint(plan.startPos, plan.group.target, t, plan.bend)
          output.push({
            type: EventType.IncrementalSnapshot,
            data: {
              source: IncrementalSource.MouseMove,
              positions: [{ x: point.x, y: point.y, id: plan.group.nodeId, timeOffset: 0 }],
            },
            timestamp: Math.round(sceneStartFinal + moveStart + ((moveEnd - moveStart) * frame) / frames),
          })
        }

        const lastMember = plan.group.members[plan.group.members.length - 1]
        for (const member of plan.group.members) {
          const memberEvent = kept[member]
          const local = downTs + (memberEvent.timestamp - plan.group.startTs)
          output.push({ ...memberEvent, timestamp: Math.round(sceneStartFinal + local) })
        }

        shift += downTs - rawGroupStart
        cursorLocal = downTs + (kept[lastMember].timestamp - plan.group.startTs)
        continue
      }

      // Raw MouseMove events (Playwright's instant jumps) are replaced by the
      // synthesized Bézier arcs above — never re-emit them (ghost cursor).
      if (event.type === EventType.IncrementalSnapshot && event.data?.source === IncrementalSource.MouseMove) continue

      const local = transform(event.timestamp) + shift
      output.push({ ...event, timestamp: Math.round(sceneStartFinal + local) })
      cursorLocal = Math.max(cursorLocal, local)
    }

    // ---- 3. the scene span (what the audio and subtitles align to) -------
    const naturalMs = Math.max(cursorLocal, rawSpan * tempo + gestureBudget)
    const span = target > 0 ? Math.max(target, naturalMs + 120) : naturalMs + minTail
    if (target > 0 && naturalMs > target) {
      warnings.push(
        `cena ${sceneId}: replay ${(naturalMs / 1000).toFixed(1)}s > narração ${(target / 1000).toFixed(1)}s ` +
          `(silêncio no fim da cena; encurte as ações ou alongue o texto)`
      )
    }
    sceneSpans.push({
      id: sceneId,
      title: markers[sceneIndex].title,
      index: sceneIndex,
      start: Math.round(sceneStartFinal),
      span: Math.round(span),
      narrationMs: Math.round(target),
      naturalMs: Math.round(naturalMs),
      clicks: plans.length,
      tempo: Number(tempo.toFixed(3)),
      paddingMs: Math.round(Math.max(0, span - (target || naturalMs))),
    })
    sceneStartFinal += span
  }

  output.sort((a, b) => a.timestamp - b.timestamp)

  const timeline: CinematicTimeline = {
    totalMs: Math.round(sceneStartFinal),
    fps,
    width,
    height,
    scenes: sceneSpans,
    warnings,
  }

  writeJson(outJson, { events: output, timeline })
  log.line(
    `processor: ${output.length} eventos, ${sceneSpans.length} cenas, ` +
      `${(timeline.totalMs / 1000).toFixed(1)}s @ ${fps}fps`,
    true
  )
  for (const warning of warnings) log.warn(warning)

  return { events: output, timeline }
}

/* --------------------------------------------------------------------- CLI */

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const rawJson = args[0] ?? 'raw.json'
  const outJson = args[1] ?? 'cinematic.json'
  const narrationsFile = args[2]
  const log = new Log(false)
  const narrations: SceneNarration[] = narrationsFile && fs.existsSync(narrationsFile)
    ? (JSON.parse(fs.readFileSync(narrationsFile, 'utf-8')) as SceneNarration[])
    : []
  processCinematic({
    rawJson,
    outJson,
    narrations,
    width: 1600,
    height: 900,
    fps: 30,
    seed: 0x9e3779b9,
    log,
  })
  log.flush(path.join(path.dirname(path.resolve(outJson)), 'processor.log'))
}

if (process.argv[1] && /processor\.(ts|js)$/i.test(process.argv[1])) {
  void main()
}
