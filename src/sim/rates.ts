export const RATE_WINDOW_SECONDS = 60;

interface Sample {
  t: number;
  v: number;
}

let samples: Sample[] = [];

function cutoff(): number {
  return samples[samples.length - 1].t - RATE_WINDOW_SECONDS;
}

// Cumulative value at time x, interpolated between surrounding samples.
function valueAt(x: number): number {
  const last = samples[samples.length - 1];
  if (x >= last.t) {
    return last.v;
  }
  if (x <= samples[0].t) {
    return samples[0].v;
  }
  for (let i = 1; i < samples.length; i++) {
    const b = samples[i];
    if (b.t >= x) {
      const a = samples[i - 1];
      if (b.t === a.t) {
        return b.v;
      }
      const frac = (x - a.t) / (b.t - a.t);
      return a.v + (b.v - a.v) * frac;
    }
  }
  return last.v;
}

export function sampleProgress(time: number, cumulative: number): void {
  if (!Number.isFinite(time) || !Number.isFinite(cumulative)) {
    return;
  }
  if (samples.length > 0) {
    const last = samples[samples.length - 1];
    if (time < last.t) {
      return;
    }
    if (time === last.t) {
      last.v = Math.max(last.v, cumulative);
      return;
    }
    samples.push({ t: time, v: Math.max(cumulative, last.v) });
    while (samples.length > 2 && samples[1].t < cutoff()) {
      samples.shift();
    }
  } else {
    samples.push({ t: time, v: cumulative });
  }
}

export function ratePerMinute(): number {
  if (samples.length < 2) {
    return 0;
  }
  const end = samples[samples.length - 1].t;
  const start = Math.max(end - RATE_WINDOW_SECONDS, samples[0].t);
  const span = end - start;
  if (span <= 0) {
    return 0;
  }
  const delta = Math.max(
    0,
    samples[samples.length - 1].v - valueAt(start)
  );
  return (delta / span) * 60;
}

export function resetRateSamples(): void {
  samples = [];
}
