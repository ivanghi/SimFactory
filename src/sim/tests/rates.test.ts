import { describe, it, expect, beforeEach } from 'vitest';
import { RATE_WINDOW_SECONDS, ratePerMinute, resetRateSamples, sampleProgress } from '../rates';

// Isolated failure modes for the rolling production-rate tracker:
// - no samples yet, or only a baseline sample (measures nothing)
// - duplicated and rewound timestamps must not cause division by zero
// - corrupt (decreasing) cumulative progress must not produce a negative rate
// - samples older than the window must be evicted from the measurement
// - reset (new game / save load) must re-baseline, so a rewound clock is accepted again
// - non-finite input from a malformed save must be ignored
describe('rate tracker', () => {
  beforeEach(() => {
    resetRateSamples();
  });

  it('reports 0 with no samples', () => {
    expect(ratePerMinute()).toBe(0);
  });

  it('reports 0 with only a baseline sample', () => {
    sampleProgress(0, 0);
    expect(ratePerMinute()).toBe(0);
  });

  it('reports 0 for constant progress over a full window', () => {
    sampleProgress(0, 0);
    sampleProgress(30, 0);
    sampleProgress(60, 0);
    expect(ratePerMinute()).toBe(0);
  });

  it('averages steady production over the window', () => {
    sampleProgress(0, 0);
    sampleProgress(60, 4);
    expect(ratePerMinute()).toBeCloseTo(4, 10);
  });

  it('tolerates duplicate timestamps without division by zero', () => {
    sampleProgress(0, 0);
    sampleProgress(10, 5);
    sampleProgress(10, 5);
    sampleProgress(70, 9);
    expect(ratePerMinute()).toBeCloseTo(4, 10);
  });

  it('ignores a rewound clock', () => {
    sampleProgress(0, 0);
    sampleProgress(60, 4);
    sampleProgress(30, 99);
    sampleProgress(120, 8);
    expect(ratePerMinute()).toBeCloseTo(4, 10);
  });

  it('never reports a negative rate from decreasing progress', () => {
    sampleProgress(0, 0);
    sampleProgress(60, 4);
    sampleProgress(120, 2);
    expect(ratePerMinute()).toBe(0);
  });

  it('evicts samples outside the rolling window', () => {
    sampleProgress(0, 0);
    sampleProgress(60, 4);
    sampleProgress(60 + RATE_WINDOW_SECONDS, 4);
    sampleProgress(60 + RATE_WINDOW_SECONDS + 0.5, 4);
    expect(ratePerMinute()).toBe(0);
  });

  it('measures a full window when the boundary lands between samples', () => {
    // Cumulative science grows linearly: 4/min. The cutoff (t=10.5) has no
    // sample, so the base value must be interpolated (0.6), not dropped,
    // to keep the measured span at the full window.
    sampleProgress(0, 0);
    sampleProgress(70, 4);
    sampleProgress(70.5, 4);
    expect(ratePerMinute()).toBeCloseTo((4 - 0.6) * (60 / 60), 10);
  });

  it('re-baselines on reset so a fresh clock (lower time) is accepted', () => {
    sampleProgress(600, 20);
    sampleProgress(660, 24);
    resetRateSamples();
    expect(ratePerMinute()).toBe(0);
    sampleProgress(0, 0);
    sampleProgress(60, 2);
    expect(ratePerMinute()).toBeCloseTo(2, 10);
  });

  it('ignores non-finite time or progress', () => {
    sampleProgress(0, 0);
    sampleProgress(Number.NaN, 100);
    sampleProgress(60, Number.POSITIVE_INFINITY);
    expect(ratePerMinute()).toBe(0);
  });
});
