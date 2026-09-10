import React from 'react';
import { Composition, Folder } from 'remotion';
import { MainVideo, videoTheme } from './Video';

import { SceneHeroHeadline } from '../../../remotion/scenes/scene-hero-headline';
import { SceneSplitComparison } from '../../../remotion/scenes/scene-split-comparison';
import { SceneMetricCounter } from '../../../remotion/scenes/scene-metric-counter';
import { SceneCtaPulse } from '../../../remotion/scenes/scene-cta-pulse';

export const RemotionRoot: React.FC = () => {
  const fps = 30;
  const width = 1920;
  const height = 1080;

  return (
    <>
      {/* Pasta para pré-visualizar e inspecionar cada cena isoladamente no Studio */}
      <Folder id="Scenes">
        <Composition
          id="01-SceneHero"
          component={SceneHeroHeadline}
          durationInFrames={90}
          fps={fps}
          width={width}
          height={height}
          defaultProps={{
            badgeText: 'NOVIDADE',
            headline: 'Vídeos Programáticos em Escala',
            highlightWord: 'Escala',
            subtitle: 'Gere sequências de cenas com React e Remotion de forma declarativa',
            theme: videoTheme,
          }}
        />

        <Composition
          id="02-SceneSplitComparison"
          component={SceneSplitComparison}
          durationInFrames={150}
          fps={fps}
          width={width}
          height={height}
          defaultProps={{
            badgeText: 'COMPARATIVO',
            title: 'Manual vs Automação',
            subtitle: 'Economize horas de edição repetitiva',
            theme: videoTheme,
          }}
        />

        <Composition
          id="03-SceneMetricCounter"
          component={SceneMetricCounter}
          durationInFrames={120}
          fps={fps}
          width={width}
          height={height}
          defaultProps={{
            badgeText: 'IMPACTO',
            title: 'Resultados Reais',
            subtitle: 'Mais velocidade para sua equipe',
            theme: videoTheme,
          }}
        />

        <Composition
          id="04-SceneCtaPulse"
          component={SceneCtaPulse}
          durationInFrames={120}
          fps={fps}
          width={width}
          height={height}
          defaultProps={{
            badgeText: 'COMECE AGORA',
            headline: 'Eleve Sua Produção de Vídeos',
            highlightWord: 'Eleve',
            subtitle: 'Conheça as skills de storyboard e crie seus primeiros vídeos hoje mesmo',
            buttonText: 'Explorar no GitHub',
            urlText: 'github.com/higorsilvarosa/ultraskills',
            theme: videoTheme,
          }}
        />
      </Folder>

      {/* Composição Raiz do Vídeo Completo */}
      <Composition
        id="MainVideo"
        component={MainVideo}
        durationInFrames={435} // Total considerando os 3 overlaps de transição (15f cada)
        fps={fps}
        width={width}
        height={height}
      />
    </>
  );
};
