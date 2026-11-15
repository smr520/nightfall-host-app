import { createActionHandlers } from './action-handlers';
import { actor, alive, canVote, clone, demand, log, player, requireStage, target } from './shared';
import { addMark, callActorAlive, knifeActors, moveVoteMark, nextNightCall, nineTailsVoter } from './night';
import { advance, end, getNightAnnouncement, kill, nightDeaths, privateDeathDetails, resolveDelayedDeaths } from './dawn';
import { afterSheriff, exile, makeVote, tally } from './day';
import type { Action, Game } from './types';

export { actor, alive, canVote, goodAlive, seatName, wolvesAlive } from './shared';
export { callActorAlive, callActorStatus, callIdentitySeats, callIsActive, isFeared, knifeActors, nightCallIdentityConfirmed, nightIdentitySeats } from './night';
export type { NightCallActorStatus } from './night';
export { getNightAnnouncement, nightDeaths, victory } from './dawn';
export { tally } from './day';
export { createGame, validateCounts } from './game-setup';

const actionHandlers = createActionHandlers({
  demand, player, target, requireStage, log, nextNightCall, actor, knifeActors,
  alive, canVote, makeVote, tally, exile, afterSheriff, resolveDelayedDeaths,
  advance, nightDeaths, privateDeathDetails, getNightAnnouncement, kill, end,
  addMark, moveVoteMark, nineTailsVoter, callActorAlive,
});

export function applyAction(original: Game, action: Action): Game {
  const g = clone(original);
  demand(g.stage !== 'ended', '对局已结束，可先撤销结束操作');
  actionHandlers.dispatch(g, action);
  return g;
}
