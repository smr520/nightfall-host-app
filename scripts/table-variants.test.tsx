import React from 'react';
import { Text } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import { DEFAULT_RULES, openingRulesScript, ruleSummary } from '../src/game/config';
import { applyAction, callActorStatus, callIdentitySeats, callIsActive, createGame } from '../src/game/engine';
import { hostNarration } from '../src/game/narration';
import { gameInvariantIssues } from '../src/game/save-invariants';
import { normalizePreferences } from '../src/game/preferences';
import { decodeSession, isValidGame } from '../src/game/save-schema';
import { tableRules, validateTableRules } from '../src/game/table-rules';
import type { Game, Role, Rules } from '../src/game/types';
import { GameScreen } from '../src/ui/GameScreen';
import { SetupScreen } from '../src/ui/SetupScreen';

jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { SafeAreaView: View };
});

const roles: Role[] = ['wolf', 'wolf', 'villager', 'villager', 'seer', 'guard'];

function gameWith(rules: Partial<Rules> = {}): Game {
  return createGame(
    '桌规差异测试',
    '六人测试局',
    roles.map((role, index) => ({ name: `${index + 1}号玩家`, role })),
    { ...DEFAULT_RULES, sheriff: false, win: 'all', ...rules },
  );
}

function mount(element: React.ReactElement) {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(element);
  });
  const button = (label: string) => renderer.root.findAll(node =>
    node.props.accessibilityRole === 'button'
    && node.props.accessibilityLabel === label
    && typeof node.props.onPress === 'function')[0];
  const press = (label: string) => {
    const control = button(label);
    if (!control) throw new Error(`Missing control: ${label}`);
    act(() => {
      if (!control.props.disabled) control.props.onPress();
    });
  };
  const text = () => renderer.root.findAllByType(Text).map(node => String(node.props.children)).join('\n');
  return { renderer, button, press, text };
}

describe('table defaults and validation', () => {
  it('keeps dead-role night calls by default and only skips them when explicitly disabled', () => {
    const kept = gameWith();
    const skipped = gameWith({ flow: { keepDeadCalls: false } });
    kept.players[5] = { ...kept.players[5], alive: false, death: { day: 1, cause: 'knife' } };
    skipped.players[5] = { ...skipped.players[5], alive: false, death: { day: 1, cause: 'knife' } };

    expect(callIsActive(kept, 'guard')).toBe(true);
    expect(callIsActive(skipped, 'guard')).toBe(false);
  });

  it('validates the new identity-check and quick-exile settings', () => {
    expect(validateTableRules({ exileRecord: 'quick' })).toBe(true);
    expect(validateTableRules({ exileRecord: 'detailed' })).toBe(true);
    expect(validateTableRules({ exileRecord: 'skip' })).toBe(false);
    expect(validateTableRules({ exileSelfVote: true })).toBe(true);
    expect(validateTableRules({ exileSelfVote: 'yes' })).toBe(false);
    expect(tableRules({ exileRecord: 'quick' }).exileRecord).toBe('quick');
    expect(tableRules(undefined).exileRecord).toBe('detailed');
  });

  it('persists the table rhythm fields in saved profiles', () => {
    const rules: Rules = {
      ...DEFAULT_RULES,
      table: { exileRecord: 'quick' },
      flow: { identityCheck: 'during-night', keepDeadCalls: false },
    };
    const restored = normalizePreferences({
      hostingMode: 'custom',
      profiles: [{ id: 'rhythm', name: '本桌节奏', boardName: '六人局', roles, rules }],
      selectedProfileId: 'rhythm',
    }).profiles[0];

    expect(restored.rules.table?.exileRecord).toBe('quick');
    expect(restored.rules.flow?.identityCheck).toBe('during-night');
    expect(restored.rules.flow?.keepDeadCalls).toBe(false);
  });

  it('exposes the table rhythm choices in the normal pregame rules step', () => {
    const onStart = jest.fn();
    const app = mount(<SetupScreen mode="standard" initialRules={DEFAULT_RULES} onBack={jest.fn()} onStart={onStart} />);

    app.press('下一步');
    expect(app.button('夜间行动流程 确认即行动')?.props.accessibilityState.selected).toBe(true);
    expect(app.button('放逐记录 逐人计票')?.props.accessibilityState.selected).toBe(true);
    expect(app.button('出局角色夜间口播 默认保留')?.props.accessibilityState.selected).toBe(true);
    app.press('夜间行动流程 发牌后自行看牌');
    expect(app.button('夜间行动流程 发牌后自行看牌')?.props.accessibilityState.selected).toBe(true);
    app.press('夜间行动流程 确认即行动');
    app.press('放逐记录 快速记录结果');
    app.press('出局角色夜间口播 跳过');
    app.press('展开更多桌规');
    expect(app.button('放逐平票 PK 一轮')).toBeUndefined();
    app.press('收起更多桌规');
    app.press('下一步');
    app.press('开始主持');

    const game = onStart.mock.calls[0][0] as Game;
    expect(game.rules.flow?.identityCheck).toBe('during-night');
    expect(game.rules.flow?.keepDeadCalls).toBe(false);
    expect(game.rules.table?.exileRecord).toBe('quick');
    expect(game.stage).toBe(game.nightCalls[0]);
    expect(game.identityConfirmed).toEqual([]);
  });

  it('migrates the old pre-game confirmation choice when building a new game', () => {
    const app = mount(
      <SetupScreen
        mode="standard"
        initialRules={{ ...DEFAULT_RULES, flow: { identityCheck: 'at-nightfall' } }}
        onBack={jest.fn()}
        onStart={jest.fn()}
      />,
    );

    app.press('下一步');
    expect(app.button('夜间行动流程 确认即行动')?.props.accessibilityState.selected).toBe(true);
    expect(app.button('夜间行动流程 天黑逐人确认')).toBeUndefined();
  });

  it('omits exile PK text and timing when fast recording is selected', () => {
    const rules: Rules = {
      ...DEFAULT_RULES,
      sheriff: false,
      table: { exileRecord: 'quick', exileTie: 'pk' },
      speechDurations: { pk: 45 },
    };
    const summary = ruleSummary(rules, roles).join('\n');
    const opening = openingRulesScript(rules, roles);

    expect(summary).toContain('快速记录最终被票出者');
    expect(summary).not.toContain('放逐平票');
    expect(opening).not.toMatch(/放逐平票|PK 按 45 秒/);
  });
});

