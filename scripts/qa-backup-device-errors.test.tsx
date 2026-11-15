import React from 'react';
import { Alert, BackHandler, Text } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { createBackup } from '../src/game/backup';
import { DataBackupScreen } from '../src/ui/DataBackupScreen';

jest.mock('expo-file-system/legacy', () => ({
  getInfoAsync: jest.fn(), readAsStringAsync: jest.fn(),
  StorageAccessFramework: { requestDirectoryPermissionsAsync: jest.fn(), createFileAsync: jest.fn(), writeAsStringAsync: jest.fn() },
}));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: jest.requireActual<typeof import('react-native')>('react-native').View }));

function deferred<T>() {
  let resolve!: (value: T) => void; let reject!: (reason: Error) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}
const raw = JSON.stringify(createBackup({ session: null, history: [], preferences: { hostingMode: 'standard', profiles: [] } }));
const picked = { canceled: false as const, assets: [{ uri: 'file:///cache/backup.json', name: 'backup.json', mimeType: 'application/json', lastModified: 1 }] };

describe('backup device API failure paths', () => {
  let renderer: TestRenderer.ReactTestRenderer;
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(DocumentPicker, 'getDocumentAsync').mockResolvedValue(picked);
    jest.mocked(FileSystem.getInfoAsync).mockResolvedValue({ exists: true, uri: picked.assets[0].uri, size: raw.length, isDirectory: false, modificationTime: 1 });
    jest.mocked(FileSystem.readAsStringAsync).mockResolvedValue(raw);
  });
  afterEach(() => { if (renderer) act(() => renderer.unmount()); jest.restoreAllMocks(); });

  function mount(overrides: Partial<React.ComponentProps<typeof DataBackupScreen>> = {}) {
    const onBack = jest.fn(); const onRestoreBackup = jest.fn().mockResolvedValue(undefined);
    act(() => { renderer = TestRenderer.create(<DataBackupScreen onBack={onBack} hasActiveSession={false} onRestoreBackup={onRestoreBackup} onExportBackup={jest.fn().mockResolvedValue(raw)} {...overrides} />); });
    const button = (label: string) => renderer.root.findAll(node => node.props.accessibilityRole === 'button' && node.props.accessibilityLabel === label && typeof node.props.onPress === 'function')[0];
    const text = () => renderer.root.findAllByType(Text).map(node => String(node.props.children)).join('\n');
    const paste = (value: string) => act(() => renderer.root.findByProps({ accessibilityLabel: '备份文本' }).props.onChangeText(value));
    return { onBack, onRestoreBackup, button, text, paste };
  }

  it('opens only one picker and keeps back blocked while a native picker is outstanding', async () => {
    const selection = deferred<DocumentPicker.DocumentPickerResult>();
    jest.mocked(DocumentPicker.getDocumentAsync).mockReturnValueOnce(selection.promise);
    const backEvents = jest.spyOn(BackHandler, 'addEventListener');
    const app = mount(); const pick = app.button('选择备份文件').props.onPress;
    act(() => { pick(); pick(); app.button('返回').props.onPress(); });
    expect(DocumentPicker.getDocumentAsync).toHaveBeenCalledTimes(1);
    expect(app.onBack).not.toHaveBeenCalled();
    const hardwareBack = backEvents.mock.calls.at(-1)?.[1];
    act(() => { hardwareBack?.({} as never); });
    expect(app.onBack).not.toHaveBeenCalled();
    await act(async () => { selection.resolve({ canceled: true, assets: null }); await Promise.resolve(); });
    expect(app.button('选择备份文件').props.disabled).toBe(false);
  });

  it('rejects a known oversized file before allocating its full contents', async () => {
    jest.mocked(DocumentPicker.getDocumentAsync).mockResolvedValueOnce({ ...picked, assets: [{ ...picked.assets[0], size: 50_000_000 }] });
    const app = mount();
    await act(async () => { app.button('选择备份文件').props.onPress(); await Promise.resolve(); });
    expect(FileSystem.readAsStringAsync).not.toHaveBeenCalled();
    expect(app.text()).toContain('过大');
  });

  it('checks cached metadata before reading a file whose picker omitted its size', async () => {
    jest.mocked(FileSystem.getInfoAsync).mockResolvedValueOnce({ exists: true, uri: picked.assets[0].uri, size: 50_000_000, isDirectory: false, modificationTime: 1 });
    const app = mount();
    await act(async () => { app.button('选择备份文件').props.onPress(); await Promise.resolve(); });
    expect(FileSystem.readAsStringAsync).not.toHaveBeenCalled();
    expect(app.text()).toContain('过大');
  });

  it.each(['missing', 'permission'] as const)('keeps prior text when the cached file is %s', async fault => {
    if (fault === 'missing') jest.mocked(FileSystem.getInfoAsync).mockResolvedValueOnce({ exists: false, uri: picked.assets[0].uri, isDirectory: false });
    else jest.mocked(FileSystem.readAsStringAsync).mockRejectedValueOnce(new Error('EACCES: permission denied'));
    const app = mount(); app.paste('原有备份文本');
    await act(async () => { app.button('选择备份文件').props.onPress(); await Promise.resolve(); });
    expect(renderer.root.findByProps({ accessibilityLabel: '备份文本' }).props.value).toBe('原有备份文本');
    expect(app.text()).toMatch(/不存在|重新选择|EACCES/);
    expect(app.onRestoreBackup).not.toHaveBeenCalled();
    expect(app.button('选择备份文件').props.disabled).toBe(false);
  });

  it('accepts an import confirmation only once while the atomic restore remains pending', async () => {
    const restore = deferred<void>(); const onRestoreBackup = jest.fn().mockReturnValueOnce(restore.promise);
    const app = mount({ onRestoreBackup }); app.paste(raw);
    act(() => app.button('检查备份').props.onPress());
    const alert = jest.spyOn(Alert, 'alert');
    act(() => app.button('确认导入').props.onPress());
    const confirm = alert.mock.calls.at(-1)?.[2]?.find(item => item.text === '确认导入')?.onPress;
    act(() => { confirm?.(); confirm?.(); });
    expect(onRestoreBackup).toHaveBeenCalledTimes(1);
    expect(app.button('确认导入').props.disabled).toBe(true);
    await act(async () => { restore.reject(new Error('SQLITE_FULL')); await Promise.resolve(); });
    expect(app.text()).toContain('SQLITE_FULL');
    expect(app.button('确认导入').props.disabled).toBe(false);
  });

  it('ignores a late dismissal from a canceled dialog after the host opens a new confirmation', async () => {
    const app = mount(); app.paste(raw);
    act(() => app.button('检查备份').props.onPress());
    const alert = jest.spyOn(Alert, 'alert');
    act(() => app.button('确认导入').props.onPress());
    const first = alert.mock.calls.at(-1)!;
    act(() => first[2]?.find(item => item.text === '取消')?.onPress?.());
    act(() => app.button('确认导入').props.onPress());
    const second = alert.mock.calls.at(-1)!;
    act(() => first[3]?.onDismiss?.());
    await act(async () => { second[2]?.find(item => item.text === '确认导入')?.onPress?.(); await Promise.resolve(); });
    expect(app.onRestoreBackup).toHaveBeenCalledTimes(1);
  });

  it('keeps the backup operation retryable after the filesystem reports disk full', async () => {
    jest.mocked(FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync).mockResolvedValue({ granted: true, directoryUri: 'content://selected-folder' });
    jest.mocked(FileSystem.StorageAccessFramework.createFileAsync).mockResolvedValue('content://selected-folder/backup.json');
    jest.mocked(FileSystem.StorageAccessFramework.writeAsStringAsync).mockRejectedValueOnce(new Error('ENOSPC: no space left')).mockResolvedValue(undefined);
    const app = mount();
    await act(async () => { app.button('保存备份文件').props.onPress(); await Promise.resolve(); });
    expect(app.text()).toContain('ENOSPC');
    expect(app.button('保存备份文件').props.disabled).toBe(false);
    expect(app.onRestoreBackup).not.toHaveBeenCalled();
    await act(async () => { app.button('保存备份文件').props.onPress(); await Promise.resolve(); });
    expect(app.text()).toContain('备份文件已保存');
    expect(FileSystem.StorageAccessFramework.writeAsStringAsync).toHaveBeenCalledTimes(2);
  });

  it('does not open a directory picker after source backup export fails', async () => {
    const app = mount({ onExportBackup: jest.fn().mockRejectedValue(new Error('当前记录损坏，无法导出')) });
    await act(async () => { app.button('保存备份文件').props.onPress(); await Promise.resolve(); });
    expect(FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync).not.toHaveBeenCalled();
    expect(app.text()).toContain('当前记录损坏');
    expect(app.button('保存备份文件').props.disabled).toBe(false);
    expect(FileSystem.StorageAccessFramework.createFileAsync).not.toHaveBeenCalled();
  });
});
