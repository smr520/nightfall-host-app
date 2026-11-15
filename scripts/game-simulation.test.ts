import { BOARD_LIBRARY, boardSeats } from '../src/game/boards';
import { DEFAULT_RULES } from '../src/game/config';
import { applyAction, callActorAlive, createGame, nightDeaths } from '../src/game/engine';
import { isValidGame } from '../src/game/save-schema';
import { isWolf } from '../src/game/roles';
import type { Action, Game, HostingFlow, NightCall, Rules } from '../src/game/types';

type Scenario = {
  board: string;
  seed: number;
  sheriff: boolean;
  sheriffTiming?: 'before-announcement' | 'after-announcement';
  win: 'edge' | 'all';
  customOrder?: boolean;
  manualDawn?: boolean;
  guardSave?: 'die' | 'live';
};

/** Small deterministic PRNG: reproducible failures without running hundreds of games. */
class SeededRandom {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  next(): number {
    let x = this.state || 0x9e3779b9;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.state = x >>> 0;
    return this.state / 0x100000000;
  }

  pick<T>(values: readonly T[]): T | undefined {
    return values.length ? values[Math.floor(this.next() * values.length)] : undefined;
  }

  chance(numerator: number, denominator: number): boolean {
    return this.next() < numerator / denominator;
  }
}

function deepFreeze<T>(value: T): T {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  return value;
}

function customOrder(boardId: string): HostingFlow {
  // These preserve the engine's real dependency: wolves must precede witch.
  // Seer/guard can safely move around the wolf call because effects settle at dawn.
  const nightOrder: NightCall[] = boardId === '12-guard'
    ? ['seer', 'wolves', 'guard', 'witch']
    : ['seer', 'wolves', 'witch'];
  return { nightOrder };
}

function board(id: string) {
  const found = BOARD_LIBRARY.find(item => item.id === id);
  if (!found) throw new Error(`Unknown simulation board ${id}`);
  return found;
}

function aliveSeats(game: Game, predicate: (player: Game['players'][number]) => boolean = () => true): number[] {
  return game.players.filter(player => player.alive && predicate(player)).map(player => player.seat);
}

function pickTarget(game: Game, random: SeededRandom, predicate: (player: Game['players'][number]) => boolean, exclude?: number): number | null {
  const seats = aliveSeats(game, player => player.seat !== exclude && predicate(player));
  return random.pick(seats) ?? null;
}

function preferredWolfTarget(game: Game, random: SeededRandom, candidates: readonly number[]): number | null {
  const wolf = candidates.filter(seat => game.players.find(player => player.seat === seat)?.role && isWolf(game.players.find(player => player.seat === seat)!.role));
  return random.pick(wolf) ?? random.pick(candidates) ?? null;
}

function checkInvariants(game: Game, context: string): void {
  const valid = isValidGame(game);
  expect(valid).toBe(true);
  expect(new Set(game.players.map(player => player.seat)).size).toBe(game.players.length);
  const pendingKeys = game.pending.map(item => `${item.kind}:${item.seat}`);
  expect(new Set(pendingKeys).size).toBe(pendingKeys.length);
  const eventIds = game.events.map(event => event.id);
  expect(new Set(eventIds).size).toBe(eventIds.length);
  if (game.stage === 'ended') expect(game.winner).toBeDefined();
  if (game.pending.length) expect(game.pending[0].kind).toBe(game.stage);
  if (!valid) {
    const snapshot = game as Game;
    throw new Error(`Invalid state at ${context}: ${snapshot.stage} day ${snapshot.day}`);
  }
}

function runAction(game: Game, action: Action, context: string): Game {
  const before = JSON.stringify(game);
  const actionBefore = JSON.stringify(action);
  deepFreeze(game);
  deepFreeze(action);
  const next = applyAction(game, action);
  expect(JSON.stringify(game)).toBe(before);
  expect(JSON.stringify(action)).toBe(actionBefore);
  checkInvariants(next, context);
  return next;
}

