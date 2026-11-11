/**
 * DOM Lifecycle & Adapter Integration Test
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { KaraokeZeroTTSAdapter, SAMPLE_ZEROTTS_TRANSCRIPT } from '../src/renderers/KaraokeZeroTTSAdapter.ts';

// Minimal mock DOM for testing in Node
function createMockElement(tag: string = 'div') {
  const children: any[] = [];
  const classList = new Set<string>();
  const style: Record<string, string> = {};

  const el = {
    tagName: tag.toUpperCase(),
    style,
    id: '',
    textContent: '',
    children,
    parentElement: null,
    appendChild: (child: any) => {
      child.parentElement = el;
      children.push(child);
      return child;
    },
    querySelector: (selector: string) => {
      if (selector.startsWith('.')) {
        const cls = selector.slice(1);
        return children.find((c) => c.classList.has(cls)) || null;
      }
      return null;
    },
    querySelectorAll: (_selector: string) => children,
    classList: {
      add: (cls: string) => classList.add(cls),
      remove: (cls: string) => classList.delete(cls),
      contains: (cls: string) => classList.has(cls),
      has: (cls: string) => classList.has(cls),
    },
    innerHTML: '',
  };
  return el;
}

// Setup fake document on globalThis
(globalThis as any).document = {
  createElement: (tag: string) => createMockElement(tag),
  getElementById: (_id: string) => null,
  head: createMockElement('head'),
};

describe('KaraokeZeroTTSAdapter DOM Lifecycle', () => {
  it('should build safe-zone container and line elements on mount', () => {
    const container = createMockElement('div') as unknown as HTMLElement;
    const adapter = new KaraokeZeroTTSAdapter({
      container,
      lines: SAMPLE_ZEROTTS_TRANSCRIPT,
      safeBottom: 620,
      fontSize: 66,
    });

    assert.equal(adapter.lines.length, 4, 'Should load 4 transcript lines');
    assert.equal(container.children.length, 1, 'Container should hold safe-zone');
    const safeZone = container.children[0];
    assert.equal(safeZone.children.length, 4, 'Safe zone should contain 4 lines');
  });

  it('should update active class on lines and words as time advances', () => {
    const container = createMockElement('div') as unknown as HTMLElement;
    const adapter = new KaraokeZeroTTSAdapter({
      container,
      lines: SAMPLE_ZEROTTS_TRANSCRIPT,
    });

    // At t = 0.5s: Line 1 should be active, Word 0 ("KIẾN") should be active
    adapter.update(0.5);

    const safeZone = container.children[0];
    const line1 = safeZone.children[0];
    assert.ok(line1.classList.contains('active'), 'Line 1 should be active at t=0.5s');

    const word0 = line1.children[0];
    assert.ok(word0.className.includes('active'), 'Word 0 should have active class');

    const word1 = line1.children[1];
    assert.ok(word1.className.includes('upcoming'), 'Word 1 should have upcoming class');

    // At t = 3.5s: Line 1 should be inactive, Line 2 should be active
    adapter.update(3.5);
    assert.ok(!line1.classList.contains('active'), 'Line 1 should be inactive at t=3.5s');

    const line2 = safeZone.children[1];
    assert.ok(line2.classList.contains('active'), 'Line 2 should be active at t=3.5s');
  });
});
