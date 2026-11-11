/**
 * MultiLayerOrchestrator.ts
 *
 * Master Orchestrator coordinating all 3 layers deterministically:
 * - Layer 0: Three.js Canvas (WebGL Shader Quad + 3D Mesh)
 * - Layer 1: 2D Doodle Canvas (RoughJS Boiling Lines) + Lottie Vector Animation
 * - Layer 2: HTML/SVG Layer (ZeroTTS Karaoke Word-by-Word & Kinetic Text)
 *
 * Format: 9:16 Portrait (1080x1920) @ 30 FPS
 *
 * Hooked directly to Hyperframes lifecycle:
 * - Paused GSAP root timeline (window.__timelines[compositionId])
 * - CustomEvent 'hf-seek' listener
 */

import { ThreeSceneAdapter } from './ThreeSceneAdapter.ts';
import { RoughDoodleAdapter } from './RoughDoodleAdapter.ts';
import { createLottieController, SAMPLE_LOTTIE_PULSE_DATA } from './LottieAdapter.ts';
import { KaraokeZeroTTSAdapter, SAMPLE_ZEROTTS_TRANSCRIPT } from './KaraokeZeroTTSAdapter.ts';
import type { DoodleElement, LottieController, OrchestratorConfig } from './types.ts';

export class MultiLayerOrchestrator {
  public width: number;
  public height: number;
  public fps: number;
  public duration: number;

  public threeAdapter: ThreeSceneAdapter;
  public doodleAdapter: RoughDoodleAdapter;
  public lottieController?: LottieController;
  public karaokeAdapter: KaraokeZeroTTSAdapter;

  private state = { time: 0 };
  private boundSeekHandler: (e: any) => void;

  constructor(config: OrchestratorConfig) {
    this.width = config.width ?? 1080;
    this.height = config.height ?? 1920;
    this.fps = config.fps ?? 30;
    this.duration = config.duration ?? 10;

    // 1. Layer 0: Three.js WebGL Canvas
    this.threeAdapter = new ThreeSceneAdapter({
      canvas: config.threeLayerId ?? 'three-layer',
      width: this.width,
      height: this.height,
      shaderPreset: 'liquid-sdf',
      enableForegroundMesh: true,
      ...config.threeOptions,
    });

    // 2. Layer 1a: RoughJS 2D Doodle Canvas
    this.doodleAdapter = new RoughDoodleAdapter({
      canvas: config.doodleLayerId ?? 'doodle-layer',
      width: this.width,
      height: this.height,
      boilingRate: 3, // Boil seed shifts every 3 frames (10 FPS boiling)
      ...config.doodleOptions,
    });

    // Populate default dynamic doodle animations synced to timeline
    this.initDefaultDoodles();

    // 3. Layer 1b: Lottie Vector Animation
    const lottieContainer = document.getElementById(config.lottieLayerId ?? 'lottie-layer');
    if (lottieContainer) {
      this.lottieController = createLottieController(
        lottieContainer,
        SAMPLE_LOTTIE_PULSE_DATA,
        { loop: true }
      );
    }

    // 4. Layer 2: ZeroTTS Word-by-Word Karaoke Subtitles
    this.karaokeAdapter = new KaraokeZeroTTSAdapter({
      container: config.karaokeLayerId ?? 'karaoke-layer',
      lines: SAMPLE_ZEROTTS_TRANSCRIPT,
      safeBottom: 620,
      fontSize: 66,
      ...config.karaokeOptions,
    });

    // 5. Bind Hyperframes Seek Protocol
    this.boundSeekHandler = (e: any) => {
      const time = e?.detail?.time ?? 0;
      this.seek(time);
    };
    window.addEventListener('hf-seek', this.boundSeekHandler);

    // Initial seek to frame 0
    this.seek(0);
  }

