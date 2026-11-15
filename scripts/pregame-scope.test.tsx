import React from 'react';
import { Text } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import { BOARD_LIBRARY, boardSeats } from '../src/game/boards';
import { DEFAULT_RULES, ruleSummary } from '../src/game/config';
import type { Role, Rules } from '../src/game/types';
import { ReferenceModal } from '../src/ui/ReferenceModal';
import { SetupScreen } from '../src/ui/SetupScreen';
import { WorkflowSettings } from '../src/ui/setup/WorkflowSettings';

jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { SafeAreaView: View };
});

const quickRoles: Role[] = ['wolf', 'wolf', 'villager', 'villager', 'seer', 'witch'];
const quickRules: Rules = { ...DEFAULT_RULES, sheriff: false };

function mount(element: React.ReactElement) {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => { renderer = TestRenderer.create(element); });
  const buttons = () => renderer.root.findAll(node => node.props.accessibilityRole === 'button' && typeof node.props.onPress === 'function');
  const button = (label: string) => buttons().find(node => node.props.accessibilityLabel === label);
  const press = (label: string) => {
    const match = button(label);
    if (!match) throw new Error(`Missing button: ${label}`);
    act(() => match.props.onPress());
  };
  const text = () => renderer.root.findAllByType(Text).map(node => String(node.props.children)).join('\n');
  const unmount = () => act(() => renderer.unmount());
  return { renderer, buttons, button, press, text, unmount };
}

