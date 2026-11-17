import React from 'react';
import { Alert, Share, Text } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import { BOARD_LIBRARY, boardSeats } from '../src/game/boards';
import { DEFAULT_RULES } from '../src/game/config';
import { createBackup } from '../src/game/backup';
import { createGame } from '../src/game/engine';
import { DataBackupScreen } from '../src/ui/DataBackupScreen';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';

jest.mock('react-native/Libraries/Utilities/Platform', () => {
  const platform = {
    OS: 'android',
    select: (spec: { android?: unknown; native?: unknown; default?: unknown }) => spec.android ?? spec.native ?? spec.default,
  };
  return { __esModule: true, default: platform, ...platform };
});
jest.mock('expo-file-system/legacy', () => ({
  readAsStringAsync: jest.fn(),
  StorageAccessFramework: {
    requestDirectoryPermissionsAsync: jest.fn(), createFileAsync: jest.fn(), writeAsStringAsync: jest.fn(),
  },
}));

function backup(session: ReturnType<typeof createGame> | null, name: string) {
  return JSON.stringify(createBackup({
    session: session ? { current: session, undo: [], redo: [] } : null,
    history: [], preferences: { hostingMode: 'standard', profiles: [] },
  }, name.length));
}

function mount(props: Partial<React.ComponentProps<typeof DataBackupScreen>> = {}) {
  const onBack = jest.fn();
  const onExportBackup = jest.fn(async () => backup(null, 'export'));
  const onRestoreBackup = jest.fn(async () => undefined);
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(<DataBackupScreen onBack={onBack} hasActiveSession={false} onExportBackup={onExportBackup} onRestoreBackup={onRestoreBackup} {...props} />);
  });
  const button = (label: string) => renderer.root.findAll(node => node.props.accessibilityRole === 'button' && node.props.accessibilityLabel === label && typeof node.props.onPress === 'function')[0];
  const press = (label: string) => act(() => button(label).props.onPress());
  const text = () => renderer.root.findAllByType(Text).map(node => String(node.props.children)).join('\n');
  const paste = (value: string) => act(() => renderer.root.findByProps({ accessibilityLabel: '备份文本' }).props.onChangeText(value));
  const switches = () => renderer.root.findAll(node => typeof node.props.onValueChange === 'function' && typeof node.props.value === 'boolean');
  const unmount = () => act(() => renderer.unmount());
  return { renderer, button, press, text, paste, switches, onBack, onExportBackup, onRestoreBackup, unmount };
}

describe('offline backup screen', () => {
  it('validates before preview and reports a failed import without discarding the source text', async () => {
    const app = mount({ onRestoreBackup: jest.fn(async () => { throw new Error('transaction failed'); }) });
    app.paste('{bad json');
    app.press('检查备份');
    expect(app.text()).toContain('备份不是有效的 JSON 文件');
    expect(app.onRestoreBackup).not.toHaveBeenCalled();

    const raw = backup(null, 'good');
    app.paste(raw);
    app.press('检查备份');
    expect(app.text().replaceAll(',', '')).toContain('复盘：0 场');
    const alert = jest.spyOn(Alert, 'alert');
    app.press('确认导入');
    const confirm = alert.mock.calls.at(-1)?.[2]?.find(button => button.text === '确认导入');
    await act(async () => { await confirm?.onPress?.(); });
    expect(app.text()).toContain('transaction failed');
    expect(app.renderer.root.findByProps({ accessibilityLabel: '备份文本' }).props.value).toBe(raw);
    expect(app.onBack).not.toHaveBeenCalled();
    alert.mockRestore(); app.unmount();
  });

  it('shows the conflict switch for a damaged local session even when backup has no session', () => {
    const app = mount({ currentSessionDamaged: true });
    app.paste(backup(null, 'empty'));
    app.press('检查备份');
    expect(app.switches()).toHaveLength(1);
    expect(app.switches()[0].props.value).toBe(false);
    act(() => app.switches()[0].props.onValueChange(true));
    expect(app.switches()[0].props.value).toBe(true);
    app.unmount();
  });

  it('clears a previous replacement choice when the pasted backup changes', () => {
    const board = BOARD_LIBRARY[0];
    const game = createGame('备份对局', board.name, boardSeats(board).map(role => ({ name: '', role })), DEFAULT_RULES);
    const app = mount({ hasActiveSession: true });
    app.paste(backup(game, 'first'));
    app.press('检查备份');
    act(() => app.switches()[0].props.onValueChange(true));
    app.paste(backup(createGame('另一场', board.name, boardSeats(board).map(role => ({ name: '', role })), DEFAULT_RULES), 'second'));
    app.press('检查备份');
    expect(app.switches()[0].props.value).toBe(false);
    app.unmount();
  });

  it('exports through Share with a backup title when text sharing is selected', async () => {
    const app = mount();
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' } as never);
    await act(async () => app.press('分享备份文本'));
    expect(app.onExportBackup).toHaveBeenCalledTimes(1);
    expect(share).toHaveBeenCalledWith(expect.objectContaining({ title: '夜幕本机备份', message: expect.stringContaining('nightfall-host-backup') }));
    share.mockRestore(); app.unmount();
  });

  it('keeps pasted content when document selection is canceled', async () => {
    const app = mount();
    app.paste('keep this text');
    const picker = jest.spyOn(DocumentPicker, 'getDocumentAsync').mockResolvedValue({ canceled: true, assets: null });
    await act(async () => app.press('选择备份文件'));
    expect(app.renderer.root.findByProps({ accessibilityLabel: '备份文本' }).props.value).toBe('keep this text');
    picker.mockRestore(); app.unmount();
  });

  it('does not write a file when no folder permission is granted', async () => {
    const app = mount();
    const permission = jest.spyOn(FileSystem.StorageAccessFramework, 'requestDirectoryPermissionsAsync').mockResolvedValue({ granted: false });
    const write = jest.spyOn(FileSystem.StorageAccessFramework, 'writeAsStringAsync');
    await act(async () => app.press('保存备份文件'));
    expect(write).not.toHaveBeenCalled();
    expect(app.text()).toContain('未授予文件夹权限');
    permission.mockRestore(); write.mockRestore(); app.unmount();
  });
});
