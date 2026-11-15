import React from 'react';
import { Text } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import { DEFAULT_RULES, openingRulesScript } from '../src/game/config';
import { applyAction, createGame } from '../src/game/engine';
import { hostingProgress } from '../src/game/hosting-reference';
import { hostNarration } from '../src/game/narration';
import { normalizePreferences, type HostingProfile } from '../src/game/preferences';
import { decodeSession } from '../src/game/save-schema';
import type { Role } from '../src/game/types';
import { GameScreen } from '../src/ui/GameScreen';
import { SetupScreen } from '../src/ui/SetupScreen';

jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { SafeAreaView: View };
});

const roles: Role[] = ['wolf', 'wolf', 'villager', 'villager', 'seer', 'witch', 'guard', 'hunter'];
const profile: HostingProfile = { id: 'table', name: '朋友面杀局', boardName: '八人自定局', roles, rules: { ...DEFAULT_RULES } };

function mount(element: React.ReactElement) {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => { renderer = TestRenderer.create(element); });
  const button = (label: string) => renderer.root.findAll(node => node.props.accessibilityRole === 'button' && node.props.accessibilityLabel === label && typeof node.props.onPress === 'function')[0];
  const press = (label: string) => {
    const match = button(label);
    if (!match) throw new Error(`Missing button: ${label}`);
    act(() => match.props.onPress());
  };
  const toggle = (label: string, value: boolean) => act(() => renderer.root.findAll(node => node.props.accessibilityLabel === label && typeof node.props.onValueChange === 'function')[0].props.onValueChange(value));
  const text = () => renderer.root.findAllByType(Text).map(node => String(node.props.children)).join('\n');
  const unmount = () => act(() => renderer.unmount());
  return { renderer, button, press, toggle, text, unmount };
}

describe('personalized offline hosting', () => {
  it('saves the exact pregame selections, previews them aloud and reuses them in a new game', async () => {
    const onSaveProfile = jest.fn().mockResolvedValue(undefined);
    const app = mount(<SetupScreen mode="custom" initialRules={profile.rules} initialProfile={profile} onBack={jest.fn()} onStart={jest.fn()} onSaveProfile={onSaveProfile} />);
    app.press('下一步');
    app.press('警长平票 直接流失警徽');
    app.press('放逐平票 本轮无人出局');
    app.toggle('允许守卫连续守同一人', true);
    act(() => app.renderer.root.findByProps({ accessibilityLabel: '本桌补充约定' }).props.onChangeText('仅首夜和放逐有遗言；出局不翻身份。'));
    app.press('自定义主持流程');
    app.toggle('保留已出局角色的夜间口播', true);
    app.press('完成流程设置');
    app.press('预览开场宣读');
    const spoken = app.renderer.root.findByProps({ accessibilityLabel: '完整开场桌规台词' }).props.children as string;
    expect(spoken).toContain('守卫可以连续守同人');
    expect(spoken).toContain('不 PK，警徽流失');
    expect(spoken).toContain('不 PK，无人出局');
    expect(spoken).toContain('保留夜间口播，不录入行动');
    expect(spoken).toContain('仅首夜和放逐有遗言');
    expect(spoken).not.toMatch(/\d+\s*号.*狼人/);
    app.press('完成宣读');
    await act(async () => { app.press('保存方案并设为默认'); await Promise.resolve(); });
    expect(onSaveProfile).toHaveBeenCalledTimes(1);
    const saved = { ...onSaveProfile.mock.calls[0][0], id: profile.id } as HostingProfile;
    expect(saved.rules.table).toEqual({ guardRepeat: true, sheriffTie: 'none', exileTie: 'none', notes: '仅首夜和放逐有遗言；出局不翻身份。' });
    expect(saved.rules.flow?.keepDeadCalls).toBe(true);
    const restoredProfile = normalizePreferences({ profiles: [saved], selectedProfileId: saved.id, hostingMode: 'custom' }).profiles[0];
    const game = createGame('再次开局', saved.boardName, saved.roles.map(role => ({ name: '', role })), restoredProfile.rules);
    const restored = decodeSession(JSON.stringify({ current: game, undo: [], redo: [] })).session.current;
    expect(restored.rules).toEqual(saved.rules);
    expect(openingRulesScript(restored.rules, roles)).toBe(spoken);
    app.unmount();
  });

  it.each(['sheriff', 'exile'] as const)('keeps %s no-PK narration and the next-step hint consistent with the saved rule', kind => {
    const game = createGame('平票口播', '八人', roles.map(role => ({ name: '', role })), { ...DEFAULT_RULES, table: { sheriffTie: 'none', exileTie: 'none' } });
    game.stage = kind === 'sheriff' ? 'sheriff-vote' : 'exile-vote';
    game.vote = { kind, round: 1, candidates: [1, 2], voters: [3, 4], ballots: { 3: 1, 4: 2 } };
    const narration = hostNarration(game, '');
    expect(narration.spoken).toContain('按赛前约定不进行 PK');
    expect(narration.headline).not.toContain('进入 PK');
    expect(hostingProgress(game).next).not.toContain('PK');
    const counted = applyAction(game, { type: 'count' });
    expect(counted.stage).not.toBe(kind === 'sheriff' ? 'sheriff-vote' : 'exile-vote');
  });

  it('retains a dead seer call privately and allows continuing without a target', () => {
    let game = createGame('不翻牌局', '八人', roles.map(role => ({ name: '', role })), { ...DEFAULT_RULES, sheriff: false, flow: { keepDeadCalls: true } });
    game = applyAction(game, { type: 'guard', target: null });
    game = applyAction(game, { type: 'wolves', target: 5 });
    game = applyAction(game, { type: 'seer', target: 1 });
    game = applyAction(game, { type: 'witch', save: false, poison: null });
    game = applyAction(game, { type: 'dawn' });
    game = applyAction(game, { type: 'next-night' });
    game = applyAction(game, { type: 'guard', target: null });
    expect(hostingProgress(game).next).toContain('预言家');
    game = applyAction(game, { type: 'wolves', target: null });
    expect(game.stage).toBe('seer');
    const dispatch = jest.fn(() => true);
    const app = mount(<GameScreen game={game} canUndo={false} canRedo={false} error="" selectionRevision={0} onBack={jest.fn()} onUndo={jest.fn()} onRedo={jest.fn()} onReset={jest.fn()} dispatch={dispatch} />);
    const spoken = app.renderer.root.findByProps({ accessibilityLabel: '完整主持台词' }).props.children as string;
    expect(spoken).toContain('预言家请睁眼');
    expect(spoken).toContain('预言家请闭眼');
    expect(spoken).not.toMatch(/5\s*号|出局|死亡/);
    expect(app.text()).toContain('避免通过省略流程暴露身份');
    expect(app.button('预言家已出局，跳过并继续').props.disabled).toBe(false);
    app.press('预言家已出局，跳过并继续');
    expect(dispatch).toHaveBeenCalledWith({ type: 'skip-night', reason: '行动角色已出局' });
    app.unmount();
  });

  it('says the opening before a retained dead first call without announcing the death', () => {
    const game = createGame('空唤醒', '八人', roles.map(role => ({ name: '', role })), { ...DEFAULT_RULES, flow: { keepDeadCalls: true } });
    game.players[6].alive = false;
    const narration = hostNarration(game, '');
    expect(narration.spoken).toMatch(/^天黑了，请所有玩家闭眼。守卫请睁眼/);
    expect(narration.spoken).not.toMatch(/出局|7\s*号/);
  });
});
