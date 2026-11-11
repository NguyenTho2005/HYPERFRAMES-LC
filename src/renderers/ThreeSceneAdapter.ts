/**
 * ThreeSceneAdapter.ts
 *
 * Layer 0 (Bottom): Three.js WebGL Canvas with Background Shader + 3D Mesh
 * Resolution: 1080x1920 (9:16 Portrait) @ 30 FPS
 *
 * Deterministic Lifecycle: No requestAnimationFrame / window timers.
 * Driven strictly via render(currentTime, progress).
 */

import type { LayerAdapter, ThreeAdapterOptions } from './types.ts';

// Resolve THREE safely in browser, CDN script, or module environment
function resolveTHREE(custom?: any): any {
  if (custom) return custom;
  if (typeof window !== 'undefined' && (window as any).THREE) {
    return (window as any).THREE;
  }
  try {
    return (globalThis as any).THREE;
  } catch {
    return null;
  }
}

// ============================================================================
// GLSL Shaders: Aurora Gradient & Liquid SDF Metaballs
// ============================================================================

const VERTEX_SHADER_QUAD = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

/**
 * Liquid SDF Metaballs Fragment Shader
 * Organic fluid metaballs with smooth blending, chromatic aberration & glowing rim
 */
const FRAGMENT_SHADER_LIQUID_SDF = /* glsl */ `
precision highp float;
uniform float uTime;
uniform vec2 uResolution;
uniform float uProgress;
varying vec2 vUv;

// Smooth minimum for organic metaball blending
float smin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

// 2D Rotation
vec2 rotate(vec2 p, float a) {
  float c = cos(a);
  float s = sin(a);
  return vec2(p.x * c - p.y * s, p.x * s + p.y * c);
}

// Pseudo-random noise
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

// Fractional Brownian Motion for liquid turbulence
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  vec2 shift = vec2(100.0);
  for (int i = 0; i < 4; ++i) {
    v += a * noise(p);
    p = rotate(p * 2.0, 0.5) + shift;
    a *= 0.5;
  }
  return v;
}

// 2D Circle SDF
float sdCircle(vec2 p, float r) {
  return length(p) - r;
}

void main() {
  // Normalize aspect ratio (9:16 portrait)
  vec2 uv = (gl_FragCoord.xy * 2.0 - uResolution) / min(uResolution.x, uResolution.y);
  float t = uTime * 0.8;

  // Liquid domain warping
  vec2 q = vec2(fbm(uv + vec2(0.0, t * 0.15)), fbm(uv + vec2(5.2, t * 0.12)));
  vec2 r = vec2(fbm(uv + 4.0 * q + vec2(1.7, 9.2 + 0.2 * t)), fbm(uv + 4.0 * q + vec2(8.3, 2.8 + 0.18 * t)));
  float warp = fbm(uv + 3.0 * r);

  // Moving metaball centers in 9:16 normalized space
  vec2 c1 = vec2(sin(t * 0.9) * 0.45, cos(t * 0.7) * 0.85);
  vec2 c2 = vec2(cos(t * 0.8 + 2.0) * 0.55, sin(t * 1.1 + 1.0) * 0.75);
  vec2 c3 = vec2(sin(t * 1.3 + 4.0) * 0.4, cos(t * 0.6 + 3.0) * 0.9);
  vec2 c4 = vec2(cos(t * 0.5 + 1.2) * 0.35, sin(t * 0.8 + 4.5) * 0.6);

  // Evaluate SDFs
  float d1 = sdCircle(uv - c1, 0.45 + 0.08 * sin(t * 2.0));
  float d2 = sdCircle(uv - c2, 0.38 + 0.06 * cos(t * 2.3));
  float d3 = sdCircle(uv - c3, 0.42 + 0.07 * sin(t * 1.7));
  float d4 = sdCircle(uv - c4, 0.35 + 0.05 * cos(t * 1.9));

  // Organic smooth merge
  float d = smin(d1, d2, 0.35);
  d = smin(d, d3, 0.35);
  d = smin(d, d4, 0.35);
  d += (warp - 0.5) * 0.25;

  // Rich color palette (Dark cyber-violet to cyan & neon magenta)
  vec3 colDeepViolet = vec3(0.04, 0.03, 0.10);
  vec3 colIndigo     = vec3(0.14, 0.05, 0.32);
  vec3 colNeonCyan   = vec3(0.00, 0.92, 0.98);
  vec3 colHotPink    = vec3(1.00, 0.05, 0.55);
  vec3 colGold       = vec3(1.00, 0.82, 0.20);

  // Background deep gradient
  vec3 bg = mix(colDeepViolet, colIndigo, vUv.y * 0.8 + warp * 0.2);

  // Metaball liquid surface and interior glow
  float glow = exp(-max(0.0, d) * 3.5);
  float edge = 1.0 - smoothstep(-0.02, 0.06, d);
  float innerGlow = smoothstep(-0.4, 0.0, d) * (1.0 - edge);

  vec3 liquidColor = mix(colIndigo, colHotPink, clamp(r.x * 1.4, 0.0, 1.0));
  liquidColor = mix(liquidColor, colNeonCyan, clamp(q.y * 1.5, 0.0, 1.0));
  liquidColor = mix(liquidColor, colGold, pow(innerGlow, 3.0) * 0.8);

  // Final composition: Background + Ambient Glow + Crisp Liquid Edge
  vec3 finalColor = bg + glow * colIndigo * 0.8;
  finalColor = mix(finalColor, liquidColor, edge * 0.92);
  finalColor += pow(glow, 2.0) * colNeonCyan * 0.45;

  // Vignette
  float vignette = 1.0 - length(vUv - 0.5) * 0.75;
  finalColor *= clamp(vignette, 0.2, 1.0);

  gl_FragColor = vec4(finalColor, 1.0);
}
`;

