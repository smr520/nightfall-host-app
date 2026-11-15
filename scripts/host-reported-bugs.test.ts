import { DEFAULT_RULES } from '../src/game/config';
import { applyAction, createGame } from '../src/game/engine';
import { decodeSession } from '../src/game/save-schema';
import type { Action, Game, Role } from '../src/game/types';

/**
 * Night skipping is deliberately represented as an action.  Keeping this
 * helper cast in one place lets this regression suite describe the public
 * action contract while the engine evolves the Action union.
 */
function skipNight(reason?: string): Action {
  return {
    type: 'skip-night',
    ...(reason === undefined ? {} : { reason }),
  } as unknown as Action;
}

function fixture(roles: Role[], sheriff = false): Game {
  return createGame(
    'host progression regression',
    `${roles.length}-player regression`,
    roles.map((role, index) => ({ name: `P${index + 1}`, role })),
    { ...DEFAULT_RULES, sheriff, win: 'all' },
  );
}

function markDead(game: Game, role: Role): Game {
  const player = game.players.find(item => item.role === role && item.alive);
  if (!player) throw new Error(`missing ${role} in fixture`);
  return {
    ...game,
    players: game.players.map(item => item.seat === player.seat
      ? { ...item, alive: false, death: { day: game.day, cause: 'ruling' as const } }
      : item),
  };
}

