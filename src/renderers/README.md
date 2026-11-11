# Hyperframes Multi-Layer Graphics Architecture
**Engine:** Hyperframes (heygen-com/hyperframes)  
**Aspect Ratio:** 9:16 Vertical Video (1080x1920 @ 30 FPS)

---

## 1. Technical Principles (Imperative Architecture)

Unlike React-based frameworks (like Remotion) that rely on the Virtual DOM, **Hyperframes** runs directly on Vanilla JavaScript/TypeScript and imperatively drives Canvases and DOM elements.

Every module adheres to:
1. **Deterministic Lifecycle:** Animations are strictly a pure function of composition time or frame (`render(currentTime, progress)` or `drawDoodle(frame)`). No `requestAnimationFrame`, `setInterval`, or uncontrolled browser clock drift.
2. **Deterministic Layering (Z-Index / Render Stack):**
   - **Layer 0 (Bottom):** Three.js WebGL Canvas (`#three-layer`)
     - Background: Fullscreen Quad with Liquid SDF Metaballs / Aurora Gradient GLSL Shader (`uTime`, `uResolution`, `uProgress`).
     - Foreground: 3D floating metallic mesh (`TorusKnotGeometry` + orbiting satellites) with physically-based lighting.
   - **Layer 1 (Middle):** 2D RoughJS Canvas + Lottie Vector Animation
     - `#doodle-layer`: RoughJS hand-drawn sketches (boxes, arrows, underlines) with **Boiling Line effect** (`seed = Math.floor(frame / 3)`).
     - `#lottie-layer`: Lottie vector animation controller driven in static frame mode (`anim.goToAndStop(frame, true)`).
   - **Layer 2 (Top):** HTML/SVG Karaoke Subtitles & Kinetic Typography
     - `#karaoke-layer`: Word-by-word active highlight matching ZeroTTS / Whisper / HeyGen word-level timestamps (`upcoming`, `active`, `spoken`). Positioned in the portrait safe area (~620px from bottom).

---

## 2. Directory Structure

```
src/renderers/
├── types.ts                     # TypeScript definitions for all adapters & data models
├── ThreeSceneAdapter.ts         # Layer 0: Three.js Scene, Camera, Shader Quad, 3D Mesh
├── RoughDoodleAdapter.ts        # Layer 1: RoughJS 2D canvas with boiling line animation
├── LottieAdapter.ts             # Layer 1: Frame-static Lottie vector controller
├── KaraokeZeroTTSAdapter.ts      # Layer 2: ZeroTTS word-by-word karaoke typography
├── MultiLayerOrchestrator.ts    # Master orchestrator coordinating all layers
├── index.ts                     # Unified public export
└── README.md                    # Documentation & usage guide

tests/
├── renderers.test.ts            # Unit tests for all adapter specifications
├── doodle.test.ts               # Unit tests for RoughJS boiling line seeds
└── karaoke.test.ts              # Unit tests for ZeroTTS DOM lifecycle

index.html                       # Complete runnable 9:16 composition demo (1080x1920 @ 30 FPS)
```

---

## 3. Quick Start & Integration

### Hooking into Hyperframes

```typescript
import { MultiLayerOrchestrator } from './src/renderers/index.ts';

// Initialize the master multi-layer orchestrator
const orchestrator = new MultiLayerOrchestrator({
  width: 1080,
  height: 1920,
  fps: 30,
  duration: 10,
  threeLayerId: 'three-layer',
  doodleLayerId: 'doodle-layer',
  lottieLayerId: 'lottie-layer',
  karaokeLayerId: 'karaoke-layer',
});

// Register paused root timeline on window.__timelines
orchestrator.registerWithGSAP('main', window.gsap);

// Also responds automatically to Hyperframes seek events
window.addEventListener('hf-seek', (e) => {
  orchestrator.seek(e.detail.time);
});
```

---

## 4. Running Tests

Run the test suite using Node.js native TypeScript runner:

```bash
node --experimental-strip-types --test tests/*.test.ts
```