/**
 * Aurora Borealis Gradient Fragment Shader
 * High-energy undulating light ribbons with deep cosmic sky
 */
const FRAGMENT_SHADER_AURORA = /* glsl */ `
precision highp float;
uniform float uTime;
uniform vec2 uResolution;
uniform float uProgress;
varying vec2 vUv;

void main() {
  vec2 uv = (gl_FragCoord.xy * 2.0 - uResolution) / min(uResolution.x, uResolution.y);
  float t = uTime * 0.6;

  vec3 color = vec3(0.03, 0.02, 0.08); // Cosmic night ground

  for (float i = 1.0; i <= 3.0; i += 1.0) {
    float wave = sin(uv.x * (1.2 * i) + t * (0.8 + 0.3 * i) + sin(uv.y * 2.0 + t)) * 0.35;
    wave += cos(uv.x * 2.5 - t * 0.5) * 0.15;
    float dist = abs(uv.y - wave - (i * 0.25 - 0.5));
    float intensity = exp(-dist * 4.5);

    vec3 auroraColor;
    if (i == 1.0) auroraColor = vec3(0.0, 0.95, 0.65);       // Emerald Green
    else if (i == 2.0) auroraColor = vec3(0.05, 0.65, 1.0);   // Cyan Blue
    else auroraColor = vec3(0.75, 0.15, 0.95);                 // Electric Violet

    color += intensity * auroraColor * 0.75;
  }

  // Soft atmospheric stars/particles
  float stars = fract(sin(dot(floor(gl_FragCoord.xy / 4.0), vec2(12.9898, 78.233))) * 43758.5453);
  if (stars > 0.985) {
    color += vec3(0.8, 0.9, 1.0) * (sin(t * 2.0 + stars * 10.0) * 0.3 + 0.7);
  }

  gl_FragColor = vec4(color, 1.0);
}
`;

// ============================================================================
// ThreeSceneAdapter Implementation
// ============================================================================

export class ThreeSceneAdapter implements LayerAdapter {
  public readonly id = 'three-layer';

  public canvas: HTMLCanvasElement;
  public renderer: any;
  public THREE: any;

  // Background Fullscreen Quad Stage
  private bgScene: any;
  private bgCamera: any;
  public bgMaterial: any;
  private bgQuad: any;

  // Foreground 3D Mesh Stage
  public scene: any;
  public camera: any;
  public foregroundMesh?: any;
  public orbitGroup: any;

  private width: number;
  private height: number;