describe('nightfall identity confirmation', () => {
  it('enters a persisted seat-by-seat confirmation stage only when selected', () => {
    const direct = gameWith();
    const confirmed = gameWith({ flow: { identityCheck: 'at-nightfall' } });

    expect(direct.stage).not.toBe('identity-check');
    expect(confirmed.stage).toBe('identity-check');
    expect(confirmed.identityConfirmed).toEqual([]);
    expect(isValidGame(confirmed)).toBe(true);
  });

  it('requires every seat to be confirmed before the first night begins', () => {
    let game = gameWith({ flow: { identityCheck: 'at-nightfall' } });

    expect(() => applyAction(game, { type: 'confirm-identity', seat: 99 })).toThrow('座位不存在');
    game = applyAction(game, { type: 'confirm-identity', seat: 1 });
    expect(() => applyAction(game, { type: 'confirm-identity', seat: 1 })).toThrow('已经确认');
    expect(game.stage).toBe('identity-check');

    for (const seat of [2, 3, 4, 5]) {
      game = applyAction(game, { type: 'confirm-identity', seat });
      expect(game.stage).toBe('identity-check');
    }

    game = applyAction(game, { type: 'confirm-identity', seat: 6 });
    expect(game.identityConfirmed).toEqual([1, 2, 3, 4, 5, 6]);
    expect(game.stage).toBe(game.nightCalls[0]);
    expect(game.events.at(-2)?.publicText).toContain('身份确认');
    expect(game.events.at(-2)?.publicText).not.toMatch(/预言家|女巫|狼人/);
  });

  it('round-trips confirmation progress and rejects duplicate progress', () => {
    let game = gameWith({ flow: { identityCheck: 'at-nightfall' } });
    game = applyAction(game, { type: 'confirm-identity', seat: 2 });
    game = applyAction(game, { type: 'confirm-identity', seat: 1 });
    const restored = decodeSession(JSON.stringify({ current: game, undo: [], redo: [] })).session.current;

    expect(restored.stage).toBe('identity-check');
    expect(restored.identityConfirmed).toEqual([1, 2]);
    expect(isValidGame({ ...game, identityConfirmed: [1, 1] })).toBe(false);
    expect(isValidGame({ ...game, identityConfirmed: [1, 2, 3, 4, 5, 6] })).toBe(false);
  });

  it('renders a non-leaking host script and can confirm the next seat', () => {
    const game = gameWith({ flow: { identityCheck: 'at-nightfall' } });
    const dispatch = jest.fn(() => true);
    const app = mount(
      <GameScreen
        game={game}
        canUndo={false}
        canRedo={false}
        error=""
        selectionRevision={0}
        onBack={jest.fn()}
        onUndo={jest.fn()}
        onRedo={jest.fn()}
        onReset={jest.fn()}
        dispatch={dispatch}
      />,
    );

    const spoken = app.renderer.root.findByProps({ accessibilityLabel: '完整主持台词' }).props.children as string;
    expect(spoken).toContain('1 号');
    expect(spoken).toContain('确认自己的身份牌');
    expect(spoken).not.toMatch(/狼人|预言家|女巫/);
    app.press('确认 1 号身份');
    expect(dispatch).toHaveBeenCalledWith({ type: 'confirm-identity', seat: 1 });
  });
});

