import React from 'react';
import { Alert } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import { BOARD_LIBRARY, boardOrigins, boardSeats, isPlayable } from '../src/game/boards';
import { BOARD_INTRODUCTIONS } from '../src/game/board-reference';
import { DEFAULT_RULES, ruleSummary } from '../src/game/config';
import { applyAction, callActorAlive, createGame, victory } from '../src/game/engine';
import { hostNarration } from '../src/game/narration';
import { rulesForBoard } from '../src/game/board-rules';
import { withSupportDefaults } from '../src/game/support-policy';
import { isValidJingchengReserve, TREASURE_RESERVE_PREFIX } from '../src/game/jingcheng-draw';
import type { Game, Role, Rules } from '../src/game/types';
import { SetupScreen } from '../src/ui/SetupScreen';
import { Sheet } from '../src/ui/kit';

jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { SafeAreaView: View };
});

const board = (id: string) => BOARD_LIBRARY.find(item => item.id === id)!;
const rulesOf = (id: string): Rules => withSupportDefaults(rulesForBoard({ ...DEFAULT_RULES, sheriff: false }, board(id)), boardSeats(board(id)));
const start = (id: string, roles: Role[] = boardSeats(board(id))) => createGame('整合板测试', board(id).name, roles.map(role => ({ name: '', role })), rulesOf(id));

describe('网易官方 + 京城大师赛整合板子库', () => {
  const NETEASE = ['standard-12', 'wolf-beauty-knight', 'wolf-king-guard', 'gargoyle-gravekeeper', 'wolf-king-dreamer', 'nightmare-shadow', 'wolf-plan', 'awakened-knight', 'salon-night'];
  const JINGCHENG = ['jingcheng-s15-treasure-master', 'jingcheng-qingqiu', 'jingcheng-masquerade', 'jingcheng-masquerade-10', 'jingcheng-mech-wolf'];

  it('tags both sources and gives every new board an introduction and a source link', () => {
    for (const id of [...NETEASE, ...JINGCHENG]) {
      expect(board(id).catalog?.sources.length).toBeGreaterThan(0);
      expect(BOARD_INTRODUCTIONS[id]).toBeDefined();
    }
    NETEASE.forEach(id => expect(boardOrigins(board(id))).toEqual(['netease']));
    JINGCHENG.forEach(id => { expect(boardOrigins(board(id))).toEqual(['jingcheng']); expect(board(id).tag).toBe('tournament'); });
  });

  it.each(BOARD_LIBRARY.filter(item => !item.deck))('starts the complete library board $name with its published lineup', item => {
    expect(BOARD_LIBRARY.filter(boardItem => boardItem.id === item.id)).toHaveLength(1);
    expect(isPlayable(item)).toBe(true);
    const game = start(item.id);
    expect(game.players).toHaveLength(item.playerCount);
    expect(game.players.map(player => player.role).sort()).toEqual(boardSeats(item).sort());
  });

  it.each(['wolf-plan', 'awakened-knight', 'salon-night', 'jingcheng-qingqiu', 'jingcheng-masquerade', 'jingcheng-masquerade-10', 'jingcheng-mech-wolf'])('starts %s as a real game with the published lineup', id => {
    expect(isPlayable(board(id))).toBe(true);
    const game = start(id);
    expect(game.players).toHaveLength(board(id).playerCount);
    expect(game.nightCalls.length).toBeGreaterThan(1);
  });

  it('runs 沙龙之夜 without a villager edge and resolves the fox automatically', () => {
    const game = start('salon-night');
    expect(game.rules.table?.lineupMode).toBe('free');
    expect(game.players.some(player => player.role === 'villager')).toBe(false);
    const emptied = { ...game, players: game.players.map(player => player.role === 'wolf' && player.seat === 1 ? { ...player, alive: false } : player) };
    expect(victory(emptied)).toBeNull();
  });

  it('skips second-night-only roles on night one and wakes them from night two', () => {
    let game = start('jingcheng-masquerade');
    expect(game.nightCalls).toEqual(expect.arrayContaining(['dancer', 'masked']));
    const visited: string[] = [];
    while (game.stage !== 'dawn') {
      visited.push(game.stage);
      game = applyAction(game, { type: 'skip-night' });
    }
    expect(visited).not.toContain('dancer');
    expect(visited).not.toContain('masked');
    expect(() => applyAction(game, { type: 'dance', seats: [1, 2, 3] })).toThrow('当前阶段');
  });

  it('uses the 机械狼通灵师 published night order and no witch self-save', () => {
    const game = start('jingcheng-mech-wolf');
    expect(game.nightCalls).toEqual(['mech-wolf', 'guard', 'wolves', 'witch', 'medium']);
    expect(game.rules.selfSave).toBe('never');
    expect(game.stage).toBe('mech-wolf');
    const narration = hostNarration(game, '', { selected: 9 });
    expect(narration.spoken).toMatch(/^天黑了，请所有玩家闭眼。机械狼请睁眼/);
    expect(narration.privateNote).toContain('目标身份');
  });
});

