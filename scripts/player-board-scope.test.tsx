import React from 'react';
import { Text } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import { BOARD_LIBRARY, boardRoles } from '../src/game/boards';
import { MotionProvider } from '../src/ui/motion';
import { PlayerSetup } from '../src/ui/player/PlayerSetup';

jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { SafeAreaView: View };
});

const flattenText = (value: unknown): string => Array.isArray(value) ? value.map(flattenText).join('') : value == null ? '' : String(value);

describe('玩家选本与角色范围', () => {
  it('only offers roles and reference pages that belong to the selected board', async () => {
    const onOpenReference = jest.fn();
    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(
        <MotionProvider><PlayerSetup onCreate={jest.fn()} onOpenReference={onOpenReference} /></MotionProvider>,
      );
    });
    const button = (label: string) => renderer.root.findAll(node => node.props.accessibilityRole === 'button' && node.props.accessibilityLabel === label && typeof node.props.onPress === 'function')[0];
    const press = (label: string) => {
      const node = button(label);
      if (!node) throw new Error(`Missing button ${label}`);
      act(() => node.props.onPress());
    };
    const text = () => renderer.root.findAllByType(Text).map(node => flattenText(node.props.children)).join('\n');
    const standard = BOARD_LIBRARY.find(board => board.id === 'standard-12')!;
    const wolfPlan = BOARD_LIBRARY.find(board => board.id === 'wolf-plan')!;

    expect(text()).toContain('本局板子');
    expect(text()).toContain(standard.name);
    press('查看规则与角色');
    expect(onOpenReference).toHaveBeenLastCalledWith(expect.objectContaining({ roles: boardRoles(standard) }));

    press('选择身份');
    expect(button('选择身份 预言家')).toBeDefined();
    expect(button('选择身份 月神预言家')).toBeUndefined();
    press('关闭');

    press(`选择板子：${standard.name}`);
    press(`使用板子：${wolfPlan.name}`);
    expect(text()).toContain(wolfPlan.name);
    press('选择身份');
    expect(button('选择身份 月神预言家')).toBeDefined();
    expect(button('选择身份 预言家')).toBeUndefined();
    press('关闭');

    press('查看规则与角色');
    expect(onOpenReference).toHaveBeenLastCalledWith(expect.objectContaining({ roles: boardRoles(wolfPlan) }));
    act(() => renderer.unmount());
  });
});
