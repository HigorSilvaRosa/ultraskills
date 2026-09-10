/**
 * Storyplay-rrweb — module 1: capture.
 *
 * Runs the storyboard's declarative actions in a real headless Chromium with
 * rrweb attached, humanizing every interaction (arc cursor travel, press/release
 * dwell, per-character typing rhythm, eased wheel scrolling). Scene boundaries
 * are marked inside the event stream as rrweb Custom events, so the processor
 * can build an exact scene timeline (and discard the pre-scene warm-up).
 */
import { chromium, type Browser, type BrowserContext, type Locator, type Page } from 'playwright'
import * as fs from 'fs'
import * as path from 'path'
import { loadStoryboard, type Action, type Scene, type Storyboard } from './storyboard'
import { Log, makeRng, resolveRrwebBundle, writeJson } from './util'

export interface CaptureResult {
  rawJson: string
  events: number
  scenes: { id: string; index: number; marked: boolean }[]
}

/* ------------------------------------------------------------ human pointer */

class Human {
  private pointer = { x: 60, y: 60 }
  private readonly rnd: () => number

  constructor(private readonly page: Page, seed: number) {
    this.rnd = makeRng(seed)
  }

  private jitter(min: number, max: number): number {
    return Math.round(min + this.rnd() * Math.max(0, max - min))
  }

  async pause(min = 220, max = 520): Promise<void> {
    await this.page.waitForTimeout(this.jitter(min, max))
  }

  private ease(t: number): number {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
  }

  async moveTo(x: number, y: number): Promise<void> {
    const from = { ...this.pointer }
    const distance = Math.hypot(x - from.x, y - from.y)
    const steps = Math.max(14, Math.min(38, Math.round(distance / 16)))
    const bend = Math.min(60, distance * 0.1) * (this.rnd() < 0.5 ? -1 : 1)
    const nx = distance === 0 ? 1 : (y - from.y) / distance
    const ny = distance === 0 ? 0 : (x - from.x) / distance
    const c1 = { x: from.x + (x - from.x) * 0.3 + nx * bend, y: from.y + (y - from.y) * 0.3 + ny * bend }
    const c2 = { x: from.x + (x - from.x) * 0.72 + nx * bend * 0.35, y: from.y + (y - from.y) * 0.72 + ny * bend * 0.35 }
    for (let i = 1; i <= steps; i += 1) {
      const u = this.ease(i / steps)
      const iu = 1 - u
      const px = iu ** 3 * from.x + 3 * iu ** 2 * u * c1.x + 3 * iu * u ** 2 * c2.x + u ** 3 * x
      const py = iu ** 3 * from.y + 3 * iu ** 2 * u * c1.y + 3 * iu * u ** 2 * c2.y + u ** 3 * y
      await this.page.mouse.move(px, py)
      await this.page.waitForTimeout(this.jitter(7, 15))
    }
    this.pointer = { x, y }
  }

