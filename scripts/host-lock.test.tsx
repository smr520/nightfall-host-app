import React from 'react';
import { Alert, Text } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import * as Crypto from 'expo-crypto';
import {
  isHostPinCredential,
  isValidHostPin,
} from '../src/game/host-pin';
import {
  createHostPinCredential,
  verifyHostPinCredential,
} from '../src/host-lock';
import type { HostPinCredential } from '../src/game/host-pin';
import { normalizePreferences } from '../src/game/preferences';
import { createBackup, parseBackup } from '../src/game/backup';
import { HostLockGate } from '../src/ui/HostLockGate';
import { MotionProvider } from '../src/ui/motion';
import { PersonalizationScreen } from '../src/ui/PersonalizationScreen';

jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'sha256' },
  randomUUID: jest.fn(() => '12345678-1234-4234-8234-123456789012'),
  digestStringAsync: jest.fn(async (_algorithm: string, value: string) => (
    value.endsWith(':2468') ? 'a'.repeat(64) : 'b'.repeat(64)
  )),
}));

describe('optional host PIN protection', () => {
  it('accepts only normalized four-to-eight digit PINs', () => {
    expect(isValidHostPin('1234')).toBe(true);
    expect(isValidHostPin('12345678')).toBe(true);
    expect(isValidHostPin('123')).toBe(false);
    expect(isValidHostPin('123456789')).toBe(false);
    expect(isValidHostPin('12a4')).toBe(false);
  });

  it('stores a salted hash and verifies without retaining the plaintext', async () => {
    const credential = await createHostPinCredential('2468');
    expect(credential).toEqual({
      salt: '12345678-1234-4234-8234-123456789012',
      hash: 'a'.repeat(64),
    });
    expect(JSON.stringify(credential)).not.toContain('2468');
    expect(isHostPinCredential(credential)).toBe(true);
    expect(await verifyHostPinCredential(credential, '2468')).toBe(true);
    expect(await verifyHostPinCredential(credential, '1357')).toBe(false);
  });

  it('drops malformed credentials while keeping other preferences usable', () => {
    const valid: HostPinCredential = { salt: 's'.repeat(16), hash: 'c'.repeat(64) };
    expect(normalizePreferences({ hostingMode: 'quick', hostPin: valid })).toMatchObject({
      hostingMode: 'quick',
      hostPin: valid,
    });
    expect(normalizePreferences({ hostingMode: 'standard', hostPin: { salt: 'short', hash: 'plain' } })).not.toHaveProperty('hostPin');
  });

  it('keeps the device lock credential out of portable backups', () => {
    const hostPin: HostPinCredential = { salt: 's'.repeat(16), hash: 'd'.repeat(64) };
    const backup = createBackup({
      session: null,
      history: [],
      preferences: normalizePreferences({ hostingMode: 'standard', hostPin }),
    });
    expect(backup.preferences).not.toHaveProperty('hostPin');
    expect(parseBackup(JSON.stringify({
      ...backup,
      preferences: { ...backup.preferences, hostPin },
    })).backup.preferences).not.toHaveProperty('hostPin');
  });

  it('unlocks after the correct PIN and keeps the error free of secret values', async () => {
    const onUnlock = jest.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <MotionProvider><HostLockGate onUnlock={onUnlock} /></MotionProvider>,
      );
    });
    const input = renderer.root.findByProps({ accessibilityLabel: '主持 PIN' });
    const button = () => renderer.root.findAll(node => (
      node.props.accessibilityLabel === '解锁主持端'
      && typeof node.props.onPress === 'function'
    ))[0];

    act(() => input.props.onChangeText('1357'));
    await act(async () => button().props.onPress());
    const text = () => renderer.root.findAllByType(Text).map(node => String(node.props.children)).join('\n');
    expect(text()).toContain('主持 PIN 不正确');
    expect(text()).not.toContain('1357');

    act(() => input.props.onChangeText('2468'));
    await act(async () => button().props.onPress());
    expect(onUnlock).toHaveBeenLastCalledWith('2468');
    act(() => renderer.unmount());
  });

  it('does not call hashing when pin length is invalid', async () => {
    jest.mocked(Crypto.digestStringAsync).mockClear();
    await expect(createHostPinCredential('12')).rejects.toThrow('4–8 位数字');
    expect(Crypto.digestStringAsync).not.toHaveBeenCalled();
  });

  it('sets the lock from personalization only after two matching PIN entries', async () => {
    const onSetHostPin = jest.fn(async () => undefined);
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <MotionProvider>
          <PersonalizationScreen
            profiles={[]}
            hostingMode="standard"
            disabled={false}
            hostPinEnabled={false}
            onSetHostPin={onSetHostPin}
            onHostingModeChange={jest.fn()}
            onCreate={jest.fn()}
            onEdit={jest.fn()}
            onSelect={jest.fn()}
            onDelete={jest.fn()}
          />
        </MotionProvider>,
      );
    });
    const open = renderer.root.findAll(node => (
      node.props.accessibilityLabel === '主持端锁：未开启'
      && typeof node.props.onPress === 'function'
    ))[0];
    act(() => open.props.onPress());
    act(() => renderer.root.findByProps({ accessibilityLabel: '设置主持 PIN' }).props.onChangeText('2468'));
    act(() => renderer.root.findByProps({ accessibilityLabel: '再次输入主持 PIN' }).props.onChangeText('2468'));
    const save = renderer.root.findAll(node => (
      node.props.accessibilityLabel === '开启主持端锁'
      && typeof node.props.onPress === 'function'
    ))[0];
    await act(async () => { await save.props.onPress(); });
    expect(onSetHostPin).toHaveBeenCalledWith('2468');
    expect(alert).toHaveBeenCalledWith('主持端锁已开启', expect.stringContaining('下次进入主持端'));
    alert.mockRestore();
    act(() => renderer.unmount());
  });
});
