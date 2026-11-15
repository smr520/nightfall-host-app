import { BOARD_LIBRARY, boardSeats, type Board } from '../src/game/boards';
import { rulesForBoard } from '../src/game/board-rules';
import { DEFAULT_RULES } from '../src/game/config';
import { applyAction, callIdentitySeats, createGame, nightCallIdentityConfirmed, nightDeaths } from '../src/game/engine';
import { drawJingchengTreasure, type JingchengDraw } from '../src/game/jingcheng-draw';
import { isWolf, type Role } from '../src/game/roles';
import { decodeSession, isValidGame } from '../src/game/save-schema';
import { gameInvariantIssues } from '../src/game/save-invariants';
import { withSupportDefaults } from '../src/game/support-policy';
import type { Action, Game, NightCall, Rules } from '../src/game/types';

type Scenario = {
  board: Board;
  draw?: JingchengDraw;
  seed: number;
  variant: number;
};

const matrixCoverage = {
  specialNightCalls: new Set<NightCall>(),
  lastWords: 0,
  manualDawn: 0,
  progressiveIdentity: 0,
  quickExile: 0,
  explicitDeadlockEnds: 0,
};

class SeededRandom {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0 || 1;
  }

  next() {
    let value = this.state;
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    this.state = value >>> 0;
    return this.state / 0x100000000;
  }

  pick<T>(values: readonly T[]): T | undefined {
    if (!values.length) return undefined;
    return values[Math.floor(this.next() * values.length)];
  }
}

function scenarioFor(board: Board, index: number, variant: number): Scenario {
  const seed = 0x1000 + index * 1009 + variant * 97;
  const random = new SeededRandom(seed);
  return {
    board,
    seed,
    variant,
    draw: board.deck ? drawJingchengTreasure(() => random.next()) : undefined,
  };
}

function rulesFor(scenario: Scenario, roles: readonly Role[]): Rules {
  const base: Rules = {
    ...DEFAULT_RULES,
    sheriff: scenario.variant !== 2,
    sheriffTiming: scenario.seed % 3 === 0 ? 'after-announcement' : 'before-announcement',
    win: scenario.variant === 1 ? 'all' : 'edge',
    flow: scenario.variant === 2
      ? {
        manualDawn: true,
        lastWords: {
          firstNight: true,
          laterNight: true,
          exile: true,
          skill: true,
          explode: true,
        },
      }
      : scenario.variant === 3 ? { identityCheck: 'during-night' } : undefined,
    ...(scenario.variant === 3 ? { table: { exileRecord: 'quick' as const } } : {}),
  };
  return withSupportDefaults(rulesForBoard(base, scenario.board), roles);
}

function newGame(scenario: Scenario): Game {
  const roles = scenario.draw?.roles ?? boardSeats(scenario.board);
  return createGame(
    `全板矩阵 ${scenario.board.name}`,
    scenario.board.name,
    roles.map((role, index) => ({ name: `P${index + 1}`, role })),
    rulesFor(scenario, roles),
    scenario.draw
      ? {
        treasure: {
          reserve: scenario.draw.reserve,
          camp: scenario.draw.treasureCamp,
        },
      }
      : {},
  );
}

function act(game: Game, action: Action, label: string): Game {
  const before = JSON.stringify(game);
  const next = applyAction(game, action);
  if (JSON.stringify(game) !== before) throw new Error(`${label}: action mutated input`);
  if (!isValidGame(next)) throw new Error(`${label}: produced structurally invalid state after ${action.type}`);
  const issues = gameInvariantIssues(next);
  if (issues.length) {
    throw new Error(`${label}: produced semantic invariant errors after ${action.type}: ${issues.map(issue => issue.message).join('；')}`);
  }
  return next;
}

function alive(game: Game, role?: Role): number[] {
  return game.players
    .filter(player => player.alive && (!role || player.role === role))
    .map(player => player.seat);
}