  /**
   * Brings the element into view using *recorded* scrolling.
   *
   * `locator.scrollIntoViewIfNeeded()` scrolls through CDP without producing a
   * scroll event rrweb can replay, so clicks would land on the wrong layout in
   * the final video. Wheel scrolling is both faithful and human.
   */
  private async ensureVisible(locator: Locator): Promise<void> {
    const viewport = this.page.viewportSize() ?? { width: 1440, height: 810 }
    const margin = Math.round(viewport.height * 0.18)
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const box = await locator.boundingBox()
      if (!box) return
      let delta = 0
      if (box.y < margin) delta = box.y - margin
      else if (box.y + box.height > viewport.height - margin) {
        delta = box.y + box.height - (viewport.height - margin)
      }
      if (Math.abs(delta) < 6) return
      await this.scrollBy(delta)
    }
    // Last resort for inner scroll containers (not recorded by rrweb).
    await locator.scrollIntoViewIfNeeded().catch(() => undefined)
    await this.pause(150, 320)
  }

  private async targetPoint(locator: Locator): Promise<{ x: number; y: number } | null> {
    await this.ensureVisible(locator)
    const box = await locator.boundingBox()
    if (!box) return null
    return {
      x: box.x + box.width * (0.38 + this.rnd() * 0.24),
      y: box.y + box.height * (0.38 + this.rnd() * 0.24),
    }
  }

  async click(selector: string): Promise<void> {
    const locator = this.page.locator(selector).first()
    await locator.waitFor({ state: 'visible', timeout: 15000 })
    const point = await this.targetPoint(locator)
    if (!point) {
      await locator.click()
      return
    }
    await this.moveTo(point.x, point.y)
    await this.pause(110, 300)
    await this.page.mouse.down()
    await this.page.waitForTimeout(this.jitter(45, 95))
    await this.page.mouse.up()
  }

  async hover(selector: string): Promise<void> {
    const locator = this.page.locator(selector).first()
    await locator.waitFor({ state: 'visible', timeout: 15000 })
    const point = await this.targetPoint(locator)
    if (!point) return
    await this.moveTo(point.x, point.y)
    await this.pause(160, 380)
  }

  async fill(selector: string, text: string): Promise<void> {
    const locator = this.page.locator(selector).first()
    await this.click(selector)
    const current = await locator.inputValue().catch(() => '')
    if (current) {
      await this.page.keyboard.press('Control+A')
      await this.pause(60, 140)
    }
    for (let i = 0; i < text.length; i += 1) {
      await this.page.keyboard.type(text[i])
      const isBreak = text[i] === ' ' || text[i] === ',' || text[i] === '.'
      await this.page.waitForTimeout(
        isBreak ? this.jitter(140, 250) : i < 2 ? this.jitter(110, 180) : this.jitter(50, 120)
      )
    }
  }

  async press(key: string): Promise<void> {
    await this.page.keyboard.press(key)
    await this.pause(200, 420)
  }

  async type(text: string): Promise<void> {
    for (let i = 0; i < text.length; i += 1) {
      await this.page.keyboard.type(text[i])
      await this.page.waitForTimeout(text[i] === ' ' ? this.jitter(130, 240) : this.jitter(50, 120))
    }
  }

  async scrollBy(deltaY: number): Promise<void> {
    const total = Math.round(deltaY)
    const steps = Math.max(5, Math.min(16, Math.round(Math.abs(total) / 120)))
    let done = 0
    for (let i = 1; i <= steps; i += 1) {
      const target = Math.round(total * this.ease(i / steps))
      const step = target - done
      if (step !== 0) {
        await this.page.mouse.wheel(0, step)
        done = target
      }
      await this.page.waitForTimeout(this.jitter(26, 70))
    }
  }

  async scrollTo(absoluteY: number): Promise<void> {
    const current = (await this.page.evaluate('window.scrollY')) as number
    await this.scrollBy(absoluteY - current)
  }

  async scrollToSelector(selector: string): Promise<void> {
    const locator = this.page.locator(selector).first()
    await locator.waitFor({ state: 'visible', timeout: 15000 })
    await this.ensureVisible(locator)
    await this.pause(200, 420)
  }

  async settle(): Promise<void> {
    await this.page.waitForLoadState('networkidle').catch(() => undefined)
    await this.page.waitForTimeout(this.jitter(180, 360))
    await this.page
      .evaluate(
        'new Promise(function (resolve) { requestAnimationFrame(function () { requestAnimationFrame(function () { resolve(true) }) }) })'
      )
      .catch(() => undefined)
  }
}

/* --------------------------------------------------------------- actions */

function resolveUrl(target: string, baseUrl: string): string {
  try {
    return new URL(target, baseUrl).toString()
  } catch {
    return target
  }
}

