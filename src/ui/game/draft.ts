import { createDawnReviewDraft, type DawnReviewDraft } from './DawnReview';
import type { VoteEntryDraft } from './VotePanel';
import type { Game } from '../../game/types';

export type Draft = VoteEntryDraft & {
  scope: string;
  selected: number | null;
  dance: number[];
  save: boolean;
  poison: number | null;
  signup: number[];
  voter: number | null;
  ruleSeat: number | null;
  ruleReason: string;
  dawn: DawnReviewDraft;
  voteRound: number;
  voteKind: 'sheriff' | 'exile' | null;
};

export const emptyDraft = (scope: string, game: Game): Draft => ({
  scope,
  selected: null,
  dance: [],
  save: false,
  poison: null,
  signup: game.signup,
  voter: null,
  ruleSeat: null,
  ruleReason: '',
  dawn: createDawnReviewDraft(game),
  voteMode: 'individual',
  batchVoters: [],
  pkSpeaking: false,
  voteRound: game.vote?.round ?? 0,
  voteKind: game.vote?.kind ?? null,
});