function firstDifferent(values: readonly number[], excluded?: number | null): number | null {
  return values.find(value => value !== excluded) ?? values[0] ?? null;
}

function chooseNightAction(game: Game, random: SeededRandom, target: number | null): Action | null {
  const stage = game.stage;
  if (stage === 'wolves') {
    const noFirstKnife = game.day === 1 && game.rules.table?.firstNightKnife === false;
    const victims = game.players.filter(player => player.alive && !isWolf(player.role)).map(player => player.seat);
    return { type: 'wolves', target: noFirstKnife ? null : random.pick(victims) ?? null };
  }
  if (stage === 'guard') return { type: 'guard', target: null };
  if (stage === 'seer') return { type: 'seer', target: null };
  if (stage === 'witch') return { type: 'witch', save: false, poison: null };
  if (stage === 'dancer') {
    const available = game.players
      .filter(player => player.alive && !(game.special?.danceVisited ?? []).includes(player.seat))
      .map(player => player.seat);
    if (available.length < 3) {
      return { type: 'finish', winner: 'draw', reason: '全板矩阵：舞池可用座位不足，验证主持裁定结束' };
    }
    return { type: 'dance', seats: available.slice(0, 3) } as Action;
  }
  if (stage === 'treasure-master') {
    const treasure = game.special?.treasure;
    if (!treasure) throw new Error('牌池板缺少盗宝大师底牌状态');
    if (treasure.borrowed == null) {
      const card = treasure.reserve.find(item => item !== treasure.lastBorrowed) ?? treasure.reserve[0];
      return { type: 'borrow', card };
    }
    return { type: 'call', callId: stage, target };
  }
  if (game.nightCalls.includes(stage as NightCall)) {
    if (stage === 'light-earl') {
      const actor = game.players.find(player => player.role === stage);
      const candidates = game.players
        .filter(player => player.alive && player.seat !== actor?.seat && player.seat !== game.special?.lightEarlLast)
        .map(player => player.seat);
      return { type: 'call', callId: stage, target: random.pick(candidates) ?? null };
    }
    return { type: 'call', callId: stage, target };
  }
  return null;
}

function advanceNight(game: Game, stage: NightCall, random: SeededRandom, label: string): Game {
  let prepared = game;
  if (game.rules.flow?.identityCheck === 'during-night' && !nightCallIdentityConfirmed(game, stage)) {
    prepared = act(game, {
      type: 'assign-night-identity',
      callId: stage,
      seats: callIdentitySeats(game, stage),
    }, `${label}:identity`);
  }
  const fallbackTarget = random.pick(alive(prepared)) ?? null;
  const first = chooseNightAction(prepared, random, fallbackTarget);
  if (!first) throw new Error(`${label}: no action for night stage ${stage}`);
  try {
    const next = act(prepared, first, label);
    matrixCoverage.specialNightCalls.add(stage);
    return next;
  } catch {
    const secondTarget = firstDifferent(alive(prepared), fallbackTarget);
    const retry = chooseNightAction(prepared, random, secondTarget);
    if (!retry || JSON.stringify(retry) === JSON.stringify(first)) {
      return finishNightDeadlock(prepared, stage, label);
    }
    try {
      const next = act(prepared, retry, label);
      matrixCoverage.specialNightCalls.add(stage);
      return next;
    } catch {
      return finishNightDeadlock(prepared, stage, label);
    }
  }
}

function finishNightDeadlock(game: Game, stage: NightCall, label: string): Game {
  if (stage === 'dancer' || stage === 'light-earl') {
    matrixCoverage.explicitDeadlockEnds += 1;
    return act(game, {
      type: 'finish',
      winner: 'draw',
      reason: `全板矩阵：${stage} 已无合法目标，验证主持裁定结束`,
    }, label);
  }
  return act(game, { type: 'skip-night', reason: `全板矩阵：${stage} 按空过推进` }, label);
}

