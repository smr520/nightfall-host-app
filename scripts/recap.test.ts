import { BOARD_LIBRARY, boardSeats } from '../src/game/boards';
import { DEFAULT_RULES } from '../src/game/config';
import { createGame, applyAction } from '../src/game/engine';
import { formatRecap } from '../src/game/recap';

describe('shareable match recap', () => {
  it('orders outcome, complete seat identities and private timeline, with a clear privacy warning', () => {
    const board = BOARD_LIBRARY[0];
    const started = createGame('周末面杀', board.name, boardSeats(board).map((role, index) => ({ name: `玩家${index + 1}`, role })), DEFAULT_RULES);
    const finished = applyAction(started, { type: 'finish', winner: 'good', reason: '最后一只狼人出局' });
    const message = formatRecap(finished);
    expect(message).toContain('周末面杀');
    expect(message).toContain('好人阵营胜利');
    expect(message).toContain('01号 玩家1');
    expect(message).toContain('狼人');
    expect(message).toContain('第1天');
    expect(message).toContain('对局结束');
    expect(message.indexOf('身份与座位')).toBeLessThan(message.indexOf('时间线'));
    expect(message).toContain('包含完整身份、出局原因和主持记录');
  });

  it('labels an unfinished game honestly and handles an empty timeline', () => {
    const board = BOARD_LIBRARY[0];
    const game = createGame('尚未结束', board.name, boardSeats(board).map(role => ({ name: '', role })), DEFAULT_RULES);
    game.events = [];
    const message = formatRecap(game);
    expect(message).toContain('对局尚未结束');
    expect(message).toContain('暂无记录');
  });
});