describe('盗宝大师牌池板', () => {
  it('forbids a first-night knife and records the private reserve log for the host', () => {
    const roles: Role[] = ['wolf', 'wolf', 'wolf-king', 'villager', 'villager', 'villager', 'villager', 'medium', 'poisoner', 'hunter', 'dreamer', 'treasure-master'];
    let game = createGame('盗宝', '盗宝大师', roles.map(role => ({ name: '', role })), rulesOf('jingcheng-s15-treasure-master'), { privateNotes: [`${TREASURE_RESERVE_PREFIX}：狼人、乌鸦、平民（本局归狼人阵营）`] });
    expect(game.events.some(event => event.text.startsWith(TREASURE_RESERVE_PREFIX) && !event.publicText)).toBe(true);
    expect(ruleSummary(game.rules)).toContain('首夜狼人只互相确认，不发动击杀');
    while (game.stage !== 'wolves') game = applyAction(game, { type: 'skip-night' });
    expect(hostNarration(game, '').spoken).toContain('首夜狼人不发动击杀');
    expect(() => applyAction(game, { type: 'wolves', target: 4 })).toThrow('首夜');
    game = applyAction(game, { type: 'wolves', target: null });
    while (game.stage !== 'treasure-master') game = applyAction(game, { type: 'skip-night' });
    expect(hostNarration(game, '').privateNote).toContain('盗宝大师底牌：狼人、乌鸦、平民');
  });

  it('deals a legal 12-seat lineup in setup and starts a game with the reserve kept private', () => {
    const alert = jest.spyOn(Alert, 'alert');
    const onStart = jest.fn();
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => { renderer = TestRenderer.create(<SetupScreen mode="standard" initialRules={DEFAULT_RULES} onBack={jest.fn()} onStart={onStart} />); });
    const press = (label: string) => {
      const node = renderer.root.findAll(item => item.props.accessibilityRole === 'button' && item.props.accessibilityLabel === label && typeof item.props.onPress === 'function')[0];
      if (!node) throw new Error(`Missing button: ${label}`);
      act(() => node.props.onPress());
    };
    press(`当前板子 ${BOARD_LIBRARY[0].name}，点击更换`);
    press('京城大师赛');
    const library = renderer.root.findAllByType(Sheet).find(node => node.props.visible && node.props.title === '板子库')!;
    const labels = library.findAll(node => typeof node.props.accessibilityLabel === 'string' && node.props.accessibilityLabel.startsWith('选择板子：') && typeof node.props.onPress === 'function').map(node => node.props.accessibilityLabel);
    expect(new Set(labels)).toEqual(new Set(BOARD_LIBRARY.filter(item => item.tag === 'tournament').map(item => `选择板子：${item.name}`)));
    press('选择板子：盗宝大师');
    press('下一步'); press('下一步');
    expect(renderer.root.findAll(node => node.props.accessibilityRole === 'header' && node.props.children === '底牌 · 仅主持人可见').length).toBeGreaterThan(0);
    press('开始主持');
    expect(onStart).toHaveBeenCalledTimes(1);
    const game: Game = onStart.mock.calls[0][0];
    expect(game.players).toHaveLength(12);
    expect(game.players.filter(player => player.role === 'treasure-master')).toHaveLength(1);
    const seated = game.players.map(player => player.role);
    const reserve = [...boardSeats(board('jingcheng-s15-treasure-master'))];
    seated.forEach(role => reserve.splice(reserve.indexOf(role), 1));
    expect(isValidJingchengReserve(reserve)).toBe(true);
    const log = game.events.find(event => event.text.startsWith(TREASURE_RESERVE_PREFIX))!;
    expect(log.publicText).toBeUndefined();
    expect(game.rules.table?.firstNightKnife).toBe(false);
    expect(alert).not.toHaveBeenCalled();
    alert.mockRestore();
    act(() => renderer.unmount());
  });
});

describe('独立行动狼人与狼刀阶段一致', () => {
  it('treats a lone independent wolf as no shared-knife actor everywhere', () => {
    const roles: Role[] = ['wolf', 'gargoyle', 'villager', 'villager', 'villager', 'seer', 'witch', 'hunter'];
    let game = createGame('独狼', '测试', roles.map(role => ({ name: '', role })), { ...DEFAULT_RULES, sheriff: false, flow: { keepDeadCalls: true } });
    game.players[0].alive = false;
    game = { ...game, stage: 'wolves' };
    expect(callActorAlive(game, 'wolves')).toBe(true);
    expect(hostNarration(game, '').privateNote).toContain('2 号');
    expect(() => applyAction(game, { type: 'wolves', target: 3 })).not.toThrow();
    expect(applyAction(game, { type: 'skip-night' }).stage).not.toBe('wolves');
  });
});
