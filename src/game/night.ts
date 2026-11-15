import { ROLES, isCallScheduled, isWolfTeam } from './roles';
import type { Game, NightCall, Player } from './types';
import { emptyNight, log } from './shared';
import { shouldKeepDeadCalls } from './flow';

export type NightCallActorStatus = {
  hasActor: boolean;
  canAct: boolean;
  blockedByFear: boolean;
};

/** 当前是否被噩梦之影恐惧。 */
export function isFeared(g: Game, seat: number) {
  return g.night.targets['nightmare'] === seat;
}

function knifeCandidates(g: Game): Player[] {
  const team = g.players.filter(p => p.alive && isWolfTeam(p.role));
  if (team.length) return team;
  return g.players.filter(p => p.alive && ROLES[p.role].lateKnife && (p.role !== 'treasure-master' || g.special?.treasure?.camp === 'wolf'));
}

/** 当前可动刀的角色：普通狼队优先；全部出局后由九尾、机械狼或狼阵营盗宝继承刀权。 */
export function knifeActors(g: Game): Player[] {
  const candidates = knifeCandidates(g);
  const feared = g.night.targets['nightmare'];
  const blocked = feared !== null && feared !== undefined && candidates.some(player => player.seat === feared);
  return blocked ? [] : candidates;
}

/** Distinguish an unavailable dead role from a living role blocked by fear. */
export function callActorStatus(g: Game, call: NightCall): NightCallActorStatus {
  const actors = call === 'wolves'
    ? knifeCandidates(g)
    : g.players.filter(player => player.alive && player.role === call);
  const canAct = call === 'wolves'
    ? knifeActors(g).length > 0
    : actors.some(player => !isFeared(g, player.seat));
  return {
    hasActor: actors.length > 0,
    canAct,
    blockedByFear: actors.length > 0 && !canAct,
  };
}

export function addMark(g: Game, seat: number) {
  const marks = { ...(g.special?.marks ?? {}) };
  marks[seat] = (marks[seat] ?? 0) + 1;
  g.special = { ...(g.special ?? {}), marks };
}

export function moveVoteMark(g: Game, voter: number, previous: number | null | undefined, next: number | null) {
  if (!nineTailsVoter(g, voter) || previous === next) return;
  const marks = { ...(g.special?.marks ?? {}) };
  if (previous != null) {
    const left = (marks[previous] ?? 0) - 1;
    if (left > 0) marks[previous] = left; else delete marks[previous];
  }
  if (next !== null) marks[next] = (marks[next] ?? 0) + 1;
  g.special = { ...(g.special ?? {}), marks };
}

export const nineTailsVoter = (g: Game, seat: number) => g.players.find(p => p.seat === seat)?.role === 'nine-tails';

/** 夜间行动是否还有存活的执行者；狼刀看当前实际持刀者，被恐惧的角色本夜不能行动。 */
export function callActorAlive(g: Game, call: NightCall) {
  return callActorStatus(g, call).canAct;
}

/** 当前夜里是否仍要唤醒该行动（考虑首夜限定、第 N 夜起和保留空唤醒）。 */
export function callIsActive(g: Game, call: NightCall) {
  if (!isCallScheduled(call, g.day)) return false;
  return shouldKeepDeadCalls(g.rules) || callActorAlive(g, call);
}

/** 从当前行动推进到下一个仍需执行的夜间行动 */
export function nextNightCall(g: Game, from: NightCall | null) {
  const start = from === null ? 0 : g.nightCalls.indexOf(from) + 1;
  for (let i = Math.max(start, 0); i < g.nightCalls.length; i++) {
    const call = g.nightCalls[i];
    if (!callIsActive(g, call)) continue;
    g.stage = call;
    return;
  }
  g.stage = 'dawn';
}

export function beginNight(g: Game) {
  const endedNight = g.night;
  g.day++;
  g.night = emptyNight();
  g.nightAnnouncement = undefined;
  g.vote = null;
  const tracksLastTarget = ['dreamer', 'nightmare', 'light-earl'].some(role => g.players.some(p => p.role === role));
  if (g.special || tracksLastTarget) {
    g.special = {
      ...(g.special ?? {}),
      dance: undefined,
      ...(tracksLastTarget ? {
        dreamerLast: endedNight.targets['dreamer'] ?? null,
        nightmareLast: endedNight.targets['nightmare'] ?? null,
        lightEarlLast: endedNight.targets['light-earl'] ?? null,
      } : {}),
    };
    if (g.special.treasure && g.special.treasure.borrowed != null) {
      g.special.treasure = { ...g.special.treasure, lastBorrowed: g.special.treasure.borrowed, borrowed: null };
    }
  }
  nextNightCall(g, null);
  log(g, `进入第 ${g.day} 夜`, `进入第 ${g.day} 夜`);
}
