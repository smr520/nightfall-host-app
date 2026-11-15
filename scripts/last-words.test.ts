import { DEFAULT_RULES, openingRulesScript } from '../src/game/config';
import { applyAction, createGame } from '../src/game/engine';
import { decodeSession, isValidGame } from '../src/game/save-schema';
import { speechKindForGame, speechSecondsForRules } from '../src/game/speech';
import { validateFlow } from '../src/game/flow';
import { hostingProgress } from '../src/game/hosting-reference';
import type { Cause, Game, HostingFlow, Role, Rules } from '../src/game/types';

const roles: Role[] = ['wolf', 'wolf', 'villager', 'villager', 'seer', 'witch', 'guard', 'hunter'];

function fixture(flow: HostingFlow = {}, overrides: Partial<Rules> = {}): Game {
  return createGame(
    '遗言流程回归',
    '八人遗言测试',
    roles.map((role, index) => ({ name: `${index + 1}号`, role })),
    { ...DEFAULT_RULES, sheriff: false, win: 'all', flow, ...overrides },
  );
}

function dawn(flow: HostingFlow, deaths: { seat: number; cause: Cause }[], day = 1): Game {
  const game = fixture(flow);
  game.day = day;
  game.stage = 'dawn';
  game.night.manualDeaths = deaths;
  game.night.manualReason = '遗言测试名单';
  game.rules.flow = { ...game.rules.flow, manualDawn: true };
  return applyAction(game, { type: 'dawn' });
}

describe('independent last-words queue', () => {
  it('keeps the old direct-to-death-skill behavior when every policy is off', () => {
    let game = fixture();
    game.stage = 'dawn';
    game.night.knife = 8;
    game = applyAction(game, { type: 'dawn' });
    expect(game.stage).toBe('hunter');
    expect(game.pending).toEqual([{ kind: 'hunter', seat: 8 }]);
  });

  it('queues first-night deaths before death skills and resumes the skill after speaking', () => {
    const game = dawn({ lastWords: { firstNight: true } }, [{ seat: 8, cause: 'knife' }]);
    expect(game.stage).toBe('last-words');
    expect(game.pending).toEqual([
      { kind: 'last-words', seat: 8 },
      { kind: 'hunter', seat: 8 },
    ]);

    const spoken = applyAction(game, { type: 'last-words', speak: true });
    expect(spoken.stage).toBe('hunter');
    expect(spoken.pending).toEqual([{ kind: 'hunter', seat: 8 }]);
    expect(spoken.events.some(event => event.publicText === '8 号发表遗言')).toBe(true);
  });

  it('honors the separate later-night policy', () => {
    const firstNight = dawn({ lastWords: { laterNight: true } }, [{ seat: 5, cause: 'knife' }], 1);
    expect(firstNight.stage).toBe('discussion');

    const laterNight = dawn({ lastWords: { laterNight: true } }, [{ seat: 5, cause: 'knife' }], 2);
    expect(laterNight.stage).toBe('last-words');
  });

  it('handles multiple deaths in seat order and records an explicit waiver', () => {
    let game = fixture({ lastWords: { firstNight: true } });
    game.stage = 'dawn';
    game.night.knife = 3;
    game.night.poison = 4;
    game = applyAction(game, { type: 'dawn' });
    expect(game.stage).toBe('last-words');
    expect(game.pending.filter(item => item.kind === 'last-words').map(item => item.seat)).toEqual([3, 4]);

    game = applyAction(game, { type: 'last-words', speak: false });
    expect(game.stage).toBe('last-words');
    expect(game.pending[0]).toEqual({ kind: 'last-words', seat: 4 });
    expect(game.events.some(event => event.publicText === '3 号放弃遗言')).toBe(true);

    game = applyAction(game, { type: 'last-words', speak: true });
    expect(game.stage).toBe('discussion');
    const lastWords = game.events.filter(event => /号(?:发表|放弃)遗言$/.test(event.publicText ?? ''));
    expect(lastWords.map(event => event.publicText)).toEqual(['3 号放弃遗言', '4 号发表遗言']);
  });

  it('runs exile last words before hunter, badge and victory settlement', () => {
    let game = fixture({ lastWords: { exile: true } });
    game.stage = 'discussion';
    game.sheriffDone = true;
    game = applyAction(game, { type: 'start-exile' });
    for (const voter of game.vote!.voters) {
      game = applyAction(game, { type: 'ballot', voter, target: voter === 8 ? 7 : 8 });
    }
    game = applyAction(game, { type: 'count' });
    expect(game.stage).toBe('last-words');
    expect(game.pending[0]).toEqual({ kind: 'last-words', seat: 8 });
    expect(game.pending.some(item => item.kind === 'hunter')).toBe(true);

    game = applyAction(game, { type: 'last-words', speak: true });
    expect(game.stage).toBe('hunter');
    expect(game.winner).toBeUndefined();
  });

  it('queues skill-caused and self-explosion deaths under their own policies', () => {
    let shot = fixture({ lastWords: { skill: true } });
    shot.stage = 'hunter';
    shot.players[7] = { ...shot.players[7], alive: false, death: { day: 1, cause: 'knife' } };
    shot.pending = [{ kind: 'hunter', seat: 8 }];
    shot = applyAction(shot, { type: 'hunter', target: 5 });
    expect(shot.stage).toBe('last-words');
    expect(shot.pending[0]).toEqual({ kind: 'last-words', seat: 5 });

    let exploded = fixture({ lastWords: { explode: true } });
    exploded.stage = 'discussion';
    exploded = applyAction(exploded, { type: 'explode', seat: 1 });
    expect(exploded.stage).toBe('last-words');
    expect(exploded.pending[0]).toEqual({ kind: 'last-words', seat: 1 });
  });

  it('processes last words before a dead sheriff badge transfer', () => {
    let game = fixture({ lastWords: { firstNight: true } }, { sheriff: true });
    game.sheriff = 5;
    game.sheriffDone = true;
    game.stage = 'dawn';
    game.night.knife = 5;
    game = applyAction(game, { type: 'dawn' });
    expect(game.stage).toBe('last-words');
    expect(game.pending).toEqual([
      { kind: 'last-words', seat: 5 },
      { kind: 'badge', seat: 5 },
    ]);
    game = applyAction(game, { type: 'last-words', speak: true });
    expect(game.stage).toBe('badge');
  });

  it('rejects a last-words action outside the queued stage', () => {
    const game = fixture({ lastWords: { firstNight: true } });
    expect(() => applyAction(game, { type: 'last-words', speak: true })).toThrow('当前阶段');
  });

  it('round-trips a queued last-words state without migration damage', () => {
    const game = dawn({ lastWords: { firstNight: true } }, [{ seat: 5, cause: 'knife' }]);
    expect(isValidGame(game)).toBe(true);
    const decoded = decodeSession(JSON.stringify({ current: game, undo: [], redo: [] })).session.current;
    expect(decoded).toEqual(game);
  });

  it('rejects malformed last-words policies and invalid phase durations', () => {
    expect(validateFlow({ lastWords: { exile: 'yes' } })).toBe(false);
    expect(() => fixture({ lastWords: { exile: true } }, { speechSeconds: 10 })).toThrow('默认发言计时无效');
    expect(() => fixture({}, { speechDurations: { pk: 5 } })).toThrow('分阶段发言计时无效');
    const game = dawn({ lastWords: { firstNight: true } }, [{ seat: 5, cause: 'knife' }]);
    const malformed = { ...game, rules: { ...game.rules, speechDurations: { lastWords: 2000 } } };
    expect(isValidGame(malformed)).toBe(false);
  });
});

