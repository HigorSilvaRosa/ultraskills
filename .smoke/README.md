# Smoke test das skills `storyplay` e `storyplay-rrweb`

Alvo local mínimo (página estática "Aurora") para validar as duas skills ponta a ponta,
sem depender de nenhum projeto externo. Foi usado para validar narração, legenda,
humanização, prep-trim e o render frame-a-frame.

## 1. Servidor da página de demo

```powershell
node .smoke/serve.mjs 4173        # http://127.0.0.1:4173
```

## 2. storyplay (Playwright test + edge-tts)

```powershell
# deps do alvo (uma vez)
cd .smoke; pnpm install; cd ..

python .agents/skills/storyplay/scripts/storyboard_video.py `
  --execution smoke-demo --project-root .smoke --evidence-dir e2e/evidence `
  --base-url http://127.0.0.1:4173
```

- Sai em `.smoke/.ultraskills/storyplay/<stamp>_smoke-demo/`
  (`final.mp4` + `final.srt` + `final.vtt` + `run.json`).
- Provisiona `e2e/evidence/helpers/{timing,human}.ts` e `playwright.evidence.config.ts`
  na primeira execução.

## 3. storyplay-rrweb (rrweb + render frame-a-frame + edge-tts)

```powershell
cd .agents/skills/storyplay-rrweb
pnpm install                      # playwright + rrweb (+ tsx)
pnpm exec tsx scripts/preflight.ts

pnpm exec tsx scripts/pipeline.ts --slug smoke-demo `
  --storyboard ../../.smoke/rrweb-storyboard.json `
  --project-root ../../.smoke
```

- Sai em `.smoke/.ultraskills/storyplay-rrweb/<stamp>_smoke-demo/`
  (`final.mp4` + `final.srt` + `final.vtt` + `cinematic.json` + `run.json`).
- Iteração barata: `--render-only --run-dir <dir>` re-renderiza sem recapturar.

## 4. Verificação objetiva

```powershell
ffprobe -v error -show_entries stream=codec_name,codec_type -of csv=p=0 <run>/final.mp4
# h264,video  /  aac,audio  /  mov_text,subtitle
```

Resultado validado (2026-09-10):

| Skill | Duração | Streams | Observações |
|---|---|---|---|
| storyplay | 17,8s | h264 + aac + mov_text | prep cortado 0,86s/0,80s pelo `SceneTimer`; 5 cues |
| storyplay-rrweb | 17,8s | h264 1440x810@30 + aac + mov_text | 535 frames; 3 gestos Bézier; clique com dwell antes do press |

## 5. Artefatos de inspeção

`inspect*/` dentro dos runs contém frames extraídos do MP4 para conferência visual
(cursor, estado da página, legenda). São descartáveis.
