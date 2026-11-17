import { Share } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { saveBackupText } from '../src/ui/backup-file';

jest.mock('react-native/Libraries/Utilities/Platform', () => {
  const platform = {
    OS: 'ios',
    select: (spec: { ios?: unknown; native?: unknown; default?: unknown }) => spec.ios ?? spec.native ?? spec.default,
  };
  return { __esModule: true, default: platform, ...platform };
});
jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///documents/',
  makeDirectoryAsync: jest.fn(),
  writeAsStringAsync: jest.fn(),
  StorageAccessFramework: {
    requestDirectoryPermissionsAsync: jest.fn(),
    createFileAsync: jest.fn(),
    writeAsStringAsync: jest.fn(),
  },
}));

describe('iOS backup file handoff', () => {
  it('writes a document file and opens the system share sheet instead of calling Android SAF', async () => {
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' } as never);

    await expect(saveBackupText('{"version":1}', 'nightfall-backup-2026-11-17')).resolves.toBe('shared');

    expect(FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync).not.toHaveBeenCalled();
    expect(FileSystem.makeDirectoryAsync).toHaveBeenCalledWith('file:///documents/nightfall-backups/', { intermediates: true });
    expect(FileSystem.writeAsStringAsync).toHaveBeenCalledWith('file:///documents/nightfall-backups/nightfall-backup-2026-11-17.json', '{"version":1}');
    expect(share).toHaveBeenCalledWith(expect.objectContaining({
      title: '保存夜幕本机备份',
      url: 'file:///documents/nightfall-backups/nightfall-backup-2026-11-17.json',
    }));

    share.mockRestore();
  });
});
