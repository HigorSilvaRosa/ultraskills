---
name: storyboard-video
description: Plan, structure, and assemble full programmatic videos using React Remotion. Decomposes scripts and briefs into a structured storyboard of sequential scenes, coordinates timeline durations and transitions, and orchestrates the creation of individual scene components via storyboard-video-remotion-scene. Use whenever the user asks to create a video, build a storyboard, orchestrate Remotion scenes, or assemble a complete Remotion video timeline.
---

# Storyboard Video

Orchestrate and assemble complete programmatic videos in React Remotion using a structured storyboard pipeline with **reusable scene components** and a **consistent design system**.

This skill acts as the **director and timeline architect**:
- Breaks down video scripts/briefs into modular scenes.
- Defines a unified **Design Theme** (colors, typography, radii) so the video has a consistent visual identity.
- Coordinates frame-accurate timing (`fps`, `durationInFrames`, transition overlaps) using [remotion-best-practices](file:///c:/Users/higor/ws/higorsilvarosa/ultraskills/.agents/skills/remotion-best-practices/SKILL.md).
- Checks and leverages the reusable scenes catalog in `.ultraskills/remotion/scenes/`.
- Delegates the creation of any new reusable scene components to **`storyboard-video-remotion-scene`**.
- Assembles the root composition using `<TransitionSeries>` from `@remotion/transitions` or `<Series>`.
- Configures `Root.tsx` with a `<Folder>` to preview individual scenes independently in Remotion Studio.

---

## 🎨 Consistent Design System (Theme)

To ensure the video maintains a cohesive visual identity across all scenes, every storyboard establishes a `StoryboardTheme` (defined in `.ultraskills/remotion/types.ts`):

```tsx
import { StoryboardTheme } from '../.ultraskills/remotion/types';

export const videoTheme: StoryboardTheme = {
  backgroundColor: '#0B0F19',
  textColor: '#F8FAFC',
  primaryColor: '#38BDF8', // Cyan/Sky
  accentColor: '#6366F1',  // Indigo
  secondaryColor: '#A855F7',
  mutedColor: '#94A3B8',
  fontFamily: 'Inter, system-ui, sans-serif',
  borderRadius: 16,
};
```

This theme is passed to every scene component via the `theme` prop.

---

## 📁 Reusable Scene Storage

All reusable scene components live in:
```
.ultraskills/remotion/scenes/<componente-reutilizavel-slug-descritivo>.tsx
```

Before creating new components, the storyboard director checks `.ultraskills/remotion/scenes/` to see if existing scene layouts (e.g. `scene-hero-headline.tsx`, `scene-split-comparison.tsx`, `scene-cta-pulse.tsx`) can be reused by simply passing new props:
- **`text`**: Titles, subtitles, badges, bullets, CTAs.
- **`media`**: URLs, local paths (`staticFile`), icons, screenshots.
- **`theme`**: The storyboard's shared color palette and typography.
- **`audio`**: Optional sound effects (`sfxSrc`) or localized voiceover cues.

⚡ **Criação Proativa**: Se o storyboard necessitar de qualquer layout novo ou não existente no catálogo (ex: gráficos, split comparativo, lista de features, contadores), **crie proativamente** o novo componente reutilizável através da skill `storyboard-video-remotion-scene`. O catálogo cresce e enriquece a cada novo vídeo.

---

## 📁 Estrutura de Arquivos de Saída do Vídeo

Todos os arquivos gerados para um vídeo montado por esta skill **DEVEM** ser organizados na seguinte hierarquia autônoma (compatível com `staticFile()` e Remotion Studio):

```
.ultraskills/storyboard-video/<collection-slug>/<video-slug>/
├── storyboard.json                 # Especificação completa do storyboard em JSON
├── src/
│   ├── Video.tsx                   # Composição principal com <TransitionSeries>, áudios e legendas
│   └── Root.tsx                    # Configuração Remotion, schemas Zod e <Folder id="Scenes">
├── public/                         # Assets estáticos resolvidos via staticFile()
│   ├── audio/                      # Locuções geradas (edge-tts), trilhas e SFX
│   │   ├── scene_01_hook.mp3
│   │   ├── scene_01_hook.vtt       # Legendas sincronizadas consumidas por <SyncedCaptions>
│   │   ├── scene_02_feature.mp3
│   │   ├── scene_02_feature.vtt
│   │   ├── bgm.mp3                 # Trilha musical de fundo
│   │   └── sfx_whoosh.mp3          # Efeitos sonoros
│   └── assets/                     # Imagens, b-roll ou ícones pesquisados (media-research)
└── out/                            # Saída da renderização final do vídeo
    └── video.mp4
```

### Regras de Organização
1. **`collection-slug`**: Nome da coleção ou categoria do projeto (ex: `product-launch`, `shorts-marketing`, `tutorials`, `saas-promos`).
2. **`video-slug`**: Identificador único do vídeo específico (ex: `launch-announcement`, `pricing-breakdown-v1`, `quick-tip-01`).
3. **Cenas Reutilizáveis**: Permanecem centralizadas no catálogo global [`.ultraskills/remotion/scenes/`](file:///c:/Users/higor/ws/higorsilvarosa/ultraskills/.ultraskills/remotion/scenes/) e são importadas pelo `src/Video.tsx` do projeto.
4. **Isolamento de Recursos e `public/`**: Narrações, legendas, assets de mídia e arquivos pertencentes exclusivamente àquele vídeo ficam dentro da pasta `public/` do vídeo para que `staticFile()` resolva os assets com 100% de confiabilidade.

---

## Storyboard Creation Workflow

```
┌────────────────────────────────────────────────────────┐
│ 1. Video Brief & Configuration                         │
│    (Aspect ratio, FPS, Duration target, Style, Theme)  │
└──────────────────────────┬─────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────┐
│ 2. Storyboard Specification & Scene Catalog Check      │
│    (Check .ultraskills/remotion/scenes/ for reusable   │
│     components; define props & frame budgets)          │
└──────────────────────────┬─────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────┐
│ 3. Scene Delegation (if new layout is needed)          │
│    (Call storyboard-video-remotion-scene to save in    │
│     .ultraskills/remotion/scenes/<slug>.tsx)           │
└──────────────────────────┬─────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────┐
│ 4. Timeline Assembly (Video.tsx)                       │
│    (TransitionSeries, Overlaps, Audio layers, Props)   │
└──────────────────────────┬─────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────┐
│ 5. Remotion Root Architecture (Root.tsx)               │
│    (Folder for individual scenes + Main Composition)   │
└────────────────────────────────────────────────────────┘
```

---

## Step 1: Video Brief & Design Theme

Confirm or establish technical and visual parameters:

### Supported Aspect Ratios & Formats

| Formato | Dimensões | Proporção | Plataformas Principais | Configuração Remotion |
| :--- | :--- | :--- | :--- | :--- |
| **Horizontal (Landscape)** | `1920x1080` | `16:9` | YouTube, Website, Apresentações, Desktop | `<Composition width={1920} height={1080} />` |
| **Vertical (Portrait)** | `1080x1920` | `9:16` | TikTok, Instagram Reels, YouTube Shorts, Stories | `<Composition width={1080} height={1920} />` |
| **Quadrado (Square)** | `1080x1080` | `1:1` | Instagram Feed, LinkedIn, Facebook Feed | `<Composition width={1080} height={1080} />` |

* **Frame Rate (`fps`)**: Padrão `30` fps (ou `60` fps para animações ultrarrápidas).
* **Meta de Duração**: ex: 15s (450 frames @ 30fps), 30s (900 frames @ 30fps).
* **Storyboard Theme**: Cores e tipografia compartilhadas (`StoryboardTheme`) em todas as cenas.
* **Áudio**: Trilha Sonora (BGM) + Narração (`edge-tts`) + Efeitos Sonoros (SFX).

---

## Step 2: Storyboard Specification

Present the storyboard breakdown to the user, specifying the reusable scene slug and props:

| # | Scene Slug / File | Duration | Script / Narrative | Props (Text, Media, Theme, Audio) | Transition Out |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **01** | `scene-hero-headline.tsx` | 3s (90f) | "Crie vídeos programáticos" | `badgeText: 'NOVIDADE'`, `headline: 'Vídeos com Remotion'`, `highlightWord: 'Remotion'` | Fade (15f) |
| **02** | `scene-feature-grid.tsx` | 5s (150f) | "Componentes modulares" | `title: '100% Reutilizável'`, `items: [...]` | Slide left (15f) |
| **03** | `scene-split-comparison.tsx`| 8s (240f) | "Antes vs Depois" | `leftTitle: 'Manual'`, `rightTitle: 'Automatizado'` | Fade (15f) |
| **04** | `scene-cta-pulse.tsx` | 4s (120f) | "Comece agora" | `ctaText: 'Ver no GitHub'`, `url: 'remotion.dev'` | None (End) |

See [references/storyboard_schema.md](file:///c:/Users/higor/ws/higorsilvarosa/ultraskills/.agents/skills/storyboard-video/references/storyboard_schema.md) for programmatic JSON representation.

---

## Step 2.5: Proactive Scene Creation (When Layout is Missing)

Before assembling the timeline:
1. Verify which scene slugs from the storyboard already exist in `.ultraskills/remotion/scenes/`.
2. For any scene slug that **does not exist**, delegate the creation to **`storyboard-video-remotion-scene`**.
3. **CRITICAL SUBAGENT RULE**: You **MUST** use the `invoke_subagent` tool (e.g. spawning a `self` subagent) to execute the `storyboard-video-remotion-scene` skill. This ensures the main agent's conversation context remains clean. Do not execute it directly in your current context.
4. **Never pause or block** asking permission: have the subagent build the reusable `.tsx` component with generic props, default values, and standard animations, saving it into `.ultraskills/remotion/scenes/<slug>.tsx`. Wait for the subagent to complete.
5. Once all required scenes exist in the catalog, proceed directly to assembling the video timeline.

---

## Step 2.6: Narration Generation with `edge-tts`

When the storyboard includes voiceover narration:
## Step 2.6: Narration Generation with `edge-tts`
 
When the storyboard includes voiceover narration:
1. Use the bundled script to generate high-quality voiceover audio (and `.vtt` subtitles) directly inside the project's `public/audio` folder:
   ```bash
   python .agents/skills/storyboard-video/scripts/synthesize_voiceover.py \
     --text "Texto da narração para a cena" \
     --voice pt-BR-AntonioNeural \
     --project-dir .ultraskills/storyboard-video/<collection-slug>/<video-slug> \
     --filename scene_01_hook \
     --fps 30 \
     --padding-frames 15
   ```
2. The script returns a JSON payload with the exact duration:
   ```json
   {
     "audioFile": "audio/scene_01_hook.mp3",
     "subtitlesFile": "audio/scene_01_hook.vtt",
     "speechFrames": 129,
     "totalDurationInFrames": 144
   }
   ```
3. **Precise Frame Budgeting**: Set the scene's `durationInFrames` to `totalDurationInFrames`. This guarantees that the visual scene and speech end at the exact same moment without awkward dead silence or cut-offs!

---

## Step 2.7: Media Discovery with `media-research`

When the scene needs stock photos, video b-roll, or sound effects:
1. **CRITICAL SUBAGENT RULE**: You **MUST** use the `invoke_subagent` tool (e.g., spawning a `research` or `self` subagent) to execute the [media-research](file:///c:/Users/higor/ws/higorsilvarosa/ultraskills/.agents/skills/media-research/SKILL.md) skill. This keeps your context clean. Instruct the subagent to run the necessary search commands, such as:
   ```bash
   python .agents/skills/media-research/scripts/search_media.py "tecnologia e inteligência artificial" --type image --env_path .env
   python .agents/skills/media-research/scripts/search_media.py "whoosh impact" --type audio --env_path .env
   ```
2. Once the subagent returns the results, inject the selected asset URL or downloaded local file path (`public/assets/...` / `public/audio/...`) into the scene's `media` and `audio` props.

---

## Step 2.8: Storyboard Validation with Zod

Before assembling components, validate the storyboard JSON against the formal Zod schema:
```tsx
import { StoryboardSchema } from '../../../../remotion/storyboard-schema';
import rawStoryboard from './storyboard.json';

export const storyboard = StoryboardSchema.parse(rawStoryboard);
```

---

## Step 3: Timeline Assembly (`src/Video.tsx`)

Assemble the reusable scenes into the main video component, passing the global theme, customized props, and font loading:

```tsx
import React from 'react';
import { TransitionSeries, linearTiming } from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';
import { slide } from '@remotion/transitions/slide';
import { Audio } from '@remotion/media';
import { staticFile, useVideoConfig } from 'remotion';

import '../../../../remotion/load-fonts'; // Preload Inter font automatically
import { StoryboardTheme } from '../../../../remotion/types';
import { SyncedCaptions } from '../../../../remotion/components/synced-captions';
import { SceneHeroHeadline } from '../../../../remotion/scenes/scene-hero-headline';
import { SceneFeatureGrid } from '../../../../remotion/scenes/scene-feature-grid';

export const videoTheme: StoryboardTheme = {
  backgroundColor: '#0A0F1D',
  textColor: '#F8FAFC',
  primaryColor: '#38BDF8',
  accentColor: '#6366F1',
  fontFamily: 'Inter, sans-serif',
  borderRadius: 16,
};

export const MainVideo: React.FC = () => {
  const { fps } = useVideoConfig();

  return (
    <>
      {/* Background Music with Fade-in */}
      <Audio
        src={staticFile('audio/bgm.mp3')}
        volume={(f) => (f < 15 ? (f / 15) * 0.25 : 0.25)}
        loop
      />

      <TransitionSeries>
        {/* Scene 1: Hero com Locução TTS e Legendas Sincronizadas */}
        <TransitionSeries.Sequence durationInFrames={3 * fps} name="Hero">
          <SceneHeroHeadline
            badgeText="LANÇAMENTO"
            headline="Vídeos Dinâmicos com Remotion"
            highlightWord="Remotion"
            subtitle="Gere vídeos automatizados com componentes React reutilizáveis"
            theme={videoTheme}
            audio={{
              voiceoverSrc: 'audio/scene_01_hook.mp3',
              sfxSrc: 'audio/whoosh.mp3',
              sfxVolume: 0.4,
              sfxStartFrame: 8,
            }}
          />
          {/* Legendas extraídas do .vtt gerado no Passo 2.6 */}
          <SyncedCaptions
            src={staticFile('audio/scene_01_hook.vtt')}
            theme={videoTheme}
          />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: 15 })}
        />

        {/* Scene 2: Feature Grid */}
        <TransitionSeries.Sequence durationInFrames={4 * fps} name="Features">
          <SceneFeatureGrid
            badgeText="DESIGN CONSISTENTE"
            title="Identidade Visual Unificada"
            subtitle="Todas as cenas compartilham o mesmo tema e tokens de design"
            theme={videoTheme}
          />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </>
  );
};
```

---

## Step 4: Remotion Root Architecture (`src/Root.tsx`)

Register individual scenes in `<Folder id="Scenes">` inside `src/Root.tsx` with their Zod schemas to enable scrubbing, visual editing, and previewing each scene in Remotion Studio.

> [!TIP]
> **Validação Estrita de Props**: Ao carregar dinamicamente dados do `storyboard.json`, valide as `props` de cada cena com o schema exportado correspondente (ex: `sceneHeroHeadlineSchema.parse(scene.props)`). Isso garante que propriedades incorretas ou incompletas falhem em tempo de compilação/execução, com mensagens de erro claras no console do Remotion.

```tsx
import React from 'react';
import { Composition, Folder } from 'remotion';
import { MainVideo, videoTheme } from './Video';
import { SceneHeroHeadline, sceneHeroHeadlineSchema } from '../../../../remotion/scenes/scene-hero-headline';
import { SceneFeatureGrid, sceneFeatureGridSchema } from '../../../../remotion/scenes/scene-feature-grid';

export const RemotionRoot: React.FC = () => {
  const fps = 30;
  const width = 1920;
  const height = 1080;

  return (
    <>
      {/* Folder for Individual Scene Isolation & Studio Previews */}
      <Folder id="Scenes">
        <Composition
          id="01-Hero"
          component={SceneHeroHeadline}
          durationInFrames={3 * fps}
          fps={fps}
          width={width}
          height={height}
          schema={sceneHeroHeadlineSchema}
          defaultProps={{
            badgeText: 'PREVIEW',
            headline: 'Cena Hero Isolada',
            theme: videoTheme,
          }}
        />
        <Composition
          id="02-Features"
          component={SceneFeatureGrid}
          durationInFrames={4 * fps}
          fps={fps}
          width={width}
          height={height}
          schema={sceneFeatureGridSchema}
          defaultProps={{
            theme: videoTheme,
          }}
        />
      </Folder>

      {/* Full Video Storyboard Composition */}
      <Composition
        id="MainVideo"
        component={MainVideo}
        durationInFrames={195} // sum(scenes) - sum(transitions)
        fps={fps}
        width={width}
        height={height}
      />
    </>
  );
};
```

---

## Commands & Workflow

> [!NOTE]
> Os comandos do Remotion abaixo devem ser executados a partir da raiz do repositório/workspace, aproveitando o `package.json` e as dependências instaladas globalmente no projeto (`remotion`, `@remotion/transitions`, `@remotion/media`, etc.).

- Inspecionar catálogo de cenas com metadados e Zod schemas:
  ```bash
  python .agents/skills/storyboard-video/scripts/list_scenes.py
  ```
- Visualizar vídeo no Remotion Studio:
  ```bash
  npx remotion studio .ultraskills/storyboard-video/<collection-slug>/<video-slug>/src/Root.tsx --no-open
  ```
- Renderizar preview rápido de 1 frame (sanity check):
  ```bash
  npx remotion still .ultraskills/storyboard-video/<collection-slug>/<video-slug>/src/Root.tsx MainVideo out/still.png --frame=30
  ```
- Renderizar vídeo final (.mp4):
  ```bash
  npx remotion render .ultraskills/storyboard-video/<collection-slug>/<video-slug>/src/Root.tsx MainVideo .ultraskills/storyboard-video/<collection-slug>/<video-slug>/out/video.mp4 --concurrency=4 --crf=18
  ```
- Renderizar trecho parcial para testes:
  ```bash
  npx remotion render .ultraskills/storyboard-video/<collection-slug>/<video-slug>/src/Root.tsx MainVideo .ultraskills/storyboard-video/<collection-slug>/<video-slug>/out/test.mp4 --frames=0-90
  ```

*(Remember: Always execute background terminal commands according to user rules).*