describe('host-reported night progression traps', () => {
  it('skips a live seer as one explicit no-op call', () => {
    const roles: Role[] = ['wolf', 'wolf', 'villager', 'villager', 'seer', 'witch', 'hunter', 'guard'];
    let game = fixture(roles);
    expect(game.stage).toBe('guard');
    game = applyAction(game, { type: 'guard', target: null });
    game = applyAction(game, { type: 'wolves', target: null });
    expect(game.stage).toBe('seer');

    game = applyAction(game, skipNight('seer declines tonight'));

    expect(game.night.inspect).toBeNull();
    expect(game.stage).toBe('witch');
    expect(game.events.at(-1)?.stage).toBe('seer');
  });

  it('lets a cached night stage with an eliminated actor advance', () => {
    const roles: Role[] = ['wolf', 'wolf', 'villager', 'villager', 'seer', 'witch', 'hunter', 'guard'];
    let game = fixture(roles);
    game = applyAction(game, { type: 'guard', target: null });
    game = applyAction(game, { type: 'wolves', target: null });
    game = markDead(game, 'seer');
    expect(game.stage).toBe('seer');
    expect(game.players.find(player => player.role === 'seer')?.alive).toBe(false);

    game = applyAction(game, skipNight('seer is already out'));

    expect(game.stage).toBe('witch');
    expect(game.night.inspect).toBeNull();
  });

  it('skips a wolves call when every wolf has already been eliminated', () => {
    const roles: Role[] = ['wolf', 'wolf', 'villager', 'villager', 'seer', 'witch'];
    let game = markDead(markDead(fixture(roles), 'wolf'), 'wolf');
    expect(game.stage).toBe('wolves');
    expect(game.players.filter(player => player.role === 'wolf' && player.alive)).toHaveLength(0);

    game = applyAction(game, skipNight('no wolves remain'));

    expect(game.night.knife).toBeNull();
    expect(game.stage).toBe('seer');
  });

  it('does not spend either medicine when the witch declines the night', () => {
    const roles: Role[] = ['wolf', 'wolf', 'villager', 'villager', 'seer', 'witch'];
    let game = fixture(roles);
    expect(game.stage).toBe('wolves');
    game = applyAction(game, { type: 'wolves', target: null });
    game = applyAction(game, { type: 'seer', target: null });
    expect(game.stage).toBe('witch');

    game = applyAction(game, skipNight());

    expect(game.stage).toBe('dawn');
    expect(game.night.save).toBe(false);
    expect(game.night.poison).toBeNull();
    expect(game.medicine).toEqual({ save: true, poison: true });
  });

  it('records null for a declined custom night role before the next role', () => {
    const roles: Role[] = ['wolf', 'wolf-beauty', 'villager', 'villager', 'seer', 'witch'];
    let game = fixture(roles);
    expect(game.nightCalls).toEqual(['wolves', 'wolf-beauty', 'seer', 'witch']);
    game = applyAction(game, { type: 'wolves', target: null });
    expect(game.stage).toBe('wolf-beauty');

    game = applyAction(game, skipNight('no charm tonight'));

    expect(game.night.targets['wolf-beauty']).toBeNull();
    expect(game.stage).toBe('seer');
  });

  it('can skip a pending shot even when its dead actor is still queued', () => {
    const roles: Role[] = ['wolf-king', 'wolf', 'villager', 'seer', 'witch', 'hunter'];
    let game = fixture(roles);
    const wolfKing = game.players.find(player => player.role === 'wolf-king')!.seat;
    game = applyAction(game, { type: 'wolves', target: wolfKing });
    game = applyAction(game, { type: 'seer', target: null });
    game = applyAction(game, { type: 'witch', save: false, poison: null });
    game = applyAction(game, { type: 'dawn' });
    expect(game.stage).toBe('shot');
    expect(game.pending[0]).toMatchObject({ kind: 'shot', seat: wolfKing, role: 'wolf-king' });
    expect(game.players.find(player => player.seat === wolfKing)?.alive).toBe(false);

    // Pending death skills are resolved by their own explicit null action;
    // skip-night is intentionally limited to the current night call.
    game = applyAction(game, { type: 'shot', target: null });

    expect(game.pending).toEqual([]);
    expect(game.stage).toBe('discussion');
  });

  it('resolves a queued link whose recorded target died before the skill stage', () => {
    const roles: Role[] = ['wolf', 'wolf-beauty', 'villager', 'villager', 'seer', 'witch', 'knight', 'guard'];
    let game = createGame('host progression regression', `${roles.length}-player regression`, roles.map((role, index) => ({ name: `P${index + 1}`, role })), { ...DEFAULT_RULES, sheriff: false, win: 'all', flow: { manualDawn: true } });
    const beauty = game.players.find(player => player.role === 'wolf-beauty')!.seat;
    const knight = game.players.find(player => player.role === 'knight')!.seat;
    game = applyAction(game, { type: 'guard', target: null });
    game = applyAction(game, { type: 'wolves', target: null });
    game = applyAction(game, { type: 'call', callId: 'wolf-beauty', target: knight });
    game = applyAction(game, { type: 'seer', target: null });
    game = applyAction(game, { type: 'witch', save: false, poison: null });
    game = applyAction(game, { type: 'set-dawn-deaths', deaths: [{ seat: beauty, cause: 'shot' }], reason: '主持人核验出局' });
    game = applyAction(game, { type: 'dawn' });
    game.players.find(player => player.seat === knight)!.alive = false;
    game.players.find(player => player.seat === knight)!.death = { day: game.day, cause: 'knife' };
    expect(game.stage).toBe('link');
    expect(game.pending[0]).toMatchObject({ kind: 'link', seat: beauty, target: knight });
    expect(game.players.find(player => player.seat === knight)?.alive).toBe(false);

    game = applyAction(game, { type: 'link', target: null });

    expect(game.pending).toEqual([]);
    expect(game.stage).toBe('discussion');
    expect(game.players.find(player => player.seat === knight)?.alive).toBe(false);
  });

  it('does not let a night skip bypass a daytime stage', () => {
    const game = { ...fixture(['wolf', 'wolf', 'villager', 'villager', 'seer', 'witch']), stage: 'discussion' as const };
    expect(() => applyAction(game, skipNight('invalid daytime skip'))).toThrow();
  });

  it('can recover a saved dead-actor stage through the same explicit action', () => {
    const original = markDead({ ...fixture(['wolf', 'wolf', 'villager', 'villager', 'seer', 'witch']), stage: 'seer' as const }, 'seer');
    const restored = decodeSession(JSON.stringify({ current: original, undo: [], redo: [] })).session.current;
    expect(restored.stage).toBe('seer');
    const resumed = applyAction(restored, skipNight('resume after reload'));
    expect(resumed.stage).toBe('witch');
  });

  it('queues a hunter heir shot after the delayed death resolves', () => {
    let game = fixture(['wolf', 'villager', 'villager', 'baize', 'seer', 'hunter']);
    const baize = game.players.find(player => player.role === 'baize')!;
    const hunter = game.players.find(player => player.role === 'hunter')!;
    game = { ...game, stage: 'heir', pending: [{ kind: 'heir', seat: baize.seat }] };
    game = applyAction(game, { type: 'heir', target: hunter.seat });
    expect(game.special?.heir).toEqual({ seat: hunter.seat, kind: 'god' });

    game = { ...game, stage: 'dawn', night: { ...game.night, knife: hunter.seat } };
    game = applyAction(game, { type: 'dawn' });
    expect(game.players.find(player => player.seat === hunter.seat)?.alive).toBe(true);
    expect(game.special?.delayedDeaths).toEqual([{ seat: hunter.seat, cause: 'knife' }]);

    game = applyAction({ ...game, stage: 'discussion' }, { type: 'next-night' });

    expect(game.players.find(player => player.seat === hunter.seat)?.alive).toBe(false);
    expect(game.stage).toBe('hunter');
    expect(game.pending[0]).toMatchObject({ kind: 'hunter', seat: hunter.seat });
  });

  it('keeps the table rule for a poisoned hunter heir', () => {
    let game = fixture(['wolf', 'villager', 'villager', 'baize', 'seer', 'hunter']);
    const baize = game.players.find(player => player.role === 'baize')!;
    const hunter = game.players.find(player => player.role === 'hunter')!;
    game = { ...game, stage: 'heir', pending: [{ kind: 'heir', seat: baize.seat }] };
    game = applyAction(game, { type: 'heir', target: hunter.seat });

    game = { ...game, stage: 'dawn', night: { ...game.night, poison: hunter.seat } };
    game = applyAction(game, { type: 'dawn' });
    game = applyAction({ ...game, stage: 'discussion' }, { type: 'next-night' });

    expect(game.players.find(player => player.seat === hunter.seat)?.alive).toBe(false);
    expect(game.stage).not.toBe('hunter');
    expect(game.pending).toEqual([]);
  });
});
