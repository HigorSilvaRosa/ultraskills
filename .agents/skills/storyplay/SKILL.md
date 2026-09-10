---
name: storyplay
description: "Generate narrated video evidence from a Playwright test suite using a scene-by-scene storyboard. Use this skill when the user wants to create a demo video, record a walkthrough, produce video evidence of a feature, generate narrated screen recordings, or build a storyboard-driven video from E2E tests. Also triggers for: \"gravar evidência\", \"criar vídeo de demo\", \"storyboard video\", \"narrated recording\", \"video evidence\", \"evidência em vídeo\", \"gerar vídeo da página\", \"vídeo com narração e legenda\"."
---

# Storyplay — vídeo de evidência narrado (Playwright + edge-tts)

Transforma um teste Playwright em vídeo **com narração pt-BR e legenda** (soft, toggleável), cena por cena.
Cada cena = 1 test + 1 narração. O pipeline faz tudo em **um comando**.

```
storyboard.json → narração (edge-tts) → teste Playwright (@sceneNN) → prep-trim → merge → concat → legenda soft → final.mp4
```

**Entrega padrão** (relativa ao projeto alvo):

```
<projeto>/.ultraskills/storyplay/<yyyy-mm-dd_hh-mm>_<slug>/
  final.mp4       vídeo + narração + legenda mov_text embutida
  final.srt       legenda sidecar
  final.vtt       legenda web
  run.json        resumo legível por máquina (status, durações, avisos)
  storyboard.json cópia do storyboard usado
  run.log         log completo (só leia se algo falhar)
```

## Regras de economia de tokens

1. **Um comando por vídeo.** Não rode os passos separados; o script é determinístico.
2. **Um arquivo para escrever:** o `storyboard.json`. Os helpers (`helpers/timing.ts`, `helpers/human.ts`) e o `playwright.evidence.config.ts` são **provisionados automaticamente** pelo pipeline.
3. **Nunca leia intermediários** (`_pw/`, `scenes/`, `run.log`, MP4s parciais).
4. **O resumo é `run.json`** (ou `--json`). A resposta final ao usuário sai dele: caminho do `final.mp4`, duração, status e `warnings`.
5. **Não cole saída de log no chat.** O stdout do pipeline já é compacto (1 linha por cena + 1 linha final).
6. Não re-renderize para "conferir": o pipeline valida com `ffprobe` e registra em `run.json`.

## 1. Dependências (sempre com confirmação do usuário)

```powershell
python .agents/skills/storyplay/scripts/storyboard_video.py --execution <slug> --check-deps
```

- Se faltar algo, **mostre a lista ao usuário e peça confirmação** — nunca instale por conta própria.
- Só depois da confirmação:

```powershell
python .agents/skills/storyplay/scripts/storyboard_video.py --execution <slug> --install-deps
```

Checagens: `ffmpeg`/`ffprobe`, `edge-tts`, `moviepy`, Playwright no projeto (`@playwright/test`), chromium do Playwright.
Instaladores sugeridos: `winget install Gyan.FFmpeg` · `python -m pip install --upgrade edge-tts moviepy` · `pnpm add -D @playwright/test` · `npx playwright install chromium`.

## 2. Storyboard — a fonte da verdade

`e2e/evidence/<execution>/storyboard.json` (array, na ordem da narração):

```json
[
  {
    "id": "01-hero",
    "title": "Hero e CTA",
    "preparation": ["Abrir a home", "Esperar hidratação"],
    "narration": "A página inicial apresenta o hero com o título principal e o botão de ação.",
    "duration_sec": 7,
    "actions": ["goto /", "click Ver recursos", "wait 900"]
  }
]
```

- `id`: obrigatório, padrão `NN-descricao` (o prefixo numérico vira a tag `@sceneNN`).
- `narration`: obrigatório, tom técnico e objetivo (é o que a voz fala e a legenda mostra).
- `duration_sec`: alvo da cena; o pipeline **avisa** se a narração real divergir >1,5s.
- `preparation` / `actions`: contrato legível da cena (registrados no `run.log`); as ações reais vivem no spec.
- Frases curtas e bem pontuadas: a legenda é montada sobre as janelas de sentença reais do TTS.
- Alvo prático: narração de **5-9s** por cena.

## 3. Specs de evidência (1 test = 1 cena)

```typescript
import { test } from '@playwright/test'
import { SceneTimer } from '../helpers/timing'
import { humanClick, humanFill, humanScrollTo, pause, settle } from '../helpers/human'

test('01-hero @scene01', async ({ page }) => {
  test.setTimeout(40000)
  const timer = new SceneTimer()

  await test.step('prep: abrir a home estabilizada', async () => {
    await page.goto('/')
    await settle(page)                                  // networkidle + rAF + pausa
    await page.getByRole('heading', { level: 1 }).waitFor({ state: 'visible' })
  })

  timer.markSceneStart('<execution>', '01-hero')        // fim do prep = início da cena gravada

  await test.step('scene: revelar recursos', async () => {
    await humanClick(page, 'role=button[name=/Ver recursos/]')
    await pause(page, 900)
  })
})
```

