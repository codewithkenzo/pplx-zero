import { test, expect, describe } from 'bun:test';
import { MODELS, type Model } from '../src/api';

describe('MODELS', () => {
  test('includes all expected models', () => {
    expect(MODELS).toContain('sonar');
    expect(MODELS).toContain('sonar-pro');
    expect(MODELS).toContain('sonar-reasoning-pro');
    expect(MODELS).toContain('sonar-deep-research');
  });

  test('has exactly 4 models', () => {
    expect(MODELS).toHaveLength(4);
  });

  test('does not include deprecated sonar-reasoning', () => {
    expect(MODELS).not.toContain('sonar-reasoning');
  });

  test('Model type matches MODELS array', () => {
    const model: Model = MODELS[0]!;
    expect(MODELS.includes(model)).toBe(true);
  });
});
