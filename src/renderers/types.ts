/**
 * Type definitions for Hyperframes Multi-Layer Graphics Architecture
 * 9:16 (1080x1920, 30 FPS)
 */

export interface LayerAdapter {
  id: string;
  render(currentTime: number, progress: number, frame: number): void;
  resize?(width: number, height: number): void;
  dispose?(): void;
}

export type ShaderPreset = 'aurora' | 'liquid-sdf';

export interface ThreeAdapterOptions {
  canvas: HTMLCanvasElement | string;
  width?: number;
  height?: number;
  shaderPreset?: ShaderPreset;
  customFragmentShader?: string;
  enableForegroundMesh?: boolean;
}

export type DoodleShapeType =
  | 'rectangle'
  | 'circle'
  | 'ellipse'
  | 'line'
  | 'polygon'
  | 'path'
  | 'arc'
  | 'curve'
  | 'badge'
  | 'arrow'
  | 'underline';

export interface DoodleStyleOptions {
  stroke?: string;
  fill?: string;
  fillStyle?: 'solid' | 'hachure' | 'zigzag' | 'cross-hatch' | 'dots' | 'sunburst' | 'dashed';
  strokeWidth?: number;
  roughness?: number;
  bowing?: number;
  seed?: number;
  curveFitting?: number;
  hachureAngle?: number;
  hachureGap?: number;
}

export interface DoodleElement {
  id: string;
  type: DoodleShapeType;
  x: number;
  y: number;
  width?: number;
  height?: number;
  points?: [number, number][];
  pathData?: string;
  options?: DoodleStyleOptions;
  startFrame?: number;
  endFrame?: number;
  // Optional animated transform evaluated per frame
  animate?: (frame: number, progress: number) => Partial<DoodleElement>;
}

export interface RoughDoodleAdapterOptions {
  canvas: HTMLCanvasElement | string;
  width?: number;
  height?: number;
  defaultRoughness?: number;
  defaultStrokeWidth?: number;
  boilingRate?: number; // Frames per boil step, defaults to 3 (10 FPS boiling at 30 FPS)
}

export interface LottieControllerOptions {
  container: HTMLElement | string;
  animationData?: any;
  path?: string;
  renderer?: 'svg' | 'canvas';
  loop?: boolean;
  autoplay?: boolean;
}

export interface LottieController {
  anim: any;
  goToFrame: (frame: number) => void;
  goToTime: (timeSeconds: number) => void;
  getDuration: () => number;
  getTotalFrames: () => number;
  destroy: () => void;
}

export interface ZeroTTSWord {
  id?: string;
  word: string;
  start: number; // in seconds
  end: number;   // in seconds
  confidence?: number;
  emphasis?: boolean;
}

export interface ZeroTTSLine {
  id: string;
  text: string;
  start: number;
  end: number;
  words: ZeroTTSWord[];
}

export interface KaraokeAdapterOptions {
  container: HTMLElement | string;
  lines: ZeroTTSLine[];
  stylePreset?: 'neon-pill' | 'glow-gradient' | 'minimal-clean' | 'kinetic-slam';
  activeColor?: string;
  inactiveColor?: string;
  completedColor?: string;
  accentColor?: string;
  fontSize?: number;
  safeBottom?: number; // Portrait safe distance from bottom (default 650px)
}

export interface OrchestratorConfig {
  width?: number;
  height?: number;
  fps?: number;
  duration: number;
  threeLayerId?: string;
  doodleLayerId?: string;
  lottieLayerId?: string;
  karaokeLayerId?: string;
  threeOptions?: Partial<ThreeAdapterOptions>;
  doodleOptions?: Partial<RoughDoodleAdapterOptions>;
  karaokeOptions?: Partial<KaraokeAdapterOptions>;
}
