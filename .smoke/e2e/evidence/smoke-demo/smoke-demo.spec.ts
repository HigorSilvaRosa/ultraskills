import { test } from '@playwright/test'
import { SceneTimer } from '../helpers/timing'
import { humanClick, humanFill, humanScrollBy, humanScrollTo, pause, settle } from '../helpers/human'

// 1 test = 1 storyboard scene. The @sceneNN tag is what the pipeline greps for.

test('01-hero @scene01', async ({ page }) => {
  test.setTimeout(40000)
  const timer = new SceneTimer()

  await test.step('prep: abrir a home estabilizada', async () => {
    await page.goto('/')
    await settle(page)
    await test.step('aguardar hero visível', async () => {
      await page.getByRole('heading', { level: 1 }).waitFor({ state: 'visible' })
    })
  })

  timer.markSceneStart('smoke-demo', '01-hero')

  await test.step('scene: revelar recursos', async () => {
    await humanClick(page, 'role=button[name=/Ver recursos/]')
    await pause(page, 900)
    await humanScrollBy(page, 260)
    await pause(page, 600)
    await humanScrollBy(page, -200)
    await humanClick(page, 'role=button[name=/Entrar/]')
    await pause(page, 700)
  })
})

test('02-form @scene02', async ({ page }) => {
  test.setTimeout(40000)
  const timer = new SceneTimer()

  await test.step('prep: abrir a home e posicionar', async () => {
    await page.goto('/')
    await settle(page)
  })

  timer.markSceneStart('smoke-demo', '02-form')

  await test.step('scene: assinar o relatório', async () => {
    await humanScrollTo(page, 900)
    await pause(page, 300)
    await humanFill(page, 'input#email', 'demo@exemplo.com')
    await humanClick(page, 'button[type=submit]')
    await pause(page, 900)
    await humanScrollBy(page, 220)
    await humanClick(page, 'role=button[name=/Entrar/]')
    await pause(page, 600)
  })
})
