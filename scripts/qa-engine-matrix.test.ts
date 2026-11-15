import { BOARD_LIBRARY, boardSeats, nightCallsFor } from '../src/game/boards';
import { DEFAULT_RULES } from '../src/game/config';
import { applyAction, createGame, nightDeaths, tally } from '../src/game/engine';
import { isValidGame, decodeSession } from '../src/game/save-schema';
import { isWolf } from '../src/game/roles';
import type { Action, Game, NightCall, Role, Rules } from '../src/game/types';

type MatrixScenario = {
  boardId: string;
  seed: number;
  profile: number;
  forcePk: boolean;
  variant: number;
};

const matrixMetrics = {
  games: 0,
  actions: 0,
  boards: {} as Record<string, number>,
  coverage: { manualDawn: 0, deadCall: 0, pk: 0, badge: 0, skipDay: 0 },
};

class Rng {
  private state: number;
  constructor(seed: number) { this.state = seed >>> 0 || 0x9e3779b9; }
  next() {
    let x = this.state;
    x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
    this.state = x >>> 0;
    return this.state / 0x100000000;
  }
  pick<T>(values: readonly T[]): T | undefined { return values.length ? values[Math.floor(this.next() * values.length)] : undefined; }
}

function failContext(label: string, operation: string) {
  return `engine QA ${label}: ${operation}`;
}

function assertState(game: Game, label: string) {
  const valid = isValidGame(game);
  if (!valid) {
    const invalid = game as unknown as { stage: string; day: number };
    throw new Error(failContext(label, `invalid state at ${invalid.stage}, day ${invalid.day}`));
  }
  const seatIds = game.players.map(player => player.seat);
  if (new Set(seatIds).size !== seatIds.length) throw new Error(failContext(label, 'duplicate seat id'));
  const eventIds = game.events.map(event => event.id);
  if (new Set(eventIds).size !== eventIds.length) throw new Error(failContext(label, 'duplicate event id'));
  const pendingKeys = game.pending.map(event => `${event.kind}:${event.seat}`);
  if (new Set(pendingKeys).size !== pendingKeys.length) throw new Error(failContext(label, `duplicate pending action (${pendingKeys.join(', ')})`));
  if (game.pending.length && game.pending[0].kind !== game.stage) throw new Error(failContext(label, `pending ${game.pending[0].kind} does not match stage ${game.stage}`));
  if (game.stage === 'ended' && !game.winner) throw new Error(failContext(label, 'ended game has no winner'));
}

function roundTrip(game: Game, label: string) {
  const decoded = decodeSession(JSON.stringify({ current: game, undo: [], redo: [] }));
  if (JSON.stringify(decoded.session.current) !== JSON.stringify(game)) throw new Error(failContext(label, 'session round trip changed current game'));
}

function step(game: Game, action: Action, label: string): Game {
  matrixMetrics.actions += 1;
  const snapshot = JSON.stringify(game);
  const actionSnapshot = JSON.stringify(action);
  const next = applyAction(game, action);
  if (JSON.stringify(game) !== snapshot) throw new Error(failContext(label, `action ${action.type} mutated its input`));
  if (JSON.stringify(action) !== actionSnapshot) throw new Error(failContext(label, `action ${action.type} mutated its payload`));
  assertState(next, `${label} after ${action.type}`);
  roundTrip(next, `${label} after ${action.type}`);
  return next;
}

function living(game: Game, predicate: (role: Role) => boolean = () => true) {
  return game.players.filter(player => player.alive && predicate(player.role)).map(player => player.seat);
}

function randomAlive(game: Game, rng: Rng, predicate: (role: Role) => boolean = () => true, exclude?: number): number | null {
  const seats = game.players.filter(player => player.alive && player.seat !== exclude && predicate(player.role)).map(player => player.seat);
  return rng.pick(seats) ?? null;
}

function nonSelfVote(candidates: number[], voter: number, preferred: number | null): number | null {
  if (preferred === null || preferred !== voter) return preferred;
  return candidates.find(candidate => candidate !== voter) ?? null;
}

