import type { Cause, Game, LastWordsPolicy, Rules } from './types';

export const LAST_WORDS_POLICY_KEYS = ['firstNight', 'laterNight', 'exile', 'skill', 'explode'] as const;

const NIGHT_CAUSES = new Set<Cause>([
  'knife',
  'poison',
  'dance',
  'check',
  'dream',
  'demon-hunt',
]);

export function validateLastWordsPolicy(value: unknown): value is LastWordsPolicy | undefined {
  if (value === undefined) return true;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const policy = value as Record<string, unknown>;
  return LAST_WORDS_POLICY_KEYS
    .every(key => policy[key] === undefined || typeof policy[key] === 'boolean');
}

export function hasLastWordsPolicy(rules: Rules): boolean {
  const policy = rules.flow?.lastWords;
  return !!policy && LAST_WORDS_POLICY_KEYS.some(key => policy[key] === true);
}

export function lastWordsPolicyLabels(rules: Rules): string[] {
  const policy = rules.flow?.lastWords;
  if (!policy) return [];
  return [
    policy.firstNight ? '首夜夜死' : '',
    policy.laterNight ? '后续夜死' : '',
    policy.exile ? '放逐' : '',
    policy.skill ? '技能带走' : '',
    policy.explode ? '自爆' : '',
  ].filter(Boolean);
}

export function shouldQueueLastWords(game: Game, cause: Cause): boolean {
  const policy = game.rules.flow?.lastWords;
  if (!policy) return false;
  if (cause === 'exile') return policy.exile === true;
  if (cause === 'explode') return policy.explode === true;
  if (NIGHT_CAUSES.has(cause)) return game.day === 1 ? policy.firstNight === true : policy.laterNight === true;
  return policy.skill === true;
}

export function queueLastWords(game: Game, seat: number, cause: Cause): void {
  if (!shouldQueueLastWords(game, cause)) return;
  if (game.pending.some(item => item.kind === 'last-words' && item.seat === seat)) return;
  game.pending.push({ kind: 'last-words', seat });
}
