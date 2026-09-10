import React from 'react';
import { TransitionSeries, linearTiming } from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';
import { Audio } from '@remotion/media';
import { staticFile, useVideoConfig } from 'remotion';

import { StoryboardTheme } from '../../../../remotion/types';
import { SyncedCaptions } from '../../../../remotion/components/synced-captions';
import { SceneVerticalDocumentary } from '../../../../remotion/scenes/scene-vertical-documentary';

import captionsData from './captions.json';

export const videoTheme: StoryboardTheme = {
  backgroundColor: '#181310',
  textColor: '#FFF8F0',
  primaryColor: '#F59E0B',
  accentColor: '#FB7185',
  secondaryColor: '#FBBF24',
  mutedColor: '#D6C7B8',
  fontFamily: 'Inter, system-ui, sans-serif',
  borderRadius: 20,
};

export const MainVideo: React.FC = () => {
  const { fps } = useVideoConfig();

  return (
    <>
      {/* Trilha Sonora com volume ajustado para 0.30 (mais presente conforme solicitado) */}
      <Audio
        src={staticFile('audio/bgm.mp3')}
        volume={(f) => (f < 20 ? (f / 20) * 0.30 : 0.30)}
        loop
      />

      <TransitionSeries>
        {/* Cena 1: Hook / Introdução com Vídeo Full-Bleed */}
        <TransitionSeries.Sequence durationInFrames={416} name="01-Hook">
          <Audio src={staticFile('audio/scene_01_hook.mp3')} volume={1} />
          <SceneVerticalDocumentary
            badgeText="MINI-DOCUMENTÁRIO"
            title="O Encanto dos Filhotes de Shih Tzu"
            highlightWord="Shih Tzu"
            subtitle="Descubra o universo das criaturinhas mais adoráveis e carinhosas do planeta"
            bgVideoSrc="videos/video_01_hero.mp4"
            theme={videoTheme}
          />
          <SyncedCaptions captions={captionsData.scene_01_hook} theme={videoTheme} />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: 15 })}
        />

        {/* Cena 2: Origem Imperial com Vídeo de Colo */}
        <TransitionSeries.Sequence durationInFrames={417} name="02-OrigemImperial">
          <Audio src={staticFile('audio/scene_02_origem.mp3')} volume={1} />
          <SceneVerticalDocumentary
            badgeText="ORIGEM REAL"
            title="De Cães Sagrados a Membros da Família"
            highlightWord="Sagrados"
            subtitle="Uma história imperial cheia de amor e nobreza"
            bgVideoSrc="videos/video_02_lap.mp4"
            theme={videoTheme}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%', maxWidth: 700 }}>
              <div
                style={{
                  background: 'rgba(24, 19, 16, 0.65)',
                  backdropFilter: 'blur(16px)',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  borderRadius: 16,
                  padding: '16px 24px',
                  textAlign: 'left',
                }}
              >
                <span style={{ color: '#F59E0B', fontWeight: 800, fontSize: 14, letterSpacing: '0.05em' }}>CHINA ANTIGA (DINASTIA MING)</span>
                <p style={{ margin: '6px 0 0 0', color: '#FFF8F0', fontSize: 18, lineHeight: 1.3 }}>
                  Considerados cães sagrados nos palácios, viviam cheios de mimos no colo de imperadores.
                </p>
              </div>
              <div
                style={{
                  background: 'rgba(24, 19, 16, 0.65)',
                  backdropFilter: 'blur(16px)',
                  border: '1px solid rgba(251, 113, 133, 0.3)',
                  borderRadius: 16,
                  padding: '16px 24px',
                  textAlign: 'left',
                }}
              >
                <span style={{ color: '#FB7185', fontWeight: 800, fontSize: 14, letterSpacing: '0.05em' }}>HOJE EM DIA</span>
                <p style={{ margin: '6px 0 0 0', color: '#FFF8F0', fontSize: 18, lineHeight: 1.3 }}>
                  Conquistaram lares do mundo inteiro com sua doçura incondicional e afeto apaixonante.
                </p>
              </div>
            </div>
          </SceneVerticalDocumentary>
          <SyncedCaptions captions={captionsData.scene_02_origem} theme={videoTheme} />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: 15 })}
        />

        {/* Cena 3: Características Físicas com Vídeo Close-Up */}
        <TransitionSeries.Sequence durationInFrames={362} name="03-Caracteristicas">
          <Audio src={staticFile('audio/scene_03_caracteristicas.mp3')} volume={1} />
          <SceneVerticalDocumentary
            badgeText="TRAÇOS APAIXONANTES"
            title="Por que eles são tão irresistíveis?"
            highlightWord="irresistíveis"
            subtitle="Cada detalhe parece esculpido para derreter o nosso coração"
            bgVideoSrc="videos/video_03_closeup.mp4"
            theme={videoTheme}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, width: '100%', maxWidth: 720 }}>
              {[
                { title: '👀 Olhinhos de Jabuticaba', desc: 'Grandes, expressivos e transbordando curiosidade e carinho.' },
                { title: '🐾 Focinho Achatado', desc: 'Carinha braquicefálica que dá a eterna expressão de bebê.' },
                { title: '☁️ Pelagem Algodão Doce', desc: 'Pêlos ultra sedosos e macios que parecem uma pelúcia viva.' },
              ].map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    background: 'rgba(24, 19, 16, 0.68)',
                    backdropFilter: 'blur(14px)',
                    border: '1px solid rgba(255, 248, 240, 0.12)',
                    borderRadius: 16,
                    padding: '14px 20px',
                    textAlign: 'left',
                  }}
                >
                  <div style={{ color: '#F59E0B', fontWeight: 800, fontSize: 17 }}>{item.title}</div>
                  <div style={{ color: '#D6C7B8', fontSize: 15, marginTop: 4 }}>{item.desc}</div>
                </div>
              ))}
            </div>
          </SceneVerticalDocumentary>
          <SyncedCaptions captions={captionsData.scene_03_caracteristicas} theme={videoTheme} />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: 15 })}
        />

        {/* Cena 4: Rotina do Filhote com Vídeo de Corrida / Brincadeira */}
        <TransitionSeries.Sequence durationInFrames={423} name="04-Rotina">
          <Audio src={staticFile('audio/scene_04_rotina.mp3')} volume={1} />
          <SceneVerticalDocumentary
            badgeText="O DIA A DIA"
            title="A Maratona de um Filhote"
            highlightWord="Maratona"
            subtitle="Entre explosões de energia e sonecas ultra pesadas"
            bgVideoSrc="videos/video_04_running.mp4"
            theme={videoTheme}
          >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, width: '100%', maxWidth: 700 }}>
              <div
                style={{
                  background: 'rgba(24, 19, 16, 0.70)',
                  backdropFilter: 'blur(16px)',
                  border: '1px solid rgba(245, 158, 11, 0.35)',
                  borderRadius: 18,
                  padding: '20px 16px',
                }}
              >
                <div style={{ fontSize: 44, fontWeight: 900, color: '#F59E0B' }}>10 min</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#FFF8F0', marginTop: 4 }}>Corrida Maluca</div>
                <div style={{ fontSize: 14, color: '#D6C7B8', marginTop: 2 }}>atrás de meias</div>
              </div>
              <div
                style={{
                  background: 'rgba(24, 19, 16, 0.70)',
                  backdropFilter: 'blur(16px)',
                  border: '1px solid rgba(251, 113, 133, 0.35)',
                  borderRadius: 18,
                  padding: '20px 16px',
                }}
              >
                <div style={{ fontSize: 44, fontWeight: 900, color: '#FB7185' }}>18 horas</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#FFF8F0', marginTop: 4 }}>Sono dos Anjos</div>
                <div style={{ fontSize: 14, color: '#D6C7B8', marginTop: 2 }}>roncando bem fofo</div>
              </div>
              <div
                style={{
                  gridColumn: '1 / -1',
                  background: 'rgba(24, 19, 16, 0.70)',
                  backdropFilter: 'blur(16px)',
                  border: '1px solid rgba(251, 191, 36, 0.35)',
                  borderRadius: 18,
                  padding: '16px 20px',
                }}
              >
                <span style={{ fontSize: 32, fontWeight: 900, color: '#FBBF24' }}>100% </span>
                <span style={{ fontSize: 18, fontWeight: 800, color: '#FFF8F0' }}>Dengo e Charme em Tempo Integral</span>
              </div>
            </div>
          </SceneVerticalDocumentary>
          <SyncedCaptions captions={captionsData.scene_04_rotina} theme={videoTheme} />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: 15 })}
        />

        {/* Cena 5: Cuidados e Bem-Estar com Vídeo de Escovação / Petting */}
        <TransitionSeries.Sequence durationInFrames={456} name="05-Cuidados">
          <Audio src={staticFile('audio/scene_05_cuidados.mp3')} volume={1} />
          <SceneVerticalDocumentary
            badgeText="BEM-ESTAR"
            title="Cuidados com Seu Novo Melhor Amigo"
            highlightWord="Melhor Amigo"
            subtitle="Dicas para que ele cresça saudável e com muita alegria"
            bgVideoSrc="videos/video_05_petting.mp4"
            theme={videoTheme}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, width: '100%', maxWidth: 720 }}>
              {[
                { label: '✨ Escovação Regular', text: 'Evita nós e mantém os pelos macios, desembaraçados e limpos.' },
                { label: '❄️ Atenção ao Calor', text: 'Ambientes frescos e muita água limpa sempre disponível.' },
                { label: '💖 Infinitos Mimos', text: 'Passeios leves, carinho na barriguinha e reforço positivo.' },
              ].map((c, i) => (
                <div
                  key={i}
                  style={{
                    background: 'rgba(24, 19, 16, 0.68)',
                    backdropFilter: 'blur(14px)',
                    border: '1px solid rgba(255, 248, 240, 0.12)',
                    borderRadius: 16,
                    padding: '14px 22px',
                    textAlign: 'left',
                  }}
                >
                  <div style={{ color: '#F59E0B', fontWeight: 800, fontSize: 17 }}>{c.label}</div>
                  <div style={{ color: '#D6C7B8', fontSize: 15, marginTop: 4 }}>{c.text}</div>
                </div>
              ))}
            </div>
          </SceneVerticalDocumentary>
          <SyncedCaptions captions={captionsData.scene_05_cuidados} theme={videoTheme} />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: 15 })}
        />

        {/* Cena 6: Amor Incondicional com Vídeo de Cuddle / Abraço */}
        <TransitionSeries.Sequence durationInFrames={394} name="06-Amor">
          <Audio src={staticFile('audio/scene_06_amor.mp3')} volume={1} />
          <SceneVerticalDocumentary
            badgeText="CONEXÃO ÚNICA"
            title="Puro Afeto em Quatro Patas"
            highlightWord="Afeto"
            bgVideoSrc="videos/video_06_cuddle.mp4"
            theme={videoTheme}
          >
            <div
              style={{
                background: 'rgba(24, 19, 16, 0.72)',
                backdropFilter: 'blur(18px)',
                border: '1px solid rgba(251, 113, 133, 0.4)',
                borderRadius: 20,
                padding: '28px 26px',
                maxWidth: 720,
              }}
            >
              <div style={{ fontSize: 38, color: '#FB7185', marginBottom: 12 }}>“</div>
              <p style={{ fontSize: 24, fontWeight: 700, lineHeight: 1.4, color: '#FFF8F0', margin: 0 }}>
                Quem tem um Shih Tzu em casa descobre que a lealdade tem quatro patas e um rabinho que não para de abanar.
              </p>
              <div style={{ marginTop: 18, color: '#F59E0B', fontWeight: 800, fontSize: 16, letterSpacing: '0.04em' }}>
                — MINI-DOCUMENTÁRIO CANINO
              </div>
            </div>
          </SceneVerticalDocumentary>
          <SyncedCaptions captions={captionsData.scene_06_amor} theme={videoTheme} />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: 15 })}
        />

        {/* Cena 7: Desfecho com Vídeo de Filhote Feliz */}
        <TransitionSeries.Sequence durationInFrames={363} name="07-Desfecho">
          <Audio src={staticFile('audio/scene_07_desfecho.mp3')} volume={1} />
          <SceneVerticalDocumentary
            badgeText="ETERNO BEBÊ"
            title="O Amor Puro em Forma de Patinhas"
            highlightWord="Amor Puro"
            subtitle="A felicidade vem embrulhada em pelos macios e um olhar apaixonado. Cuide com amor do seu eterno bebezinho!"
            bgVideoSrc="videos/video_07_happy.mp4"
            theme={videoTheme}
          >
            <div
              style={{
                marginTop: 24,
                backgroundColor: '#F59E0B',
                color: '#181310',
                padding: '18px 42px',
                borderRadius: 9999,
                fontSize: 22,
                fontWeight: 900,
                boxShadow: '0 0 50px rgba(245, 158, 11, 0.6)',
                letterSpacing: '0.04em',
              }}
            >
              🐾 Ame e Abrace Seu Filhote
            </div>
          </SceneVerticalDocumentary>
          <SyncedCaptions captions={captionsData.scene_07_desfecho} theme={videoTheme} />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </>
  );
};
