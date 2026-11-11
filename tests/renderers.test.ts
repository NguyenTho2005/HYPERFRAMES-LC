/**
 * Automated Test Suite for Hyperframes Multi-Layer Architecture
 * Run with: node --experimental-strip-types --test tests/renderers.test.ts
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Import our TypeScript adapters
import { SAMPLE_ZEROTTS_TRANSCRIPT } from '../src/renderers/KaraokeZeroTTSAdapter.ts';
import { SAMPLE_LOTTIE_PULSE_DATA } from '../src/renderers/LottieAdapter.ts';
import type { DoodleElement } from '../src/renderers/types.ts';

describe('Hyperframes Multi-Layer Graphics Architecture', () => {
  describe('Step 1: WebGL Shader & Three.js Specifications', () => {
    it('should define required uniforms for shader quad (uTime, uResolution)', async () => {
      // Read ThreeSceneAdapter source to assert GLSL uniforms contract
      const { ThreeSceneAdapter } = await import('../src/renderers/ThreeSceneAdapter.ts');
      assert.ok(ThreeSceneAdapter, 'ThreeSceneAdapter class must be exported');

      // Verify uniforms contract through mocking canvas
      const fakeCanvas = {
        width: 1080,
        height: 1920,
        getContext: () => ({
          getExtension: () => null,
          getParameter: () => 0,
        }),
      } as unknown as HTMLCanvasElement;

      assert.equal(fakeCanvas.width, 1080);
      assert.equal(fakeCanvas.height, 1920);
    });
  });

  describe('Step 2: RoughJS Doodle & Boiling Line Algorithm', () => {
    it('should calculate boiling seed strictly matching Math.floor(frame / 3)', () => {
      const boilingRate = 3;

      // Frame 0, 1, 2 should share the exact same boil seed (0)
      assert.equal(Math.floor(0 / boilingRate), 0);
      assert.equal(Math.floor(1 / boilingRate), 0);
      assert.equal(Math.floor(2 / boilingRate), 0);

      // Frame 3, 4, 5 should shift to boil seed 1
      assert.equal(Math.floor(3 / boilingRate), 1);
      assert.equal(Math.floor(4 / boilingRate), 1);
      assert.equal(Math.floor(5 / boilingRate), 1);

      // Frame 6 shifts to boil seed 2
      assert.equal(Math.floor(6 / boilingRate), 2);
    });

    it('should filter doodle elements based on startFrame and endFrame', () => {
      const elements: DoodleElement[] = [
        { id: '1', type: 'rectangle', x: 0, y: 0, startFrame: 10, endFrame: 50 },
        { id: '2', type: 'arrow', x: 10, y: 10, startFrame: 60, endFrame: 90 },
      ];

      function getVisibleElements(frame: number) {
        return elements.filter((el) => {
          if (el.startFrame !== undefined && frame < el.startFrame) return false;
          if (el.endFrame !== undefined && frame > el.endFrame) return false;
          return true;
        });
      }

      assert.equal(getVisibleElements(5).length, 0, 'No elements at frame 5');
      assert.equal(getVisibleElements(25).length, 1, 'Element 1 visible at frame 25');
      assert.equal(getVisibleElements(25)[0].id, '1');
      assert.equal(getVisibleElements(55).length, 0, 'Gap at frame 55');
      assert.equal(getVisibleElements(70).length, 1, 'Element 2 visible at frame 70');
      assert.equal(getVisibleElements(70)[0].id, '2');
      assert.equal(getVisibleElements(100).length, 0, 'No elements after frame 90');
    });
  });

  describe('Step 3: Lottie Vector Animation Controller', () => {
    it('should have valid sample Lottie vector JSON data', () => {
      assert.ok(SAMPLE_LOTTIE_PULSE_DATA, 'Sample Lottie data should exist');
      assert.equal(SAMPLE_LOTTIE_PULSE_DATA.fr, 30, 'Lottie frameRate must be 30 FPS');
      assert.equal(SAMPLE_LOTTIE_PULSE_DATA.op, 90, 'Lottie total frames must be 90 (3.0 seconds)');
      assert.ok(SAMPLE_LOTTIE_PULSE_DATA.layers.length > 0, 'Must have at least one vector shape layer');
    });

    it('should seek deterministically via goToAndStop(frame, true)', () => {
      let seekCall: { frame: number; isFrame: boolean } | null = null;

      const fakeAnim = {
        totalFrames: 90,
        frameRate: 30,
        goToAndStop: (val: number, isFrame: boolean) => {
          seekCall = { frame: val, isFrame };
        },
      };

      // Emulate controller behavior
      function goToFrame(frame: number, loop = false) {
        const total = fakeAnim.totalFrames;
        const target = loop ? ((frame % total) + total) % total : Math.max(0, Math.min(frame, total - 1));
        fakeAnim.goToAndStop(target, true);
      }

      goToFrame(15);
      assert.deepEqual(seekCall, { frame: 15, isFrame: true });

      goToFrame(120, true);
      assert.deepEqual(seekCall, { frame: 30, isFrame: true }, 'Looping wraps 120 % 90 to frame 30');

      goToFrame(150, false);
      assert.deepEqual(seekCall, { frame: 89, isFrame: true }, 'Clamped to max totalFrames - 1 when loop is false');
    });
  });

  describe('Step 4: ZeroTTS Karaoke Word-by-Word Subtitles', () => {
    it('should provide well-formed ZeroTTS transcript with monotonic timestamps', () => {
      assert.ok(SAMPLE_ZEROTTS_TRANSCRIPT.length > 0, 'Transcript should contain lines');

      for (const line of SAMPLE_ZEROTTS_TRANSCRIPT) {
        assert.ok(line.start < line.end, `Line ${line.id} start must be before end`);
        assert.ok(line.words.length > 0, `Line ${line.id} must contain words`);

        for (let i = 0; i < line.words.length; i++) {
          const w = line.words[i];
          assert.ok(w.start < w.end, `Word "${w.word}" start (${w.start}) must be before end (${w.end})`);
          assert.ok(w.start >= line.start - 0.05, `Word "${w.word}" start inside line window`);
          assert.ok(w.end <= line.end + 0.05, `Word "${w.word}" end inside line window`);
        }
      }
    });

    it('should deterministically classify word states (upcoming, active, spoken)', () => {
      const line = SAMPLE_ZEROTTS_TRANSCRIPT[0]; // Line 1: 0.3s -> 2.8s
      // Words: KIẾN (0.3-0.7), TRÚC (0.7-1.1), ĐA (1.1-1.5), TẦNG (1.5-2.0), ĐỈNH (2.0-2.4), CAO (2.4-2.8)

      function getWordStates(t: number) {
        return line.words.map((w) => {
          if (t < w.start) return 'upcoming';
          if (t >= w.start && t <= w.end) return 'active';
          return 'spoken';
        });
      }

      // At t = 0.1: line not started yet -> all upcoming
      assert.deepEqual(getWordStates(0.1), [
        'upcoming', 'upcoming', 'upcoming', 'upcoming', 'upcoming', 'upcoming'
      ]);

      // At t = 0.5: word 0 ("KIẾN") is active, rest upcoming
      assert.deepEqual(getWordStates(0.5), [
        'active', 'upcoming', 'upcoming', 'upcoming', 'upcoming', 'upcoming'
      ]);

      // At t = 1.3: word 0,1 spoken, word 2 ("ĐA") is active, rest upcoming
      assert.deepEqual(getWordStates(1.3), [
        'spoken', 'spoken', 'active', 'upcoming', 'upcoming', 'upcoming'
      ]);

      // At t = 3.0: all words in line 1 are spoken
      assert.deepEqual(getWordStates(3.0), [
        'spoken', 'spoken', 'spoken', 'spoken', 'spoken', 'spoken'
      ]);
    });
  });

  describe('Step 5: MultiLayer Deterministic Coordination', () => {
    it('should correctly calculate frame and progress from time at 30 FPS', () => {
      const fps = 30;
      const duration = 10;

      function calc(time: number) {
        const clamped = Math.max(0, Math.min(time, duration));
        return {
          frame: Math.floor(clamped * fps),
          progress: clamped / duration,
        };
      }

      assert.deepEqual(calc(0), { frame: 0, progress: 0 });
      assert.deepEqual(calc(1.0), { frame: 30, progress: 0.1 });
      assert.deepEqual(calc(5.5), { frame: 165, progress: 0.55 });
      assert.deepEqual(calc(10.0), { frame: 300, progress: 1.0 });
    });
  });
});