function simulate(scenario: Scenario): Game {
  const selectedBoard = board(scenario.board);
  const flow = scenario.customOrder ? customOrder(scenario.board) : undefined;
  const rules: Rules = {
    ...DEFAULT_RULES,
    sheriff: scenario.sheriff,
    sheriffTiming: scenario.sheriffTiming ?? 'before-announcement',
    win: scenario.win,
    guardSave: scenario.guardSave ?? 'die',
    flow: scenario.manualDawn || flow ? { ...(flow ?? {}), manualDawn: scenario.manualDawn ?? false } : undefined,
  };
  let game = createGame(`simulation-${scenario.board}-${scenario.seed}`, selectedBoard.name, boardSeats(selectedBoard).map((role, index) => ({ name: `P${index + 1}`, role })), rules);
  const random = new SeededRandom(scenario.seed);
  checkInvariants(game, `${scenario.board}:create`);
  let steps = 0;

  while (game.stage !== 'ended') {
    if (++steps > 400) throw new Error(`simulation exceeded 400 actions for ${scenario.board} seed ${scenario.seed} at ${game.stage} day ${game.day}`);
    const context = `${scenario.board} seed ${scenario.seed} step ${steps} ${game.stage} day ${game.day}`;
    if (game.nightCalls.includes(game.stage as NightCall) && !callActorAlive(game, game.stage as NightCall)) {
      game = runAction(game, { type: 'skip-night', reason: '行动角色已出局' }, context);
      continue;
    }
    switch (game.stage) {
      case 'wolves': {
        const target = pickTarget(game, random, player => !isWolf(player.role));
        game = runAction(game, { type: 'wolves', target }, context);
        break;
      }
      case 'seer': {
        const seer = game.players.find(player => player.role === 'seer' && player.alive);
        game = runAction(game, { type: 'seer', target: pickTarget(game, random, () => true, seer?.seat) }, context);
        break;
      }
      case 'witch': {
        const witch = game.players.find(player => player.role === 'witch' && player.alive);
        const save = game.medicine.save && game.night.knife !== null && random.chance(1, 4) && game.night.knife !== witch?.seat;
        const poison = game.medicine.poison && (!save || rules.doubleMedicine) && random.chance(1, 3)
          ? pickTarget(game, random, player => !isWolf(player.role), witch?.seat)
          : null;
        game = runAction(game, { type: 'witch', save, poison }, context);
        break;
      }
      case 'guard': {
        const last = game.lastGuard;
        let target = pickTarget(game, random, () => true, undefined);
        if (target === last) target = pickTarget(game, random, player => player.seat !== last);
        game = runAction(game, { type: 'guard', target }, context);
        break;
      }
      case 'dawn': {
        if (rules.flow?.manualDawn) {
          game = runAction(game, { type: 'set-dawn-deaths', deaths: nightDeaths(game), reason: '模拟核对昨夜结果' }, context);
        }
        game = runAction(game, { type: 'dawn' }, context);
        break;
      }
      case 'dawn-announcement':
        game = runAction(game, { type: 'announce-dawn' }, context);
        break;
      case 'sheriff-signup': {
        const candidates = aliveSeats(game, player => !player.exposed).slice(0, 2);
        game = runAction(game, { type: 'signup', seats: candidates }, context);
        break;
      }
      case 'sheriff-vote': {
        const candidate = game.vote?.candidates[0] ?? null;
        for (const voter of game.vote?.voters ?? []) game = runAction(game, { type: 'ballot', voter, target: candidate }, context);
        game = runAction(game, { type: 'count' }, context);
        break;
      }
      case 'discussion': {
        // Skip some days to cover the explicit next-night transition; otherwise
        // put every available wolf up for exile so the bounded simulation ends.
        if (random.chance(1, 5)) game = runAction(game, { type: 'next-night' }, context);
        else game = runAction(game, { type: 'start-exile' }, context);
        break;
      }
      case 'exile-vote': {
        const candidates = game.vote?.candidates ?? [];
        const target = preferredWolfTarget(game, random, candidates);
        for (const voter of game.vote?.voters ?? []) game = runAction(game, { type: 'ballot', voter, target }, context);
        game = runAction(game, { type: 'count' }, context);
        break;
      }
      case 'hunter':
        game = runAction(game, { type: 'hunter', target: null }, context);
        break;
      case 'shot':
        game = runAction(game, { type: 'shot', target: null }, context);
        break;
      case 'link':
        game = runAction(game, { type: 'link', target: game.pending[0]?.target ?? null }, context);
        break;
      case 'badge': {
        const target = pickTarget(game, random, player => !player.exposed, game.pending[0]?.seat);
        game = runAction(game, { type: 'badge', target }, context);
        break;
      }
      default:
        throw new Error(`simulation stalled at unsupported stage ${game.stage} (${scenario.board} seed ${scenario.seed})`);
    }
  }
  expect(steps).toBeLessThanOrEqual(400);
  expect(game.stage).toBe('ended');
  expect(game.winner).toMatch(/^(good|wolf|draw)$/);
  return game;
}

const scenarios: Scenario[] = [
  { board: '6-quick', seed: 11, sheriff: false, win: 'edge' },
  { board: '6-quick', seed: 17, sheriff: true, sheriffTiming: 'after-announcement', win: 'all', customOrder: true },
  { board: '8-standard', seed: 23, sheriff: true, sheriffTiming: 'before-announcement', win: 'edge', customOrder: true },
  { board: '8-standard', seed: 29, sheriff: true, sheriffTiming: 'after-announcement', win: 'all', manualDawn: true },
  { board: '10-standard', seed: 31, sheriff: false, win: 'all', customOrder: true },
  { board: 'standard-12', seed: 37, sheriff: true, sheriffTiming: 'before-announcement', win: 'edge' },
  { board: 'standard-12', seed: 41, sheriff: true, sheriffTiming: 'after-announcement', win: 'all', customOrder: true },
  { board: '12-guard', seed: 43, sheriff: false, win: 'edge', guardSave: 'live', customOrder: true },
  { board: '12-guard', seed: 47, sheriff: true, sheriffTiming: 'before-announcement', win: 'all', guardSave: 'die', manualDawn: true },
  { board: '15-standard', seed: 53, sheriff: true, sheriffTiming: 'after-announcement', win: 'edge' },
];

describe('deterministic complete-game simulations', () => {
  it.each(scenarios)('completes $board seed $seed without invalid state or mutation', scenario => {
    const ended = simulate(scenario);
    expect(ended.stage).toBe('ended');
    expect(ended.events.length).toBeGreaterThan(0);
  });
});
