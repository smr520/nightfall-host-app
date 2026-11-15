import type { HostTextSize } from '../game/preferences';

export type HostTextMetrics = {
  headlineSize: number;
  headlineLineHeight: number;
  scriptSize: number;
  scriptLineHeight: number;
  privateSize: number;
  privateLineHeight: number;
  operationSize: number;
};

const METRICS: Record<HostTextSize, HostTextMetrics> = {
  standard: {
    headlineSize: 32,
    headlineLineHeight: 42,
    scriptSize: 22,
    scriptLineHeight: 36,
    privateSize: 13,
    privateLineHeight: 22,
    operationSize: 12,
  },
  large: {
    headlineSize: 38,
    headlineLineHeight: 48,
    scriptSize: 27,
    scriptLineHeight: 41,
    privateSize: 16,
    privateLineHeight: 25,
    operationSize: 14,
  },
  xlarge: {
    headlineSize: 44,
    headlineLineHeight: 54,
    scriptSize: 32,
    scriptLineHeight: 48,
    privateSize: 18,
    privateLineHeight: 29,
    operationSize: 16,
  },
};

export function hostTextMetrics(size: HostTextSize | undefined): HostTextMetrics {
  return METRICS[size ?? 'standard'];
}
