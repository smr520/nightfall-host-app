import React from 'react';
import { Dimensions } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import { HomeScreen } from '../src/ui/HomeScreen';
import { MotionProvider } from '../src/ui/motion';
import { RoleGate } from '../src/ui/RoleGate';

const original = { window: Dimensions.get('window'), screen: Dimensions.get('screen') };
const setSize = async (width: number, height = 800, fontScale = 1) => {
  await act(async () => {
    Dimensions.set({
      window: { width, height, scale: 1, fontScale },
      screen: { width, height, scale: 1, fontScale },
    });
  });
};

async function mountHome(width: number, height = 800, fontScale = 1) {
  await setSize(width, height, fontScale);
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = TestRenderer.create(
      <MotionProvider>
        <HomeScreen session={null} history={[]} hostingMode="standard" disabled={false} onPersonalize={jest.fn()} onNew={jest.fn()} onResume={jest.fn()} onHistory={jest.fn()} onUndo={jest.fn()} />
      </MotionProvider>,
    );
  });
  return renderer;
}

afterEach(async () => {
  await act(async () => { Dimensions.set(original); });
});

describe('responsive screens', () => {
  it.each([
    [320, 740, false],
    [390, 844, false],
    [600, 960, false],
    [768, 1024, true],
    [1024, 768, true],
    [1280, 800, true],
  ])('uses the expected home columns at %s×%s', async (width, height, dashboard) => {
    const renderer = await mountHome(width, height);
    expect(renderer.root.findAllByProps({ testID: 'home-dashboard' }).length > 0).toBe(dashboard);
    expect(renderer.root.findAllByProps({ testID: 'home-side-column' }).length > 0).toBe(dashboard);
    await act(async () => { renderer.unmount(); });
  });

  it('keeps primary home actions mounted at two times system text', async () => {
    const phone = await mountHome(320, 740, 2);
    expect(phone.root.findAllByProps({ accessibilityLabel: '新建一场对局' }).length).toBeGreaterThan(0);
    await act(async () => { phone.unmount(); });
  });

  it('puts the first-use host and player choices side by side on tablets', async () => {
    await setSize(768, 1024);
    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(
        <MotionProvider>
          <RoleGate onSelect={jest.fn()} />
        </MotionProvider>,
      );
    });
    expect(renderer.root.findAllByProps({ testID: 'role-options-wide' }).length).toBeGreaterThan(0);
    await act(async () => { renderer.unmount(); });
  });
});
