---
name: storyplay-rrweb
description: "Generate cinematic narrated UI demo videos from headless browser automation using rrweb and Playwright. Captures DOM mutations instead of pixels, humanizes every interaction (Bézier cursor arcs, press/release dwell, eased scrolling, pacing matched to the narration), and renders frame-accurate H.264 with edge-tts narration and soft subtitles. Trigger whenever the user asks for 'cinematic recording', 'rrweb video', 'smooth cursor video', 'DOM replay video', 'demo narrada de UI', 'vídeo cinemático', 'gravar com rrweb', 'vídeo de produto sem captura de tela', or narrated marketing/product walkthroughs."
---

# Storyplay-rrweb — demo de UI cinematográfica, narrada e legendada

Grava **mutações de DOM** com `rrweb` (não pixels), humaniza as interações e renderiza
**frame a frame** um MP4 com **narração pt-BR** e **legenda soft**.
Um comando, um arquivo de entrada (storyboard JSON), zero TypeScript por execução.

```
storyboard.json → narração (edge-tts) → capture (Playwright+rrweb, humanizado)
                → processor (cursor Bézier + ritmo casado com a narração)
                → render (frames → H.264 + trilha + legenda) → final.mp4
```

**Entrega padrão** (relativa ao projeto alvo):

```
<projeto>/.ultraskills/storyplay-rrweb/<yyyy-mm-dd_hh-mm>_<slug>/
  final.mp4       vídeo + narração + legenda mov_text embutida
  final.srt       legenda sidecar
  final.vtt       legenda web
  cinematic.json  timeline + eventos (mantido: permite re-render barato)
  narrations.json áudio por cena (referência do re-render)
  run.json        resumo legível por máquina
  storyboard.json cópia do storyboard usado
  run.log         log completo (só leia se algo falhar)
```

## Quando usar esta skill (e não a `storyplay`)

| Quero… | Skill |
|---|---|
| Evidência de teste E2E que **prova** o fluxo (Playwright test + asserts) | `storyplay` |
| Demo de **produto/marketing**, cursor visível, movimento suave | `storyplay-rrweb` |
| Máxima nitidez (texto/animações), vídeo mais longo | `storyplay-rrweb` |
| Vídeo curto de evidência com narração objetiva | `storyplay` |

Diferença técnica: `storyplay` grava **pixels** de um teste Playwright; `storyplay-rrweb`
grava **DOM** e re-renderiza — ganhando cursor humanizado, prep-trim exato e fps real.

## Regras de economia de tokens

1. **Um comando por vídeo** (`pipeline.ts`). Não rode os módulos soltos.
2. **Um arquivo para escrever:** o `storyboard.json` (JSON declarativo — não escreva TypeScript).
3. **Nunca leia** `raw.json`, `cinematic.json`, `frames/`, `narration/`, `run.log`.
4. **O resumo é `run.json`** (ou `--json`). A resposta final sai dele.
5. Não cole logs no chat: o stdout já é 1 linha por cena + 1 linha final.
6. Iterar é barato: `--render-only` re-renderiza do `cinematic.json`; `--from-capture raw.json` pula o browser.

## 1. Dependências (sempre com confirmação do usuário)

```powershell
cd .agents/skills/storyplay-rrweb
pnpm exec tsx scripts/preflight.ts            # ou: pnpm run preflight
```

- Mostre o resultado ao usuário e **peça confirmação** antes de instalar.
- Só depois da confirmação: `pnpm exec tsx scripts/preflight.ts --install-deps`
  (ou `... scripts/pipeline.ts --install-deps --slug <slug>`).

Checagens: `ffmpeg`/`ffprobe`, `python -m edge_tts`, pacotes `playwright`/`rrweb`, chromium do Playwright.
Instaladores: `winget install Gyan.FFmpeg` · `python -m pip install --upgrade edge-tts` · `pnpm add playwright rrweb` · `npx playwright install chromium`.
(`pnpm` é preferido neste projeto; gerenciador equivalente serve.)

## 2. Storyboard declarativo

`.ultraskills/storyplay-rrweb/storyboards/<slug>.json` (ou passe `--storyboard <caminho>`):

```json
{
  "slug": "painel-demo",
  "baseUrl": "http://localhost:3000",
  "width": 1600, "height": 900, "fps": 30, "seed": 1234,
  "voice": "pt-BR-FranciscaNeural", "rate": "-4%",
  "scenes": [
    {
      "id": "01-hero",
      "title": "Hero e CTA",
      "narration": "A página inicial apresenta o hero com o título principal. Ao clicar, o painel de recursos é revelado.",
      "url": "/",
      "prep": [{ "wait": 300 }],
      "actions": [
        { "hover": "role=button[name=/Ver recursos/]" },
        { "wait": 250 },
        { "click": "role=button[name=/Ver recursos/]" },
        { "wait": 900 }
      ]
    }
  ]
}
```

- `id`: único; `narration`: obrigatório (vira voz + legenda); `url`: opcional (reaproveita o estado da cena anterior se omitido).
- `prep`: ações **não narradas** (aquecimento, posicionamento). O processor descarta tudo antes do marcador de cena.
- `actions`: gramática declarativa (exatamente **uma** chave por item):

