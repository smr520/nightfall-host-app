import type { Board } from './boards';
import type { Rules } from './types';

const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

function copy(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(copy);
  if (record(value)) return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, copy(item)]));
  return value;
}

/** Rule groups merge independently; an explicit night order replaces the old array. */
function merge(base: unknown, patch: unknown): unknown {
  if (!record(patch)) return copy(patch);
  const result: Record<string, unknown> = record(base) ? copy(base) as Record<string, unknown> : {};
  for (const [key, value] of Object.entries(patch)) result[key] = record(value) ? merge(result[key], value) : copy(value);
  return result;
}

export function mergeRules(base: Rules, ...patches: Partial<Rules>[]): Rules {
  return patches.reduce<Rules>((result, patch) => merge(result, patch) as Rules, copy(base) as Rules);
}

/** Keep the starting table preferences separate from a selected board's defaults. */
export function rulesForBoard(base: Rules, board: Pick<Board, 'rules'>, hostOverrides: Partial<Rules> = {}): Rules {
  return mergeRules(base, board.rules ?? {}, hostOverrides);
}

function changes(previous: unknown, next: unknown): Record<string, unknown> {
  const before = record(previous) ? previous : {};
  const after = record(next) ? next : {};
  const result: Record<string, unknown> = {};
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const left = before[key]; const right = after[key];
    if (record(left) && record(right)) {
      const nested = changes(left, right);
      if (Object.keys(nested).length) result[key] = nested;
    } else if (JSON.stringify(left) !== JSON.stringify(right)) result[key] = copy(right);
  }
  return result;
}

/** Only actual edits become persistent overrides, not inferred support defaults. */
export function ruleChanges(previous: Rules, next: Rules): Partial<Rules> {
  return changes(previous, next) as Partial<Rules>;
}

export function mergeRuleOverrides(previous: Partial<Rules>, next: Partial<Rules>): Partial<Rules> {
  return merge(previous, next) as Partial<Rules>;
}