function settingsFor(boardId: string, profile: number): Rules {
  const base: Rules = { ...DEFAULT_RULES, sheriff: profile !== 0 && profile !== 4, win: profile % 2 === 0 ? 'edge' : 'all' };
  if (profile === 0) return { ...base, sheriff: false, flow: { keepDeadCalls: true }, table: { sheriffTie: 'none', exileTie: 'none', guardRepeat: true } };
  if (profile === 1) return { ...base, sheriffTiming: 'before-announcement', table: { sheriffTie: 'pk', exileTie: 'pk' } };
  if (profile === 2) return { ...base, sheriffTiming: 'after-announcement', hunterPoison: true, doubleMedicine: true, flow: { manualDawn: true }, table: { sheriffTie: 'pk', exileTie: 'none' } };
  if (profile === 3) {
    const board = BOARD_LIBRARY.find(item => item.id === boardId)!;
    const nightOrder = nightCallsFor(board.counts);
    const seer = nightOrder.indexOf('seer');
    const wolves = nightOrder.indexOf('wolves');
    if (seer >= 0 && wolves >= 0 && seer > wolves) [nightOrder[seer], nightOrder[wolves]] = [nightOrder[wolves], nightOrder[seer]];
    return { ...base, sheriffTiming: 'before-announcement', flow: { manualDawn: true, keepDeadCalls: true, nightOrder: nightOrder as NightCall[] }, table: { sheriffTie: 'none', exileTie: 'pk', guardRepeat: false } };
  }
  if (profile === 4) return { ...base, sheriff: false, selfSave: 'never', table: { sheriffTie: 'none', exileTie: 'pk', guardRepeat: true } };
  return { ...base, sheriffTiming: 'after-announcement', guardSave: 'live', table: { sheriffTie: 'pk', exileTie: 'none' } };
}

function buildMatrix(): MatrixScenario[] {
  const boardIds = ['6-quick', '8-standard', '9-classic', '10-standard', 'standard-12', '12-guard', '15-standard', 'wolf-king-guard', 'white-wolf-king-guard', 'wolf-beauty-knight'];
  return boardIds.flatMap((boardId, boardIndex) => Array.from({ length: 6 }, (_, profile) => Array.from({ length: 3 }, (_, variant) => ({
    boardId,
    seed: 0x241114 + boardIndex * 10001 + profile * 101 + variant * 17,
    profile,
    variant,
    forcePk: profile % 2 === 1,
  })))).flat();
}

