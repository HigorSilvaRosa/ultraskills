# ultraskills

Coleção de **agent skills** publicada como fonte para o [`npx skills`](https://github.com/vercel-labs/skills)
(o gerenciador de pacotes do ecossistema de skills). Qualquer repo pode instalar e atualizar
estas skills com um comando.

## Skills publicadas

| Skill | O que faz |
|---|---|
| `storyplay` | Vídeo de evidência narrado (pt-BR) a partir de um teste Playwright + storyboard, com legenda soft embutida |
| `storyplay-rrweb` | Demo de UI cinematográfica narrada: captura DOM com rrweb, cursor humanizado (Bézier), render frame-a-frame + legenda |
| `media-research` | Busca/baixa mídia (imagem, vídeo, áudio) em repositórios da internet |
| `storyboard-video` | Planeja e monta vídeos programáticos com React Remotion a partir de um storyboard |
| `storyboard-documentary` | Cria documentários narrados (pesquisa → roteiro → storyboard → `storyboard-video`) |
| `storyboard-video-remotion-scene` | Cria cenas Remotion modulares e animadas para um storyboard |

Consumidas do upstream (não redistribuídas por este repo, ver `skills-lock.json`):
`find-skills` ([vercel-labs/skills](https://github.com/vercel-labs/skills)), `remotion-best-practices`
([remotion-dev/skills](https://github.com/remotion-dev/skills)), `skill-creator`
([anthropics/skills](https://github.com/anthropics/skills)).

---

## Instalar em outro repositório

```bash
# interativo (escolhe skills e agentes)
npx skills add HigorSilvaRosa/ultraskills

# ver o que o repo oferece, sem instalar
npx skills add HigorSilvaRosa/ultraskills --list

# instalar as duas skills de vídeo no projeto atual (não interativo)
npx skills add HigorSilvaRosa/ultraskills -s storyplay -s storyplay-rrweb -y

# quem usa .agents/skills/ (Codex, Cursor, Amp, OpenCode, DSH...)
npx skills add HigorSilvaRosa/ultraskills -s storyplay -s storyplay-rrweb -a universal -y

# agentes específicos
npx skills add HigorSilvaRosa/ultraskills -a claude-code -a cursor -a codex -y

# tudo, em todos os agentes detectados
npx skills add HigorSilvaRosa/ultraskills --all

# copiar arquivos em vez de symlink (ambientes sem suporte a symlink)
npx skills add HigorSilvaRosa/ultraskills -s storyplay -a universal -y --copy

# forma <source>@<skill>
npx skills add HigorSilvaRosa/ultraskills@storyplay -y
```

Escopo **global** (vale em todos os projetos):

```bash
npx skills add HigorSilvaRosa/ultraskills -s storyplay -s storyplay-rrweb -g -y
```

Usar sem instalar (gera o prompt da skill):

```bash
npx skills use HigorSilvaRosa/ultraskills@storyplay
npx skills use HigorSilvaRosa/ultraskills --skill storyplay-rrweb --agent claude-code
```

## Atualizar

```bash
npx skills update                                  # tudo (pergunta o escopo)
npx skills update -y                               # não interativo (projeto, se estiver em um)
npx skills update storyplay storyplay-rrweb        # skills específicas
npx skills update -p                               # somente escopo projeto
npx skills update -g                               # somente escopo global

npx skills ls                                      # o que está instalado
npx skills ls -a claude-code -a cursor             # filtrando por agente
```

## Remover

```bash
npx skills remove storyplay
npx skills remove --agent universal storyplay
npx skills remove --all
```

## CI / restaurar de um lock existente

```bash
npx skills experimental_install        # restaura as skills a partir de skills-lock.json
```

```yaml
# .github/workflows/skills.yml
- uses: actions/checkout@v4
- run: npx -y skills@latest experimental_install
```

---

## Requisitos das skills de vídeo

As duas skills **não instalam nada sozinhas**: elas detectam o que falta e esperam a
confirmação do usuário.

```bash
# storyplay (Playwright + edge-tts + ffmpeg)
python .agents/skills/storyplay/scripts/storyboard_video.py --execution <slug> --check-deps
# depois da confirmação:
python .agents/skills/storyplay/scripts/storyboard_video.py --execution <slug> --install-deps

# storyplay-rrweb (Playwright + rrweb + ffmpeg + edge-tts)
cd .agents/skills/storyplay-rrweb && pnpm exec tsx scripts/preflight.ts
pnpm exec tsx scripts/preflight.ts --install-deps
```

Os vídeos saem em `<projeto>/.ultraskills/storyplay/<yyyy-mm-dd_hh-mm>_<slug>/` e
`<projeto>/.ultraskills/storyplay-rrweb/<yyyy-mm-dd_hh-mm>_<slug>/` (`final.mp4` +
`final.srt` + `final.vtt` + `run.json`).

## Desenvolvimento neste repo

```bash
pnpm run skills:check     # valida frontmatter e a armadilha do SKILL.md na raiz
pnpm run skills:list      # lista o que este repo publica (usa o CLI real)
node .smoke/serve.mjs 4173   # servidor da página de demo
```

Regras para manter o repo compatível com o CLI:

1. **Nunca** crie `SKILL.md` na raiz: ele ofusca a descoberta e o repo passa a publicar
   1 skill em vez de todas as de `.agents/skills/` (`pnpm run skills:check` falha nisso).
2. Cada skill vive em `.agents/skills/<nome>/SKILL.md` com frontmatter `name` (igual ao
   nome da pasta) e `description` de uma linha.
3. Skills de terceiros ficam em `skills-lock.json` (consumidas do upstream) e por isso
   não aparecem na descoberta deste repo — para publicá-las aqui seria preciso remover
   as entradas do lock.
4. O smoke test ponta a ponta das skills de vídeo está em [`.smoke/README.md`](.smoke/README.md).

## Estrutura

```
.agents/skills/<nome>/SKILL.md   # skills publicadas (+ scripts/ e templates/ da própria skill)
skills-lock.json                 # skills consumidas de terceiros (fonte + hash)
scripts/verify-skills.mjs        # checagem de compatibilidade com `npx skills`
.smoke/                          # alvo de teste local das skills storyplay
```