describe('progressive identity confirmation during night actions', () => {
  it('starts the normal first night without a separate seat-confirmation stage', () => {
    const game = gameWith({ flow: { identityCheck: 'during-night' } });

    expect(game.stage).toBe(game.nightCalls[0]);
    expect(game.stage).not.toBe('identity-check');
    expect(game.identityConfirmed).toEqual([]);
    expect(isValidGame(game)).toBe(true);
  });

  it('records the selected role seats before the normal action', () => {
    let game = gameWith({ flow: { identityCheck: 'during-night' } });
    game.stage = 'wolves';

    expect(callIdentitySeats(game, 'wolves')).toEqual([1, 2]);
    game = applyAction(game, { type: 'assign-night-identity', callId: 'wolves', seats: [1, 2] });
    expect(game.identityConfirmed).toEqual([1, 2]);
    game = applyAction(game, { type: 'wolves', target: null });
    expect(game.identityConfirmed).toEqual([1, 2]);

    game.stage = 'seer';
    expect(callIdentitySeats(game, 'seer')).toEqual([5]);
    game = applyAction(game, { type: 'assign-night-identity', callId: 'seer', seats: [5] });
    game = applyAction(game, { type: 'seer', target: null });
    expect(game.identityConfirmed).toEqual([1, 2, 5]);
  });

  it('keeps partial in-game identity progress across saved sessions', () => {
    let game = gameWith({ flow: { identityCheck: 'during-night' } });
    game.stage = 'wolves';
    game = applyAction(game, { type: 'assign-night-identity', callId: 'wolves', seats: [1, 2] });
    game = applyAction(game, { type: 'wolves', target: null });

    const restored = decodeSession(JSON.stringify({ current: game, undo: [], redo: [] })).session.current;
    expect(restored.stage).toBe('seer');
    expect(restored.identityConfirmed).toEqual([1, 2]);
    expect(isValidGame({ ...game, identityConfirmed: undefined })).toBe(false);
  });

  it('shows the exact seats on the ordinary wolves action screen', () => {
    let game = gameWith({ flow: { identityCheck: 'during-night' } });
    game.stage = 'wolves';
    game = applyAction(game, { type: 'assign-night-identity', callId: 'wolves', seats: [1, 2] });
    const app = mount(
      <GameScreen
        game={game}
        canUndo={false}
        canRedo={false}
        error=""
        selectionRevision={0}
        onBack={jest.fn()}
        onUndo={jest.fn()}
        onRedo={jest.fn()}
        onReset={jest.fn()}
        dispatch={jest.fn(() => true)}
      />,
    );

    expect(app.text()).toContain('本步身份/阵营');
    expect(app.text()).toContain('1号、2号');
    expect(app.renderer.root.findByProps({ accessibilityLabel: '身份记录 2 / 4 个夜间行动座位' })).toBeDefined();
    expect(app.text()).toContain('本步身份已确认，立即完成本步技能');
    expect(app.text()).toContain('本步身份已确认');
  });

  it('puts the full wolf team in the private confirm-and-act prompt', () => {
    let game = gameWith({ flow: { identityCheck: 'during-night' } });
    game.stage = 'wolves';
    game = applyAction(game, { type: 'assign-night-identity', callId: 'wolves', seats: [1, 2] });

    const narration = hostNarration(game, '');
    expect(narration.privateNote).toContain('本步身份/阵营：1 号、2 号（狼人阵营）');
    expect(narration.privateNote).toContain('先确认身份/阵营，再立即执行本步技能');
    expect(narration.spoken).not.toContain('1 号、2 号');
  });

  it('includes an independent late-knife actor in the wolf identity step', () => {
    const lateKnifeRoles: Role[] = ['wolf', 'wolf', 'villager', 'villager', 'seer', 'gargoyle'];
    let game = createGame(
      '继承刀权',
      '六人测试局',
      lateKnifeRoles.map((role, index) => ({ name: `${index + 1}号玩家`, role })),
      { ...DEFAULT_RULES, sheriff: false, flow: { identityCheck: 'during-night' } },
    );
    game.players[0] = { ...game.players[0], alive: false, death: { day: 1, cause: 'exile' } };
    game.players[1] = { ...game.players[1], alive: false, death: { day: 1, cause: 'exile' } };
    game.stage = 'wolves';
    game = applyAction(game, { type: 'assign-night-identity', callId: 'wolves', seats: [1, 2, 6] });

    expect(callIdentitySeats(game, 'wolves')).toEqual([1, 2, 6]);
    expect(hostNarration(game, '').privateNote).toContain('本步行动座位：6 号');
  });

  it('distinguishes a feared living actor from an eliminated actor during the night flow', () => {
    let game = gameWith({ flow: { identityCheck: 'during-night' } });
    game.stage = 'guard';
    const guard = game.players.find(player => player.role === 'guard')!;
    game.night.targets.nightmare = guard.seat;
    game = applyAction(game, { type: 'assign-night-identity', callId: 'guard', seats: [guard.seat] });
    const app = mount(
      <GameScreen
        game={game}
        canUndo={false}
        canRedo={false}
        error=""
        selectionRevision={0}
        onBack={jest.fn()}
        onUndo={jest.fn()}
        onRedo={jest.fn()}
        onReset={jest.fn()}
        dispatch={jest.fn(() => true)}
      />,
    );

    expect(app.text()).toContain('角色仍存活，但本夜被恐惧，不能行动；本步仍保留身份核对。');
    expect(app.text()).not.toContain('角色已出局，按赛前设置保留空唤醒');
  });

  it('keeps a dead role identity visible on its retained empty wake-up', () => {
    let game = gameWith({ flow: { identityCheck: 'during-night' } });
    game.stage = 'guard';
    game.players[5] = { ...game.players[5], alive: false, death: { day: 1, cause: 'knife' } };
    game = applyAction(game, { type: 'assign-night-identity', callId: 'guard', seats: [6] });
    const app = mount(
      <GameScreen
        game={game}
        canUndo={false}
        canRedo={false}
        error=""
        selectionRevision={0}
        onBack={jest.fn()}
        onUndo={jest.fn()}
        onRedo={jest.fn()}
        onReset={jest.fn()}
        dispatch={jest.fn(() => true)}
      />,
    );

    expect(app.text()).toContain('本步身份/阵营：6 号（守卫）');
    expect(app.text()).toContain('本角色已出局');
  });

  it('submits a three-seat dancer pool instead of a generic night call', () => {
    const dancerRoles: Role[] = ['wolf', 'wolf', 'villager', 'villager', 'seer', 'dancer'];
    const game = createGame(
      '舞池主线',
      '六人舞池',
      dancerRoles.map((role, index) => ({ name: `${index + 1}号玩家`, role })),
      { ...DEFAULT_RULES, sheriff: false },
    );
    game.stage = 'dancer';
    const dispatch = jest.fn(() => true);
    const app = mount(
      <GameScreen
        game={game}
        canUndo={false}
        canRedo={false}
        error=""
        selectionRevision={0}
        onBack={jest.fn()}
        onUndo={jest.fn()}
        onRedo={jest.fn()}
        onReset={jest.fn()}
        dispatch={dispatch}
      />,
    );

    app.press('1号 存活');
    app.press('2号 存活');
    app.press('3号 存活');
    app.press('确认舞池：1 号、2 号、3 号');
    expect(dispatch).toHaveBeenCalledWith({ type: 'dance', seats: [1, 2, 3] });
    expect(dispatch).not.toHaveBeenCalledWith({ type: 'call', callId: 'dancer', target: null });
  });
});

