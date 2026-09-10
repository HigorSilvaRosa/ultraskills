import React from 'react';
import { Composition, Folder } from 'remotion';
import { MainVideo, videoTheme } from './Video';

import { SceneHeroHeadline } from '../../../../remotion/scenes/scene-hero-headline';
import { SceneSplitComparison } from '../../../../remotion/scenes/scene-split-comparison';
import { SceneFeatureGrid } from '../../../../remotion/scenes/scene-feature-grid';
import { SceneMetricCounter } from '../../../../remotion/scenes/scene-metric-counter';
import { SceneQuoteTestimonial } from '../../../../remotion/scenes/scene-quote-testimonial';
import { SceneCtaPulse } from '../../../../remotion/scenes/scene-cta-pulse';

export const RemotionRoot: React.FC = () => {
  const fps = 30;
  const width = 1080;
  const height = 1920;

  return (
    <>
      {/* Pasta para pré-visualização isolada de cada cena do documentário no Studio */}
      <Folder name="Cenas-do-Documentario">
        <Composition
          id="01-Hook"
          component={SceneHeroHeadline}
          durationInFrames={416}
          fps={fps}
          width={width}
          height={height}
          defaultProps={{
            badgeText: 'MINI-DOCUMENTÁRIO',
            headline: 'O Encanto dos Filhotes de Shih Tzu',
            highlightWord: 'Shih Tzu',
            subtitle: 'Descubra o universo das criaturinhas mais adoráveis e carinhosas do planeta',
            theme: videoTheme,
            media: {
              src: 'assets/puppy_01_hero.jpg',
              type: 'image',
              alt: 'Filhote de Shih Tzu fofo',
            },
          }}
        />

        <Composition
          id="02-OrigemImperial"
          component={SceneSplitComparison}
          durationInFrames={417}
          fps={fps}
          width={width}
          height={height}
          defaultProps={{
            badgeText: 'ORIGEM REAL',
            title: 'De Cães Sagrados a Membros da Família',
            subtitle: 'Uma história imperial cheia de amor e nobreza',
            theme: videoTheme,
            leftCard: {
              tag: 'CHINA ANTIGA',
              title: 'Dinastia Ming',
              description: 'Considerados sagrados nos templos e palácios, viviam cheios de mimos no colo de imperadores.',
              highlightColor: '#F59E0B',
            },
            rightCard: {
              tag: 'HOJE EM DIA',
              title: 'Coração do Lar',
              description: 'Conquistaram lares no mundo todo com sua doçura incondicional e jeitinho apaixonante.',
              highlightColor: '#FB7185',
            },
          }}
        />

        <Composition
          id="03-Caracteristicas"
          component={SceneFeatureGrid}
          durationInFrames={362}
          fps={fps}
          width={width}
          height={height}
          defaultProps={{
            badgeText: 'TRAÇOS APAIXONANTES',
            title: 'Por que eles são tão irresistíveis?',
            subtitle: 'Cada detalhe parece esculpido para derreter o nosso coração',
            theme: videoTheme,
            items: [
              {
                title: 'Olhinhos de Jabuticaba',
                description: 'Grandes, escuros e transbordando carinho e curiosidade.',
              },
              {
                title: 'Focinho Achatado',
                description: 'Carinha braquicefálica que dá a eterna expressão de bebê.',
              },
              {
                title: 'Pelagem Algodão',
                description: 'Pêlos ultra macios que lembram um bichinho de pelúcia vivo.',
              },
            ],
          }}
        />

        <Composition
          id="04-Rotina"
          component={SceneMetricCounter}
          durationInFrames={423}
          fps={fps}
          width={width}
          height={height}
          defaultProps={{
            badgeText: 'O DIA A DIA',
            title: 'A Maratona de um Filhote',
            subtitle: 'Entre explosões de energia e sonecas ultra pesadas',
            theme: videoTheme,
            metrics: [
              {
                value: 10,
                prefix: '',
                suffix: ' min',
                label: 'Corrida Maluca',
                sublabel: 'atrás de meias pela casa',
              },
              {
                value: 18,
                prefix: '',
                suffix: ' h',
                label: 'Sono dos Anjos',
                sublabel: 'roncando bem baixinho',
              },
              {
                value: 100,
                prefix: '',
                suffix: '%',
                label: 'Dengo e Charme',
                sublabel: 'em tempo integral',
              },
            ],
          }}
        />

        <Composition
          id="05-Cuidados"
          component={SceneFeatureGrid}
          durationInFrames={456}
          fps={fps}
          width={width}
          height={height}
          defaultProps={{
            badgeText: 'BEM-ESTAR',
            title: 'Cuidados com Seu Novo Melhor Amigo',
            subtitle: 'Para que ele cresça sempre com saúde e muita alegria',
            theme: videoTheme,
            items: [
              {
                title: 'Escovação Diária',
                description: 'Evita nós e mantém a pelagem desembaraçada, macia e brilhante.',
              },
              {
                title: 'Atenção ao Calor',
                description: 'Ambientes ventilados e fresquinhos com água limpa sempre à mão.',
              },
              {
                title: 'Doses de Carinho',
                description: 'Passeios leves, carinho na barriga e educação com reforço positivo.',
              },
            ],
          }}
        />

        <Composition
          id="06-Amor"
          component={SceneQuoteTestimonial}
          durationInFrames={394}
          fps={fps}
          width={width}
          height={height}
          defaultProps={{
            badgeText: 'CONEXÃO ÚNICA',
            quote: 'Quem tem um Shih Tzu em casa descobre que a lealdade tem quatro patas e um rabinho que não para de abanar.',
            authorName: 'Mini-Documentário Canino',
            authorRole: 'Puro Afeto em Quatro Patas',
            authorCompany: 'Companheirismo Sem Fim',
            theme: videoTheme,
          }}
        />

        <Composition
          id="07-Desfecho"
          component={SceneCtaPulse}
          durationInFrames={363}
          fps={fps}
          width={width}
          height={height}
          defaultProps={{
            badgeText: 'ETERNO BEBÊ',
            headline: 'O Amor Puro em Forma de Patinhas',
            highlightWord: 'Amor',
            subtitle: 'A felicidade vem embrulhada em pelos macios e um olhar apaixonado. Cuide com amor do seu pequeno príncipe!',
            buttonText: 'Abrace Seu Amiguinho',
            urlText: 'ultraskills.dev/documentaries',
            theme: videoTheme,
          }}
        />
      </Folder>

      {/* Composição Final do Documentário Completo */}
      <Composition
        id="MainVideo"
        component={MainVideo}
        durationInFrames={2741} // Soma dos frames (2831) menos 6 transições de 15f (90f)
        fps={fps}
        width={width}
        height={height}
      />
    </>
  );
};
