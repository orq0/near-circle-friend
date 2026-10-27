import { describe, expect, it } from 'vitest';
import { defaultStrideM, estimateSteps, parseStrideM } from '../src/routing/steps.js';
import { catchStatus } from './helpers.js';

describe('estimateSteps', () => {
  it('divides route distance by stride and rounds', () => {
    expect(estimateSteps(340, 0.75)).toBe(453);
    expect(estimateSteps(0, 0.75)).toBe(0);
    expect(estimateSteps(750, 0.8)).toBe(938);
  });

  it('rejects invalid inputs with 400', async () => {
    expect(await catchStatus(async () => estimateSteps(-1, 0.75))).toBe(400);
    expect(await catchStatus(async () => estimateSteps(100, 0))).toBe(400);
    expect(await catchStatus(async () => estimateSteps(Number.NaN, 0.75))).toBe(400);
  });
});

describe('parseStrideM', () => {
  it('accepts explicit strides and falls back otherwise', () => {
    expect(parseStrideM(undefined, 0.75)).toBe(0.75);
    expect(parseStrideM('0.8', 0.75)).toBe(0.8);
    expect(parseStrideM(0.7, 0.75)).toBe(0.7);
  });

  it('rejects bad strides with 400', async () => {
    for (const bad of ['abc', '0', '-1', '5', {}, []]) {
      expect(await catchStatus(async () => parseStrideM(bad, 0.75))).toBe(400);
    }
  });
});

describe('defaultStrideM', () => {
  it('reads the environment with a safe fallback', () => {
    expect(defaultStrideM({})).toBe(0.75);
    expect(defaultStrideM({ DEFAULT_STRIDE_M: '0.8' })).toBe(0.8);
    expect(defaultStrideM({ DEFAULT_STRIDE_M: 'bogus' })).toBe(0.75);
    expect(defaultStrideM({ DEFAULT_STRIDE_M: '0' })).toBe(0.75);
  });
});
