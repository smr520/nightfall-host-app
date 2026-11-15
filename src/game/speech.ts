import type { Game, Rules, SpeechDurations } from './types';

export const SPEECH_KINDS = ['discussion', 'sheriff', 'pk', 'lastWords'] as const;
export type SpeechKind = typeof SPEECH_KINDS[number];

export const SPEECH_LABELS: Record<SpeechKind, string> = {
  discussion: '白天发言',
  sheriff: '警上发言',
  pk: 'PK 发言',
  lastWords: '遗言',
};

export const MIN_SPEECH_SECONDS = 15;
export const MAX_SPEECH_SECONDS = 1800;

export function isValidSpeechSeconds(value: unknown): value is number {
  return typeof value === 'number'
    && Number.isInteger(value)
    && value >= MIN_SPEECH_SECONDS
    && value <= MAX_SPEECH_SECONDS;
}

export function validateSpeechDurations(value: unknown): value is SpeechDurations | undefined {
  if (value === undefined) return true;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const durations = value as Record<string, unknown>;
  return SPEECH_KINDS.every(kind => durations[kind] === undefined || isValidSpeechSeconds(durations[kind]));
}

export function speechSecondsForRules(rules: Rules, kind: SpeechKind): number {
  const configured = rules.speechDurations?.[kind];
  return isValidSpeechSeconds(configured) ? configured : rules.speechSeconds;
}

export function speechKindForGame(game: Game): SpeechKind {
  if (game.stage === 'last-words') return 'lastWords';
  if (game.stage === 'sheriff-signup') return 'sheriff';
  if (game.stage === 'sheriff-vote') return game.vote?.round === 2 ? 'pk' : 'sheriff';
  if (game.stage === 'exile-vote' && game.vote?.round === 2) return 'pk';
  return 'discussion';
}

export function speechSecondsForGame(game: Game): number {
  return speechSecondsForRules(game.rules, speechKindForGame(game));
}

export function speechDurationsSummary(rules: Rules): string {
  return SPEECH_KINDS
    .map(kind => `${SPEECH_LABELS[kind]} ${speechSecondsForRules(rules, kind)} 秒`)
    .join(' · ');
}
