import { describe, test, expect } from 'vitest';
import katex from 'katex';
import { curriculumData, IDLE_FACTS } from './curriculum';

describe('curriculum', () => {
  test('has the eleven modules, each with every card filled in', () => {
    expect(curriculumData).toHaveLength(11);
    for (const m of curriculumData) {
      for (const key of ['id', 'title', 'accent', 'definition', 'comparison', 'math', 'misconception']) {
        expect(m[key], `${m.id}.${key}`).toBeTruthy();
      }
    }
    expect(new Set(curriculumData.map((m) => m.id)).size).toBe(11);
  });

  test("every module's formula parses in KaTeX", () => {
    for (const m of curriculumData) {
      expect(() => katex.renderToString(m.math, { throwOnError: true }), m.id).not.toThrow();
    }
  });

  test('every idle fact links to a real module', () => {
    const ids = new Set(curriculumData.map((m) => m.id));
    for (const f of IDLE_FACTS) expect(ids.has(f.moduleId), f.moduleId).toBe(true);
  });
});
