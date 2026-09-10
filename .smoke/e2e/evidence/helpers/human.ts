/**
 * Storyplay humanized interactions for Playwright evidence specs.
 *
 * Deterministic (seeded) organic motion: arc-shaped cursor travel, jittered
 * pacing, press/release dwell and eased wheel scrolling. No `slowMo` needed,
 * so scenes stay short while looking human on video.
 *
 * Usage:
 *   import { settle, pause, humanClick, humanFill, humanScrollTo, humanScrollBy } from '../helpers/human'
 *   await settle(page)                       // networkidle + 2 rAF + small pause
 *   await humanClick(page, 'role=link[name=/Começar/]')
 *   await humanFill(page, 'input#email', 'demo@exemplo.com')
 *   await humanScrollTo(page, 1200)
 */
import { expect, type Page } from '@playwright/test'

let seed = 0x9e3779b9
let mouseX = 0
let mouseY = 0

/** Deterministic PRNG so every re-run of the same spec looks identical. */
export function setHumanSeed(value: number): void {
  seed = (value >>> 0) || 0x9e3779b9
}

function rnd(): number {
  seed ^= seed << 13
  seed ^= seed >>> 17
  seed ^= seed << 5
  return (seed >>> 0) / 0xffffffff
}

export function jitter(min: number, max: number): number {
  return Math.round(min + rnd() * Math.max(0, max - min))
}

function easeInOut(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

/** Wait for a settled frame: network idle, layout animations done, paint flushed. */
export async function settle(page: Page, ms = 260): Promise<void> {
  await page.waitForLoadState('networkidle').catch(() => undefined)
  await page.waitForTimeout(jitter(ms * 0.7, ms * 1.3))
  await page
    .evaluate(
      () =>
        new Promise<void>((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
        })
    )
    .catch(() => undefined)
}

/** Human pause (reading/thinking time). */
export async function pause(page: Page, ms?: number): Promise<void> {
  await page.waitForTimeout(ms ?? jitter(280, 640))
}

/** Move the pointer along a gentle cubic arc to viewport coordinates. */
export async function humanMoveTo(page: Page, x: number, y: number): Promise<void> {
  const distance = Math.hypot(x - mouseX, y - mouseY)
  const steps = Math.max(12, Math.min(42, Math.round(distance / 18)))
  const bend = Math.min(70, distance * 0.12) * (rnd() < 0.5 ? -1 : 1)
  const c1x = mouseX + (x - mouseX) * 0.3 - (y - mouseY) * (bend / Math.max(distance, 1))
  const c1y = mouseY + (y - mouseY) * 0.3 + (x - mouseX) * (bend / Math.max(distance, 1))
  const c2x = mouseX + (x - mouseX) * 0.72
  const c2y = mouseY + (y - mouseY) * 0.72
  for (let i = 1; i <= steps; i += 1) {
    const u = easeInOut(i / steps)
    const iu = 1 - u
    const px = iu ** 3 * mouseX + 3 * iu ** 2 * u * c1x + 3 * iu * u ** 2 * c2x + u ** 3 * x
    const py = iu ** 3 * mouseY + 3 * iu ** 2 * u * c1y + 3 * iu * u ** 2 * c2y + u ** 3 * y
    await page.mouse.move(px, py)
    await page.waitForTimeout(jitter(6, 16))
  }
  mouseX = x
  mouseY = y
}

/** Humanized click: scroll into view, arc to the target, dwell, press, release. */
export async function humanClick(page: Page, selector: string): Promise<void> {
  const locator = page.locator(selector).first()
  await expect(locator).toBeVisible({ timeout: 15000 })
  await locator.scrollIntoViewIfNeeded().catch(() => undefined)
  const box = await locator.boundingBox()
  if (!box) {
    await locator.click()
    return
  }
  const x = box.x + box.width * (0.4 + rnd() * 0.2)
  const y = box.y + box.height * (0.4 + rnd() * 0.2)
  await humanMoveTo(page, x, y)
  await page.waitForTimeout(jitter(110, 300))
  await page.mouse.down()
  await page.waitForTimeout(jitter(45, 95))
  await page.mouse.up()
}

/** Humanized typing: click first, then keystrokes with an organic rhythm. */
export async function humanFill(page: Page, selector: string, text: string): Promise<void> {
  const locator = page.locator(selector).first()
  await humanClick(page, selector)
  const current = await locator.inputValue().catch(() => '')
  if (current) {
    await page.keyboard.press('Control+A')
    await page.waitForTimeout(jitter(60, 140))
  }
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]
    await page.keyboard.type(ch)
    const isBreak = ch === ' ' || ch === ',' || ch === '.'
    await page.waitForTimeout(isBreak ? jitter(140, 260) : i < 2 ? jitter(120, 190) : jitter(55, 130))
  }
}

/** Eased wheel scrolling by a delta (positive = down). */
export async function humanScrollBy(page: Page, deltaY: number, steps?: number): Promise<void> {
  const total = Math.round(deltaY)
  const count = steps ?? Math.max(4, Math.min(14, Math.round(Math.abs(total) / 130)))
  let done = 0
  for (let i = 1; i <= count; i += 1) {
    const target = Math.round(total * easeInOut(i / count))
    const step = target - done
    if (step !== 0) {
      await page.mouse.wheel(0, step)
      done = target
    }
    await page.waitForTimeout(jitter(30, 85))
  }
}

/** Eased wheel scrolling to an absolute document position. */
export async function humanScrollTo(page: Page, absoluteY: number): Promise<void> {
  const current = await page.evaluate(() => window.scrollY)
  await humanScrollBy(page, absoluteY - current)
}

export { humanScrollTo as humanScroll }
