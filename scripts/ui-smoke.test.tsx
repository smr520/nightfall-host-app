import React from 'react';
import { Alert, BackHandler, Text } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import App from '../App';
import { clearDamagedSession, persistAppRole, persistPreferences, persistSession, retryPersistSession, readAppRole, readHistory, readPreferences, readSession } from '../src/storage';
import { BOARD_LIBRARY, DEFAULT_RULES, ROLE_IDS, boardSeats } from '../src/game/config';
import { createGame } from '../src/game/engine';
import type { Game, Session } from '../src/game/types';
import { SetupScreen } from '../src/ui/SetupScreen';
import { Sheet } from '../src/ui/kit';
import { ReferenceModal } from '../src/ui/ReferenceModal';
import type { HostingProfile } from '../src/ui/preferences';

jest.mock('expo-keep-awake', () => ({ useKeepAwake: jest.fn() }));
jest.mock('expo-screen-capture', () => ({ usePreventScreenCapture: jest.fn() }));
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
jest.mock('react-native-safe-area-context', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { SafeAreaProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>, SafeAreaView: View };
});
jest.mock('../src/player/device-storage', () => ({
  playerNotebookStorage: {
    read: jest.fn().mockResolvedValue(null),
    persist: jest.fn().mockResolvedValue(undefined),
    clear: jest.fn().mockResolvedValue(undefined),
  },
}));
jest.mock('../src/storage', () => ({
  clearSession: jest.fn().mockResolvedValue(undefined), clearDamagedSession: jest.fn().mockResolvedValue(undefined), persistSession: jest.fn().mockResolvedValue(undefined), retryPersistSession: jest.fn().mockResolvedValue(undefined),
  readHistory: jest.fn(), readSession: jest.fn(), readPreferences: jest.fn().mockResolvedValue({ hostingMode: 'standard' }), persistPreferences: jest.fn().mockResolvedValue(undefined), readAppRole: jest.fn().mockResolvedValue('host'), persistAppRole: jest.fn().mockResolvedValue(undefined), getWarnings: jest.fn(() => []), exportRawData: jest.fn().mockResolvedValue('{}'),
}));

