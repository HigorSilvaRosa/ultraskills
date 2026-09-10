# Storyboard JSON Schema Reference

Structured schema for defining reusable-scene based storyboards with global design consistency.
Formal TypeScript & Zod validation is implemented in `.ultraskills/remotion/storyboard-schema.ts`.

```json
{
  "title": "Apresentação de Produto - UltraSkills",
  "fps": 30,
  "width": 1920,
  "height": 1080,
  "theme": {
    "backgroundColor": "#0A0F1D",
    "textColor": "#F8FAFC",
    "primaryColor": "#38BDF8",
    "accentColor": "#6366F1",
    "secondaryColor": "#A855F7",
    "mutedColor": "#94A3B8",
    "fontFamily": "Inter, sans-serif",
    "borderRadius": 16
  },
  "audio": {
    "bgm": "audio/energetic_track.mp3",
    "bgmVolume": 0.25
  },
  "scenes": [
    {
      "id": "scene_01",
      "sceneSlug": "scene-hero-headline",
      "durationInFrames": 90,
      "narrative": "Hook com novidade e impacto",
      "props": {
        "badgeText": "LANÇAMENTO",
        "headline": "Vídeos com Componentes Reutilizáveis",
        "highlightWord": "Reutilizáveis",
        "subtitle": "Cada cena é um componente React flexível e configurável por props"
      },
      "audio": {
        "sfxSrc": "audio/whoosh.mp3",
        "sfxVolume": 0.4,
        "sfxStartFrame": 8
      },
      "transitionOut": {
        "type": "fade",
        "durationInFrames": 15
      }
    },
    {
      "id": "scene_02",
      "sceneSlug": "scene-split-comparison",
      "durationInFrames": 150,
      "narrative": "Comparativo antes vs depois",
      "props": {
        "title": "Produção de Vídeo Escalável",
        "media": {
          "src": "assets/preview-code.png",
          "type": "image"
        }
      },
      "transitionOut": {
        "type": "slide",
        "direction": "from-right",
        "durationInFrames": 15
      }
    },
    {
      "id": "scene_03",
      "sceneSlug": "scene-cta-pulse",
      "durationInFrames": 120,
      "narrative": "Chamada para ação final",
      "props": {
        "headline": "Comece Hoje Mesmo",
        "highlightWord": "Hoje",
        "buttonText": "Explore o Repositório no GitHub",
        "badgeText": "OPEN SOURCE"
      },
      "transitionOut": null
    }
  ]
}
```

## Diretrizes de Reuso e Validação

1. **Validação com Zod**:
   ```tsx
   import { StoryboardSchema } from '../.ultraskills/remotion/storyboard-schema';
   const validatedStoryboard = StoryboardSchema.parse(rawStoryboardJson);
   ```
2. **`theme`**: Compartilhado por todas as cenas do storyboard, garantindo cores, fontes e estilo uniformes.
3. **`sceneSlug`**: Identifica o arquivo em `.ultraskills/remotion/scenes/<sceneSlug>.tsx`.
4. **`props`**: Injeta dinamicamente textos, mídias, dados ou variações, dispensando a recriação do componente.
5. **Assets e Áudios**: Caminhos relativos (`audio/...`, `assets/...`) são resolvidos pelo Remotion via `staticFile()` a partir da pasta `public/` do projeto.

