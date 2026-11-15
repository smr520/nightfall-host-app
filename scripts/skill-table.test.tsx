import React from 'react';
import { BackHandler, FlatList, Text } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import { ROLE_REFERENCE } from '../src/game/role-reference';
import { CARD_TYPE_LABEL, ROLE_CATALOG } from '../src/game/role-catalog';
import { ROLES, ROLE_IDS, type Role } from '../src/game/roles';
import { SkillTableScreen } from '../src/ui/SkillTableScreen';

function mount() {
  const onOpenGuide = jest.fn();
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => { renderer = TestRenderer.create(<SkillTableScreen onOpenGuide={onOpenGuide} />); });
  const button = (label: string) => renderer.root.findAll(node => node.props.accessibilityRole === 'button' && node.props.accessibilityLabel === label && typeof node.props.onPress === 'function')[0];
  const press = (label: string) => { const node = button(label); if (!node) throw new Error(`Missing button ${label}`); act(() => node.props.onPress()); };
  const search = (query: string) => act(() => renderer.root.findByProps({ accessibilityLabel: '搜索卡牌技能' }).props.onChangeText(query));
  const rows = () => renderer.root.findByType(FlatList).props.data as Role[];
  const text = () => renderer.root.findAllByType(Text).map(node => String(node.props.children)).join('\n');
  const unmount = () => act(() => renderer.unmount());
  return { renderer, onOpenGuide, button, press, search, rows, text, unmount };
}

describe('dedicated role skill table', () => {
  it('offers every registered card and opens the same complete reference for each card', () => {
    const app = mount();
    expect(app.rows()).toEqual(ROLE_IDS);
    for (const role of ROLE_IDS) {
      app.search(ROLES[role].name);
      app.press(`查看技能：${ROLES[role].name}`);
      expect(app.text()).toContain(ROLE_REFERENCE[role].timing);
      expect(app.text()).toContain(ROLE_REFERENCE[role].skills[0]);
      expect(app.text()).toContain(CARD_TYPE_LABEL[ROLE_CATALOG[role].type]);
      expect(app.button('展开主持说明与来源')).toBeDefined();
      expect(app.button('展开主持说明与来源').props.accessibilityState.expanded).toBe(false);
      app.press('展开主持说明与来源');
      expect(app.text()).toContain(ROLE_REFERENCE[role].automationNote);
      expect(app.text()).toContain('参考资料');
      expect(app.text()).not.toMatch(/\d+\s*号玩家|本步行动座位|昨夜\s*\d+/);
      app.press('收起主持说明与来源');
      app.press('返回');
    }
    app.unmount();
  });

  it('filters by actual skill text and reference faction, including the lone girl as third party', () => {
    const app = mount();
    app.search('开枪');
    expect(app.rows()).toContain('hunter');
    expect(app.rows()).not.toContain('villager');
    app.press('清空搜索');
    app.press('技能阵营：第三方');
    expect(app.rows()).toEqual(['lone-girl', 'fox', 'treasure-master']);
    app.press('技能阵营：狼人');
    expect(app.rows()).not.toContain('lone-girl');
    expect(app.rows().every(role => (ROLE_REFERENCE[role].camp ?? ROLES[role].camp) === 'wolf')).toBe(true);
    app.unmount();
  });

  it('filters by explicit card type and distinguishes the gifted lucky-one status from a dealt identity', () => {
    const app = mount();
    app.press('筛选卡牌类型');
    app.press('技能类型：基础身份');
    expect(app.rows()).toContain('seer');
    expect(app.rows()).not.toContain('knight');
    expect(app.rows()).not.toContain('lucky-one');
    app.press('筛选卡牌类型');
    app.press('技能类型：觉醒身份');
    expect(app.rows()).toEqual(['awakened-hidden-wolf', 'awakened-wolf-king', 'awakened-guard', 'awakened-knight', 'awakened-wolf-beauty', 'awakened-seer']);
    app.press('筛选卡牌类型');
    app.press('技能类型：附加状态');
    expect(app.rows()).toEqual(['lucky-one']);
    app.press('查看技能：幸运儿');
    expect(app.text()).toContain('商人赠予状态，不单独占座');
    expect(app.text()).toContain('附加状态');
    expect(app.text()).toContain('不是另一张基础身份牌');
    app.unmount();
  });

  it('preserves the search on detail return and exposes the guide without opening a game', () => {
    const app = mount();
    app.search('查验');
    const filtered = app.rows();
    app.press('查看技能：预言家');
    expect(app.text()).toContain('技能介绍');
    expect(app.text()).toContain('限制与争议点');
    expect(app.button('展开主持说明与来源')).toBeDefined();
    app.press('返回');
    expect(app.rows()).toEqual(filtered);
    expect(app.renderer.root.findByProps({ accessibilityLabel: '搜索卡牌技能' }).props.value).toBe('查验');
    app.press('规则与流程');
    expect(app.onOpenGuide).toHaveBeenCalledTimes(1);
    app.search('不存在的角色牌');
    expect(app.rows()).toEqual([]);
    expect(app.text()).toContain('没有找到卡牌');
    app.unmount();
  });

  it('returns from a role detail on Android back before leaving the skill table', () => {
    const listener = jest.spyOn(BackHandler, 'addEventListener');
    const app = mount();
    app.search('女巫');
    app.press('查看技能：女巫');
    const callback = listener.mock.calls.at(-1)![1];
    let handled: unknown;
    act(() => { handled = callback({ type: 'hardwareBackPress', timeStamp: 0 }); });
    expect(handled).toBe(true);
    expect(app.button('查看技能：女巫')).toBeDefined();
    listener.mockRestore();
    app.unmount();
  });
});
