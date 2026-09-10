import React from 'react';
import { TransitionSeries, linearTiming } from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';
import { Audio } from '@remotion/media';
import { staticFile, useVideoConfig } from 'remotion';

import { StoryboardTheme } from '../../../remotion/types';
import { SceneHeroHeadline } from '../../../remotion/scenes/scene-hero-headline';
import { SceneSplitComparison } from '../../../remotion/scenes/scene-split-comparison';
import { SceneMetricCounter } from '../../../remotion/scenes/scene-metric-counter';
import { SceneCtaPulse } from '../../../remotion/scenes/scene-cta-pulse';

export const videoTheme: StoryboardTheme = {
  backgroundColor: '#0A0F1D',
  textColor: '#F8FAFC',
  primaryColor: '#38BDF8',
  accentColor: '#6366F1',
  secondaryColor: '#A855F7',
  mutedColor: '#94A3B8',
  fontFamily: 'Inter, system-ui, sans-serif',
  borderRadius: 16,
};

export const MainVideo: React.FC = () => {
  const { fps } = useVideoConfig();

  return (
    <>
      {/* Trilha Sonora com Ducking suave */}
      <Audio
        src={staticFile('audio/bgm.mp3')}
        volume={(f) => (f < 15 ? (f / 15) * 0.2 : 0.2)}
        loop
      />

      <TransitionSeries>
        {/* Cena 1: Hero */}
        <TransitionSeries.Sequence durationInFrames={90} name="Hero">
          <SceneHeroHeadline
            badgeText="NOVIDADE"
            headline="Vídeos Programáticos em Escala"
            highlightWord="Escala"
            subtitle="Gere sequências de cenas com React e Remotion de forma declarativa"
            theme={videoTheme}
            audio={{ voiceoverSrc: 'audio/scene_01_hook.mp3' }}
          />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: 15 })}
        />

        {/* Cena 2: Comparativo Antes vs Depois */}
        <TransitionSeries.Sequence durationInFrames={150} name="Comparativo">
          <SceneSplitComparison
            badgeText="COMPARATIVO"
            title="Manual vs Automação"
            subtitle="Economize horas de edição repetitiva"
            theme={videoTheme}
            leftCard={{
              tag: 'TRADICIONAL',
              title: 'Edição Manual',
              description: 'Cortes quadro a quadro, keyframes manuais e retrabalho a cada variação.',
              highlightColor: '#EF4444',
            }}
            rightCard={{
              tag: 'COM ULTRASKILLS',
              title: '100% Automatizado',
              description: 'Componentes reutilizáveis, dados dinâmicos e exportação instantânea.',
              highlightColor: '#10B981',
            }}
          />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: 15 })}
        />

        {/* Cena 3: Métricas de Sucesso */}
        <TransitionSeries.Sequence durationInFrames={120} name="Metricas">
          <SceneMetricCounter
            badgeText="IMPACTO"
            title="Resultados Reais"
            subtitle="Mais velocidade para sua equipe"
            theme={videoTheme}
            metrics={[
              { value: 10, prefix: '', suffix: 'x', label: 'Mais Rápido', sublabel: 'em produção' },
              { value: 100, prefix: '', suffix: '%', label: 'Reutilizável', sublabel: 'em código React' },
              { value: 1000, prefix: '+', suffix: '', label: 'Variações', sublabel: 'por campanha' },
            ]}
          />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: 15 })}
        />

        {/* Cena 4: Chamada para Ação */}
        <TransitionSeries.Sequence durationInFrames={120} name="CTA">
          <SceneCtaPulse
            badgeText="COMECE AGORA"
            headline="Eleve Sua Produção de Vídeos"
            highlightWord="Eleve"
            subtitle="Conheça as skills de storyboard e crie seus primeiros vídeos hoje mesmo"
            buttonText="Explorar no GitHub"
            urlText="github.com/higorsilvarosa/ultraskills"
            theme={videoTheme}
          />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </>
  );
};
