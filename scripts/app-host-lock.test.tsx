import React from 'react';
import { Text } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import App from '../App';
import { HomeScreen } from '../src/ui/HomeScreen';
import { HostLockGate } from '../src/ui/HostLockGate';

jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'sha256' },
  randomUUID: jest.fn(() => '12345678-1234-4234-8234-123456789012'),
  digestStringAsync: jest.fn(async () => 'a'.repeat(64)),
}));
jest.mock('expo-keep-awake', () => ({ useKeepAwake: jest.fn() }));
jest.mock('expo-screen-capture', () => ({ usePreventScreenCapture: jest.fn() }));
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { SafeAreaProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>, SafeAreaView: View };
});
jest.mock('../src/storage', () => ({
  clearDamagedSession: jest.fn(),
  clearSession: jest.fn(),
  exportBackup: jest.fn(),
  exportRawData: jest.fn(async () => '{}'),
  getWarnings: jest.fn(() => []),
  persistAppRole: jest.fn(async () => undefined),
  persistPreferences: jest.fn(async () => undefined),
  persistSession: jest.fn(async () => undefined),
  readAppRole: jest.fn(async () => 'host'),
  readHistory: jest.fn(async () => []),
  readPreferences: jest.fn(async () => ({
    hostingMode: 'standard',
    hostPin: { salt: '12345678-1234-4234-8234-123456789012', hash: 'a'.repeat(64) },
  })),
  readSession: jest.fn(async () => null),
  restoreBackup: jest.fn(),
  retryPersistSession: jest.fn(async () => undefined),
}));

describe('app-level host lock', () => {
  it('opens the PIN gate before mounting host data and unlocks with the PIN', async () => {
    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(<App />);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(renderer.root.findByType(HostLockGate)).toBeDefined();
    expect(renderer.root.findAllByType(HomeScreen)).toHaveLength(0);

    const input = renderer.root.findByProps({ accessibilityLabel: '主持 PIN' });
    act(() => input.props.onChangeText('2468'));
    const unlock = renderer.root.findAll(node => (
      node.props.accessibilityLabel === '解锁主持端'
      && typeof node.props.onPress === 'function'
    ))[0];
    await act(async () => {
      await unlock.props.onPress();
      await Promise.resolve();
    });
    expect(renderer.root.findAllByType(HomeScreen)).toHaveLength(1);
    expect(renderer.root.findAllByType(Text).map(node => String(node.props.children)).join('\n')).not.toContain('主持端已锁定');
    act(() => renderer.unmount());
  });
});
