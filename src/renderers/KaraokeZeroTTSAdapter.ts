/**
 * KaraokeZeroTTSAdapter.ts
 *
 * Layer 2 (Top): HTML/SVG Layer for Word-by-Word Karaoke Subtitles & Kinetic Typography
 * Designed for ZeroTTS, Whisper & HeyGen word-level timestamp formats.
 * Resolution: 1080x1920 (9:16 Portrait) @ 30 FPS
 *
 * Conforms to Hyperframes portrait caption doctrine:
 * - Positioned in the portrait safe area (~600-720px from bottom).
 * - Full-width flex container with centered text alignment.
 * - Word states: upcoming (dimmed), active (pop/glow/karaoke sweep), completed (solid).
 * - Deterministic update(currentTime, progress).
 */

import type { KaraokeAdapterOptions, LayerAdapter, ZeroTTSLine, ZeroTTSWord } from './types.ts';

export class KaraokeZeroTTSAdapter implements LayerAdapter {
  public readonly id = 'karaoke-layer';

  public container: HTMLElement;
  public lines: ZeroTTSLine[];
  public options: KaraokeAdapterOptions;

  private lineElements: {
    line: ZeroTTSLine;
    wrapper: HTMLDivElement;
    wordElements: { word: ZeroTTSWord; span: HTMLSpanElement }[];
  }[] = [];

  constructor(options: KaraokeAdapterOptions) {
    this.options = options;

    if (typeof options.container === 'string') {
      const el = document.getElementById(options.container);
      if (!el) throw new Error(`[KaraokeZeroTTSAdapter] Element #${options.container} not found`);
      this.container = el;
    } else {
      this.container = options.container;
    }

    this.lines = options.lines || [];
    this.initStyles();
    this.buildDOM();
  }

  /**
   * Inject scoped styles for high-impact 9:16 mobile karaoke captions
   */
  private initStyles(): void {
    const styleId = 'hf-karaoke-styles';
    if (document.getElementById(styleId)) return;

    const styleEl = document.createElement('style');
    styleEl.id = styleId;
    styleEl.textContent = /* css */ `
      .hf-karaoke-root {
        position: absolute;
        inset: 0;
        pointer-events: none;
        overflow: hidden;
        z-index: 20;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Inter", "Poppins", sans-serif;
        user-select: none;
      }

      .hf-karaoke-safe-zone {
        position: absolute;
        bottom: ${this.options.safeBottom ?? 620}px;
        left: 0;
        width: 1080px;
        padding: 0 40px;
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        text-align: center;
      }

      .hf-karaoke-line {
        position: absolute;
        width: 100%;
        max-width: 960px;
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: center;
        gap: 16px 20px;
        opacity: 0;
        visibility: hidden;
        transform: translateY(24px) scale(0.96);
        transition: none; /* Deterministic seek must NOT use CSS transitions */
      }

      .hf-karaoke-line.active {
        opacity: 1;
        visibility: visible;
        transform: translateY(0px) scale(1.0);
      }

      .hf-karaoke-word {
        display: inline-block;
        font-size: ${this.options.fontSize ?? 64}px;
        font-weight: 800;
        line-height: 1.25;
        letter-spacing: -0.02em;
        text-transform: uppercase;
        border-radius: 18px;
        padding: 4px 16px;
        will-change: transform, opacity, color;
        position: relative;
      }

      /* State 1: Upcoming (dimmed) */
      .hf-karaoke-word.upcoming {
        color: ${this.options.inactiveColor ?? 'rgba(255, 255, 255, 0.42)'};
        text-shadow: 0 2px 10px rgba(0, 0, 0, 0.6);
        transform: scale(1.0);
      }

      /* State 2: Active (singing/speaking now) */
      .hf-karaoke-word.active {
        color: ${this.options.activeColor ?? '#ffe600'};
        background: rgba(255, 230, 0, 0.16);
        border: 2px solid rgba(255, 230, 0, 0.85);
        box-shadow: 0 0 35px rgba(255, 230, 0, 0.55), 0 4px 12px rgba(0, 0, 0, 0.7);
        text-shadow: 0 0 15px rgba(255, 230, 0, 0.8), 0 2px 8px rgba(0, 0, 0, 0.9);
        transform: scale(1.10) translateY(-4px);
        z-index: 5;
      }

      /* State 2b: Active emphasis word */
      .hf-karaoke-word.active.emphasis {
        color: #00f2fe;
        background: rgba(0, 242, 254, 0.22);
        border-color: #00f2fe;
        box-shadow: 0 0 45px rgba(0, 242, 254, 0.75), 0 4px 15px rgba(0, 0, 0, 0.8);
        text-shadow: 0 0 20px rgba(0, 242, 254, 0.9);
        transform: scale(1.18) translateY(-6px);
      }

      /* State 3: Completed / Spoken */
      .hf-karaoke-word.spoken {
        color: ${this.options.completedColor ?? '#ffffff'};
        text-shadow: 0 2px 10px rgba(0, 0, 0, 0.7);
        transform: scale(1.0);
        background: transparent;
        border: 2px solid transparent;
      }
    `;
    document.head.appendChild(styleEl);
  }