describe('phase-specific speech durations', () => {
  it('falls back to the legacy speechSeconds value for every phase', () => {
    const rules = { ...DEFAULT_RULES, speechSeconds: 75 };
    expect(speechSecondsForRules(rules, 'discussion')).toBe(75);
    expect(speechSecondsForRules(rules, 'sheriff')).toBe(75);
    expect(speechSecondsForRules(rules, 'pk')).toBe(75);
    expect(speechSecondsForRules(rules, 'lastWords')).toBe(75);
  });

  it('uses each configured duration independently', () => {
    const rules: Rules = {
      ...DEFAULT_RULES,
      speechSeconds: 90,
      speechDurations: { discussion: 120, sheriff: 45, pk: 30, lastWords: 60 },
    };
    expect(speechSecondsForRules(rules, 'discussion')).toBe(120);
    expect(speechSecondsForRules(rules, 'sheriff')).toBe(45);
    expect(speechSecondsForRules(rules, 'pk')).toBe(30);
    expect(speechSecondsForRules(rules, 'lastWords')).toBe(60);
  });

  it('maps the active stage and vote round to the correct timer category', () => {
    const game = fixture({ lastWords: { exile: true, firstNight: true } });
    game.stage = 'last-words';
    expect(speechKindForGame(game)).toBe('lastWords');
    game.stage = 'sheriff-signup';
    expect(speechKindForGame(game)).toBe('sheriff');
    game.stage = 'sheriff-vote';
    game.vote = { kind: 'sheriff', round: 2, candidates: [1, 2], voters: [], ballots: {} };
    expect(speechKindForGame(game)).toBe('pk');
    game.stage = 'exile-vote';
    game.vote = { kind: 'exile', round: 2, candidates: [1, 2], voters: [], ballots: {} };
    expect(speechKindForGame(game)).toBe('pk');
    game.stage = 'discussion';
    expect(speechKindForGame(game)).toBe('discussion');
  });
});

describe('host copy follows the actual last-words policy', () => {
  it('does not announce a last-words timer when every policy is off', () => {
    const script = openingRulesScript(DEFAULT_RULES, roles);
    expect(script).not.toContain('遗言按');
  });

  it('announces only enabled timers and inserts last words into the next-step roadmap', () => {
    const rules: Rules = {
      ...DEFAULT_RULES,
      sheriff: false,
      flow: { lastWords: { firstNight: true, exile: true } },
      speechDurations: { lastWords: 60, pk: 30 },
      table: { exileTie: 'none' },
    };
    const script = openingRulesScript(rules, roles);
    expect(script).toContain('遗言按 60 秒');
    expect(script).not.toContain('警上按');
    expect(script).not.toContain('PK 按');

    const game = fixture(rules.flow, { sheriff: false });
    game.stage = 'dawn';
    expect(hostingProgress(game).next).toContain('遗言（如命中）');
  });
});
