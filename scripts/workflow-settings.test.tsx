import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { DEFAULT_RULES } from '../src/game/config';
import type { Role, Rules } from '../src/game/types';
import { WorkflowSettings } from '../src/ui/setup/WorkflowSettings';

const roles: Role[] = ['wolf', 'wolf', 'villager', 'villager', 'seer', 'witch'];

function mount(rules: Rules, onChange = jest.fn()) {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(<WorkflowSettings roles={roles} rules={rules} onChange={onChange} />);
  });
  const control = (label: string) => renderer.root.findAll(node =>
    node.props.accessibilityLabel === label
    && typeof node.props.onPress === 'function')[0];
  const toggle = renderer.root.findAll(node =>
    node.props.accessibilityLabel === '允许放逐时投给自己'
    && typeof node.props.onValueChange === 'function')[0];
  return { renderer, control, toggle, onChange };
}

describe('workflow settings', () => {
  it('saves the detailed exile self-vote choice', () => {
    const app = mount(DEFAULT_RULES);

    act(() => app.toggle.props.onValueChange(true));

    expect(app.onChange.mock.calls[0][0].table?.exileSelfVote).toBe(true);
  });

  it('hides the self-vote choice when fast exile recording is selected', () => {
    const app = mount({
      ...DEFAULT_RULES,
      table: { exileRecord: 'quick' },
    });

    expect(app.toggle).toBeUndefined();
  });

  it('lets the host move badge handling before death skills', () => {
    const app = mount(DEFAULT_RULES);

    act(() => app.control('上移警徽结算').props.onPress());

    expect(app.onChange.mock.calls[0][0].flow?.deathResolutionOrder).toEqual([
      'last-words',
      'badge',
      'death-skill',
    ]);
  });
});