| Ação | Exemplo | Efeito humanizado |
|---|---|---|
| `goto` | `{"goto": "/blog"}` | navega + settle |
| `click` | `{"click": "role=link[name=/Ler/]"}` | scroll até o alvo, arco Bézier, dwell, press/release |
| `hover` | `{"hover": "#menu"}` | movimento em arco + pausa |
| `fill` | `{"fill": {"target": "#email", "text": "a@b.c"}}` | clique + digitação com ritmo |
| `type` | `{"type": "texto"}` | digita no elemento focado |
| `press` | `{"press": "Enter"}` | tecla + pausa |
| `scroll` | `{"scroll": {"to": 900}}` / `{"scroll": 600}` / `{"scroll": {"by": -200}}` | roda do mouse com easing |
| `scrollTo` | `{"scrollTo": "#contato"}` | scroll até o elemento |
| `wait` | `{"wait": 500}` | pausa |
| `expect` | `{"expect": "role=heading[name=/Blog/]"}` | espera visível (mantém a demo honesta) |

- Seletores: qualquer string aceita pelo Playwright (`role=...`, `text=...`, `#id`, `.classe`).
- **Narração de 5-9s por cena**; frases curtas e bem pontuadas geram legendas melhores.
- `seed` fixa o movimento: mesma captura + mesmo seed = mesmo vídeo (demo reproduzível).

## 3. Execução

```powershell
cd .agents/skills/storyplay-rrweb
pnpm exec tsx scripts/pipeline.ts --slug painel-demo --project-root ../.. `
  --storyboard ../../.ultraskills/storyplay-rrweb/storyboards/painel-demo.json
```

Flags úteis:

| Flag | Default | Uso |
|---|---|---|
| `--project-root` | cwd | raiz do projeto alvo (define `.ultraskills/...`) |
| `--out-root` | `.ultraskills/storyplay-rrweb` | raiz de saída |
| `--run-dir` | auto (`<stamp>_<slug>`) | força um diretório de run |
| `--fps` | storyboard (30) | quadros por segundo do render |
| `--crf` / `--png` | 18 / off | qualidade (PNG = lossless, mais lento/pesado) |
| `--render-only` | off | re-renderiza do `cinematic.json` do `--run-dir` |
| `--from-capture` | — | reusa um `raw.json` (pula o browser) |
| `--keep-intermediates` | off | mantém `frames/`, `narration/`, `raw.json` |
| `--no-subtitles` | off | desliga legenda |
| `--check-deps` / `--install-deps` | off | preflight / instalação confirmada |
| `--json` / `--verbose` | off | só o `run.json` / stdout completo |

## 4. O que o pipeline garante

**Capture (`capture.ts`)**
- Cursor real via `page.mouse`: trajeto em arco Bézier amostrado com jitter de tempo.
- Clique = chegar → dwell de 110-300ms → `down` → 45-95ms → `up` (nunca clique instantâneo).
- Digitação com ritmo: mais lenta nas duas primeiras teclas e após espaço/pontuação.
- Scroll por `mouse.wheel` com easing e micro-pausas — inclusive o scroll automático até o alvo
  (`scrollIntoViewIfNeeded` via CDP não gera evento que o rrweb consiga replayar, então o clique
  cairia fora do lugar no vídeo final).
- Marcador `storyplay/scene` (custom event rrweb) + full snapshot a cada início de cena.

**Processor (`processor.ts`)**
- **Prep-trim exato**: tudo antes do primeiro marcador é descartado — zero flash de carregamento, sem depender de relógio de parede.
- **Cursor sintetizado**: os `MouseMove` brutos do Playwright são removidos e trocados por **um arco Bézier por clique**, com `mousedown/mouseup/click` coerentes (nada de teleporte seguido de deslize).
- **Ritmo casado com a narração**: cada cena é esticada (dwell/hold naturais) ou comprimida (só o tempo morto entre gestos, até 40%) para durar exatamente a narração. A folga vira silêncio no fim da cena — **áudio e legenda sincronizados por construção**.
- Determinístico (seed) e ordenado por timestamp.

**Render (`render.ts`)**
- Replayer do rrweb pausado em cada frame e fotografado (`pause(t)` + screenshot): **fps real**, sem frames perdidos de screencast.
- Cursor macOS por **CSS na página hospedeira** (não por evento custom, que o replayer ignora).
- Trilha montada com `aresample` + `apad` por cena (silêncio exato) via `filter_complex` + `concat`.
- Mux final: `-c:v copy` (H.264 intacto) + AAC + `mov_text` soft com `language=por`.

## 5. Validação e entrega

```powershell
ffprobe -v error -show_entries stream=codec_name,codec_type -of csv=p=0 <run>/final.mp4
# esperado: h264,video / aac,audio / mov_text,subtitle
```

Entregue: caminho do `final.mp4`, `.srt`/`.vtt`, duração, resolução/fps e o `run.json`.
Confira `run.json.warnings` — ex.: cena em que o replay é maior que a narração (encurte as ações ou alongue o texto).

## 6. Problemas comuns

| Sintoma | Causa provável | Correção |
|---|---|---|
| `capture sem marcadores de cena` | `rrweb` não carregou / init script morto | veja `pageerror` no `run.log`; confirme o bundle local do `rrweb` |
| Vídeo com área em branco | canvas/WebGL sem `recordCanvas` | `"recordCanvas": true` no storyboard |
| Iframe de outro domínio vazio | rrweb não captura cross-origin por padrão | evite iframe externo ou use a `storyplay` (pixels) |
| `cena X: replay > narração` (warning) | ações longas para texto curto | encurte `actions`/`wait` ou alongue a narração |
| Render lento | fps alto + PNG | use `--fps 30` e JPEG (padrão); `--png` só para lossless |
| `edge-tts falhou` | rede/403 temporário | o pipeline já tenta 3×; rode de novo |