function simulate(scenario: Scenario): Game {
  let game = newGame(scenario);
  const random = new SeededRandom(scenario.seed);
  const label = `${scenario.board.id} seed=${scenario.seed}`;
  let operations = 0;

  while (game.stage !== 'ended') {
    operations += 1;
    if (operations > 600) {
      throw new Error(`${label}: stalled at ${game.stage}, day ${game.day}`);
    }

    if (game.nightCalls.includes(game.stage as NightCall)) {
      game = advanceNight(game, game.stage as NightCall, random, `${label} op=${operations}`);
      continue;
    }

    switch (game.stage) {
      case 'identity-check': {
        const next = game.players.find(player => !(game.identityConfirmed ?? []).includes(player.seat));
        if (!next) throw new Error(`${label}: identity confirmation has no remaining seat`);
        game = act(game, { type: 'confirm-identity', seat: next.seat }, `${label} op=${operations}`);
        break;
      }
      case 'dawn':
        if (game.rules.flow?.manualDawn) {
          matrixCoverage.manualDawn += 1;
          game = act(game, {
            type: 'set-dawn-deaths',
            deaths: nightDeaths(game),
            reason: '全板矩阵：按结算结果复核天亮名单',
          }, `${label} op=${operations}`);
        }
        game = act(game, { type: 'dawn' }, `${label} op=${operations}`);
        break;
      case 'dawn-announcement':
        game = act(game, { type: 'announce-dawn' }, `${label} op=${operations}`);
        break;
      case 'last-words':
        matrixCoverage.lastWords += 1;
        game = act(game, { type: 'last-words', speak: random.next() < 0.7 }, `${label} op=${operations}`);
        break;
      case 'sheriff-signup': {
        const candidates = random.pick([[], alive(game).slice(0, 2)]) ?? [];
        game = act(game, { type: 'signup', seats: candidates }, `${label} op=${operations}`);
        break;
      }
      case 'sheriff-vote':
      case 'exile-vote': {
        const vote = game.vote;
        if (!vote) throw new Error(`${label}: missing vote at ${game.stage}`);
        if (vote.kind === 'exile' && game.rules.table?.exileRecord === 'quick') {
          matrixCoverage.quickExile += 1;
          game = act(game, { type: 'exile-result', target: random.pick(vote.candidates) ?? null }, `${label} op=${operations}`);
          break;
        }
        if (!vote.voters.length) {
          game = act(game, { type: 'count' }, `${label} op=${operations}`);
          break;
        }
        if (scenario.variant === 1 && vote.round === 1 && vote.candidates.length >= 2) {
          const tied = vote.candidates.slice(0, 2);
          let voters = [...vote.voters];
          if (vote.kind === 'exile' && game.sheriff !== null && voters.includes(game.sheriff)) {
            game = act(game, { type: 'ballot', voter: game.sheriff, target: null }, `${label} op=${operations}`);
            voters = voters.filter(seat => seat !== game.sheriff);
          }
          if (voters.length % 2 === 1) {
            const abstainer = voters.pop()!;
            game = act(game, { type: 'ballot', voter: abstainer, target: null }, `${label} op=${operations}`);
          }
          if (voters.length >= 2) {
            voters.forEach((voter, index) => {
              const preferred = tied[index % tied.length];
              game = act(game, {
                type: 'ballot',
                voter,
                target: preferred === voter ? tied.find(seat => seat !== voter) ?? null : preferred,
              }, `${label} op=${operations}`);
            });
          } else {
            const target = random.pick(vote.candidates) ?? null;
            const batchVoters = target === null ? vote.voters : vote.voters.filter(voter => voter !== target);
            if (batchVoters.length) game = act(game, { type: 'ballots', voters: batchVoters, target }, `${label} op=${operations}`);
            for (const voter of vote.voters.filter(seat => !batchVoters.includes(seat))) {
              game = act(game, {
                type: 'ballot',
                voter,
                target: vote.candidates.find(seat => seat !== voter) ?? null,
              }, `${label} op=${operations}`);
            }
          }
        } else {
          const target = random.pick(vote.candidates) ?? null;
          const batchVoters = target === null ? vote.voters : vote.voters.filter(voter => voter !== target);
          if (batchVoters.length) game = act(game, { type: 'ballots', voters: batchVoters, target }, `${label} op=${operations}`);
          for (const voter of vote.voters.filter(seat => !batchVoters.includes(seat))) {
            game = act(game, {
              type: 'ballot',
              voter,
              target: vote.candidates.find(seat => seat !== voter) ?? null,
            }, `${label} op=${operations}`);
          }
        }
        game = act(game, { type: 'count' }, `${label} op=${operations}`);
        break;
      }
      case 'discussion': {
        if (game.day >= 6 || (game.rules.flow?.manualVictory && game.day >= 3)) {
          game = act(game, {
            type: 'finish',
            winner: 'draw',
            reason: '全板矩阵：达到受控局数上限，验证主持人结束流程',
          }, `${label} op=${operations}`);
        } else if (random.next() < 0.15) {
          game = act(game, { type: 'next-night' }, `${label} op=${operations}`);
        } else {
          game = act(game, { type: 'start-exile' }, `${label} op=${operations}`);
        }
        break;
      }
      case 'hunter':
        game = act(game, { type: 'hunter', target: null }, `${label} op=${operations}`);
        break;
      case 'shot':
        game = act(game, { type: 'shot', target: null }, `${label} op=${operations}`);
        break;
      case 'badge':
        game = act(game, { type: 'badge', target: null }, `${label} op=${operations}`);
        break;
      case 'link':
        game = act(game, { type: 'link', target: game.pending[0]?.target ?? null }, `${label} op=${operations}`);
        break;
      case 'heir':
        game = act(game, { type: 'heir', target: firstDifferent(alive(game)) }, `${label} op=${operations}`);
        break;
      default:
        throw new Error(`${label}: unsupported stage ${game.stage}`);
    }
  }

  expect(isValidGame(game)).toBe(true);
  expect(gameInvariantIssues(game)).toEqual([]);
  expect(decodeSession(JSON.stringify({ current: game, undo: [], redo: [] })).session.current).toEqual(game);
  if (game.rules.flow?.identityCheck === 'during-night' && (game.identityConfirmed?.length ?? 0) > 0) {
    matrixCoverage.progressiveIdentity += 1;
  }
  return game;
}

