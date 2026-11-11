/**
 * RoughDoodleAdapter.ts
 *
 * Layer 1 (Middle): 2D Canvas for RoughJS Hand-Drawn Doodle & Sketching
 * Resolution: 1080x1920 (9:16 Portrait) @ 30 FPS
 *
 * Boiling Line Animation:
 * Uses a seed shifting every 3 frames: seed = Math.floor(frame / 3)
 * producing traditional 10 FPS hand-drawn line boiling / jitter.
 */

import type { DoodleElement, LayerAdapter, RoughDoodleAdapterOptions } from './types.ts';

function resolveRough(custom?: any): any {
  if (custom) return custom;
  if (typeof window !== 'undefined' && (window as any).rough) {
    return (window as any).rough;
  }
  try {
    return (globalThis as any).rough;
  } catch {
    return null;
  }
}

export class RoughDoodleAdapter implements LayerAdapter {
  public readonly id = 'doodle-layer';

  public canvas: HTMLCanvasElement;
  public ctx: CanvasRenderingContext2D;
  public rc: any; // RoughCanvas instance

  private width: number;
  private height: number;
  private boilingRate: number;
  private defaultRoughness: number;
  private defaultStrokeWidth: number;

  // Stored active elements if managed internally
  public elements: DoodleElement[] = [];

  constructor(options: RoughDoodleAdapterOptions) {
    if (typeof options.canvas === 'string') {
      const el = document.getElementById(options.canvas);
      if (!el || !(el instanceof HTMLCanvasElement)) {
        throw new Error(`[RoughDoodleAdapter] Canvas with ID "${options.canvas}" not found`);
      }
      this.canvas = el;
    } else {
      this.canvas = options.canvas;
    }

    this.width = options.width ?? 1080;
    this.height = options.height ?? 1920;
    this.boilingRate = options.boilingRate ?? 3; // Shift seed every 3 frames
    this.defaultRoughness = options.defaultRoughness ?? 1.5;
    this.defaultStrokeWidth = options.defaultStrokeWidth ?? 3;

    this.canvas.width = this.width;
    this.canvas.height = this.height;

    const context = this.canvas.getContext('2d');
    if (!context) {
      throw new Error('[RoughDoodleAdapter] Failed to obtain 2D canvas context');
    }
    this.ctx = context;

    // Initialize Rough.js
    const roughLib = resolveRough((options as any).roughInstance);
    if (!roughLib) {
      throw new Error('[RoughDoodleAdapter] roughjs library not found on window.rough or options');
    }
    const roughFactory = roughLib.canvas || roughLib;
    this.rc = typeof roughFactory === 'function' ? roughFactory(this.canvas) : roughLib;
  }

  /**
   * Set the collection of doodle elements to be rendered across frames
   */
  public setElements(elements: DoodleElement[]): void {
    this.elements = elements;
  }

  public addElement(element: DoodleElement): void {
    this.elements.push(element);
  }

  /**
   * Core Boiling Line Render Function
   * @param frame Current integer frame number (0, 1, 2, ...)
   * @param elements Array of doodle elements to render
   */
  public drawDoodle(frame: number, elements: DoodleElement[] = this.elements): void {
    // 1. Clear frame
    this.ctx.clearRect(0, 0, this.width, this.height);

    // 2. Compute boiling seed: changes every 3 frames
    const boilSeed = Math.floor(frame / this.boilingRate);

    // 3. Render each element
    for (const rawEl of elements) {
      // Frame range check
      if (rawEl.startFrame !== undefined && frame < rawEl.startFrame) continue;
      if (rawEl.endFrame !== undefined && frame > rawEl.endFrame) continue;

      // Calculate animated properties if an animate function is provided
      let el = rawEl;
      if (typeof rawEl.animate === 'function') {
        const duration = (rawEl.endFrame ?? 300) - (rawEl.startFrame ?? 0);
        const progress = duration > 0 ? (frame - (rawEl.startFrame ?? 0)) / duration : 0;
        const overrides = rawEl.animate(frame, Math.max(0, Math.min(1, progress)));
        el = { ...rawEl, ...overrides, options: { ...rawEl.options, ...overrides.options } };
      }

      // Generate seed unique to element + current boil step
      const elementSeed = (el.options?.seed ?? 1000) + boilSeed * 37;

      const style = {
        roughness: el.options?.roughness ?? this.defaultRoughness,
        strokeWidth: el.options?.strokeWidth ?? this.defaultStrokeWidth,
        stroke: el.options?.stroke ?? '#ffffff',
        fill: el.options?.fill,
        fillStyle: el.options?.fillStyle ?? 'hachure',
        bowing: el.options?.bowing ?? 1.2,
        seed: elementSeed,
        hachureAngle: el.options?.hachureAngle ?? -45,
        hachureGap: el.options?.hachureGap ?? 8,
      };

      this.renderElement(el, style);
    }
  }