describe('direct exile recording', () => {
  function atDiscussion(rules: Partial<Rules> = {}) {
    const game = gameWith(rules);
    game.stage = 'discussion';
    game.sheriffDone = true;
    return applyAction(game, { type: 'start-exile' });
  }

  it('keeps the current per-voter path for detailed records', () => {
    const game = atDiscussion();
    expect(game.vote?.voters).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('directly exiles a selected seat while reusing the normal death pipeline', () => {
    let game = atDiscussion({ table: { exileRecord: 'quick' } });
    expect(game.vote?.voters).toEqual([]);
    game = applyAction(game, { type: 'exile-result', target: 3 });

    expect(game.players[2]).toMatchObject({ alive: false, death: { day: 1, cause: 'exile' } });
    expect(game.events.at(-2)?.publicText).toBe('3 号被放逐');
    expect(game.day).toBe(2);
    expect(game.stage).toBe(game.nightCalls[0]);
  });

  it('supports an explicit no-exile result and rejects per-voter counting', () => {
    let game = atDiscussion({ table: { exileRecord: 'quick' } });
    expect(() => applyAction(game, { type: 'ballot', voter: 1, target: 2 })).toThrow('快速放逐');
    expect(() => applyAction(game, { type: 'count' })).toThrow('快速放逐');
    game = applyAction(game, { type: 'exile-result', target: null });
    expect(game.events.at(-2)?.publicText).toBe('本轮无人被放逐');
    expect(game.day).toBe(2);
  });

  it('rejects malformed fast-exile saves that contain a second round or ballots', () => {
    const game = atDiscussion({ table: { exileRecord: 'quick' } });
    const malformed: Game = {
      ...game,
      vote: {
        ...game.vote!,
        round: 2,
        voters: [1],
        ballots: { 1: 2 },
      },
    };
    expect(isValidGame(malformed)).toBe(false);
    expect(gameInvariantIssues(malformed).map(issue => issue.code)).toContain('invalid-quick-exile');
  });

  it('records the selected exile directly from the host screen', () => {
    const game = atDiscussion({ table: { exileRecord: 'quick' } });
    const dispatch = jest.fn(() => true);
    const app = mount(
      <GameScreen
        game={game}
        canUndo={false}
        canRedo={false}
        error=""
        selectionRevision={0}
        onBack={jest.fn()}
        onUndo={jest.fn()}
        onRedo={jest.fn()}
        onReset={jest.fn()}
        dispatch={dispatch}
      />,
    );

    expect(app.text()).toContain('快速放逐记录');
    app.press('3号 存活');
    app.press('记录 3 号被放逐');
    expect(dispatch).toHaveBeenCalledWith({ type: 'exile-result', target: 3 });
  });

  it('keeps last words, death skills and badge handling after a quick exile', () => {
    const deathRoles: Role[] = ['wolf', 'wolf', 'villager', 'villager', 'guard', 'witch', 'hunter', 'idiot'];
    let game = createGame(
      '快速放逐后续',
      '八人测试局',
      deathRoles.map((role, index) => ({ name: `${index + 1}号玩家`, role })),
      {
        ...DEFAULT_RULES,
        sheriff: true,
        win: 'all',
        table: { exileRecord: 'quick' },
        flow: { lastWords: { exile: true } },
      },
    );
    game = { ...game, stage: 'discussion', sheriffDone: true, sheriff: 7 };
    game = applyAction(game, { type: 'start-exile' });
    game = applyAction(game, { type: 'exile-result', target: 7 });

    expect(game.pending.map(item => item.kind)).toEqual(['last-words', 'hunter', 'badge']);
    expect(game.stage).toBe('last-words');
    game = applyAction(game, { type: 'last-words', speak: false });
    expect(game.stage).toBe('hunter');
    game = applyAction(game, { type: 'hunter', target: null });
    expect(game.stage).toBe('badge');
    game = applyAction(game, { type: 'badge', target: null });
    expect(game.day).toBe(2);
    expect(game.stage).toBe(game.nightCalls[0]);
  });
});

describe('living but feared roles', () => {
  it('does not label a feared living role as eliminated', () => {
    const fearRoles: Role[] = ['wolf', 'wolf', 'villager', 'villager', 'seer', 'witch'];
    const game = createGame(
      '恐惧状态',
      '六人测试局',
      fearRoles.map((role, index) => ({ name: `${index + 1}号玩家`, role })),
      { ...DEFAULT_RULES, sheriff: false },
    );
    const witchSeat = game.players.find(player => player.role === 'witch')!.seat;
    game.stage = 'witch';
    game.night.targets.nightmare = witchSeat;
    expect(callActorStatus(game, 'witch')).toEqual({ hasActor: true, canAct: false, blockedByFear: true });

    const dispatch = jest.fn(() => true);
    const app = mount(
      <GameScreen
        game={game}
        canUndo={false}
        canRedo={false}
        error=""
        selectionRevision={0}
        onBack={jest.fn()}
        onUndo={jest.fn()}
        onRedo={jest.fn()}
        onReset={jest.fn()}
        dispatch={dispatch}
      />,
    );
    expect(app.text()).toContain('女巫仍存活，但本夜被恐惧');
    expect(app.text()).not.toContain('女巫已出局');
    app.press('本夜被恐惧，跳过并继续');
    expect(dispatch).toHaveBeenCalledWith({ type: 'skip-night', reason: '行动角色本夜被恐惧' });
  });
});
