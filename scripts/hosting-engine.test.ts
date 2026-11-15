import { DEFAULT_RULES } from '../src/game/config';
import { BOARD_LIBRARY, boardSeats } from '../src/game/boards';
import { applyAction, createGame, nightDeaths } from '../src/game/engine';
import type { Game, Role } from '../src/game/types';

const standard = (afterAnnouncement = false) => {
  const board = BOARD_LIBRARY[0];
  return createGame('主持回归', board.name, boardSeats(board).map(role => ({ name: role, role })), {
    ...DEFAULT_RULES, sheriffTiming: afterAnnouncement ? 'after-announcement' : 'before-announcement',
  });
};

function finishNight(game: Game, knife: number | null, poison: number | null = null, targets: Record<string, number | null> = {}): Game {
  let current = game;
  for (const call of game.nightCalls) {
    if (current.stage !== call) continue;
    if (call === 'guard') current = applyAction(current, { type: 'guard', target: null });
    else if (call === 'wolves') current = applyAction(current, { type: 'wolves', target: knife });
    else if (call === 'seer') current = applyAction(current, { type: 'seer', target: null });
    else if (call === 'witch') current = applyAction(current, { type: 'witch', save: false, poison });
    else current = applyAction(current, { type: 'call', callId: call, target: targets[call] ?? null });
  }
  expect(current.stage).toBe('dawn');
  return current;
}

