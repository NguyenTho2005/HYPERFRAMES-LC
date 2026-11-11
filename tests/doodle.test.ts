/**
 * RoughDoodleAdapter Lifecycle & Boiling Line Test
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { RoughDoodleAdapter } from '../src/renderers/RoughDoodleAdapter.ts';
import type { DoodleElement } from '../src/renderers/types.ts';

describe('RoughDoodleAdapter Implementation', () => {
  it('should initialize and render doodle elements with correct boiling line seeds', () => {
    const renderedCalls: { method: string; args: any[]; seed?: number }[] = [];

    const mockRough = {
      rectangle: (x: number, y: number, w: number, h: number, style: any) => {
        renderedCalls.push({ method: 'rectangle', args: [x, y, w, h], seed: style.seed });
      },
      circle: (x: number, y: number, r: number, style: any) => {
        renderedCalls.push({ method: 'circle', args: [x, y, r], seed: style.seed });
      },
      line: (x1: number, y1: number, x2: number, y2: number, style: any) => {
        renderedCalls.push({ method: 'line', args: [x1, y1, x2, y2], seed: style.seed });
      },
    };

    let clearedRects: any[] = [];
    const mockCtx = {
      clearRect: (x: number, y: number, w: number, h: number) => {
        clearedRects.push([x, y, w, h]);
      },
    };

    const mockCanvas = {
      width: 0,
      height: 0,
      getContext: () => mockCtx,
    } as unknown as HTMLCanvasElement;

    const adapter = new RoughDoodleAdapter({
      canvas: mockCanvas,
      width: 1080,
      height: 1920,
      boilingRate: 3,
      roughInstance: mockRough,
    } as any);

    assert.equal(mockCanvas.width, 1080);
    assert.equal(mockCanvas.height, 1920);

    const elements: DoodleElement[] = [
      { id: 'box', type: 'rectangle', x: 100, y: 200, width: 300, height: 150, options: { seed: 500 } },
    ];

    // Frame 0
    adapter.drawDoodle(0, elements);
    assert.equal(clearedRects.length, 1);
    assert.deepEqual(clearedRects[0], [0, 0, 1080, 1920]);
    assert.equal(renderedCalls.length, 1);
    const seedFrame0 = renderedCalls[0].seed;
    assert.equal(seedFrame0, 500 + 0 * 37);

    // Frame 1: Seed should remain identical (within 3-frame boiling window)
    renderedCalls.length = 0;
    adapter.drawDoodle(1, elements);
    assert.equal(renderedCalls[0].seed, seedFrame0);

    // Frame 2: Seed still identical
    renderedCalls.length = 0;
    adapter.drawDoodle(2, elements);
    assert.equal(renderedCalls[0].seed, seedFrame0);

    // Frame 3: Boil seed shifts!
    renderedCalls.length = 0;
    adapter.drawDoodle(3, elements);
    assert.notEqual(renderedCalls[0].seed, seedFrame0);
    assert.equal(renderedCalls[0].seed, 500 + 1 * 37);
  });
});
