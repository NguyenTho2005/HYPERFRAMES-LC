/**
 * Hyperframes Multi-Layer Graphics Architecture
 * Layer 0: Three.js + WebGL Shaders (Aurora / Liquid SDF) + 3D Mesh
 * Layer 1: RoughJS 2D Doodles (Boiling Lines) + Lottie Vector Animation
 * Layer 2: HTML/SVG Karaoke ZeroTTS Subtitles & Kinetic Typography
 */

export * from './types.ts';
export * from './ThreeSceneAdapter.ts';
export * from './RoughDoodleAdapter.ts';
export * from './LottieAdapter.ts';
export * from './KaraokeZeroTTSAdapter.ts';
export * from './MultiLayerOrchestrator.ts';
