import { emptyCounts, nightCallsFor } from './boards';
import { DAWN_CAUSES, resolveNightOrder, validateFlow } from './flow';
import { STAGES } from './config';
import { getNightAnnouncement, nightDeaths } from './engine';
import { isRole } from './roles';
import { isValidSpeechSeconds, validateSpeechDurations } from './speech';
import { validateTableRules } from './table-rules';
import { hasValidGameInvariants } from './save-invariants';
import type { Game, NightCall, Role, Session } from './types';

type RecordValue = Record<string, unknown>;
const object = (v: unknown): v is RecordValue => v !== null && typeof v === 'object' && !Array.isArray(v);
const integer = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const bool = (v: unknown) => typeof v === 'boolean';
const optionalText = (v: unknown) => v === undefined || typeof v === 'string';
const oneOf = (v: unknown, options: string[]) => typeof v === 'string' && options.includes(v);
const causes = ['knife', 'poison', 'exile', 'shot', 'explode', 'ruling', 'link', 'dance', 'hunt', 'check', 'dream', 'demon-hunt'];
const fixedStages = Object.keys(STAGES);
const pendingKinds = ['last-words', 'hunter', 'shot', 'link', 'badge', 'heir'];
const isNightCall = (v: unknown): v is NightCall => v === 'wolves' || isRole(v);

