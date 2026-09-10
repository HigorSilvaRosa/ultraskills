---
name: storyboard-documentary
description: Create narration-driven documentary videos about any subject using React Remotion. Researches the topic, writes a documentary script with voiceover narration, structures it into a storyboard, and delegates to storyboard-video for assembly. Use whenever the user asks to create a documentary, make an explainer video with narration, produce an educational video, build a narrated video essay, or create any informational video that tells a story about a subject.
---

# Storyboard Documentary

Create compelling, narration-driven documentary videos about any subject the user chooses. This skill acts as the **screenwriter and research director** — it researches a topic, writes a documentary script with narration, and then delegates to [storyboard-video](file:///c:/Users/higor/ws/higorsilvarosa/ultraskills/.agents/skills/storyboard-video/SKILL.md) for the full Remotion video assembly.

Documentaries are **narration-first** — the voiceover drives the pacing, visuals support the story, and every scene's duration is dictated by how long the narrator speaks. This is the fundamental difference from a regular promotional or marketing video.

---

## Documentary Creation Workflow

```
┌──────────────────────────────────────────────────┐
│ 1. Understand the Subject & Documentary Intent    │
│    (Topic, audience, tone, duration, language)    │
└────────────────────────┬─────────────────────────┘
                         │
┌────────────────────────▼─────────────────────────┐
│ 2. Research the Subject                           │
│    (Web search, gather facts, stats, quotes)      │
└────────────────────────┬─────────────────────────┘
                         │
┌────────────────────────▼─────────────────────────┐
│ 3. Write the Documentary Script                   │
│    (Narrative arc, scene-by-scene narration text)  │
└────────────────────────┬─────────────────────────┘
                         │
┌────────────────────────▼─────────────────────────┐
│ 4. Design the Storyboard (Visual Plan)            │
│    (Map narration → scenes, choose layouts, media) │
└────────────────────────┬─────────────────────────┘
                         │
┌────────────────────────▼─────────────────────────┐
│ 5. Delegate to storyboard-video                   │
│    (Full Remotion assembly, TTS, rendering)        │
└──────────────────────────────────────────────────┘
```

---

## Step 1: Understand the Subject & Documentary Intent

Before writing anything, clarify these parameters with the user (or infer sensible defaults):

| Parameter | Default | Notes |
| :--- | :--- | :--- |
| **Subject** | *(required)* | The topic the documentary covers |
| **Target Duration** | 2–3 minutes | Short-form docs work best for programmatic video. Can go longer. |
| **Audience** | General public | Adjusts vocabulary, depth, and tone |
| **Tone** | Informative and engaging | Options: dramatic, conversational, academic, cinematic, investigative |
| **Language** | pt-BR | Determines TTS voice and narration language |
| **Aspect Ratio** | 16:9 (1920×1080) | Horizontal for YouTube/educational, vertical for Shorts/Reels |
| **Narration Voice** | `pt-BR-AntonioNeural` | Male voice. Alternative: `pt-BR-FranciscaNeural` (female) |

If the user just says "make a documentary about X", use the defaults and proceed — don't over-interrogate. You can mention the defaults briefly and ask if they want to change anything.

---

## Step 2: Research the Subject

A good documentary is built on facts. Before writing the script:

1. **Use web search** to gather key facts, statistics, historical context, expert quotes, and interesting angles about the subject.
2. **Organize findings** into a rough outline with 4–8 main talking points, ordered in a logical narrative arc.
3. **Identify visual opportunities** — what imagery, graphs, comparisons, or b-roll would enhance each talking point? Note these for the visual plan later.

The depth of research should match the documentary's length:
- **30s–1min**: 3–4 key facts, surface-level overview
- **1–3min**: 5–7 talking points with supporting data
- **3–5min+**: Full narrative arc with introduction, development, climax, and conclusion

---

## Step 3: Write the Documentary Script

This is the heart of the skill. The script is a scene-by-scene document where **each scene has narration text that will become the voiceover**.

### Narrative Structure

Documentaries follow a storytelling arc. Use this structure as a guide:

1. **Hook** (5–10s): A provocative question, surprising fact, or dramatic statement that grabs attention immediately.
2. **Context** (10–20s): Set the stage — what is the subject, why does it matter, what's the scope?
3. **Development** (bulk of the video): Present the main content — facts, history, analysis, comparisons. Each scene covers one idea.
4. **Climax / Key Insight** (10–15s): The most impactful revelation, the "aha moment".
5. **Conclusion** (5–10s): Wrap up with a reflection, call to thought, or forward-looking statement.

### Writing Narration Text

The narration text is what the TTS voice will speak. Follow these principles:

- **Write for the ear, not the eye.** Use short, clear sentences. Avoid complex subordinate clauses. If you'd run out of breath reading it aloud, it's too long.
- **One idea per scene.** Each scene's narration should cover a single concept. If you're tempted to use "and also" or "furthermore" extensively, split into two scenes.
- **Be specific.** Instead of "many people", say "mais de 2 bilhões de pessoas". Numbers and concrete details make documentaries compelling.
- **Vary rhythm.** Alternate between longer explanatory passages and short punchy statements. This creates natural pacing.
- **Respect TTS cadence.** Edge-TTS reads at approximately 140–160 words per minute. A 10-second scene fits ~25 words of narration. Use this to estimate durations.

### Script Format

Write the script as a structured plan. For each scene, specify:

```
## Scene N: [Scene Title]
**Narration:** "[Exact text the narrator will speak]"
**Visual Concept:** [Brief description of what the viewer sees]
**Scene Type:** [hero-headline / feature-grid / split-comparison / metric-counter / quote-testimonial / etc.]
**Media Needs:** [Any images, b-roll, or icons needed]
**Estimated Duration:** [Based on narration word count]
```

**Example:**

```
## Scene 1: Hook
**Narration:** "E se eu te dissesse que, neste exato momento, existem mais de cinco mil satélites orbitando a Terra — e que esse número vai triplicar nos próximos cinco anos?"
**Visual Concept:** Dark space background with animated satellite counter ticking up
**Scene Type:** scene-metric-counter
**Media Needs:** Space/satellite imagery
**Estimated Duration:** 8s (~30 words)

## Scene 2: Context
**Narration:** "A corrida espacial não é mais entre nações. Hoje, empresas privadas como SpaceX, OneWeb e Amazon disputam a órbita terrestre baixa, lançando constelações de satélites que prometem conectar cada canto do planeta."
**Visual Concept:** Split view with logos/images of the companies mentioned
**Scene Type:** scene-feature-grid
**Media Needs:** Company logos or rocket launch images
**Estimated Duration:** 15s (~45 words)
```

---

## Step 4: Design the Storyboard (Visual Plan)

Transform the script into a storyboard table that maps directly to the `storyboard-video` skill's format:

| # | Scene Title | Narration (exact text) | Scene Slug | Key Props | Transition | Media Needs |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 01 | Hook | "E se eu te dissesse..." | `scene-metric-counter` | `value: 5000, label: 'Satélites'` | fade (15f) | Space image |
| 02 | Context | "A corrida espacial..." | `scene-feature-grid` | `items: [...]` | slide (15f) | Company logos |
| ... | ... | ... | ... | ... | ... | ... |

### Mapping Narration to Scene Types

Choose scene layouts that **complement and reinforce** the narration, not compete with it. The viewer should be able to understand the documentary with audio alone — the visuals add depth.

| Narration Content | Recommended Scene Type | Why |
| :--- | :--- | :--- |
| Opening question / dramatic fact | `scene-hero-headline` | Big text grabs attention |
| Statistic or number | `scene-metric-counter` | Animated counter emphasizes data |
| Comparison (before/after, A vs B) | `scene-split-comparison` | Side-by-side makes contrasts visual |
| List of features / factors / causes | `scene-feature-grid` | Organized grid for multiple items |
| Expert quote or testimony | `scene-quote-testimonial` | Centered quote with attribution |
| Call to action or closing thought | `scene-cta-pulse` | Pulsing CTA draws final attention |

If none of the existing scene types fit, storyboard-video will create a new reusable component via `storyboard-video-remotion-scene`.

### Theme & Visual Identity

Choose a theme that matches the documentary's subject and tone:

- **Technology / Science**: Dark backgrounds (`#0A0F1D`), cyan/blue accents (`#38BDF8`), clean sans-serif
- **Nature / Environment**: Deep greens (`#0D3B2E`), earth tones (`#A8D5BA`), warm accents
- **History / Culture**: Warm dark (`#1A1410`), gold/amber accents (`#D4A574`), serif touches
- **Social / Human Interest**: Neutral dark (`#18181B`), vibrant accent (`#F97316`), humanist feel
- **Business / Economy**: Navy (`#0F172A`), professional blues/greens, sharp typography

---

## Step 5: Delegate to storyboard-video

Once the script and storyboard are complete, delegate the full video assembly to `storyboard-video`. This is where everything comes together.

### How to Delegate

Use `storyboard-video` to execute the following, providing it with the complete storyboard specification:

1. **Theme definition** — pass the `StoryboardTheme` object
2. **Scene catalog check** — storyboard-video will check `.ultraskills/remotion/scenes/` for existing components
3. **Scene creation** — any missing scene types get created via `storyboard-video-remotion-scene`
4. **Narration generation** — for each scene, storyboard-video uses `synthesize_voiceover.py` to generate TTS audio and `.vtt` subtitles, then sets `durationInFrames` from the audio duration
5. **Media discovery** — storyboard-video uses `media-research` to find relevant stock imagery
6. **Timeline assembly** — `Video.tsx` with `TransitionSeries`, audio layers, and `SyncedCaptions`
7. **Root configuration** — `Root.tsx` with individual scene previews

### Critical: Narration-Driven Timing

In a documentary, the narration dictates scene duration — not the other way around. When delegating to storyboard-video, make it clear that:

- Each scene's `durationInFrames` **MUST** be set from the TTS output's `totalDurationInFrames`
- The narration text is **not optional** — every scene has a voiceover
- `SyncedCaptions` should be rendered on every scene for accessibility
- Background music volume should be **lower than in a promotional video** (0.12–0.18 instead of 0.25) so the narration remains clearly audible

### Delegation Prompt Template

When delegating to `storyboard-video`, provide a structured brief like this:

```
Create a documentary video with the following storyboard.

**Documentary Title:** [Title]
**Collection:** documentaries
**Video Slug:** [slug]
**Aspect Ratio:** 1920x1080 (16:9)
**FPS:** 30
**TTS Voice:** pt-BR-AntonioNeural
**BGM Volume:** 0.15 (narration-focused, keep music subtle)

**Theme:**
- backgroundColor: '#0A0F1D'
- textColor: '#F8FAFC'
- primaryColor: '#38BDF8'
- accentColor: '#6366F1'
- fontFamily: 'Inter, sans-serif'
- borderRadius: 16

**CRITICAL — Narration-Driven Timing:**
Every scene's durationInFrames MUST be determined by the TTS narration output.
Use synthesize_voiceover.py for each scene and set durationInFrames = totalDurationInFrames from the output.
Render SyncedCaptions on every scene.

**Storyboard:**

| # | Scene Title | Narration | Scene Slug | Props | Transition |
| --- | --- | --- | --- | --- | --- |
| 01 | [Title] | "[narration text]" | [slug] | [props] | fade (15f) |
| 02 | ... | "..." | ... | ... | ... |
| ... | ... | ... | ... | ... | ... |
```

---

## Documentary Formats & Presets

### Short Documentary (30s–1min)
- 3–5 scenes
- Hook → 2–3 key points → Conclusion
- Great for social media, Shorts, Reels

### Standard Documentary (2–3min)
- 6–10 scenes
- Full narrative arc with hook, context, development, insight, conclusion
- YouTube, educational platforms

### Deep Dive Documentary (5min+)
- 10–15+ scenes
- Multiple chapters, detailed analysis, multiple perspectives
- Consider splitting into parts if exceeding 7 minutes

---

## Language & Voice Reference

| Language | Male Voice | Female Voice |
| :--- | :--- | :--- |
| pt-BR | `pt-BR-AntonioNeural` | `pt-BR-FranciscaNeural` |
| en-US | `en-US-ChristopherNeural` | `en-US-JennyNeural` |
| es-ES | `es-ES-AlvaroNeural` | `es-ES-ElviraNeural` |
| fr-FR | `fr-FR-HenriNeural` | `fr-FR-DeniseNeural` |

---

## Example: Complete Documentary Brief

**Subject:** "A História da Inteligência Artificial"
**Duration:** ~2 minutes
**Tone:** Informative, slightly dramatic

### Script:

**Scene 1 — Hook:**
"Em 1950, Alan Turing fez uma pergunta que mudaria o mundo: as máquinas podem pensar?"

**Scene 2 — Origins:**
"A inteligência artificial nasceu como um sonho acadêmico. Na conferência de Dartmouth, em 1956, um grupo de cientistas apostou que, em uma geração, máquinas seriam tão inteligentes quanto humanos."

**Scene 3 — The AI Winters:**
"Mas o progresso foi mais lento do que o esperado. Duas vezes, o financiamento secou e o otimismo morreu. Esses períodos ficaram conhecidos como os invernos da IA."

**Scene 4 — The Deep Learning Revolution:**
"Tudo mudou em 2012, quando uma rede neural chamada AlexNet venceu uma competição de reconhecimento de imagens por uma margem absurda. A era do deep learning havia começado."

**Scene 5 — The Present:**
"Hoje, a IA escreve textos, gera imagens, diagnostica doenças e dirige carros. Em apenas uma década, ela saiu dos laboratórios e entrou no cotidiano de bilhões de pessoas."

**Scene 6 — Conclusion:**
"A pergunta de Turing ainda não foi respondida. Mas uma coisa é certa: a inteligência artificial já não é ficção científica. É a tecnologia que está definindo o século vinte e um."

*(This example demonstrates the narrative arc, writing style, and level of specificity expected.)*
