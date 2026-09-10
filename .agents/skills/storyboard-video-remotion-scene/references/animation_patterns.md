# Remotion Animation Patterns & Recipes

Reusable, frame-accurate animation patterns for `storyboard-video-remotion-scene`.
All patterns adhere strictly to **Remotion 4.x best practices**:
- Use `<Interactive.Div name="...">` to ensure elements are visual and editable in Remotion Studio.
- Keep `interpolate()` inline in the `style` prop for Studio timeline/scrub integration.
- Use CSS properties `scale`, `translate`, `rotate` directly over combined `transform` strings.
- Use `Easing.spring()` and `Easing.bezier()` inside `interpolate()` instead of legacy standalone `spring()`.

---

## 1. Number Counter Animation

Smoothly increment numbers (e.g. stats, percentages, currency) with easing:

```tsx
import React from 'react';
import { interpolate, useCurrentFrame, Easing, Interactive } from 'remotion';

export const Counter: React.FC<{
  targetValue: number;
  startFrame?: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
}> = ({ targetValue, startFrame = 10, duration = 45, prefix = '', suffix = '' }) => {
  const frame = useCurrentFrame();

  const count = Math.round(
    interpolate(frame, [startFrame, startFrame + duration], [0, targetValue], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.out(Easing.cubic),
    })
  );

  return (
    <Interactive.Div name="Counter" style={{ fontVariantNumeric: 'tabular-nums' }}>
      {prefix}{count.toLocaleString()}{suffix}
    </Interactive.Div>
  );
};
```

---

## 2. 3D Tilt Card Entrance

Creates depth using CSS `perspective` on the container and separate `rotate` / `scale` CSS properties:

```tsx
import React from 'react';
import { interpolate, useCurrentFrame, Easing, Interactive } from 'remotion';

export const TiltCard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const frame = useCurrentFrame();

  return (
    <div style={{ perspective: 1000 }}>
      <Interactive.Div
        name="TiltCard"
        style={{
          scale: interpolate(frame, [0, 25], [0.8, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: Easing.spring({ damping: 140 }),
            output: 'perceptual-scale',
          }),
          rotate: interpolate(frame, [0, 25], ['15deg', '0deg'], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: Easing.spring({ damping: 140 }),
          }),
        }}
      >
        {children}
      </Interactive.Div>
    </div>
  );
};
```

---

## 3. Kinetic Slide-in with Mask / Overflow Hidden

Text slides in from behind an invisible baseline using CSS `translate` without spilling outside its container:

```tsx
import React from 'react';
import { interpolate, useCurrentFrame, Easing, Interactive } from 'remotion';

export const MaskedSlideText: React.FC<{ text: string }> = ({ text }) => {
  const frame = useCurrentFrame();

  return (
    <div style={{ overflow: 'hidden', display: 'inline-block' }}>
      <Interactive.Div
        name="MaskedSlideText"
        style={{
          translate: interpolate(frame, [0, 20], ['0px 100%', '0px 0%'], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
        }}
      >
        {text}
      </Interactive.Div>
    </div>
  );
};
```

---

## 4. Glowing Accent Border / Pulse

Dynamic pulsing glow around a hero card using inline interpolation on `boxShadow`:

```tsx
import React from 'react';
import { interpolate, useCurrentFrame, Interactive } from 'remotion';

export const PulseCard: React.FC<{
  children: React.ReactNode;
  glowColor?: string;
}> = ({ children, glowColor = 'rgba(99, 102, 241, 0.6)' }) => {
  const frame = useCurrentFrame();

  const glowRadius = interpolate(Math.sin(frame / 10), [-1, 1], [10, 30], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <Interactive.Div
      name="PulseCard"
      style={{
        borderRadius: 20,
        boxShadow: `0 0 ${glowRadius}px ${glowColor}`,
        border: '1px solid rgba(255, 255, 255, 0.1)',
        padding: 32,
      }}
    >
      {children}
    </Interactive.Div>
  );
};
```