describe('complete interaction matrix for every published board', () => {
  const scenarios = BOARD_LIBRARY.flatMap((board, index) => (
    [0, 1, 2, 3].map(variant => scenarioFor(board, index, variant))
  ));

  it('covers the whole public board library', () => {
    expect(scenarios).toHaveLength(124);
    expect(new Set(scenarios.map(scenario => scenario.board.id)).size).toBe(31);
  });

  it.each(scenarios)('$board.name completes from setup through recap', scenario => {
    const ended = simulate(scenario);
    expect(ended.stage).toBe('ended');
    expect(ended.winner).toBeDefined();
    expect(ended.endedAt).toBeDefined();
    expect(ended.events.length).toBeGreaterThan(2);
  });

  it('actually exercises special night calls, last words and manual dawn review', () => {
    expect(matrixCoverage.specialNightCalls.size).toBeGreaterThanOrEqual(12);
    expect([...matrixCoverage.specialNightCalls]).toEqual(expect.arrayContaining([
      'nightmare',
      'dreamer',
      'gargoyle',
      'nine-tails',
      'dancer',
      'treasure-master',
      'mech-wolf',
      'medium',
      'poisoner',
      'fragrance-shadow',
    ]));
    expect(matrixCoverage.lastWords).toBeGreaterThan(20);
    expect(matrixCoverage.manualDawn).toBeGreaterThan(20);
    expect(matrixCoverage.progressiveIdentity).toBeGreaterThan(20);
    expect(matrixCoverage.quickExile).toBeGreaterThan(20);
    expect(matrixCoverage.explicitDeadlockEnds).toBeLessThan(10);
  });
});