  /**
   * Initializes vibrant, hand-drawn annotations synced with subtitle beats
   */
  private initDefaultDoodles(): void {
    const doodles: DoodleElement[] = [
      // Beat 1: Highlight box around main title (frame 10 to 80)
      {
        id: 'box_title',
        type: 'rectangle',
        x: 140,
        y: 280,
        width: 800,
        height: 140,
        startFrame: 10,
        endFrame: 84,
        options: {
          stroke: '#00f2fe',
          strokeWidth: 4,
          roughness: 2.0,
          fill: 'rgba(0, 242, 254, 0.08)',
          fillStyle: 'cross-hatch',
        },
      },
      // Beat 2: Hand-drawn arrow pointing to 3D center mesh (frame 90 to 170)
      {
        id: 'arrow_to_3d',
        type: 'arrow',
        x: 160,
        y: 1100,
        width: 220,
        height: -180,
        startFrame: 90,
        endFrame: 170,
        options: {
          stroke: '#ffe600',
          strokeWidth: 4.5,
          roughness: 1.8,
        },
      },
      // Beat 3: Energetic underline under karaoke line (frame 175 to 240)
      {
        id: 'underline_karaoke',
        type: 'underline',
        x: 190,
        y: 1390,
        width: 700,
        startFrame: 175,
        endFrame: 240,
        options: {
          stroke: '#ff007a',
          strokeWidth: 5,
          roughness: 2.2,
        },
      },
      // Beat 4: Orbiting decorative stars/crosses in top corners
      {
        id: 'star_accent',
        type: 'circle',
        x: 920,
        y: 220,
        width: 70,
        startFrame: 0,
        endFrame: 300,
        options: {
          stroke: '#ffffff',
          strokeWidth: 3,
          fill: 'rgba(255, 230, 0, 0.4)',
          fillStyle: 'solid',
        },
      },
    ];

    this.doodleAdapter.setElements(doodles);
  }

  /**
   * Deterministic Master Seek
   * Seeks all layers simultaneously for the requested composition time
   * @param currentTime Target time in seconds
   */
  public seek(currentTime: number): void {
    const clampedTime = Math.max(0, Math.min(currentTime, this.duration));
    const progress = this.duration > 0 ? clampedTime / this.duration : 0;
    const frame = Math.floor(clampedTime * this.fps);

    this.state.time = clampedTime;

    // Layer 0: Three.js (Shader Uniforms + 3D Mesh)
    this.threeAdapter.render(clampedTime, progress);

    // Layer 1a: RoughJS Doodle (Boiling Line Seed)
    this.doodleAdapter.drawDoodle(frame);

    // Layer 1b: Lottie Vector Animation
    if (this.lottieController) {
      this.lottieController.goToFrame(frame);
    }

    // Layer 2: ZeroTTS Word-by-Word Karaoke
    this.karaokeAdapter.update(clampedTime, progress);
  }

  /**
   * Registers a paused GSAP root timeline for Hyperframes rendering
   * @param compositionId Matching data-composition-id attribute in HTML (default 'main')
   * @param gsapInstance Global or imported gsap instance
   */
  public registerWithGSAP(compositionId: string = 'main', gsapInstance?: any): any {
    const g = gsapInstance ?? (window as any).gsap;
    if (!g) {
      throw new Error('[MultiLayerOrchestrator] GSAP is not available on window or arguments');
    }

    const tl = g.timeline({ paused: true });

    // Single linear progression driving the orchestrator deterministically
    tl.to(
      this.state,
      {
        time: this.duration,
        duration: this.duration,
        ease: 'none',
        onUpdate: () => {
          this.seek(this.state.time);
        },
      },
      0
    );

    // Register on Hyperframes timeline registry
    (window as any).__timelines = (window as any).__timelines || {};
    (window as any).__timelines[compositionId] = tl;

    // Prime to 0
    tl.seek(0);

    return tl;
  }

  public dispose(): void {
    window.removeEventListener('hf-seek', this.boundSeekHandler);
    this.threeAdapter.dispose();
    this.doodleAdapter.dispose();
    this.lottieController?.destroy();
    this.karaokeAdapter.dispose();
  }
}
