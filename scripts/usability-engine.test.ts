import { DEFAULT_RULES } from '../src/game/config';
import { applyAction, createGame, tally } from '../src/game/engine';
import { validateFlow } from '../src/game/flow';
import { winnerLabel } from '../src/game/host-ui';
import { decodeSession, isValidGame } from '../src/game/save-schema';
import type { Action, Game, Role, Rules } from '../src/game/types';

const roles: Role[] = ['wolf', 'wolf', 'villager', 'seer', 'witch', 'hunter'];
const fixture = (rules: Partial<Rules> = {}, lineup = roles) => createGame('现场主持', '六人测试', lineup.map(role => ({ name: '', role })), { ...DEFAULT_RULES, sheriff: false, ...rules });

function exileVote(): Game {
  const game = fixture(); game.stage = 'discussion'; game.sheriff = 1;
  return applyAction(game, { type: 'start-exile' });
}

function hunterDawn(): Game {
  const game = fixture({ flow: { manualVictory: true } }, ['wolf', 'wolf', 'villager', 'villager', 'villager', 'hunter']);
  game.stage = 'dawn'; game.night.knife = 6; game.sheriff = 6;
  return applyAction(game, { type: 'dawn' });
}

describe('grouped voting keeps real voter records', () => {
  it('records a group atomically, keeps sheriff weighting, and overwrites instead of duplicating votes', () => {
    const game = exileVote();
    const before = JSON.stringify(game);
    const group = { type: 'ballots', voters: [4, 1, 3], target: 2 } as const;
    const action = { ...group, voters: [...group.voters] };
    const recorded = applyAction(game, action);
    expect(JSON.stringify(game)).toBe(before);
    expect(action.voters).toEqual([4, 1, 3]);
    expect(recorded.vote?.ballots).toEqual({ 1: 2, 3: 2, 4: 2 });
    expect(recorded.events).toHaveLength(game.events.length + 1);
    expect(recorded.events.at(-1)).toMatchObject({ text: '1 号、3 号、4 号投给 2 号', publicText: '1 号、3 号、4 号投给 2 号' });
    expect(tally(recorded).find(item => item.seat === 2)?.votes).toBe(3.5);
    const corrected = applyAction(recorded, { type: 'ballots', voters: [1, 3], target: 5 });
    expect(corrected.vote?.ballots).toEqual({ 1: 5, 3: 5, 4: 2 });
    expect(tally(corrected).find(item => item.seat === 2)?.votes).toBe(1);
    expect(tally(corrected).find(item => item.seat === 5)?.votes).toBe(2.5);
    expect(isValidGame(corrected)).toBe(true);
  });

  it.each([
    { voters: [], target: 2 },
    { voters: [3, 3], target: 2 },
    { voters: [3, 99], target: 2 },
    { voters: [3], target: 99 },
  ])('rejects the whole invalid group without changing the original: %j', payload => {
    const game = exileVote(); const before = JSON.stringify(game);
    expect(() => applyAction(game, { type: 'ballots', ...payload })).toThrow();
    expect(JSON.stringify(game)).toBe(before);
    expect(game.vote?.ballots).toEqual({});
  });

  it('checks sheriff-election voter qualification and retains the normal tie/PK rules', () => {
    const game = fixture({ sheriff: true }); game.stage = 'sheriff-signup';
    let voting = applyAction(game, { type: 'signup', seats: [1, 2] });
    expect(() => applyAction(voting, { type: 'ballots', voters: [3, 1], target: 1 })).toThrow('没有本轮投票权');
    expect(voting.vote?.ballots).toEqual({});
    voting = applyAction(voting, { type: 'ballots', voters: [3, 4], target: 1 });
    expect(() => applyAction(voting, { type: 'count' })).toThrow('还有未录入');
    voting = applyAction(voting, { type: 'ballots', voters: [5, 6], target: 2 });
    const pk = applyAction(voting, { type: 'count' });
    expect(pk.vote).toMatchObject({ round: 2, candidates: [1, 2], voters: [3, 4, 5, 6], ballots: {} });
    const abstained = applyAction(pk, { type: 'ballots', voters: [3, 4, 5, 6], target: null });
    const finished = applyAction(abstained, { type: 'count' });
    expect(finished.sheriff).toBeNull();
    expect(finished.sheriffDone).toBe(true);
    expect(finished.stage).toBe('discussion');
    expect(isValidGame(finished)).toBe(true);
  });

  it('rejects grouped voting outside a voting stage', () => {
    expect(() => applyAction(fixture(), { type: 'ballots', voters: [3], target: 2 })).toThrow('当前阶段');
  });
});