function isValidGameShape(v: unknown, schema: 1 | 2): v is RecordValue & Game {
  if (!object(v) || v.schema !== schema || typeof v.id !== 'string' || !v.id || typeof v.name !== 'string' || typeof v.board !== 'string' || !finite(v.startedAt) || !integer(v.day) || v.day < 1 || typeof v.stage !== 'string') return false;
  if (!Array.isArray(v.players) || v.players.length < 6 || v.players.length > 16) return false;
  const seats = new Set<number>();
  for (const p of v.players) {
    if (!object(p) || !integer(p.seat) || p.seat < 1 || p.seat > v.players.length || seats.has(p.seat) || typeof p.name !== 'string' || !isRole(p.role) || !bool(p.alive) || !bool(p.exposed)) return false;
    seats.add(p.seat);
    if (p.death !== undefined && (!object(p.death) || !integer(p.death.day) || p.death.day < 1 || p.death.day > v.day || typeof p.death.cause !== 'string' || !causes.includes(p.death.cause))) return false;
  }
  const seat = (n: unknown) => integer(n) && seats.has(n);
  const nullableSeat = (n: unknown) => n === null || seat(n);
  const seatList = (list: unknown): list is number[] => Array.isArray(list) && !list.some(item => !seat(item)) && new Set(list).size === list.length;
  if (!object(v.rules) || !bool(v.rules.sheriff) || (v.rules.sheriffTiming !== undefined && !oneOf(v.rules.sheriffTiming, ['before-announcement', 'after-announcement'])) || !oneOf(v.rules.win, ['edge', 'all']) || !oneOf(v.rules.selfSave, ['never', 'first', 'always']) || !oneOf(v.rules.guardSave, ['die', 'live']) || !bool(v.rules.doubleMedicine) || !bool(v.rules.hunterPoison) || ![1, 1.5].includes(v.rules.sheriffWeight as number) || !isValidSpeechSeconds(v.rules.speechSeconds) || !validateSpeechDurations(v.rules.speechDurations) || !validateTableRules(v.rules.table) || (v.rules.flow !== undefined && !validateFlow(v.rules.flow))) return false;
  if (!object(v.night) || !['guard', 'knife', 'inspect', 'poison'].every(key => nullableSeat((v.night as RecordValue)[key])) || !bool(v.night.save)) return false;
  if ((v.night as RecordValue).checkDeaths !== undefined && !seatList((v.night as RecordValue).checkDeaths)) return false;
  if (schema === 2) {
    const targets = (v.night as RecordValue).targets;
    if (!object(targets) || !Object.values(targets).every(nullableSeat)) return false;
    const manualDeaths = (v.night as RecordValue).manualDeaths;
    if (manualDeaths !== undefined && (!Array.isArray(manualDeaths) || manualDeaths.some(item => !object(item) || !seat(item.seat) || !(DAWN_CAUSES as readonly string[]).includes(item.cause as string)) || new Set(manualDeaths.map(item => (item as RecordValue).seat)).size !== manualDeaths.length || typeof (v.night as RecordValue).manualReason !== 'string' || ((v.night as RecordValue).manualReason as string).trim().length < 2 || v.rules.flow === undefined || !v.rules.flow.manualDawn)) return false;
  }
  if (!nullableSeat(v.lastGuard) || !nullableSeat(v.sheriff) || !object(v.medicine) || !bool(v.medicine.save) || !bool(v.medicine.poison) || !bool(v.sheriffDone) || !bool(v.announcementReady) || !seatList(v.signup) || !oneOf(v.resume, ['discussion', 'night'])) return false;
  if (v.identityConfirmed !== undefined && !seatList(v.identityConfirmed)) return false;
  const identityMode = v.rules.flow?.identityCheck;
  if (v.identityConfirmed !== undefined && identityMode !== 'at-nightfall') return false;
  if (v.stage === 'identity-check' && (identityMode !== 'at-nightfall' || !Array.isArray(v.identityConfirmed))) return false;
  if (v.stage === 'identity-check' && (v.identityConfirmed as number[]).length >= v.players.length) return false;
  if (v.stage !== 'identity-check' && identityMode === 'at-nightfall' && (!Array.isArray(v.identityConfirmed) || v.identityConfirmed.length !== v.players.length)) return false;
  if (!optionalText(v.nightAnnouncement) || !optionalText(v.endReason) || (v.endedAt !== undefined && !finite(v.endedAt)) || (v.winner !== undefined && !oneOf(v.winner, ['good', 'wolf', 'third', 'draw']))) return false;
  if (v.stage === 'ended' && (!v.winner || !finite(v.endedAt))) return false;
  if (schema === 2) {
    if (!Array.isArray(v.nightCalls) || !v.nightCalls.length || !v.nightCalls.every(isNightCall) || new Set(v.nightCalls).size !== v.nightCalls.length) return false;
    const counts = emptyCounts();
    v.players.forEach(p => { counts[p.role as Role] += 1; });
    try { if (JSON.stringify(resolveNightOrder(counts, v.rules.flow)) !== JSON.stringify(v.nightCalls)) return false; } catch { return false; }
    if (!fixedStages.includes(v.stage) && !v.nightCalls.includes(v.stage as NightCall)) return false;
  } else if (!fixedStages.includes(v.stage) && !isNightCall(v.stage)) return false;
  if (!Array.isArray(v.pending) || !v.pending.every(item => object(item) && oneOf(item.kind, pendingKinds) && seat(item.seat) && (item.role === undefined || isRole(item.role)) && (item.target === undefined || seat(item.target)))) return false;
  if (new Set(v.pending.map(item => `${item.kind}:${item.seat}`)).size !== v.pending.length) return false;
  if (pendingKinds.includes(v.stage) && (!v.pending[0] || v.pending[0].kind !== v.stage)) return false;
  if (v.vote !== null) {
    if (!object(v.vote) || !oneOf(v.vote.kind, ['sheriff', 'exile']) || !integer(v.vote.round) || v.vote.round < 1 || v.vote.round > 2 || !seatList(v.vote.candidates) || !seatList(v.vote.voters) || !object(v.vote.ballots)) return false;
    const vote = v.vote;
    if (!optionalText(vote.result)) return false;
    if (!Object.entries(vote.ballots as RecordValue).every(([voter, target]) => String(Number(voter)) === voter && (vote.voters as number[]).includes(Number(voter)) && (target === null || (vote.candidates as number[]).includes(target as number)))) return false;
    if (vote.kind === 'exile' && v.rules.table?.exileRecord === 'quick'
      && (vote.round !== 1 || (vote.voters as number[]).length !== 0 || Object.keys(vote.ballots as RecordValue).length !== 0)) return false;
  }
  if ((v.stage === 'sheriff-vote' || v.stage === 'exile-vote') && (!object(v.vote) || v.vote.kind !== (v.stage === 'sheriff-vote' ? 'sheriff' : 'exile'))) return false;
  if (v.special !== undefined) {
    if (!object(v.special)) return false;
    const special = v.special;
    if (special.marks !== undefined && (!object(special.marks) || !Object.entries(special.marks).every(([key, value]) => String(Number(key)) === key && seat(Number(key)) && integer(value) && (value as number) > 0))) return false;
    if (special.poisonerUsed !== undefined && !bool(special.poisonerUsed)) return false;
    if (special.dance !== undefined && (!object(special.dance) || !seatList(special.dance.pool) || special.dance.pool.length !== 3)) return false;
    if (special.danceVisited !== undefined && !seatList(special.danceVisited)) return false;
    if (special.mechLearned !== undefined && !isRole(special.mechLearned)) return false;
    if (special.gargoyleChecked !== undefined && !seatList(special.gargoyleChecked)) return false;
    if (special.dreamerLast !== undefined && !nullableSeat(special.dreamerLast)) return false;
    if (special.nightmareLast !== undefined && !nullableSeat(special.nightmareLast)) return false;
    if (special.lightEarlLast !== undefined && !nullableSeat(special.lightEarlLast)) return false;
    if (special.treasure !== undefined) {
      const treasure = special.treasure;
      if (!object(treasure) || !Array.isArray(treasure.reserve) || treasure.reserve.length !== 3 || !treasure.reserve.every(isRole) || !oneOf(treasure.camp, ['wolf', 'good'])) return false;
      if (treasure.borrowed !== undefined && treasure.borrowed !== null && !isRole(treasure.borrowed)) return false;
      if (treasure.lastBorrowed !== undefined && treasure.lastBorrowed !== null && !isRole(treasure.lastBorrowed)) return false;
    }
    if (special.heir !== undefined && (!object(special.heir) || !seat(special.heir.seat) || !oneOf(special.heir.kind, ['villager', 'god', 'wolf']))) return false;
    if (special.delayedDeaths !== undefined && (!Array.isArray(special.delayedDeaths) || special.delayedDeaths.some(item => !object(item) || !seat(item.seat) || typeof item.cause !== 'string' || !causes.includes(item.cause)))) return false;
  }
  return Array.isArray(v.events) && v.events.every((e, index) => object(e) && e.id === index + 1 && finite(e.at) && integer(e.day) && typeof e.stage === 'string' && typeof e.text === 'string' && optionalText(e.publicText));
}