  constructor(options: ThreeAdapterOptions & { threeInstance?: any }) {
    this.THREE = resolveTHREE(options.threeInstance);
    if (!this.THREE) {
      throw new Error(
        '[ThreeSceneAdapter] THREE is not loaded. Ensure three.js is imported or attached to window.THREE'
      );
    }
    const THREE = this.THREE;

    // 1. Resolve canvas element
    if (typeof options.canvas === 'string') {
      const el = document.getElementById(options.canvas);
      if (!el || !(el instanceof HTMLCanvasElement)) {
        throw new Error(`[ThreeSceneAdapter] Canvas with ID "${options.canvas}" not found`);
      }
      this.canvas = el;
    } else {
      this.canvas = options.canvas;
    }

    this.width = options.width ?? 1080;
    this.height = options.height ?? 1920;

    // Explicit dimensions on the HTML canvas
    this.canvas.width = this.width;
    this.canvas.height = this.height;

    // 2. Initialize WebGLRenderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
      stencil: false,
    });
    this.renderer.setPixelRatio(1); // Crucial for deterministic pixel-perfect frame capture
    this.renderer.setSize(this.width, this.height, false);
    this.renderer.autoClear = false;

    // 3. Setup Background Fullscreen Quad (Orthographic)
    this.bgScene = new THREE.Scene();
    this.bgCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    const fragShader =
      options.customFragmentShader ??
      (options.shaderPreset === 'aurora'
        ? FRAGMENT_SHADER_AURORA
        : FRAGMENT_SHADER_LIQUID_SDF);

    this.bgMaterial = new THREE.ShaderMaterial({
      vertexShader: VERTEX_SHADER_QUAD,
      fragmentShader: fragShader,
      uniforms: {
        uTime: { value: 0.0 },
        uResolution: { value: new THREE.Vector2(this.width, this.height) },
        uProgress: { value: 0.0 },
      },
      depthWrite: false,
      depthTest: false,
    });

    const quadGeo = new THREE.PlaneGeometry(2, 2);
    this.bgQuad = new THREE.Mesh(quadGeo, this.bgMaterial);
    this.bgScene.add(this.bgQuad);

    // 4. Setup Foreground 3D Scene (Perspective Camera 9:16)
    this.scene = new THREE.Scene();
    const aspect = this.width / this.height;
    this.camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 100);
    this.camera.position.set(0, 0, 7.5);

    // Group for animated 3D components
    this.orbitGroup = new THREE.Group();
    this.scene.add(this.orbitGroup);

    // Lighting for 3D meshes
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    this.scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0x00f2fe, 3.2);
    keyLight.position.set(3, 4, 5);
    this.scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0xff007a, 4.0);
    rimLight.position.set(-4, -2, -3);
    this.scene.add(rimLight);

    // Optional Foreground 3D Stylized Mesh (e.g. Torus Knot with metallic material)
    if (options.enableForegroundMesh !== false) {
      this.initForegroundMesh();
    }
  }

  private initForegroundMesh(): void {
    const THREE = this.THREE;
    const geometry = new THREE.TorusKnotGeometry(1.35, 0.38, 128, 32);
    const material = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      metalness: 0.88,
      roughness: 0.18,
      clearcoat: 1.0,
      clearcoatRoughness: 0.1,
      reflectivity: 0.95,
      wireframe: false,
    });

    this.foregroundMesh = new THREE.Mesh(geometry, material);
    this.foregroundMesh.position.set(0, 0.2, 0);
    this.orbitGroup.add(this.foregroundMesh);

    // Add orbiting accent satellites for depth
    const satelliteGeo = new THREE.IcosahedronGeometry(0.22, 1);
    const satelliteMat = new THREE.MeshStandardMaterial({
      color: 0x00f2fe,
      emissive: 0x004455,
      metalness: 0.5,
      roughness: 0.3,
    });

    for (let i = 0; i < 4; i++) {
      const sat = new THREE.Mesh(satelliteGeo, satelliteMat);
      sat.name = `sat_${i}`;
      this.orbitGroup.add(sat);
    }
  }

  /**
   * Deterministic Render Hook for Hyperframes
   * @param currentTime Current playback time in seconds (float)
   * @param progress Normalized composition progress (0.0 - 1.0)
   */
  public render(currentTime: number, progress: number): void {
    // 1. Update Background Shader Uniforms
    this.bgMaterial.uniforms.uTime.value = currentTime;
    this.bgMaterial.uniforms.uProgress.value = progress;

    // 2. Deterministic Foreground 3D Animation (Pure function of time)
    if (this.foregroundMesh) {
      this.foregroundMesh.rotation.x = currentTime * 0.45;
      this.foregroundMesh.rotation.y = currentTime * 0.65;
      this.foregroundMesh.position.y = 0.2 + Math.sin(currentTime * 1.6) * 0.25;

      // Update orbiting satellites
      for (let i = 0; i < 4; i++) {
        const sat = this.orbitGroup.getObjectByName(`sat_${i}`);
        if (sat) {
          const angle = currentTime * 1.2 + (i * Math.PI) / 2;
          const radius = 2.4 + 0.2 * Math.sin(currentTime * 2.0 + i);
          sat.position.set(
            Math.cos(angle) * radius,
            Math.sin(angle * 0.7) * 0.8 + 0.2,
            Math.sin(angle) * radius
          );
          sat.rotation.x = currentTime * 2.0;
        }
      }
    }

    // Gentle camera sway
    this.camera.position.x = Math.sin(currentTime * 0.5) * 0.25;
    this.camera.position.y = Math.cos(currentTime * 0.6) * 0.2;
    this.camera.lookAt(0, 0, 0);

    // 3. Multi-pass Render (Background Quad -> Clear Depth -> 3D Mesh)
    this.renderer.clear();
    this.renderer.render(this.bgScene, this.bgCamera);
    this.renderer.clearDepth();
    this.renderer.render(this.scene, this.camera);
  }

  public resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.canvas.width = width;
    this.canvas.height = height;
    this.bgMaterial.uniforms.uResolution.value.set(width, height);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  public dispose(): void {
    this.bgQuad.geometry.dispose();
    this.bgMaterial.dispose();
    if (this.foregroundMesh) {
      this.foregroundMesh.geometry.dispose();
      (this.foregroundMesh.material as THREE.Material).dispose();
    }
    this.renderer.dispose();
  }
}