Regras:

- **Tag `@sceneNN` no título do test** — é o que o pipeline usa no `--grep` (sem ela a cena não é encontrada).
- `timer.markSceneStart(execution, id)` na última linha do prep: o pipeline corta exatamente esse trecho (fim das telas brancas/`about:blank`).
- Ações da cena **só** com os helpers humanos — nada de `click()` cru, `waitForTimeout` gigante ou `slowMo` global.
- Seletores por papel/texto (`getByRole`, `getByText`, `getByLabel` ou a string `role=...`), nunca CSS frágil.
- `test.setTimeout(40000)` por cena (prep + ações + margem).

### Humanização embutida

| Helper | O que faz |
|---|---|
| `settle(page)` | networkidle + 2×`requestAnimationFrame` + pausa jitterizada |
| `pause(page, ms?)` | pausa de leitura (280-640 ms aleatórios por padrão) |
| `humanClick(page, sel)` | scroll até o alvo, trajeto em arco Bézier, dwell de 110-300 ms, `mouse.down` → 45-95 ms → `mouse.up` |
| `humanFill(page, sel, txt)` | clique humano + digitação com ritmo (mais lento após espaço/pontuação) |
| `humanScrollTo/By` | scroll por roda com easing e micro-pausas (nunca `scrollTo` instantâneo) |

O PRNG é semeado (determinístico): duas execuções produzem o mesmo vídeo.

## 4. Execução

```powershell
python .agents/skills/storyplay/scripts/storyboard_video.py `
  --execution smoke-demo `
  --project-root . `
  --base-url http://localhost:3000
```

Flags úteis:

| Flag | Default | Uso |
|---|---|---|
| `--out-root` | `.ultraskills/storyplay` | raiz de saída (relativa ao `--project-root`) |
| `--slug` / `--run-dir` | `--execution` / auto | nome/força o diretório do run |
| `--voice` / `--rate` | `pt-BR-FranciscaNeural` / `-4%` | voz e velocidade da narração |
| `--evidence-dir` | `e2e/evidence` | onde vivem storyboard/spec/helpers |
| `--base-url` | config | vira `STORYPLAY_BASE_URL` para os testes |
| `--no-subtitles` | off | pula legenda (raro: a entrega padrão tem legenda) |
| `--allow-missing` | off | cena sem vídeo vira `status=partial` em vez de falhar |
| `--keep-intermediates` | off | mantém `.webm`/`.mp3`/frames para depurar |
| `--json` | off | imprime só o `run.json` |
| `--verbose` | off | stdout completo (para depurar) |

Por cena o pipeline: gera áudio + cues → roda `playwright test --grep @sceneNN --workers=1 --output=<run>/_pw` → lê o timing do `SceneTimer` → corta o prep → faz merge (freeze no último frame se a narração for maior) → concatena com fade in/out → grava `final.srt`/`final.vtt` → mux `mov_text` (soft) → limpa intermediários.

## 5. Validação e entrega

```powershell
# stream de legenda presente?
ffprobe -v error -show_entries stream=codec_name,codec_type -of csv=p=0 <run>/final.mp4
# deve listar: h264,video / aac,audio / mov_text,subtitle
```

Entregue ao usuário: caminho do `final.mp4`, `.srt`/`.vtt`, duração e o `run.json` (status + `warnings`).
`status=ok` é a única condição para afirmar sucesso; `partial` significa cena faltando; `failed` significa que **nenhum** MP4 foi gerado (exit code 3).

## 6. Modo manual (escape hatch)

Para narrar um único vídeo já gravado:

```powershell
python .agents/skills/storyplay/scripts/merge_voice.py --text-file narracao.txt --video gravacao.webm
```

## 7. Problemas comuns

| Sintoma (`run.json.warnings`) | Causa | Correção |
|---|---|---|
| `SceneTimer não marcou a cena` | spec sem `markSceneStart` | chame `timer.markSceneStart(...)` no fim do prep |
| `X s de frame congelado` | narração muito maior que as ações | alongue as ações ou encurte o texto |
| `narração Xs vs duration_sec Ys` | alvo do storyboard desatualizado | ajuste `duration_sec` ou a narração |
| `N vídeos no output` | `--grep` casou mais de um test | mantenha 1 test por cena, com tag única |
| cena `sem vídeo gravado` | test falhou (veja `run.log`) | corrija o test; `--allow-missing` só para diagnóstico |