export function isValidGame(v: unknown): v is Game {
  return isValidGameShape(v, 2) && hasValidGameInvariants(v);
}

/** v1 → v2：补夜间行动序列与行动记录；未知结构仍然拒绝 */
export function migrateGame(value: unknown): Game {
  if (isValidGameShape(value, 2)) {
    const repaired = repair(JSON.parse(JSON.stringify(value)) as Game);
    if (!isValidGame(repaired)) throw new Error('存档迁移后仍存在不一致状态，需要人工恢复');
    return repaired;
  }
  if (!isValidGameShape(value, 1)) throw new Error('存档结构不兼容或损坏');
  const legacy = JSON.parse(JSON.stringify(value)) as Game;
  const counts = emptyCounts();
  legacy.players.forEach(p => { counts[p.role] += 1; });
  const game: Game = {
    ...legacy,
    schema: 2,
    night: { ...legacy.night, targets: {} },
    nightCalls: nightCallsFor(counts),
  };
  if (!game.nightCalls.length) throw new Error('存档角色构成无法重建夜间流程');
  if (!fixedStages.includes(game.stage) && !game.nightCalls.includes(game.stage as NightCall)) game.stage = game.nightCalls[0];
  const repaired = repair(game);
  if (!isValidGame(repaired)) throw new Error('旧版存档迁移后仍存在不一致状态，需要人工恢复');
  return repaired;
}

function repair(game: Game): Game {
  if (game.announcementReady && ['sheriff-signup', 'sheriff-vote', 'dawn-announcement'].includes(game.stage)) {
    const earlyDeaths = game.players.filter(p => !p.alive && p.death?.day === game.day && (p.death.cause === 'knife' || p.death.cause === 'poison'));
    const calculated = nightDeaths(game);
    if (earlyDeaths.some(p => !calculated.some(d => d.seat === p.seat && d.cause === p.death?.cause))) throw new Error('旧版死亡记录与夜间行动不一致，需要人工恢复');
    const deadSheriff = game.pending.find(item => item.kind === 'badge' && earlyDeaths.some(p => p.seat === item.seat));
    if (deadSheriff) {
      if (game.sheriff !== null && game.sheriff !== deadSheriff.seat) throw new Error('旧版警徽状态存在冲突，需要人工恢复');
      game.sheriff = deadSheriff.seat;
    }
    for (const player of earlyDeaths) { player.alive = true; delete player.death; }
    game.pending = game.pending.filter(item => !earlyDeaths.some(p => p.seat === item.seat));
    game.nightAnnouncement = getNightAnnouncement(game);
  }
  return game;
}

export function decodeSession(raw: string): { session: Session; repaired: boolean } {
  const parsed: unknown = JSON.parse(raw);
  if (!object(parsed) || !Array.isArray(parsed.undo) || !Array.isArray(parsed.redo)) throw new Error('会话结构损坏');
  const current = migrateGame(parsed.current);
  const recoverStack = (stack: unknown[]) => stack.flatMap(item => {
    try { const game = migrateGame(item); return game.id === current.id ? [game] : []; }
    catch { return []; }
  });
  const session = { current, undo: recoverStack(parsed.undo), redo: recoverStack(parsed.redo) };
  return { session, repaired: JSON.stringify(session) !== raw };
}