describe('host-confirmed victory', () => {
  it('preserves standard automatic ending by default, and waits for the host only when enabled', () => {
    const game = fixture(); game.stage = 'dawn'; game.night.knife = 3;
    expect(applyAction(game, { type: 'dawn' })).toMatchObject({ stage: 'ended', winner: 'wolf' });
    game.rules.flow = { manualVictory: true };
    const continued = applyAction(game, { type: 'dawn' });
    expect(continued.stage).toBe('discussion');
    expect(continued.winner).toBeUndefined();
    const nextNight = applyAction(continued, { type: 'next-night' });
    expect(nextNight.stage).toBe('wolves');
    expect(nextNight.day).toBe(2);
    const ended = applyAction(nextNight, { type: 'finish', winner: 'draw', reason: '特殊玩法核对结束' });
    expect(ended).toMatchObject({ stage: 'ended', winner: 'draw', endReason: '主持人裁定：特殊玩法核对结束' });
    expect(isValidGame(ended)).toBe(true);
  });

  it('still resolves death skills and the badge before continuing a decisive death', () => {
    let game = hunterDawn();
    expect(game.stage).toBe('hunter');
    expect(game.pending.map(item => item.kind)).toEqual(['hunter', 'badge']);
    game = applyAction(game, { type: 'hunter', target: null });
    expect(game.stage).toBe('badge');
    game = applyAction(game, { type: 'badge', target: 3 });
    expect(game.stage).toBe('discussion');
    expect(game.sheriff).toBe(3);
    expect(game.winner).toBeUndefined();
    expect(game.players[5].alive).toBe(false);
    expect(isValidGame(game)).toBe(true);
  });

  it('validates and restores the setting without changing old defaults', () => {
    expect(validateFlow({ manualVictory: true })).toBe(true);
    expect(validateFlow({ manualVictory: false })).toBe(true);
    expect(validateFlow({ manualVictory: 'true' })).toBe(false);
    const game = fixture({ flow: { manualVictory: true } });
    expect(decodeSession(JSON.stringify({ current: game, undo: [], redo: [] })).session.current.rules.flow?.manualVictory).toBe(true);
    expect(fixture().rules.flow?.manualVictory).toBeUndefined();
    const invalid = { ...game, rules: { ...game.rules, flow: { manualVictory: 1 } } };
    expect(isValidGame(invalid)).toBe(false);
    expect(() => createGame('非法设置', '六人', roles.map(role => ({ name: '', role })), invalid.rules as unknown as Rules)).toThrow('自定义流程无效');
  });

  it('records a host-confirmed third-party win and restores it as the same result', () => {
    const game = fixture({ flow: { manualVictory: true } });
    const ended = applyAction(game, { type: 'finish', winner: 'third', reason: '第三方达成本桌约定的胜利条件' });
    expect(ended.winner).toBe('third');
    expect(ended.events.at(-1)?.text).toContain('第三方获胜');
    expect(winnerLabel(ended.winner!)).toBe('第三方胜利');
    expect(isValidGame(ended)).toBe(true);
    const restored = decodeSession(JSON.stringify({ current: ended, undo: [game], redo: [] })).session;
    expect(restored.current).toEqual(ended);
    expect(restored.undo[0]).toEqual(game);
    expect(() => applyAction(game, { type: 'finish', winner: 'unknown', reason: '错误结果' } as unknown as Action)).toThrow('胜方无效');
  });
});

describe('private host notes preserve the active workflow', () => {
  it.each(['night', 'dawn', 'vote', 'skill'] as const)('records a note during %s without advancing or revealing it', phase => {
    const game = phase === 'vote' ? exileVote() : phase === 'skill' ? hunterDawn() : fixture();
    if (phase === 'dawn') game.stage = 'dawn';
    const next = applyAction(game, { type: 'note', text: '  商人授予 3 号技能，本桌另行核对  ' });
    const { events: oldEvents, ...oldState } = game;
    const { events: newEvents, ...newState } = next;
    expect(newState).toEqual(oldState);
    expect(newEvents.slice(0, -1)).toEqual(oldEvents);
    expect(newEvents.at(-1)?.text).toBe('主持备忘：商人授予 3 号技能，本桌另行核对');
    expect(newEvents.at(-1)?.publicText).toBeUndefined();
    expect(isValidGame(next)).toBe(true);
    expect(decodeSession(JSON.stringify({ current: next, undo: [], redo: [] })).session.current.events.at(-1)?.publicText).toBeUndefined();
  });

  it.each(['', '  ', '记'.repeat(1201)])('rejects empty or overlong notes', text => {
    const game = fixture(); const before = JSON.stringify(game);
    expect(() => applyAction(game, { type: 'note', text })).toThrow();
    expect(JSON.stringify(game)).toBe(before);
  });

  it('does not accept a note after the game ends', () => {
    const ended = applyAction(fixture(), { type: 'finish', winner: 'draw', reason: '现场结束' });
    expect(() => applyAction(ended, { type: 'note', text: '结束后备注' } as Action)).toThrow('对局已结束');
  });
});
