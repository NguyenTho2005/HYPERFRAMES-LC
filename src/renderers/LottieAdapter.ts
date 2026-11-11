/**
 * LottieAdapter.ts
 *
 * Layer 1 (Middle): Lottie Vector Animation Controller
 * Resolution: 1080x1920 (9:16 Portrait) @ 30 FPS
 *
 * Deterministic Frame-by-Frame Seek:
 * anim.goToAndStop(frame, true) - frame static seek without rAF loops.
 */

import type { LayerAdapter, LottieController, LottieControllerOptions } from './types.ts';

function resolveLottie(custom?: any): any {
  if (custom) return custom;
  if (typeof window !== 'undefined' && (window as any).lottie) {
    return (window as any).lottie;
  }
  try {
    return (globalThis as any).lottie;
  } catch {
    return null;
  }
}

/**
 * Creates a deterministic, seekable Lottie controller
 * @param container DOM element host for SVG/Canvas Lottie rendering
 * @param animationData Raw Lottie JSON data or path object
 * @param options Additional configuration (renderer, loop, startFrame)
 */
export function createLottieController(
  container: HTMLElement,
  animationData: any,
  options: Partial<LottieControllerOptions> & { lottieInstance?: any } = {}
): LottieController {
  const lottieInstance = resolveLottie(options.lottieInstance);
  if (!lottieInstance) {
    throw new Error('[LottieAdapter] lottie-web library not found on window.lottie or options');
  }

  const loadFn = lottieInstance.loadAnimation || lottieInstance;
  const anim: any = loadFn({
    container,
    renderer: (options.renderer as any) ?? 'svg',
    loop: options.loop ?? false,
    autoplay: false, // Strict deterministic requirement: NEVER autoplay
    animationData: animationData?.layers ? animationData : undefined,
    path: typeof animationData === 'string' ? animationData : options.path,
  });

  // Register on window.__hfLottie for Hyperframes engine autodiscovery
  if (typeof window !== 'undefined') {
    (window as any).__hfLottie = (window as any).__hfLottie || [];
    if (!(window as any).__hfLottie.includes(anim)) {
      (window as any).__hfLottie.push(anim);
    }
  }

  const controller: LottieController = {
    anim,

    /**
     * Seek to exact integer or fractional frame number
     * @param frame Frame index (0 to totalFrames - 1)
     */
    goToFrame: (frame: number) => {
      if (!anim) return;
      const total = anim.totalFrames || 1;
      const targetFrame = options.loop
        ? ((frame % total) + total) % total
        : Math.max(0, Math.min(frame, total - 1));

      anim.goToAndStop(targetFrame, true);
    },

    /**
     * Seek using composition time in seconds
     * @param timeSeconds Time in seconds
     */
    goToTime: (timeSeconds: number) => {
      if (!anim) return;
      const fps = anim.frameRate || 30;
      const frame = timeSeconds * fps;
      controller.goToFrame(frame);
    },

    getDuration: () => {
      const fps = anim.frameRate || 30;
      return (anim.totalFrames || 0) / fps;
    },

    getTotalFrames: () => anim.totalFrames || 0,

    destroy: () => {
      try {
        anim.destroy();
      } catch {
        // Safe destroy
      }
    },
  };

  return controller;
}

/**
 * LayerAdapter wrapper for orchestrator integration
 */
export class LottieLayerAdapter implements LayerAdapter {
  public readonly id = 'lottie-layer';
  public container: HTMLElement;
  public controller?: LottieController;
  private fps: number;

  constructor(container: HTMLElement | string, animationData: any, fps: number = 30) {
    if (typeof container === 'string') {
      const el = document.getElementById(container);
      if (!el) throw new Error(`[LottieLayerAdapter] Element #${container} not found`);
      this.container = el;
    } else {
      this.container = container;
    }

    this.fps = fps;

    if (animationData) {
      this.controller = createLottieController(this.container, animationData);
    }
  }

  public setAnimation(animationData: any): void {
    if (this.controller) {
      this.controller.destroy();
    }
    this.controller = createLottieController(this.container, animationData);
  }

  public render(currentTime: number, progress: number, frame: number): void {
    if (this.controller) {
      this.controller.goToFrame(frame);
    }
  }

  public dispose(): void {
    this.controller?.destroy();
  }
}

/**
 * Built-in minimal vector sample Lottie animation data
 * High-tech pulsing audio frequency ring & star burst (useful for instant testing)
 */
export const SAMPLE_LOTTIE_PULSE_DATA = {
  v: '5.7.4',
  fr: 30,
  ip: 0,
  op: 90,
  w: 300,
  h: 300,
  nm: 'HighTechBadge',
  ddd: 0,
  assets: [],
  layers: [
    {
      ddd: 0,
      ind: 1,
      ty: 4,
      nm: 'PulseRing',
      sr: 1,
      ks: {
        o: {
          k: [
            { i: { x: [0.833], y: [0.833] }, o: { x: [0.167], y: [0.167] }, t: 0, s: [100] },
            { t: 90, s: [10] },
          ],
        },
        r: {
          k: [
            { i: { x: [0.833], y: [0.833] }, o: { x: [0.167], y: [0.167] }, t: 0, s: [0] },
            { t: 90, s: [360] },
          ],
        },
        p: { k: [150, 150, 0] },
        a: { k: [0, 0, 0] },
        s: {
          k: [
            { i: { x: [0.667], y: [1] }, o: { x: [0.333], y: [0] }, t: 0, s: [60, 60, 100] },
            { t: 90, s: [130, 130, 100] },
          ],
        },
      },
      ao: 0,
      shapes: [
        {
          ty: 'gr',
          it: [
            {
              ty: 'el',
              p: { k: [0, 0] },
              s: { k: [160, 160] },
            },
            {
              ty: 'st',
              c: { k: [0, 0.95, 1, 1] },
              o: { k: 100 },
              w: { k: 6 },
              lc: 2,
              lj: 2,
            },
            {
              ty: 'tr',
              p: { k: [0, 0] },
              a: { k: [0, 0] },
              s: { k: [100, 100] },
              r: { k: 0 },
              o: { k: 100 },
            },
          ],
        },
      ],
      ip: 0,
      op: 90,
      st: 0,
      bm: 0,
    },
  ],
};
