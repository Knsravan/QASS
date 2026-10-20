import { describe, test, expect } from 'vitest';
import { STAGE_PHASES, hubScenePose, SHARED_SCENE_STAGES, SIDE_TITLES } from './stagePhases';
import { curriculumData } from './curriculum';

// What App.jsx used to work out inline for the hub's scene, kept here as the reference.
const before = (stagePhase, stageId, pairModule) => ({
  activeModule: stagePhase === 'grow' || stagePhase === 'shrink' ? 'gates' : stagePhase.startsWith('multi-') ? pairModule : stagePhase === 'solo-unsolo' ? 'interference' : stageId,
  multi: stagePhase === 'multi-center' ? 'center' : stagePhase === 'multi-merge' ? 'merge' : stagePhase === 'multi-split' || stagePhase === 'multi-unsplit' ? 'split' : stagePhase === 'multi-zoom' || stagePhase === 'multi-unzoom' ? 'zoom' : null,
  vanishing: stagePhase === 'vanish',
  centerOnly: stagePhase === 'solo-center',
});

describe('the stage phases', () => {
  const stages = [null, ...curriculumData.map((m) => m.id)];
  const pairs = ['multi-qubit-gates', 'entanglement', 'decoherence', 'exponential'];

  test.each(Object.keys(STAGE_PHASES))('%s: the hub scene gets the same props as before', (phase) => {
    for (const stageId of stages) {
      for (const pair of pairs) expect(hubScenePose(phase, stageId, pair)).toEqual(before(phase, stageId, pair));
    }
  });

  test('every phase a phase leads to exists, after a real delay', () => {
    for (const [name, p] of Object.entries(STAGE_PHASES)) {
      if (!p.next) continue;
      expect(STAGE_PHASES[p.next], `${name} -> ${p.next}`).toBeDefined();
      expect(p.after, name).toBeGreaterThan(0);
    }
  });

  test('the stage lists name real modules', () => {
    const ids = new Set(curriculumData.map((m) => m.id));
    for (const id of SHARED_SCENE_STAGES) expect(ids.has(id), id).toBe(true);
    for (const id of Object.keys(SIDE_TITLES)) expect(ids.has(id), id).toBe(true);
  });
});
