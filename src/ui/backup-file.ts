import * as FileSystem from 'expo-file-system/legacy';
import { Platform, Share } from 'react-native';

export const MAX_BACKUP_CHARACTERS = 5_000_000;
// A UTF-8 file cannot require more than three bytes per JavaScript UTF-16 unit.
export const MAX_BACKUP_FILE_BYTES = MAX_BACKUP_CHARACTERS * 3;

type BackupFileAsset = {
  uri: string;
  size?: number;
  file?: File;
};

type DesktopBridge = {
  saveBackupText?: (suggestedName: string, content: string) => Promise<boolean>;
};

export type SaveBackupResult = 'saved' | 'downloaded' | 'shared' | 'cancelled';
export type ShareBackupResult = 'shared' | 'copied' | 'downloaded';

function desktopBridge(): DesktopBridge | undefined {
  return (globalThis as typeof globalThis & { nightfallDesktop?: DesktopBridge }).nightfallDesktop;
}

function verifyCharacters(value: string): string {
  if (value.length > MAX_BACKUP_CHARACTERS) throw new Error('备份文件过大，未修改本机数据');
  return value;
}

export function backupFilename(date = new Date()): string {
  return `nightfall-backup-${date.toISOString().slice(0, 10)}`;
}

export async function readBackupFile(asset: BackupFileAsset): Promise<string> {
  if (typeof asset.size === 'number' && asset.size > MAX_BACKUP_FILE_BYTES) {
    throw new Error('备份文件过大，未修改本机数据');
  }
  if (Platform.OS === 'web') {
    if (asset.file) return verifyCharacters(await asset.file.text());
    const response = await fetch(asset.uri);
    if (!response.ok) throw new Error('备份文件已不存在或不可读取，请重新选择');
    return verifyCharacters(await response.text());
  }
  const file = await FileSystem.getInfoAsync(asset.uri);
  if (!file.exists || file.isDirectory) throw new Error('备份文件已不存在或不可读取，请重新选择');
  if (file.size > MAX_BACKUP_FILE_BYTES) throw new Error('备份文件过大，未修改本机数据');
  return verifyCharacters(await FileSystem.readAsStringAsync(asset.uri));
}

function downloadText(filename: string, content: string) {
  const safeFilename = filename.replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '') || 'nightfall-export';
  const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${safeFilename}.json`;
  anchor.rel = 'noopener';
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export async function saveBackupText(content: string, filename: string): Promise<SaveBackupResult> {
  verifyCharacters(content);
  if (Platform.OS === 'web') {
    const bridge = desktopBridge();
    if (bridge?.saveBackupText) {
      return await bridge.saveBackupText(filename, content) ? 'saved' : 'cancelled';
    }
    downloadText(filename, content);
    return 'downloaded';
  }
  if (Platform.OS === 'android' && FileSystem.StorageAccessFramework?.requestDirectoryPermissionsAsync) {
    const permission = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
    if (!permission.granted) return 'cancelled';
    const uri = await FileSystem.StorageAccessFramework.createFileAsync(permission.directoryUri, filename, 'application/json');
    await FileSystem.StorageAccessFramework.writeAsStringAsync(uri, content);
    return 'saved';
  }
  if (!FileSystem.documentDirectory) throw new Error('当前设备没有可写目录，无法保存备份');
  const backupDirectory = `${FileSystem.documentDirectory}nightfall-backups/`;
  await FileSystem.makeDirectoryAsync(backupDirectory, { intermediates: true });
  const uri = `${backupDirectory}${filename}.json`;
  await FileSystem.writeAsStringAsync(uri, content);
  await Share.share({
    title: '保存夜幕本机备份',
    message: '把备份文件保存到“文件”或你信任的位置。',
    url: uri,
  });
  return 'shared';
}

export async function shareBackupText(title: string, content: string, filename: string): Promise<ShareBackupResult> {
  verifyCharacters(content);
  if (Platform.OS !== 'web') {
    await Share.share({ title, message: content });
    return 'shared';
  }
  if (navigator.share) {
    try {
      await navigator.share({ title, text: content });
      return 'shared';
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return 'shared';
    }
  }
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(content);
      return 'copied';
    } catch {
      // Fall through to a normal file download when clipboard access is denied.
    }
  }
  downloadText(filename, content);
  return 'downloaded';
}
