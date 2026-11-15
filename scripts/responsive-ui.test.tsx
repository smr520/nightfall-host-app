import React from 'react';
import { Dimensions } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import { HomeScreen } from '../src/ui/HomeScreen';
import { MotionProvider } from '../src/ui/motion';
import { RoleGate } from '../src/ui/RoleGate';

const original = { window: Dimensions.get('window'), screen: Dimensions.get('screen') };
const setSize = async (width: number, height = 800) => {
  await act(async () => {
    Dimensions.set({
      window: { width, height, scale: 1, fontScale: 1 },
      screen: { width, height, scale: 1, fontScale: 1 },
    });
  });
};

async function mountHome(width: number) {
  await setSize(width);
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
  it('uses one column on phones and two columns on tablets', async () => {
    const phone = await mountHome(390);
    expect(phone.root.findAllByProps({ testID: 'home-dashboard' })).toHaveLength(0);
    await act(async () => { phone.unmount(); });

    const tablet = await mountHome(768);
    expect(tablet.root.findAllByProps({ testID: 'home-dashboard' }).length).toBeGreaterThan(0);
    expect(tablet.root.findAllByProps({ testID: 'home-side-column' }).length).toBeGreaterThan(0);
    await act(async () => { tablet.unmount(); });
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