describe('host screen UI regression', () => {
  jest.setTimeout(30000);
  const flush = async () => {
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
      await new Promise(resolve => setTimeout(resolve, 0));
    });
  };
  afterEach(async () => {
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 50)); });
  });
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(readSession).mockResolvedValue(null);
    jest.mocked(readHistory).mockResolvedValue([]);
    jest.mocked(readPreferences).mockResolvedValue({ hostingMode: 'standard' });
    jest.mocked(persistPreferences).mockResolvedValue(undefined);
    jest.mocked(persistSession).mockResolvedValue(undefined);
    jest.mocked(retryPersistSession).mockResolvedValue(undefined);
    jest.mocked(readAppRole).mockResolvedValue('host');
    jest.mocked(persistAppRole).mockResolvedValue(undefined);
  });

  it('keeps target confirmation available and preserves screen state after a game action', async () => {
    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => { renderer = TestRenderer.create(<App />); });
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    const buttons = () => renderer.root.findAll(node => node.props.accessibilityRole === 'button' && typeof node.props.onPress === 'function');
    const press = (label: string) => {
      const button = buttons().find(item => item.props.accessibilityLabel === label);
      if (!button) throw new Error(`UI button not found: ${label}`);
      act(() => button.props.onPress());
    };

    for (let attempt = 0; attempt < 30 && !buttons().some(item => item.props.accessibilityLabel === '新建一场对局'); attempt++) {
      await act(async () => { await new Promise(resolve => setTimeout(resolve, 5)); });
    }
    if (!buttons().some(item => item.props.accessibilityLabel === '新建一场对局')) throw new Error(`Home did not render. Buttons: ${buttons().map(item => String(item.props.accessibilityLabel)).join('|')}; text: ${renderer.root.findAllByType(Text).map(node => String(node.props.children)).join('|')}`);
    press('新建一场对局');
    press('下一步');
    press('下一步');
    press('开始主持');
    expect(buttons().some(item => item.props.accessibilityLabel === '选择刀口，或空刀')).toBe(true);

    const seat5 = buttons().find(item => String(item.props.accessibilityLabel).startsWith('5号'));
    expect(seat5).toBeDefined();
    act(() => seat5!.props.onPress());
    expect(buttons().some(item => item.props.accessibilityLabel === '确认刀口：5 号')).toBe(true);

    const pressTab = (label: string) => {
      const tab = renderer.root.findAll(node => node.props.accessibilityRole === 'tab' && node.props.accessibilityLabel === label)[0];
      if (!tab) throw new Error(`Tab not found: ${label}`);
      act(() => tab.props.onPress());
    };
    pressTab('座位');
    const rolesSwitch = renderer.root.findAll(node => node.props.accessibilityLabel === '显示身份' && typeof node.props.onValueChange === 'function')[0];
    act(() => rolesSwitch.props.onValueChange(true));
    expect(renderer.root.findAllByType(Text).some(node => String(node.props.children) === '狼')).toBe(true);
    pressTab('主持');
    expect(buttons().some(item => item.props.accessibilityLabel === '确认刀口：5 号')).toBe(true);
    press('确认刀口：5 号');
    expect(buttons().some(item => item.props.accessibilityLabel === '选择查验目标，或空过')).toBe(true);
    await act(async () => { await Promise.resolve(); });
    press('返回');
    const confirmation = jest.spyOn(Alert, 'alert');
    press('新建一场对局');
    expect(confirmation).toHaveBeenCalledWith('当前对局还没结束', expect.any(String), expect.any(Array));
    expect(buttons().some(item => item.props.accessibilityLabel === '继续主持')).toBe(true);
    confirmation.mockRestore();
    await flush(); act(() => renderer.unmount());
  });

  const fixture = (overrides: Partial<Game> = {}): Session => {
    const board = BOARD_LIBRARY[0];
    const players = boardSeats(board).map(role => ({ name: role, role }));
    return { current: { ...createGame('Saved game', board.name, players, DEFAULT_RULES), ...overrides }, undo: [], redo: [] };
  };
  async function mountSaved(saved: Session | null = null) {
    jest.mocked(readSession).mockResolvedValue(saved);
    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => { renderer = TestRenderer.create(<App />); });
    const buttons = () => renderer.root.findAll(node => node.props.accessibilityRole === 'button' && typeof node.props.onPress === 'function');
    const button = (label: string) => {
      const match = buttons().find(node => node.props.accessibilityLabel === label);
      if (!match) throw new Error(`Missing button ${label}`);
      return match;
    };
    const press = (label: string) => act(() => { const match = button(label); if (!match.props.disabled) match.props.onPress(); });
    const selectMainTab = (label: string) => {
      const navigation = renderer.root.findAll(node => node.props.testID === 'main-navigation')[0];
      if (!navigation) throw new Error('Main navigation is not visible');
      const tab = navigation.findAll(node => node.props.accessibilityRole === 'tab' && node.props.accessibilityLabel === label && typeof node.props.onPress === 'function')[0];
      if (!tab) throw new Error(`Missing main tab ${label}`);
      act(() => { if (!tab.props.disabled) tab.props.onPress(); });
    };
    const text = () => renderer.root.findAllByType(Text).map(node => String(node.props.children)).join('\n');
    return { renderer, buttons, button, press, selectMainTab, text };
  }

  const profileFixture = (id = 'profile-test', name = '我的六人局'): HostingProfile => ({
    id, name, boardName: '六人速开', roles: ['wolf', 'wolf', 'villager', 'villager', 'seer', 'witch'],
    rules: { ...DEFAULT_RULES, sheriff: false, win: 'all', selfSave: 'never' },
  });

  it('asks for host or player on first launch and switches without touching host navigation', async () => {
    jest.mocked(readAppRole).mockResolvedValue(null);
    const app = await mountSaved(null);
    await flush();

    expect(app.text()).toContain('你是主持人，还是玩家？');
    expect(app.button('我是主持人')).toBeDefined();
    expect(app.button('我是玩家')).toBeDefined();
    expect(app.renderer.root.findAll(node => node.props.testID === 'main-navigation')).toHaveLength(0);

    app.press('我是主持人');
    await flush();
    expect(persistAppRole).toHaveBeenCalledWith('host');
    expect(app.button('新建一场对局')).toBeDefined();
    expect(app.button('切换到玩家模式')).toBeDefined();

    const alert = jest.spyOn(Alert, 'alert');
    app.press('切换到玩家模式');
    const switchAction = alert.mock.calls.at(-1)?.[2]?.find(item => item.text === '切换');
    expect(switchAction).toBeDefined();
    await act(async () => { switchAction?.onPress?.(); });
    await flush();

    expect(persistAppRole).toHaveBeenLastCalledWith('player');
    expect(app.text()).toContain('先选本，再记你的身份');
    expect(app.renderer.root.findAll(node => node.props.testID === 'main-navigation')).toHaveLength(0);

    const backAlert = jest.spyOn(Alert, 'alert');
    app.press('主持');
    const backAction = backAlert.mock.calls.at(-1)?.[2]?.find(item => item.text === '切换');
    expect(backAction).toBeDefined();
    await act(async () => { backAction?.onPress?.(); });
    await flush();
    expect(persistAppRole).toHaveBeenLastCalledWith('host');
    expect(app.button('新建一场对局')).toBeDefined();
    backAlert.mockRestore();
    alert.mockRestore();
    await flush(); act(() => app.renderer.unmount());
  });

  it('opens directly in the remembered player mode without host navigation', async () => {
    jest.mocked(readAppRole).mockResolvedValue('player');
    const app = await mountSaved(null);
    await flush();

    expect(app.text()).toContain('先选本，再记你的身份');
    expect(app.renderer.root.findAll(node => node.props.testID === 'main-navigation')).toHaveLength(0);
    expect(app.buttons().some(node => node.props.accessibilityLabel === '新建一场对局')).toBe(false);
    expect(app.button('主持')).toBeDefined();

    await flush(); act(() => app.renderer.unmount());
  });

  it('keeps host recovery controls out of player mode', async () => {
    jest.mocked(readAppRole).mockResolvedValue('player');
    jest.mocked(readSession).mockRejectedValue(new Error('damaged host session'));
    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => { renderer = TestRenderer.create(<App />); });
    await flush();

    const buttons = () => renderer.root.findAll(node => node.props.accessibilityRole === 'button' && typeof node.props.onPress === 'function');
    const text = () => renderer.root.findAllByType(Text).map(node => String(node.props.children)).join('\n');
    expect(text()).toContain('先选本，再记你的身份');
    expect(buttons().some(node => node.props.accessibilityLabel === '重试读档')).toBe(false);
    expect(buttons().some(node => node.props.accessibilityLabel === '备份后清除异常会话')).toBe(false);
    expect(buttons().some(node => node.props.accessibilityLabel === '分享原始数据')).toBe(false);

    const alert = jest.spyOn(Alert, 'alert');
    const switchButton = buttons().find(node => node.props.accessibilityLabel === '主持');
    expect(switchButton).toBeDefined();
    act(() => switchButton?.props.onPress());
    const switchAction = alert.mock.calls.at(-1)?.[2]?.find(item => item.text === '切换');
    expect(switchAction).toBeDefined();
    await act(async () => { switchAction?.onPress?.(); });
    await flush();
    expect(buttons().some(node => node.props.accessibilityLabel === '重试读档')).toBe(true);
    expect(buttons().some(node => node.props.accessibilityLabel === '备份后清除异常会话')).toBe(true);
    alert.mockRestore();
    act(() => renderer.unmount());
  });

  it('preserves an active host game across player mode', async () => {
    const saved = fixture();
    const app = await mountSaved(saved);
    const alert = jest.spyOn(Alert, 'alert');

    app.press('切换到玩家模式');
    const toPlayer = alert.mock.calls.at(-1)?.[2]?.find(item => item.text === '切换');
    expect(toPlayer).toBeDefined();
    await act(async () => { toPlayer?.onPress?.(); });
    await flush();
    expect(app.text()).toContain('先选本，再记你的身份');

    app.press('主持');
    const toHost = alert.mock.calls.at(-1)?.[2]?.find(item => item.text === '切换');
    expect(toHost).toBeDefined();
    await act(async () => { toHost?.onPress?.(); });
    await flush();
    expect(app.button('继续主持')).toBeDefined();
    expect(app.text()).toContain(saved.current.name);
    expect(persistSession).not.toHaveBeenCalled();

    alert.mockRestore();
    await flush(); act(() => app.renderer.unmount());
  });

  it('separates the three host pages in order and keeps navigation read-only for an active game', async () => {
    const saved = fixture();
    const app = await mountSaved(saved);
    const navigation = () => app.renderer.root.findAll(node => node.props.testID === 'main-navigation')[0];
    const tabLabels = Array.from(new Set(navigation().findAll(node => node.props.accessibilityRole === 'tab' && typeof node.props.onPress === 'function').map(node => node.props.accessibilityLabel)));
    expect(tabLabels).toEqual(['主持', '技能表', '个性化']);
    expect(app.buttons().some(node => ['标准流程', '熟人快局', '我的方案'].includes(String(node.props.accessibilityLabel)))).toBe(false);
    expect(app.button('继续主持')).toBeDefined();
    app.selectMainTab('技能表');
    expect(app.renderer.root.findAll(node => node.props.accessibilityLabel === '搜索卡牌技能').length).toBeGreaterThan(0);
    expect(app.buttons().some(node => node.props.accessibilityLabel === '新建自定义方案')).toBe(false);
    app.selectMainTab('个性化');
    expect(app.button('标准流程')).toBeDefined();
    expect(app.button('熟人快局')).toBeDefined();
    expect(app.button('新建自定义方案')).toBeDefined();
    app.selectMainTab('主持');
    expect(app.text()).toContain(saved.current.name);
    expect(persistSession).not.toHaveBeenCalled();
    expect(persistPreferences).not.toHaveBeenCalled();
    app.press('继续主持');
    expect(app.renderer.root.findAll(node => node.props.testID === 'main-navigation')).toHaveLength(0);
    expect(app.button('选择刀口，或空刀')).toBeDefined();
    await flush(); act(() => app.renderer.unmount());
  });

  it('hides the main tabs while setting up and hosting a game', async () => {
    const app = await mountSaved(null);
    app.press('新建一场对局');
    expect(app.renderer.root.findAll(node => node.props.testID === 'main-navigation')).toHaveLength(0);
    app.press('返回');
    expect(app.renderer.root.findAll(node => node.props.testID === 'main-navigation').length).toBeGreaterThan(0);
    app.press('新建一场对局'); app.press('下一步'); app.press('下一步'); app.press('开始主持');
    expect(app.renderer.root.findAll(node => node.props.testID === 'main-navigation')).toHaveLength(0);
    expect(app.button('选择刀口，或空刀')).toBeDefined();
    await flush(); act(() => app.renderer.unmount());
  });

  it('offers an enabled skip action for a restored eliminated night role without requesting a target', async () => {
    const saved = fixture({ stage: 'seer', day: 2, sheriffDone: true });
    const seer = saved.current.players.find(player => player.role === 'seer')!;
    seer.alive = false; seer.death = { day: 1, cause: 'exile' };
    const app = await mountSaved(saved); app.press('继续主持');
    expect(app.button('预言家已出局，跳过并继续').props.disabled).toBe(false);
    expect(app.text()).toContain('这个角色已经出局，本夜无需行动');
    expect(app.buttons().some(node => node.props.accessibilityLabel === '规则与角色图鉴')).toBe(false);
    expect(app.text()).not.toContain('特殊技能 · 需要主持人复核');
    app.press('预言家已出局，跳过并继续');
    expect(jest.mocked(persistSession).mock.calls.at(-1)?.[0].current.stage).toBe('witch');
    expect(jest.mocked(persistSession).mock.calls.at(-1)?.[0].current.night.inspect).toBeNull();
    await flush(); act(() => app.renderer.unmount());
  });

  it('shows the eliminated hunter seat in the large headline and allows declining the shot', async () => {
    const saved = fixture({ stage: 'hunter', sheriffDone: true });
    const hunter = saved.current.players.find(player => player.role === 'hunter')!;
    hunter.alive = false; hunter.death = { day: 1, cause: 'knife' };
    saved.current.pending = [{ kind: 'hunter', seat: hunter.seat }];
    const app = await mountSaved(saved); app.press('继续主持');
    const headline = app.renderer.root.findAll(node => node.props.accessibilityLabel === '本环节大字提示')[0];
    expect(headline.props.children).toContain(`${hunter.seat} 号猎人`);
    const speech = app.renderer.root.findAll(node => node.props.accessibilityLabel === '完整主持台词')[0];
    expect(speech.props.children).toContain('如果不开枪，请明确表示');
    expect(speech.props.numberOfLines).toBeUndefined();
    expect(app.button('不开枪').props.accessibilityState.disabled).toBe(false);
    app.press('不开枪');
    expect(jest.mocked(persistSession).mock.calls.at(-1)?.[0].current.stage).toBe('discussion');
    await flush(); act(() => app.renderer.unmount());
  });

  it('confirms an unchanged manual dawn list without requiring the host to type during the game', async () => {
    const saved = fixture({ stage: 'dawn', sheriffDone: true });
    saved.current.rules = { ...saved.current.rules, sheriff: false, flow: { manualDawn: true } };
    saved.current.night.knife = 5;
    const app = await mountSaved(saved); app.press('继续主持');
    expect(app.button('确认昨夜出局名单').props.disabled).toBe(false);
    app.press('确认昨夜出局名单');
    expect(jest.mocked(persistSession).mock.calls.at(-1)?.[0].current.night.manualReason).toBe('已按赛前桌规核对');
    app.press('确认夜间结算');
    expect(jest.mocked(persistSession).mock.calls.at(-1)?.[0].current.players[4].alive).toBe(false);
    await flush(); act(() => app.renderer.unmount());
  });

  it('keeps a just-exiled seat visible in large text when the engine advances to the next night', async () => {
    const saved = fixture({ stage: 'exile-vote', sheriffDone: true });
    const voters = saved.current.players.map(player => player.seat);
    saved.current.vote = { kind: 'exile', round: 1, candidates: [...voters], voters, ballots: Object.fromEntries(voters.map(seat => [seat, 5])) };
    const app = await mountSaved(saved); app.press('继续主持'); app.press('完成计票');
    expect(jest.mocked(persistSession).mock.calls.at(-1)?.[0].current.stage).toBe('wolves');
    const result = app.renderer.root.findAll(node => node.props.accessibilityLabel === '刚刚公布的大字结果')[0];
    expect(result.props.children).toBe('5 号被放逐');
    expect(app.renderer.root.findAll(node => node.props.accessibilityLabel === '完整主持台词')[0].props.children).toContain('天黑了，请所有玩家闭眼。');
    app.press('6号 存活'); app.press('确认刀口：6 号');
    expect(app.renderer.root.findAll(node => node.props.accessibilityLabel === '刚刚公布的大字结果')).toHaveLength(0);
    await flush(); act(() => app.renderer.unmount());
  });

  it('applies a saved custom order, script, duration and manual-dawn setting from the flow editor', async () => {
    const app = await mountSaved(null);
    app.selectMainTab('个性化'); app.press('新建自定义方案');
    act(() => app.renderer.root.findByProps({ accessibilityLabel: '方案名称' }).props.onChangeText('我的流程'));
    app.press('下一步'); app.press('自定义主持流程');
    app.press('上移预言家行动');
    app.press('发言时长 120 秒');
    const manual = app.renderer.root.findAll(node => node.props.accessibilityLabel === '天亮时手动确认出局名单' && typeof node.props.onValueChange === 'function')[0];
    act(() => manual.props.onValueChange(true));
    act(() => app.renderer.root.findByProps({ accessibilityLabel: '自定义主持词：白天发言' }).props.onChangeText('现在请 {发言人} 发言。'));
    app.press('完成流程设置');
    await act(async () => app.press('保存方案并设为默认'));
    const saved = jest.mocked(persistPreferences).mock.calls.at(-1)?.[0].profiles?.[0];
    expect(saved?.rules).toMatchObject({ speechSeconds: 120, flow: { nightOrder: ['seer', 'wolves', 'witch'], manualDawn: true, scripts: { discussion: '现在请 {发言人} 发言。' } } });
    app.selectMainTab('主持'); app.press('新建一场对局'); app.press('下一步'); app.press('下一步'); app.press('开始主持');
    expect(jest.mocked(persistSession).mock.calls.at(-1)?.[0].current.stage).toBe('seer');
    await flush(); act(() => app.renderer.unmount());
  });

  it('retains a poisoned hunter cause through manual death-list removal and re-addition', async () => {
    const saved = fixture({ stage: 'dawn' });
    const hunter = saved.current.players.find(player => player.role === 'hunter')!.seat;
    saved.current.rules = { ...saved.current.rules, sheriff: false, flow: { manualDawn: true } };
    saved.current.sheriffDone = true; saved.current.night.poison = hunter;
    const app = await mountSaved(saved); app.press('继续主持');
    expect(app.button('先确认昨夜出局名单').props.disabled).toBe(true);
    app.press(`${hunter}号 存活`);
    act(() => app.renderer.root.findByProps({ accessibilityLabel: '天亮复核原因' }).props.onChangeText('先移出名单'));
    app.press('确认昨夜出局名单');
    expect(jest.mocked(persistSession).mock.calls.at(-1)?.[0].current.night.manualDeaths).toEqual([]);
    app.press(`${hunter}号 存活`); app.press('更新昨夜出局名单');
    expect(jest.mocked(persistSession).mock.calls.at(-1)?.[0].current.night.manualDeaths).toEqual([{ seat: hunter, cause: 'poison' }]);
    app.press('确认夜间结算');
    expect(jest.mocked(persistSession).mock.calls.at(-1)?.[0].current.stage).toBe('discussion');
    expect(app.text()).not.toContain('选择开枪目标');
    await flush(); act(() => app.renderer.unmount());
  });

  it('keeps speech timing and numbered narration after switching tabs', async () => {
    const app = await mountSaved(fixture({ stage: 'discussion', sheriffDone: true }));
    app.press('继续主持'); app.press('发言人 5 号'); app.press('开始计时');
    expect(app.text()).toContain('请 5 号玩家发言');
    const selectTab = (label: string) => act(() => app.renderer.root.findAll(node => node.props.accessibilityRole === 'tab' && node.props.accessibilityLabel === label)[0].props.onPress());
    selectTab('座位'); selectTab('主持');
    expect(app.button('暂停计时')).toBeDefined(); expect(app.text()).toContain('请 5 号玩家发言');
    app.press('下一位发言'); expect(app.text()).toContain('请 6 号玩家发言');
    expect(app.button('开始计时')).toBeDefined();
    app.press('发言方向：顺号'); selectTab('座位'); selectTab('主持');
    expect(app.button('发言方向：逆号')).toBeDefined();
    app.press('下一位发言'); expect(app.text()).toContain('请 5 号玩家发言');
    expect(persistSession).not.toHaveBeenCalled();
    await flush(); act(() => app.renderer.unmount());
  });

  it('opens an offline searchable role reference from the skill page without changing game data', async () => {
    const app = await mountSaved(null);
    app.selectMainTab('技能表'); app.press('规则与流程'); app.press('角色图鉴');
    const reference = () => app.renderer.root.findByType(ReferenceModal);
    act(() => reference().findByProps({ accessibilityLabel: '搜索角色' }).props.onChangeText('女巫'));
    app.press('查看角色：女巫');
    app.press('展开主持说明与来源');
    expect(app.text()).toContain('软件如何处理');
    expect(app.text()).toContain('参考资料');
    const back = reference().findAll(node => node.props.accessibilityRole === 'button' && node.props.accessibilityLabel === '返回')[0];
    act(() => back.props.onPress());
    act(() => reference().findByProps({ accessibilityLabel: '搜索角色' }).props.onChangeText('没有这张牌'));
    expect(app.text()).toContain('没有找到角色');
    app.press('清空'); app.press('第三方'); app.press('查看角色：孤独少女');
    app.press('展开主持说明与来源');
    expect(app.text()).toContain('第三方阵营');
    expect(app.text()).toContain('无法按崇拜对象判胜');
    app.press('关闭规则图鉴');
    expect(reference().props.visible).toBe(false);
    expect(persistSession).not.toHaveBeenCalled();
    expect(persistPreferences).not.toHaveBeenCalled();
    await flush(); act(() => app.renderer.unmount());
  });

  it('looks up the current draft rules without losing setup values or the current step', async () => {
    const app = await mountSaved(null);
    app.press('新建一场对局');
    act(() => app.renderer.root.findByProps({ accessibilityLabel: '对局名称' }).props.onChangeText('查规则不丢设置'));
    app.press('下一步'); app.press('展开更多桌规'); app.press('首日公布顺序 先公布后竞选');
    app.press('查看规则与角色技能'); app.press('基础规则');
    const reference = app.renderer.root.findByType(ReferenceModal);
    const referenceText = reference.findAllByType(Text).map(node => String(node.props.children)).join('\n');
    expect(referenceText).toContain('本局采用的桌规');
    expect(referenceText).toContain('先公布死亡，再竞选');
    app.press('关闭规则图鉴'); app.press('上一步');
    expect(app.renderer.root.findByProps({ accessibilityLabel: '对局名称' }).props.value).toBe('查规则不丢设置');
    app.press('下一步'); app.press('下一步');
    expect(app.text()).toContain('开局前核对');
    app.press('开始主持');
    expect(jest.mocked(persistSession).mock.calls.at(-1)?.[0].current.rules.sheriffTiming).toBe('after-announcement');
    await flush(); act(() => app.renderer.unmount());
  });

  it('preserves a pending night target while looking up only the current lineup', async () => {
    const saved = fixture();
    const app = await mountSaved(saved);
    app.press('继续主持'); app.press('5号 存活');
    const selectTab = (label: string) => act(() => app.renderer.root.findAll(node => node.props.accessibilityRole === 'tab' && node.props.accessibilityLabel === label)[0].props.onPress());
    selectTab('更多');
    app.press('规则与角色图鉴'); app.press('角色图鉴'); app.press('只看本局角色');
    const reference = app.renderer.root.findByType(ReferenceModal);
    expect(reference.findAll(node => node.props.accessibilityLabel === '查看角色：狼人').length).toBeGreaterThan(0);
    expect(reference.findAll(node => node.props.accessibilityLabel === '查看角色：守卫')).toHaveLength(0);
    const referenceText = reference.findAllByType(Text).map(node => String(node.props.children)).join('\n');
    expect(referenceText).not.toContain('1 号');
    app.press('关闭规则图鉴');
    selectTab('主持');
    expect(app.button('确认刀口：5 号')).toBeDefined();
    expect(persistSession).not.toHaveBeenCalled();
    app.press('确认刀口：5 号');
    expect(app.button('选择查验目标，或空过')).toBeDefined();
    await flush(); act(() => app.renderer.unmount());
  });

  it('shows role details from the custom lineup builder and returns to its uncommitted choices', async () => {
    const app = await mountSaved(null);
    app.selectMainTab('个性化'); app.press('新建自定义方案'); app.press('自定义人数和角色');
    act(() => app.renderer.root.findByProps({ accessibilityLabel: '板子名称' }).props.onChangeText('边查边配'));
    app.press('增加守卫'); app.press('查看技能：守卫');
    const reference = app.renderer.root.findByType(ReferenceModal);
    expect(reference.props.initialRole).toBe('guard');
    const back = reference.findAll(node => node.props.accessibilityRole === 'button' && node.props.accessibilityLabel === '返回')[0];
    act(() => back.props.onPress());
    app.press('只看本局角色');
    expect(reference.findAll(node => node.props.accessibilityLabel === '查看角色：守卫').length).toBeGreaterThan(0);
    app.press('关闭规则图鉴');
    expect(app.renderer.root.findByProps({ accessibilityLabel: '板子名称' }).props.value).toBe('边查边配');
    app.press('用这套阵容');
    expect(app.button('当前板子 边查边配，点击更换')).toBeDefined();
    expect(persistPreferences).not.toHaveBeenCalled();
    await flush(); act(() => app.renderer.unmount());
  });

  it('saves a personal lineup and rules, reloads them, and applies them to the next game', async () => {
    const app = await mountSaved(null);
    app.selectMainTab('个性化');
    app.press('我的方案');
    act(() => app.renderer.root.findByProps({ accessibilityLabel: '方案名称' }).props.onChangeText('周五六人局'));
    app.press(`当前板子 ${BOARD_LIBRARY[0].name}，点击更换`);
    app.press('选择板子：六人速开');
    app.press('下一步');
    const sheriff = app.renderer.root.findAll(node => typeof node.props.onValueChange === 'function')[0];
    act(() => sheriff.props.onValueChange(false));
    app.press('胜负条件 屠城');
    app.press('女巫自救 不可');
    await act(async () => app.press('保存方案并设为默认'));
    const saved = jest.mocked(persistPreferences).mock.calls.at(-1)?.[0];
    expect(saved).toMatchObject({ hostingMode: 'custom', profiles: [{ name: '周五六人局', boardName: '六人速开', rules: { sheriff: false, win: 'all', selfSave: 'never' } }] });
    expect(persistSession).not.toHaveBeenCalled();
    expect(app.text()).toContain('默认开局');
    act(() => app.renderer.unmount());
    jest.mocked(readPreferences).mockResolvedValue(saved!);
    const restarted = await mountSaved(null);
    expect(restarted.text()).toContain('周五六人局');
    restarted.press('新建一场对局');
    restarted.press('下一步'); restarted.press('下一步'); restarted.press('开始主持');
    const game = jest.mocked(persistSession).mock.calls.at(-1)?.[0].current;
    expect(game?.players.map(player => player.role)).toEqual(profileFixture().roles);
    expect(game?.rules).toMatchObject({ sheriff: false, win: 'all', selfSave: 'never' });
    await flush(); act(() => restarted.renderer.unmount());
  });

  it('edits the same saved profile without replacing an active game', async () => {
    const profile = profileFixture();
    jest.mocked(readPreferences).mockResolvedValue({ hostingMode: 'custom', profiles: [profile], selectedProfileId: profile.id });
    const current = fixture();
    const app = await mountSaved(current);
    app.selectMainTab('个性化'); app.press(`编辑方案：${profile.name}`);
    act(() => app.renderer.root.findByProps({ accessibilityLabel: '方案名称' }).props.onChangeText('改名六人局'));
    app.press('自定义人数和角色'); app.press('增加村民'); app.press('用这套阵容');
    app.press('下一步'); app.press('女巫自救 始终');
    await act(async () => app.press('保存方案并设为默认'));
    expect(jest.mocked(persistPreferences).mock.calls.at(-1)?.[0]).toMatchObject({ profiles: [{ id: profile.id, name: '改名六人局', rules: { selfSave: 'always' } }] });
    expect(jest.mocked(persistPreferences).mock.calls.at(-1)?.[0].profiles?.[0].roles).toHaveLength(7);
    expect(persistSession).not.toHaveBeenCalled();
    app.selectMainTab('主持'); app.press('继续主持');
    expect(app.text()).toContain('Saved game');
    expect(app.button('选择刀口，或空刀')).toBeDefined();
    await flush(); act(() => app.renderer.unmount());
  });

  it('retains unsaved profile edits after storage failure and allows retry', async () => {
    jest.mocked(persistPreferences).mockRejectedValueOnce(new Error('disk full'));
    const app = await mountSaved(null);
    app.selectMainTab('个性化'); app.press('新建自定义方案');
    act(() => app.renderer.root.findByProps({ accessibilityLabel: '方案名称' }).props.onChangeText('不会丢的设置'));
    app.press(`当前板子 ${BOARD_LIBRARY[0].name}，点击更换`); app.press('选择板子：预女猎守');
    app.press('下一步'); app.press('守救同人 存活');
    await act(async () => app.press('保存方案并设为默认'));
    expect(app.text()).toContain('你的修改仍保留在这里');
    expect(app.button('保存方案并设为默认').props.disabled).toBe(false);
    await act(async () => app.press('保存方案并设为默认'));
    expect(jest.mocked(persistPreferences).mock.calls.at(-1)?.[0]).toMatchObject({ profiles: [{ name: '不会丢的设置', rules: { guardSave: 'live' } }] });
    expect(app.text()).toContain('默认开局');
    expect(persistSession).not.toHaveBeenCalled();
    await flush(); act(() => app.renderer.unmount());
  });

  it('deletes the last selected profile with confirmation and returns to standard defaults', async () => {
    const profile = profileFixture();
    jest.mocked(readPreferences).mockResolvedValue({ hostingMode: 'custom', profiles: [profile], selectedProfileId: profile.id });
    const alert = jest.spyOn(Alert, 'alert');
    const app = await mountSaved(fixture());
    app.selectMainTab('个性化'); app.press(`删除方案：${profile.name}`);
    expect(persistPreferences).not.toHaveBeenCalled();
    const confirm = alert.mock.calls.at(-1)?.[2]?.find(item => item.text === '删除方案');
    await act(async () => { confirm?.onPress?.(); });
    expect(jest.mocked(persistPreferences).mock.calls.at(-1)?.[0]).toMatchObject({ hostingMode: 'standard', profiles: [] });
    expect(persistSession).not.toHaveBeenCalled();
    app.selectMainTab('主持'); expect(app.button('继续主持')).toBeDefined();
    alert.mockRestore(); await flush(); act(() => app.renderer.unmount());
  });

  it('blocks preference writes after a failed read and preserves recovered profiles when changing mode', async () => {
    jest.mocked(readPreferences).mockRejectedValueOnce(new Error('read failed'));
    const app = await mountSaved(null);
    app.selectMainTab('个性化');
    expect(app.button('新建自定义方案').props.disabled).toBe(true);
    expect(persistPreferences).not.toHaveBeenCalled();
    const profile = profileFixture();
    jest.mocked(readPreferences).mockResolvedValue({ hostingMode: 'custom', profiles: [profile], selectedProfileId: profile.id });
    await act(async () => app.press('重试读取偏好'));
    expect(app.text()).toContain(profile.name);
    await act(async () => app.press('熟人快局'));
    expect(jest.mocked(persistPreferences).mock.calls.at(-1)?.[0]).toMatchObject({ hostingMode: 'quick', profiles: [profile] });
    app.selectMainTab('主持');
    app.press('新建一场对局');
    expect(app.text()).toContain(BOARD_LIBRARY[0].name);
    await flush(); act(() => app.renderer.unmount());
  });

  it('waits for a changed hosting mode to save before allowing a new game', async () => {
    let finishSave!: () => void;
    jest.mocked(persistPreferences).mockImplementationOnce(() => new Promise<void>(resolve => { finishSave = resolve; }));
    const app = await mountSaved(null);
    app.selectMainTab('个性化');
    app.press('熟人快局');
    const hostTab = app.renderer.root.findAll(node => node.props.accessibilityRole === 'tab' && node.props.accessibilityLabel === '主持' && typeof node.props.onPress === 'function')[0];
    expect(hostTab.props.accessibilityState.disabled).toBe(true);
    app.selectMainTab('主持');
    expect(app.buttons().some(node => node.props.accessibilityLabel === '新建一场对局')).toBe(false);
    expect(app.button('熟人快局').props.disabled).toBe(true);
    expect(app.renderer.root.findAllByType(SetupScreen)).toHaveLength(0);
    await act(async () => { finishSave(); });
    app.selectMainTab('主持');
    app.press('新建一场对局'); app.press('下一步');
    const sheriff = app.renderer.root.findAll(node => typeof node.props.onValueChange === 'function')[0];
    expect(sheriff.props.value).toBe(false);
    await flush(); act(() => app.renderer.unmount());
  });

  it('shows a valid session even when history fails, blocks overwrite, and retries independently', async () => {
    jest.mocked(readHistory).mockRejectedValue(new Error('history read failed'));
    const app = await mountSaved(fixture());
    expect(app.text()).toContain('历史记录读取失败');
    expect(app.button('新建一场对局').props.disabled).toBe(true);
    expect(app.button('继续主持')).toBeDefined();
    app.press('继续主持');
    app.press('空刀（今晚不杀人）');
    expect(persistSession).not.toHaveBeenCalled();
    app.press('返回');
    jest.mocked(readHistory).mockResolvedValue([]);
    await act(async () => app.press('重试读档'));
    expect(app.button('新建一场对局').props.disabled).toBe(false);
    await flush(); act(() => app.renderer.unmount());
  });

  it('does not treat a rejected session read as an empty device', async () => {
    jest.mocked(readSession).mockRejectedValue(new Error('current read failed'));
    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => { renderer = TestRenderer.create(<App />); });
    const root = renderer.root;
    const create = root.findAll(node => node.props.accessibilityLabel === '新建一场对局' && node.props.accessibilityRole === 'button')[0];
    expect(create.props.disabled).toBe(true);
    expect(root.findAllByType(Text).some(node => String(node.props.children).includes('进行中对局读取失败'))).toBe(true);
    expect(root.findAll(node => node.props.accessibilityLabel === '备份后清除异常会话').length).toBeGreaterThan(0);
    expect(persistSession).not.toHaveBeenCalled();
    await flush(); act(() => renderer.unmount());
  });

  it('only unlocks new games after explicit backup/clear and successful reread', async () => {
    jest.mocked(readSession).mockRejectedValue(new Error('current damaged'));
    const alert = jest.spyOn(Alert, 'alert');
    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => { renderer = TestRenderer.create(<App />); });
    const button = (label: string) => renderer.root.findAll(node => node.props.accessibilityRole === 'button' && node.props.accessibilityLabel === label)[0];
    expect(button('新建一场对局').props.disabled).toBe(true);
    act(() => button('备份后清除异常会话').props.onPress());
    const confirm = alert.mock.calls.at(-1)?.[2]?.find(item => item.text === '备份并清除');
    jest.mocked(clearDamagedSession).mockRejectedValueOnce(new Error('disk full'));
    await act(async () => { confirm?.onPress?.(); });
    expect(button('新建一场对局').props.disabled).toBe(true);
    expect(renderer.root.findAllByType(Text).some(node => String(node.props.children).includes('备份失败'))).toBe(true);
    jest.mocked(readSession).mockResolvedValue(null);
    await act(async () => { confirm?.onPress?.(); });
    expect(button('新建一场对局').props.disabled).toBe(false);
    alert.mockRestore();
    await flush(); act(() => renderer.unmount());
  });

  it('keeps save failures visible after Android back and permits explicit save retry', async () => {
    const handler = jest.spyOn(BackHandler, 'addEventListener');
    jest.mocked(persistSession).mockRejectedValue(new Error('disk full'));
    const app = await mountSaved(fixture());
    app.press('继续主持');
    await act(async () => app.press('空刀（今晚不杀人）'));
    expect(app.text()).toContain('对局或复盘保存失败');
    const lastSubscription = handler.mock.calls.at(-1);
    act(() => { lastSubscription?.[1]({ type: 'hardwareBackPress', timeStamp: 0 }); });
    expect(app.text()).toContain('对局或复盘保存失败');
    expect(app.button('新建一场对局').props.disabled).toBe(true);
    jest.mocked(persistSession).mockResolvedValue(undefined);
    await act(async () => app.press('重试保存'));
    expect(app.text()).not.toContain('对局或复盘保存失败');
    handler.mockRestore();
    await flush(); act(() => app.renderer.unmount());
  });

  it('clears target drafts on undo while keeping the host role-visibility preference', async () => {
    const saved = fixture({ stage: 'seer' });
    saved.undo = [{ ...saved.current, stage: 'wolves' }];
    const app = await mountSaved(saved);
    app.press('继续主持');
    const tab = (label: string) => app.renderer.root.findAll(node => node.props.accessibilityRole === 'tab' && node.props.accessibilityLabel === label)[0];
    act(() => tab('座位').props.onPress());
    const rolesSwitch = () => app.renderer.root.findAll(node => node.props.accessibilityLabel === '显示身份' && typeof node.props.onValueChange === 'function')[0];
    act(() => rolesSwitch().props.onValueChange(true));
    act(() => tab('主持').props.onPress());
    const target = app.buttons().find(node => node.props.accessibilityLabel === '6号 存活');
    act(() => target!.props.onPress());
    expect(app.button('确认查验 6 号')).toBeDefined();
    act(() => tab('更多').props.onPress());
    app.press('撤回上一步');
    act(() => tab('主持').props.onPress());
    expect(app.button('选择刀口，或空刀').props.disabled).toBe(true);
    act(() => tab('座位').props.onPress());
    expect(rolesSwitch().props.value).toBe(true);
    await flush(); act(() => app.renderer.unmount());
  });

  it('expires ruling drafts between days, not the whole game screen', async () => {
    const saved = fixture({ stage: 'discussion', sheriffDone: true });
    const app = await mountSaved(saved);
    app.press('继续主持');
    app.press('自爆 / 人工裁定');
    const target = app.buttons().find(node => node.props.accessibilityLabel === '5号 存活');
    act(() => target!.props.onPress());
    act(() => app.renderer.root.findByProps({ accessibilityLabel: '人工裁定原因' }).props.onChangeText('测试'));
    expect(app.button('5 号改为出局').props.disabled).toBe(false);
    app.press('关闭');
    app.press('不放逐，进入下一夜');
    app.press('空刀（今晚不杀人）');
    app.press('空过（今晚不查验）');
    app.press('确认女巫用药');
    app.press('确认夜间结算');
    app.press('自爆 / 人工裁定');
    expect(app.renderer.root.findByProps({ accessibilityLabel: '人工裁定原因' }).props.value).toBe('');
    await flush(); act(() => app.renderer.unmount());
  });

  it('splits the game into separate host, seats, log and more pages', async () => {
    const app = await mountSaved(fixture({ stage: 'discussion', sheriffDone: true }));
    app.press('继续主持');
    expect(app.button('开始放逐投票')).toBeDefined();
    const tab = (label: string) => app.renderer.root.findAll(node => node.props.accessibilityRole === 'tab' && node.props.accessibilityLabel === label)[0];
    act(() => tab('座位').props.onPress());
    expect(app.text()).toContain('点座位查看身份与出局原因');
    act(() => tab('记录').props.onPress());
    expect(app.text()).toContain('带“公开”标记的内容可播报给玩家');
    act(() => tab('更多').props.onPress());
    expect(app.text()).toContain('对局信息与操作');
    act(() => tab('主持').props.onPress());
    expect(app.button('开始放逐投票')).toBeDefined();
    await flush(); act(() => app.renderer.unmount());
  });

  it('renders the legacy death announcement from night actions when its cached text is absent', async () => {
    const base = fixture();
    base.current = { ...base.current, stage: 'dawn-announcement', sheriffDone: true, announcementReady: true, night: { ...base.current.night, knife: 5 } };
    const app = await mountSaved(base);
    app.press('继续主持');
    expect(app.text()).toContain('昨夜 5 号 出局');
    expect(app.text()).not.toContain('昨夜平安夜');
    await flush(); act(() => app.renderer.unmount());
  });

  it('lets the host pick an official board from the library and runs its night order', async () => {
    const app = await mountSaved(null);
    await act(async () => { await Promise.resolve(); });
    app.press('新建一场对局');
    app.press(`当前板子 ${BOARD_LIBRARY[0].name}，点击更换`);
    app.press('选择板子：狼美人骑士');
    app.press('下一步');
    app.press('下一步');
    app.press('开始主持');
    expect(app.button('选择守护目标，或空守')).toBeDefined();
    act(() => app.buttons().find(node => node.props.accessibilityLabel === '2号 存活')!.props.onPress());
    app.press('确认守护 2 号');
    app.press('空刀（今晚不杀人）');
    expect(app.button('选择魅惑目标，或空过')).toBeDefined();
    await flush(); act(() => app.renderer.unmount());
  });

  it('builds a custom board and starts it with the chosen roles', async () => {
    const app = await mountSaved(null);
    await act(async () => { await Promise.resolve(); });
    app.press('新建一场对局');
    app.press(`当前板子 ${BOARD_LIBRARY[0].name}，点击更换`);
    app.press('自己配一套阵容');
    act(() => app.renderer.root.findByProps({ accessibilityLabel: '板子名称' }).props.onChangeText('测试板'));
    act(() => app.renderer.root.findByProps({ accessibilityLabel: '增加预言家' }).props.onPress());
    app.press('用这套阵容');
    app.press('下一步');
    app.press('下一步');
    app.press('开始主持');
    expect(app.button('选择刀口，或空刀')).toBeDefined();
    expect(app.buttons().filter(node => /^\d+号 (存活|出局)$/.test(String(node.props.accessibilityLabel))).length).toBe(13);
    await flush(); act(() => app.renderer.unmount());
  });

  it('exposes every library board as selectable', () => {
    const ids = BOARD_LIBRARY.map(board => board.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(BOARD_LIBRARY.length).toBeGreaterThanOrEqual(20);
    expect(BOARD_LIBRARY.every(board => board.playerCount >= 6)).toBe(true);
    expect(ROLE_IDS.length).toBeGreaterThan(20);
  });

  it('requires a fresh target for each voter after recording a ballot', async () => {
    const app = await mountSaved(fixture({ stage: 'discussion', sheriffDone: true }));
    app.press('继续主持');
    app.press('开始放逐投票');
    app.press('5号 存活');
    app.press('记录 1 号投给 5 号');
    expect(app.button('选择 2 号投给谁').props.disabled).toBe(true);
    expect(app.buttons().some(node => node.props.accessibilityLabel === '记录 2 号投给 5 号')).toBe(false);
    expect(jest.mocked(persistSession).mock.calls.at(-1)?.[0].current.vote?.ballots).toEqual({ 1: 5 });
    app.press('6号 存活');
    app.press('记录 2 号投给 6 号');
    expect(jest.mocked(persistSession).mock.calls.at(-1)?.[0].current.vote?.ballots).toEqual({ 1: 5, 2: 6 });
    await flush(); act(() => app.renderer.unmount());
  });

  it('allows the host to select an eliminated player and restore them by ruling', async () => {
    const saved = fixture({ stage: 'discussion', sheriffDone: true });
    saved.current.players[4] = { ...saved.current.players[4], alive: false, death: { day: 1, cause: 'knife' } };
    const app = await mountSaved(saved);
    app.press('继续主持');
    app.press('自爆 / 人工裁定');
    const eliminated = app.button('5号 出局');
    expect(eliminated.props.disabled).toBe(false);
    expect(eliminated.props.accessibilityState.disabled).toBe(false);
    app.press('5号 出局');
    act(() => app.renderer.root.findByProps({ accessibilityLabel: '人工裁定原因' }).props.onChangeText('纠正误操作'));
    app.press('5 号恢复存活');
    expect(jest.mocked(persistSession).mock.calls.at(-1)?.[0].current.players[4].alive).toBe(true);
    await flush(); act(() => app.renderer.unmount());
  });

  it('shows invalid lineup errors inside the open builder sheet', async () => {
    const app = await mountSaved(null);
    app.press('新建一场对局');
    app.press('自定义人数和角色');
    ['减少狼人', '减少狼人', '减少狼人', '减少狼人', '减少村民', '减少村民', '减少村民', '减少村民', '减少预言家', '减少女巫', '减少猎人', '减少白痴'].forEach(label => app.press(label));
    app.press('用这套阵容');
    const builder = app.renderer.root.findAllByType(Sheet).find(node => node.props.title === '自定义板子');
    expect(builder?.props.visible).toBe(true);
    expect(builder?.findAllByType(Text).some(node => node.props.children === '支持 6–16 人局')).toBe(true);
    await flush(); act(() => app.renderer.unmount());
  });

  it('confirms before discarding modified setup from the top back button or Android back', async () => {
    const onBack = jest.fn();
    const alert = jest.spyOn(Alert, 'alert');
    const handler = jest.spyOn(BackHandler, 'addEventListener');
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => { renderer = TestRenderer.create(<SetupScreen mode="standard" initialRules={DEFAULT_RULES} onBack={onBack} onStart={jest.fn()} />); });
    act(() => renderer.root.findByProps({ accessibilityLabel: '对局名称' }).props.onChangeText('周五测试局'));
    const back = renderer.root.findAll(node => node.props.accessibilityLabel === '返回' && typeof node.props.onPress === 'function')[0];
    act(() => back.props.onPress());
    expect(alert).toHaveBeenLastCalledWith('放弃本次开局设置？', expect.any(String), expect.any(Array));
    expect(onBack).not.toHaveBeenCalled();
    const latestHandler = handler.mock.calls.at(-1)?.[1];
    act(() => { latestHandler?.({ type: 'hardwareBackPress', timeStamp: 0 }); });
    expect(onBack).not.toHaveBeenCalled();
    const discard = alert.mock.calls.at(-1)?.[2]?.find(button => button.text === '放弃设置');
    act(() => discard?.onPress?.());
    expect(onBack).toHaveBeenCalledTimes(1);
    alert.mockRestore(); handler.mockRestore();
    act(() => renderer.unmount());
  });

  it('uses after-announcement scripts and keeps the announced result visible during election', async () => {
    const saved = fixture({ stage: 'dawn' });
    saved.current.rules = { ...saved.current.rules, sheriffTiming: 'after-announcement' };
    saved.current.night.knife = 5;
    const app = await mountSaved(saved);
    app.press('继续主持');
    const headline = app.renderer.root.findAll(node => node.props.accessibilityLabel === '本环节大字提示')[0];
    expect(headline.props.children).toBe('昨夜 5 号出局');
    const speech = app.renderer.root.findAll(node => node.props.accessibilityLabel === '完整主持台词')[0];
    expect(speech.props.children).toContain('天亮了，请所有玩家睁眼。昨夜 5 号出局。');
    expect(speech.props.children).toContain('请出局玩家');
    expect(app.text()).not.toContain('暂不公布昨夜结果');
    app.press('确认夜间结算');
    expect(app.text()).toContain('昨夜结果已公布');
    expect(app.text()).toContain('已公布的昨夜结果');
    expect(app.text()).toContain('昨夜 5 号 出局');
    expect(app.text()).not.toContain('昨夜结果尚未公布');
    await flush(); act(() => app.renderer.unmount());
  });

  it('separates night actions from daytime events in the log', async () => {
    const saved = fixture({ stage: 'discussion', sheriffDone: true });
    saved.current.events.push({ id: 2, day: 1, at: Date.now(), stage: 'discussion', text: '白天讨论' });
    const app = await mountSaved(saved);
    app.press('继续主持');
    const logTab = app.renderer.root.findAll(node => node.props.accessibilityRole === 'tab' && node.props.accessibilityLabel === '记录')[0];
    act(() => logTab.props.onPress());
    const labels = app.renderer.root.findAllByType(Text).map(node => Array.isArray(node.props.children) ? node.props.children.join('') : String(node.props.children));
    expect(labels).toContain('第 1 夜 · 行动汇总');
    expect(labels).toContain('第 1 夜');
    expect(labels).toContain('第 1 天');
    expect(labels.some(label => label.includes('天夜间行动'))).toBe(false);
    await flush(); act(() => app.renderer.unmount());
  });
});