function simulate(scenario: MatrixScenario) {
  const label = `${scenario.boardId} seed=${scenario.seed} profile=${scenario.profile}`;
  const board = BOARD_LIBRARY.find(item => item.id === scenario.boardId);
  if (!board) throw new Error(failContext(label, 'board missing'));
  const rules = settingsFor(board.id, scenario.profile);
  let game = createGame(label, board.name, boardSeats(board).map((role, index) => ({ name: `P${index + 1}`, role })), rules);
  const rng = new Rng(scenario.seed);
  const covered = { manualDawn: false, deadCall: false, pk: false, badge: false, skipDay: false };
  assertState(game, `${label} create`);
  roundTrip(game, `${label} create`);
  let operations = 0;

  while (game.stage !== 'ended') {
    if (++operations > 350) throw new Error(failContext(label, `did not terminate after 350 operations; stopped at ${game.stage}, day ${game.day}`));
    const context = `${label} op=${operations} ${game.stage} day=${game.day}${game.vote ? ` round=${game.vote.round}` : ''}`;
    if (game.stage === 'wolves') {
      const seer = game.players.find(player => player.alive && player.role === 'seer');
      const villagers = living(game, role => !isWolf(role));
      const target = seer?.seat ?? rng.pick(villagers) ?? null;
      game = step(game, { type: 'wolves', target }, context);
      continue;
    }
    if (game.stage === 'guard') {
      if (!game.players.some(player => player.alive && player.role === 'guard')) {
        covered.deadCall = true;
        game = step(game, { type: 'skip-night', reason: 'QA guard unavailable' }, context);
        continue;
      }
      let target = randomAlive(game, rng, () => true, rules.table?.guardRepeat ? undefined : game.lastGuard ?? undefined);
      if (target === game.lastGuard) target = randomAlive(game, rng, role => role !== 'wolf', game.lastGuard ?? undefined);
      game = step(game, { type: 'guard', target }, context);
      continue;
    }
    if (game.stage === 'seer') {
      const seer = game.players.find(player => player.alive && player.role === 'seer');
      game = seer
        ? step(game, { type: 'seer', target: randomAlive(game, rng, () => true, seer.seat) }, context)
        : (covered.deadCall = true, step(game, { type: 'skip-night', reason: 'QA seer unavailable' }, context));
      continue;
    }
    if (game.stage === 'witch') {
      const witch = game.players.find(player => player.alive && player.role === 'witch');
      const save = !!witch && game.medicine.save && game.night.knife !== null && game.night.knife !== witch.seat && rng.next() < 0.12;
      const poison = !!witch && game.medicine.poison && (!save || rules.doubleMedicine) && rng.next() < 0.13 ? randomAlive(game, rng, () => true, witch.seat) : null;
      game = step(game, { type: 'witch', save, poison }, context);
      continue;
    }
    if (game.nightCalls.includes(game.stage as NightCall)) {
      const call = game.stage as NightCall;
      const actorAlive = call === 'wolves' ? game.players.some(player => player.alive && isWolf(player.role)) : game.players.some(player => player.alive && player.role === call);
      if (!actorAlive && rules.flow?.keepDeadCalls) covered.deadCall = true;
      if (call !== 'wolves' && game.day === 1 && game.players.some(player => player.role === call && player.death?.day === 1)) covered.deadCall = true;
      const target = actorAlive && !ROLES_FOR_MATRIX(call) ? randomAlive(game, rng) : null;
      game = step(game, actorAlive ? { type: 'call', callId: call, target } : { type: 'skip-night', reason: 'QA actor unavailable' }, context);
      continue;
    }
    if (game.stage === 'dawn') {
      if (rules.flow?.manualDawn) {
        covered.manualDawn = true;
        game = step(game, { type: 'set-dawn-deaths', deaths: nightDeaths(game), reason: 'QA verified dawn roster' }, context);
      }
      game = step(game, { type: 'dawn' }, context);
      continue;
    }
    if (game.stage === 'dawn-announcement') { game = step(game, { type: 'announce-dawn' }, context); continue; }
    if (game.stage === 'sheriff-signup') {
      const candidates = living(game).filter(seat => !game.players.find(player => player.seat === seat)?.exposed).slice(0, 2);
      game = step(game, { type: 'signup', seats: candidates }, context);
      continue;
    }
    if (game.stage === 'sheriff-vote' || game.stage === 'exile-vote') {
      const vote = game.vote!;
      const tiedCandidates = vote.candidates.slice(0, 2);
      if (scenario.forcePk && vote.round === 1 && tiedCandidates.length === 2 && vote.voters.length >= 2) {
        const voters = [...vote.voters];
        const sheriff = game.sheriff;
        if (vote.kind === 'exile' && sheriff !== null && voters.includes(sheriff) && rules.sheriffWeight === 1.5) {
          game = step(game, { type: 'ballot', voter: sheriff, target: null }, context);
          voters.splice(voters.indexOf(sheriff), 1);
        }
        if (voters.length % 2) {
          const abstainer = voters.pop()!;
          game = step(game, { type: 'ballot', voter: abstainer, target: null }, context);
        }
        for (let index = 0; index < voters.length; index++) {
          const voter = voters[index];
          game = step(game, { type: 'ballot', voter, target: nonSelfVote(tiedCandidates, voter, tiedCandidates[index % 2]) }, context);
        }
        const tallyAfter = tally(game);
        const hasTie = tallyAfter.length > 1 && tallyAfter[0].votes === tallyAfter[1].votes && tallyAfter[0].votes > 0;
        game = step(game, { type: 'count' }, context);
        if (hasTie && game.vote?.round === 2) covered.pk = true;
      } else {
        const wolves = vote.candidates.filter(seat => isWolf(game.players.find(player => player.seat === seat)!.role));
        const target = wolves[0] ?? vote.candidates[0] ?? null;
        for (const voter of vote.voters) game = step(game, { type: 'ballot', voter, target: nonSelfVote(vote.candidates, voter, target) }, context);
        game = step(game, { type: 'count' }, context);
        if (game.vote?.round === 2) covered.pk = true;
      }
      continue;
    }
    if (game.stage === 'discussion') {
      const skip = rng.next() < 0.12;
      if (skip) { covered.skipDay = true; game = step(game, { type: 'next-night' }, context); }
      else game = step(game, { type: 'start-exile' }, context);
      continue;
    }
    if (game.stage === 'hunter') { game = step(game, { type: 'hunter', target: null }, context); continue; }
    if (game.stage === 'shot') { game = step(game, { type: 'shot', target: null }, context); continue; }
    if (game.stage === 'link') { game = step(game, { type: 'link', target: game.pending[0]?.target ?? null }, context); continue; }
    if (game.stage === 'badge') {
      const target = randomAlive(game, rng, role => !isWolf(role));
      game = step(game, { type: 'badge', target }, context);
      covered.badge = true;
      continue;
    }
    throw new Error(failContext(label, `unhandled stage ${game.stage}`));
  }

  expect(game.winner).toBeDefined();
  matrixMetrics.games += 1;
  matrixMetrics.boards[scenario.boardId] = (matrixMetrics.boards[scenario.boardId] ?? 0) + 1;
  for (const key of Object.keys(covered) as (keyof typeof covered)[]) if (covered[key]) matrixMetrics.coverage[key] += 1;
  return { game, covered };
}