async function runActions(page: Page, human: Human, actions: Action[] | undefined, baseUrl: string): Promise<void> {
  for (const action of actions ?? []) {
    if (action.goto !== undefined) {
      await page.goto(resolveUrl(action.goto, baseUrl), { waitUntil: 'domcontentloaded' })
      await human.settle()
    } else if (action.click !== undefined) {
      await human.click(action.click)
    } else if (action.hover !== undefined) {
      await human.hover(action.hover)
    } else if (action.fill !== undefined) {
      await human.fill(action.fill.target, action.fill.text)
    } else if (action.press !== undefined) {
      await human.press(action.press)
    } else if (action.type !== undefined) {
      await human.type(action.type)
    } else if (action.scroll !== undefined) {
      if (typeof action.scroll === 'number') await human.scrollBy(action.scroll)
      else if (action.scroll.to !== undefined) await human.scrollTo(action.scroll.to)
      else if (action.scroll.by !== undefined) await human.scrollBy(action.scroll.by)
    } else if (action.scrollTo !== undefined) {
      await human.scrollToSelector(action.scrollTo)
    } else if (action.wait !== undefined) {
      await page.waitForTimeout(action.wait)
    } else if (action.expect !== undefined) {
      const locator = page.locator(action.expect).first()
      await locator.waitFor({ state: 'visible', timeout: 15000 })
      await human.pause(200, 420)
    }
  }
}

/* --------------------------------------------------------------- capture */

/**
 * Starts the rrweb recorder for the *current* document. Must be called after
 * every navigation (each document needs its own recorder) and never at
 * document-start time (see the note on the init script above).
 */
async function ensureRecording(page: Page): Promise<boolean> {
  await page
    .waitForFunction('!!(window.rrweb && typeof window.rrweb.record === "function")', undefined, { timeout: 15000 })
    .catch(() => undefined)
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const started = await page.evaluate('Boolean(window.__spStart && window.__spStart())').catch(() => false)
    if (started) return true
    if (await page.evaluate('Boolean(window.__spRecording)').catch(() => false)) return true
    await page.waitForTimeout(100)
  }
  return false
}

export interface CaptureOptions {
  storyboard: Storyboard
  rawJson: string
  log: Log
}

