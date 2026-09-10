/**
 * Storyplay scene timing marker.
 *
 * The pipeline (`storyboard_video.py`) sets STORYPLAY_TIMING_DIR and trims the
 * beginning of each recorded scene by the reported `prep_duration_sec`, so the
 * final video never shows navigation/blank/flicker frames.
 *
 * Usage inside a Playwright evidence spec:
 *
 *   const timer = new SceneTimer()          // at the very top of the test
 *   await test.step('prep: ...', async () => { ... })
 *   timer.markSceneStart('blog_navigation', '01-home-hero')   // last line of prep
 *   await test.step('scene: ...', async () => { ... })
 */
import * as fs from 'fs'
import * as path from 'path'

export interface SceneTiming {
  execution: string
  scene_id: string
  prep_duration_sec: number
  marked_at: string
}

function timingDir(): string {
  const dir = process.env.STORYPLAY_TIMING_DIR
  if (!dir) {
    throw new Error(
      'STORYPLAY_TIMING_DIR não definido. Rode o spec pelo pipeline ' +
        '(python .agents/skills/storyplay/scripts/storyboard_video.py ...) ' +
        'ou exporte a variável apontando para <run-dir>/timings.'
    )
  }
  return dir
}

export class SceneTimer {
  private readonly t0 = Date.now()
  private marked = false

  /** Seconds elapsed since the timer was created (i.e. since the test started). */
  elapsedSec(): number {
    return (Date.now() - this.t0) / 1000
  }

  /**
   * Marks the exact moment preparation ended. Everything before it is discarded
   * from the recorded scene. Returns the discarded duration in seconds.
   */
  markSceneStart(execution: string, sceneId: string): number {
    const dir = timingDir()
    const prepDurationSec = Number(this.elapsedSec().toFixed(3))
    fs.mkdirSync(dir, { recursive: true })
    const payload: SceneTiming = {
      execution,
      scene_id: sceneId,
      prep_duration_sec: prepDurationSec,
      marked_at: new Date().toISOString(),
    }
    fs.writeFileSync(path.join(dir, `${sceneId}.json`), JSON.stringify(payload, null, 2), 'utf-8')
    this.marked = true
    return prepDurationSec
  }

  hasMarked(): boolean {
    return this.marked
  }
}