function ROLES_FOR_MATRIX(call: NightCall) {
  return call !== 'wolves' && ['seer', 'witch', 'guard'].includes(call);
}

describe('seeded whole-game QA matrix', () => {
  it.each(buildMatrix())('completes $boardId seed $seed profile $profile variant $variant with valid immutable saved states', scenario => {
    const { game } = simulate(scenario);
    expect(game.stage).toBe('ended');
    expect(game.events.length).toBeGreaterThan(1);
    expect(decodeSession(JSON.stringify({ current: game, undo: [], redo: [] })).session.current).toEqual(game);
  });

  it('covers the intended cross-board workflow and settings in the matrix', () => {
    expect(matrixMetrics.games).toBe(180);
    expect(matrixMetrics.actions).toBeGreaterThan(180);
    expect(Object.keys(matrixMetrics.boards)).toHaveLength(10);
    expect(Object.values(matrixMetrics.boards)).toEqual(Array(10).fill(18));
    console.log(`QA matrix: ${matrixMetrics.games} games, ${matrixMetrics.actions} actions`, { boards: matrixMetrics.boards, coverage: matrixMetrics.coverage });
    expect(matrixMetrics.coverage.manualDawn).toBeGreaterThan(0);
    expect(matrixMetrics.coverage.deadCall).toBeGreaterThan(0);
    expect(matrixMetrics.coverage.pk).toBeGreaterThan(0);
    expect(matrixMetrics.coverage.badge).toBeGreaterThan(0);
    expect(matrixMetrics.coverage.skipDay).toBeGreaterThan(0);
  });

  it('explicitly resumes a saved dead actor call when keepDeadCalls is enabled', () => {
    const roles: Role[] = ['wolf', 'wolf', 'villager', 'villager', 'seer', 'witch'];
    const game = createGame('dead actor QA', '六人', roles.map(role => ({ name: '', role })), { ...DEFAULT_RULES, sheriff: false, flow: { keepDeadCalls: true } });
    game.stage = 'seer';
    game.players[4] = { ...game.players[4], alive: false, death: { day: 1, cause: 'knife' } };
    const resumed = step(game, { type: 'skip-night', reason: 'QA dead actor wake-up' }, 'dead actor saved stage');
    expect(resumed.stage).toBe('witch');
  });
});