describe('pregame lineup scope', () => {
  it('swaps two selected seat identities while preserving the chosen board, counts and names', () => {
    const onStart = jest.fn();
    const app = mount(<SetupScreen mode="standard" initialRules={DEFAULT_RULES} onBack={jest.fn()} onStart={onStart} />);
    app.press('下一步'); app.press('下一步');
    act(() => app.renderer.root.findByProps({ accessibilityLabel: '1号玩家姓名' }).props.onChangeText('一号玩家'));
    act(() => app.renderer.root.findByProps({ accessibilityLabel: '9号玩家姓名' }).props.onChangeText('九号玩家'));
    app.press('1号身份 狼人，点击更改');
    expect(app.text()).toContain('互换身份');
    expect(app.button('设为守卫')).toBeUndefined();
    expect(app.buttons().filter(node => String(node.props.accessibilityLabel).startsWith('与')).map(node => node.props.accessibilityLabel)).toEqual([
      '与5号互换身份（村民）', '与6号互换身份（村民）', '与7号互换身份（村民）', '与8号互换身份（村民）',
      '与9号互换身份（预言家）', '与10号互换身份（女巫）', '与11号互换身份（猎人）', '与12号互换身份（白痴）',
    ]);
    app.press('与9号互换身份（预言家）');
    expect(app.button('1号身份 预言家，点击更改')).toBeDefined();
    expect(app.button('9号身份 狼人，点击更改')).toBeDefined();
    app.press('开始主持');
    const game = onStart.mock.calls[0][0];
    expect(game.board).toBe(BOARD_LIBRARY[0].name);
    expect(game.players.map((player: { role: Role }) => player.role).sort()).toEqual(boardSeats(BOARD_LIBRARY[0]).sort());
    expect(game.players[0]).toMatchObject({ name: '一号玩家', role: 'seer' });
    expect(game.players[8]).toMatchObject({ name: '九号玩家', role: 'wolf' });
    app.unmount();
  });

  it('keeps the full role catalog inside the explicit custom lineup editor', () => {
    const app = mount(<SetupScreen mode="standard" initialRules={DEFAULT_RULES} onBack={jest.fn()} onStart={jest.fn()} />);
    expect(app.button('增加流光伯爵')).toBeUndefined();
    app.press(`当前板子 ${BOARD_LIBRARY[0].name}，点击更换`);
    app.press('自己配一套阵容');
    expect(app.button('增加流光伯爵')).toBeDefined();
    expect(app.button('增加守卫')).toBeDefined();
    app.unmount();
  });

  it('decides applicable rules before seating and omits absent roles and disabled sheriff settings', () => {
    const app = mount(<SetupScreen mode="custom" initialRules={quickRules} initialProfile={{ id: 'quick', name: '六人方案', boardName: '六人速开', roles: quickRoles, rules: quickRules }} onBack={jest.fn()} onStart={jest.fn()} />);
    app.press('下一步');
    expect(app.text()).toContain('先定好本桌规则');
    expect(app.text()).toContain('本局采用的桌规');
    expect(app.text()).toContain('不上警');
    expect(app.text()).not.toMatch(/猎人|守卫|白痴/);
    expect(app.button('女巫自救 不可')).toBeDefined();
    expect(app.button('警长票权 1.5 票')).toBeUndefined();
    expect(app.button('守救同人 存活')).toBeUndefined();
    act(() => app.renderer.root.findByProps({ accessibilityLabel: '开启警长竞选' }).props.onValueChange(true));
    app.press('展开更多桌规');
    expect(app.button('警长票权 1.5 票')).toBeDefined();
    app.unmount();
  });

  it('offers scripts only for actual night actions, death skills and enabled sheriff stages', () => {
    const onChange = jest.fn();
    const app = mount(<WorkflowSettings roles={quickRoles} rules={quickRules} onChange={onChange} />);
    const scriptLabels = () => app.buttons().map(node => String(node.props.accessibilityLabel)).filter(label => label.startsWith('编辑口播：'));
    expect(scriptLabels()).toEqual([
      '编辑口播：狼人行动', '编辑口播：预言家行动', '编辑口播：女巫行动', '编辑口播：天亮核对', '编辑口播：公布结果', '编辑口播：白天发言', '编辑口播：放逐投票',
    ]);
    const special = BOARD_LIBRARY.find(board => board.id === 'wolf-beauty-knight')!;
    act(() => app.renderer.update(<WorkflowSettings roles={boardSeats(special)} rules={DEFAULT_RULES} onChange={onChange} />));
    expect(scriptLabels()).toEqual(expect.arrayContaining(['编辑口播：守卫行动', '编辑口播：狼美人行动', '编辑口播：跟随出局', '编辑口播：警长竞选', '编辑口播：警徽处理']));
    expect(scriptLabels()).not.toEqual(expect.arrayContaining(['编辑口播：猎人技能', '编辑口播：出局技能']));
    app.press('编辑口播：跟随出局');
    act(() => app.renderer.update(<WorkflowSettings roles={quickRoles} rules={quickRules} onChange={onChange} />));
    act(() => app.renderer.root.findByProps({ accessibilityLabel: '自定义主持词：白天发言' }).props.onChangeText('六人桌白天发言'));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ flow: expect.objectContaining({ scripts: { discussion: '六人桌白天发言' } }) }));
    app.unmount();
  });

  it('defaults contextual references to the current lineup and expands only through the all-roles action', () => {
    const app = mount(<ReferenceModal visible roles={quickRoles} rules={quickRules} onClose={jest.fn()} />);
    app.press('角色图鉴');
    expect(app.button('只看本局角色')?.props.accessibilityState.selected).toBe(true);
    expect(app.button('查看角色：女巫')).toBeDefined();
    expect(app.button('查看角色：守卫')).toBeUndefined();
    app.press('全部');
    expect(app.button('查看角色：守卫')).toBeUndefined();
    app.press('查看全部角色');
    expect(app.button('查看角色：守卫')).toBeDefined();
    app.press('只看本局角色');
    expect(app.button('查看角色：守卫')).toBeUndefined();
    app.press('基础规则');
    expect(app.text()).toContain('本局采用的桌规');
    expect(app.text()).not.toContain('猎人被毒');
    app.press('查看全部通用规则');
    expect(app.text()).toContain('猎人被毒');
    app.press('只看本局规则');
    expect(app.text()).not.toContain('猎人被毒');
    app.unmount();
    const global = mount(<ReferenceModal visible onClose={jest.fn()} />);
    global.press('角色图鉴');
    expect(global.button('查看角色：守卫')).toBeDefined();
    expect(global.button('只看本局角色')).toBeUndefined();
    global.unmount();
  });

  it('summarizes only applicable role rules while preserving the global reference summary', () => {
    expect(ruleSummary(quickRules, quickRoles).join('\n')).not.toMatch(/守卫|守救|猎人|白痴/);
    const hunterOnly: Role[] = ['wolf', 'villager', 'seer', 'hunter'];
    expect(ruleSummary(quickRules, hunterOnly).join('\n')).toContain('猎人出局可开枪');
    expect(ruleSummary(quickRules, hunterOnly).join('\n')).not.toMatch(/女巫|被毒|白痴/);
    expect(ruleSummary(DEFAULT_RULES)).toHaveLength(11);
    expect(ruleSummary(DEFAULT_RULES).join('\n')).toContain('夜间行动流程：发牌后自行看牌');
    expect(ruleSummary({
      ...DEFAULT_RULES,
      flow: { identityCheck: 'during-night' },
    }).join('\n')).toContain('夜间行动流程：确认即行动');
    expect(ruleSummary(DEFAULT_RULES).join('\n')).toContain('放逐记录：逐人录票并自动处理平票');
    expect(ruleSummary(DEFAULT_RULES).join('\n')).toContain('守救同人死亡');
  });
});