  /**
   * Dispatch element rendering to Rough.js drawing methods
   */
  private renderElement(el: DoodleElement, style: any): void {
    switch (el.type) {
      case 'rectangle':
        this.rc.rectangle(el.x, el.y, el.width ?? 100, el.height ?? 100, style);
        break;

      case 'circle':
        this.rc.circle(el.x, el.y, el.width ?? 100, style);
        break;

      case 'ellipse':
        this.rc.ellipse(el.x, el.y, el.width ?? 120, el.height ?? 80, style);
        break;

      case 'line':
        if (el.points && el.points.length >= 2) {
          this.rc.line(el.points[0][0], el.points[0][1], el.points[1][0], el.points[1][1], style);
        } else {
          this.rc.line(el.x, el.y, el.x + (el.width ?? 100), el.y + (el.height ?? 0), style);
        }
        break;

      case 'polygon':
        if (el.points && el.points.length >= 3) {
          this.rc.polygon(el.points, style);
        }
        break;

      case 'path':
        if (el.pathData) {
          this.rc.path(el.pathData, style);
        }
        break;

      case 'underline':
        this.drawHandDrawnUnderline(el.x, el.y, el.width ?? 300, style);
        break;

      case 'arrow':
        this.drawHandDrawnArrow(
          el.points?.[0]?.[0] ?? el.x,
          el.points?.[0]?.[1] ?? el.y,
          el.points?.[1]?.[0] ?? el.x + (el.width ?? 150),
          el.points?.[1]?.[1] ?? el.y + (el.height ?? 0),
          style
        );
        break;

      case 'badge':
        this.drawHandDrawnBadge(el.x, el.y, el.width ?? 280, el.height ?? 80, style);
        break;

      default:
        this.rc.rectangle(el.x, el.y, el.width ?? 100, el.height ?? 100, style);
        break;
    }
  }

  // --- Specialized Doodle Presets ---

  private drawHandDrawnUnderline(x: number, y: number, width: number, style: any): void {
    // Double rough stroke for energetic hand-drawn marker feel
    this.rc.line(x, y, x + width, y + 2, style);
    this.rc.line(x + 5, y + 6, x + width - 10, y + 7, {
      ...style,
      strokeWidth: Math.max(1, style.strokeWidth - 1),
    });
  }

  private drawHandDrawnArrow(x1: number, y1: number, x2: number, y2: number, style: any): void {
    // Shaft
    this.rc.line(x1, y1, x2, y2, style);

    // Arrowhead calculations
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const headLen = 28;
    const arrowAngle = Math.PI / 6; // 30 degrees

    const hx1 = x2 - headLen * Math.cos(angle - arrowAngle);
    const hy1 = y2 - headLen * Math.sin(angle - arrowAngle);
    const hx2 = x2 - headLen * Math.cos(angle + arrowAngle);
    const hy2 = y2 - headLen * Math.sin(angle + arrowAngle);

    this.rc.line(x2, y2, hx1, hy1, style);
    this.rc.line(x2, y2, hx2, hy2, style);
  }

  private drawHandDrawnBadge(
    x: number,
    y: number,
    width: number,
    height: number,
    style: any
  ): void {
    // Rounded-corner look via overlapping lines or curved rectangle
    this.rc.rectangle(x, y, width, height, {
      ...style,
      fill: style.fill ?? 'rgba(0, 242, 254, 0.15)',
      fillStyle: style.fillStyle ?? 'cross-hatch',
    });
  }

  /**
   * Deterministic LayerAdapter render method
   */
  public render(currentTime: number, progress: number, frame: number): void {
    this.drawDoodle(frame, this.elements);
  }

  public resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.canvas.width = width;
    this.canvas.height = height;
  }

  public dispose(): void {
    this.ctx.clearRect(0, 0, this.width, this.height);
    this.elements = [];
  }
}