export async function capture(options: CaptureOptions): Promise<CaptureResult> {
  const { storyboard, rawJson, log } = options
  const bundlePath = await resolveRrwebBundle(log)
  log.line(`rrweb bundle: ${bundlePath}`)

  const browser: Browser = await chromium.launch({ headless: true })
  log.line('chrome: launched')
  const context: BrowserContext = await browser.newContext({
    viewport: { width: storyboard.width, height: storyboard.height },
    deviceScaleFactor: 1,
    reducedMotion: 'no-preference',
  })
  log.line('chrome: context')

  const events: unknown[] = []
  await context.exposeFunction('__spEmit', (event: unknown) => {
    events.push(event)
  })
  await context.addInitScript({ path: bundlePath })
  log.line('chrome: bundle injected')
  // NOTE 1: page-side callbacks are passed as STRINGS (IIFE) on purpose. tsx/esbuild
  // injects a `__name` helper into nested closures, which does not exist in the
  // browser (pageerror: "__name is not defined"), silently killing init scripts.
  // NOTE 2: recording must NOT start from the document-start init script: emitting
  // through the exposed binding while the context is still being created deadlocks
  // `newPage()`. The recorder is started explicitly after each navigation.
  await context.addInitScript({
    content: `
(function () {
  var w = window;
  w.__spStart = function () {
    var rrweb = w.rrweb;
    if (!rrweb || typeof rrweb.record !== 'function' || w.__spRecording) return false;
    if (typeof w.__spEmit !== 'function') return false;
    rrweb.record({
      emit: function (event) { w.__spEmit(event); },
      recordCanvas: ${storyboard.recordCanvas ? 'true' : 'false'},
      collectFonts: true,
      inlineStylesheet: true,
      maskAllInputs: false
    });
    w.__spRecording = true;
    return true;
  };
  w.__spMark = function (payload) {
    w.__spStart();
    var record = w.rrweb && w.rrweb.record;
    try { if (record && record.takeFullSnapshot) record.takeFullSnapshot(true); } catch (error) {}
    try {
      if (record && record.addCustomEvent) record.addCustomEvent('storyplay/scene', payload);
      else w.__spEmit({ type: 5, data: { tag: 'storyplay/scene', payload }, timestamp: Date.now() });
    } catch (error) {
      w.__spEmit({ type: 5, data: { tag: 'storyplay/scene', payload }, timestamp: Date.now() });
    }
    return true;
  };
})();
`,
  })

  const page = await context.newPage()
  log.line('chrome: page')
  const marked: CaptureResult['scenes'] = []
  page.setDefaultTimeout(20000)
  page.on('pageerror', (error) => log.warn(`capture pageerror: ${error.message}`))

  try {
    if (storyboard.scenes[0]?.url) {
      log.line(`goto ${storyboard.baseUrl}`)
      await page.goto(resolveUrl(storyboard.scenes[0].url as string, storyboard.baseUrl), {
        waitUntil: 'domcontentloaded',
      })
      log.line('goto ok')
      await page.waitForTimeout(600)
      await ensureRecording(page)
    }

    for (const [index, scene] of storyboard.scenes.entries()) {
      const human = new Human(page, storyboard.seed + index * 7919)
      log.line(`capture ${index + 1}/${storyboard.scenes.length}: ${scene.id}`)

      // 1. Preparation (never narrated, discarded by the processor).
      if (scene.url) {
        await page.goto(resolveUrl(scene.url, storyboard.baseUrl), { waitUntil: 'domcontentloaded' })
        await ensureRecording(page)
      }
      log.line(`  prep: settle`)
      await human.settle()
      await runActions(page, human, scene.prep, storyboard.baseUrl)
      await human.settle()
      log.line(`  prep: ok`)

      // 2. Scene marker: full snapshot + custom event at the exact same tick.
      log.line(`  marker`)
      await page.evaluate(
        `(function (payload) { return window.__spMark(payload) })(${JSON.stringify({
          id: scene.id,
          index,
          title: scene.title ?? scene.id,
        })})`
      )
      const recording = await page.evaluate('Boolean(window.__spRecording)')
      marked.push({ id: scene.id, index, marked: Boolean(recording) })
      log.line(`  marker ok (rrweb recording: ${Boolean(recording)})`)

      // 3. Narrated actions.
      log.line(`  actions (${(scene.actions ?? []).length})`)
      await runActions(page, human, scene.actions, storyboard.baseUrl)
      await page.waitForTimeout(scene.holdMs ?? 450)
      log.line(`  scene ${scene.id} ok`)
    }
  } finally {
    await page.waitForTimeout(400)
    await browser.close()
  }

  fs.mkdirSync(path.dirname(path.resolve(rawJson)), { recursive: true })
  fs.writeFileSync(rawJson, JSON.stringify(events, null, 0), 'utf-8')
  writeJson(`${rawJson}.meta.json`, {
    width: storyboard.width,
    height: storyboard.height,
    scenes: marked,
    events: events.length,
  })
  log.line(`capture: ${events.length} eventos -> ${rawJson}`, true)

  return { rawJson, events: events.length, scenes: marked }
}

/* --------------------------------------------------------------------- CLI */

async function main(): Promise<void> {
  const [storyboardPath, rawArg] = process.argv.slice(2)
  if (!storyboardPath) throw new Error('uso: tsx scripts/capture.ts <storyboard.json> [raw.json]')
  const rawJson = path.resolve(rawArg ?? 'raw.json')
  const log = new Log(false)
  const storyboard = loadStoryboard(path.resolve(storyboardPath))
  await capture({ storyboard, rawJson, log })
  log.flush(path.join(path.dirname(rawJson), 'capture.log'))
}

if (process.argv[1] && /capture\.(ts|js)$/i.test(process.argv[1])) {
  void main().catch((error) => {
    console.error(`ERRO: ${error instanceof Error ? error.message : String(error)}`)
    process.exit(1)
  })
}