describe('hosted game death and election transitions', () => {
  it('handles first-night hunter skills before an after-announcement election', () => {
    let game = standard(true);
    const hunter = game.players.find(player => player.role === 'hunter')!.seat;
    game = applyAction(finishNight(game, hunter), { type: 'dawn' });
    expect(game.stage).toBe('hunter');
    expect(game.sheriffDone).toBe(false);
    game = applyAction(game, { type: 'hunter', target: null });
    expect(game.pending).toEqual([]);
    expect(game.stage).toBe('sheriff-signup');
    game = applyAction(game, { type: 'signup', seats: [2, 3] });
    for (const voter of game.vote!.voters) game = applyAction(game, { type: 'ballot', voter, target: 2 });
    game = applyAction(game, { type: 'count' });
    expect(game.stage).toBe('discussion');
  });

  it('checks a decisive night death before starting an after-announcement election', () => {
    const roles: Role[] = ['wolf', 'wolf', 'villager', 'seer', 'witch', 'hunter'];
    let game = createGame('首日胜负', '六人', roles.map(role => ({ name: role, role })), { ...DEFAULT_RULES, sheriffTiming: 'after-announcement' });
    game = applyAction(finishNight(game, 3), { type: 'dawn' });
    expect(game.stage).toBe('ended');
    expect(game.winner).toBe('wolf');
  });

  it('finishes death work already queued in an old after-announcement election state', () => {
    const game = standard(true);
    const hunter = game.players.find(player => player.role === 'hunter')!;
    hunter.alive = false;
    hunter.death = { day: 1, cause: 'knife' };
    game.stage = 'sheriff-signup';
    game.pending = [{ kind: 'hunter', seat: hunter.seat }];
    const elected = applyAction(game, { type: 'signup', seats: [2] });
    expect(elected.stage).toBe('hunter');
    expect(applyAction(elected, { type: 'hunter', target: null }).stage).toBe('discussion');
  });

  it('completes a wolf-beauty link when the linked player died in the same night', () => {
    const board = BOARD_LIBRARY.find(item => item.id === 'wolf-beauty-knight')!;
    let game = createGame('同夜死亡', board.name, boardSeats(board).map(role => ({ name: role, role })), { ...DEFAULT_RULES, sheriff: false, flow: { manualDawn: true } });
    const beauty = game.players.find(player => player.role === 'wolf-beauty')!.seat;
    const knight = game.players.find(player => player.role === 'knight')!.seat;
    game = finishNight(game, null, null, { 'wolf-beauty': knight });
    game = applyAction(game, { type: 'set-dawn-deaths', deaths: [{ seat: beauty, cause: 'shot' }, { seat: knight, cause: 'knife' }], reason: '核对同夜出局' });
    game = applyAction(game, { type: 'dawn' });
    expect(game.stage).toBe('link');
    game = applyAction(game, { type: 'link', target: knight });
    expect(game.stage).toBe('discussion');
    expect(game.pending).toEqual([]);
    expect(game.players.find(player => player.seat === knight)!.death?.cause).toBe('knife');
    expect(game.events.at(-1)?.publicText).toContain('无需重复殉情');
  });

  it('keeps a living wolf-beauty target locked without granting linked death skills', () => {
    const roles: Role[] = ['wolf-beauty', 'wolf', 'villager', 'seer', 'witch', 'hunter'];
    let game = createGame('殉情猎人', '六人', roles.map(role => ({ name: role, role })), { ...DEFAULT_RULES, sheriff: false });
    game = finishNight(game, null, null, { 'wolf-beauty': 6 });
    game = applyAction(game, { type: 'dawn' });
    game.stage = 'discussion';
    const voters = game.players.filter(player => player.alive && player.seat !== 1).map(player => player.seat);
    game.stage = 'exile-vote';
    game.vote = { kind: 'exile', round: 1, candidates: [1], voters, ballots: Object.fromEntries(voters.map(seat => [seat, 1])) };
    game = applyAction(game, { type: 'count' });
    expect(game.stage).toBe('link');
    expect(() => applyAction(game, { type: 'link', target: 3 })).toThrow('只能确认已记录的魅惑目标');
    game = applyAction(game, { type: 'link', target: 6 });
    expect(game.stage).toBe('wolves');
    expect(game.players[5].death?.cause).toBe('link');
  });

  it('allows white-wolf-king shots only on explosion', () => {
    const roles: Role[] = ['white-wolf-king', 'wolf', 'villager', 'seer', 'witch', 'hunter'];
    const base = createGame('白狼王', '六人', roles.map(role => ({ name: role, role })), { ...DEFAULT_RULES, sheriff: false });
    const nightDeath = applyAction(finishNight(base, 1), { type: 'dawn' });
    expect(nightDeath.stage).toBe('discussion');
    expect(nightDeath.pending).toEqual([]);
    const explosion = applyAction({ ...base, stage: 'discussion' }, { type: 'explode', seat: 1 });
    expect(explosion.stage).toBe('shot');
    expect(explosion.pending[0]).toMatchObject({ role: 'white-wolf-king', seat: 1 });
  });

  it('honors light-earl protection on a decisive knife target', () => {
    const roles: Role[] = ['wolf', 'sun-eater', 'villager', 'seer', 'witch', 'light-earl'];
    let game = createGame('流光保护', '六人', roles.map(role => ({ name: role, role })), { ...DEFAULT_RULES, sheriff: false });
    game = { ...game, day: 2, stage: 'wolves' };
    game = finishNight(game, 3, null, { 'light-earl': 3 });
    expect(nightDeaths(game)).toEqual([]);
    game = applyAction(game, { type: 'dawn' });
    expect(game.players[2].alive).toBe(true);
    expect(game.stage).toBe('discussion');
    expect(game.winner).toBeUndefined();
  });

  it('keeps a recorded light-earl protection effective if the caster dies simultaneously', () => {
    const roles: Role[] = ['wolf', 'sun-eater', 'villager', 'seer', 'witch', 'light-earl'];
    let game = createGame('同时中毒', '六人', roles.map(role => ({ name: role, role })), { ...DEFAULT_RULES, sheriff: false });
    game = { ...game, day: 2, stage: 'wolves' };
    game = finishNight(game, 3, 6, { 'light-earl': 3 });
    expect(nightDeaths(game)).toEqual([{ seat: 6, cause: 'poison' }]);
    game = applyAction(game, { type: 'dawn' });
    expect(nightDeaths(game)).toEqual([{ seat: 6, cause: 'poison' }]);
    expect(game.players[2].alive).toBe(true);
  });
});