  /**
   * Build DOM nodes for all transcript lines & words
   */
  private buildDOM(): void {
    this.container.classList.add('hf-karaoke-root');
    this.container.innerHTML = '';

    const safeZone = document.createElement('div');
    safeZone.className = 'hf-karaoke-safe-zone';
    this.container.appendChild(safeZone);

    this.lineElements = this.lines.map((line) => {
      const lineDiv = document.createElement('div');
      lineDiv.id = `line-${line.id}`;
      lineDiv.className = 'hf-karaoke-line';

      const wordElements = line.words.map((w, idx) => {
        const span = document.createElement('span');
        span.id = `word-${line.id}-${idx}`;
        span.className = 'hf-karaoke-word upcoming';
        span.textContent = w.word;
        if (w.emphasis) {
          span.classList.add('emphasis');
        }
        lineDiv.appendChild(span);
        return { word: w, span };
      });

      safeZone.appendChild(lineDiv);
      return { line, wrapper: lineDiv, wordElements };
    });
  }

  public setLines(lines: ZeroTTSLine[]): void {
    this.lines = lines;
    this.buildDOM();
  }

  /**
   * Deterministic Time Update
   * Updates line visibility & word highlights purely from currentTime
   */
  public update(currentTime: number, _progress: number = 0): void {
    for (const { line, wrapper, wordElements } of this.lineElements) {
      // Determine if line is active
      const isLineActive = currentTime >= line.start && currentTime <= line.end;

      if (isLineActive) {
        if (!wrapper.classList.contains('active')) {
          wrapper.classList.add('active');
        }

        // Update word states
        for (const { word, span } of wordElements) {
          if (currentTime < word.start) {
            // Not reached yet
            span.className = 'hf-karaoke-word upcoming' + (word.emphasis ? ' emphasis' : '');
          } else if (currentTime >= word.start && currentTime <= word.end) {
            // Word currently spoken (Active Highlight)
            span.className = 'hf-karaoke-word active' + (word.emphasis ? ' emphasis' : '');
          } else {
            // Already spoken
            span.className = 'hf-karaoke-word spoken' + (word.emphasis ? ' emphasis' : '');
          }
        }
      } else {
        if (wrapper.classList.contains('active')) {
          wrapper.classList.remove('active');
        }
      }
    }
  }

  public render(currentTime: number, progress: number, _frame: number): void {
    this.update(currentTime, progress);
  }

  public resize(width: number, height: number): void {
    const safeZone = this.container.querySelector('.hf-karaoke-safe-zone') as HTMLElement;
    if (safeZone) {
      safeZone.style.width = `${width}px`;
    }
  }

  public dispose(): void {
    this.container.innerHTML = '';
    const styleEl = document.getElementById('hf-karaoke-styles');
    if (styleEl) styleEl.remove();
  }
}

/**
 * Sample bilingual ZeroTTS word-level transcript fixture (10 seconds)
 * Combines high-energy Vietnamese and English tech punchlines
 */
export const SAMPLE_ZEROTTS_TRANSCRIPT: ZeroTTSLine[] = [
  {
    id: 'line_1',
    text: 'KIẾN TRÚC ĐA TẦNG ĐỈNH CAO',
    start: 0.3,
    end: 2.8,
    words: [
      { word: 'KIẾN', start: 0.3, end: 0.7 },
      { word: 'TRÚC', start: 0.7, end: 1.1 },
      { word: 'ĐA', start: 1.1, end: 1.5 },
      { word: 'TẦNG', start: 1.5, end: 2.0, emphasis: true },
      { word: 'ĐỈNH', start: 2.0, end: 2.4 },
      { word: 'CAO', start: 2.4, end: 2.8, emphasis: true },
    ],
  },
  {
    id: 'line_2',
    text: 'THREE.JS VÀ SHADER LIQUID SDF',
    start: 3.1,
    end: 5.6,
    words: [
      { word: 'THREE.JS', start: 3.1, end: 3.7, emphasis: true },
      { word: 'VÀ', start: 3.7, end: 4.1 },
      { word: 'SHADER', start: 4.1, end: 4.7 },
      { word: 'LIQUID', start: 4.7, end: 5.1, emphasis: true },
      { word: 'SDF', start: 5.1, end: 5.6, emphasis: true },
    ],
  },
  {
    id: 'line_3',
    text: 'ROUGHJS VẼ TAY RUNG HOẠT HÌNH',
    start: 5.9,
    end: 7.8,
    words: [
      { word: 'ROUGHJS', start: 5.9, end: 6.4, emphasis: true },
      { word: 'VẼ', start: 6.4, end: 6.7 },
      { word: 'TAY', start: 6.7, end: 7.0 },
      { word: 'RUNG', start: 7.0, end: 7.4 },
      { word: 'HOẠT', start: 7.4, end: 7.6 },
      { word: 'HÌNH', start: 7.6, end: 7.8, emphasis: true },
    ],
  },
  {
    id: 'line_4',
    text: 'KARAOKE SYNC TỪNG TỪ CỰC CHUẨN',
    start: 8.0,
    end: 9.8,
    words: [
      { word: 'KARAOKE', start: 8.0, end: 8.4, emphasis: true },
      { word: 'SYNC', start: 8.4, end: 8.7 },
      { word: 'TỪNG', start: 8.7, end: 9.0 },
      { word: 'TỪ', start: 9.0, end: 9.3 },
      { word: 'CỰC', start: 9.3, end: 9.5 },
      { word: 'CHUẨN', start: 9.5, end: 9.8, emphasis: true },
    ],
  },
];
