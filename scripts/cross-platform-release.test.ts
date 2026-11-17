import appConfig from '../app.json';
import desktopPackage from '../desktop/package.json';
import rootPackage from '../package.json';
import { backupFilename } from '../src/ui/backup-file';

describe('cross-platform release contract', () => {
  it('publishes one version to Android, iOS, web, Windows, and macOS', () => {
    expect(appConfig.expo.platforms).toEqual(['android', 'ios', 'web']);
    expect(desktopPackage.version).toBe(rootPackage.version);
    expect(appConfig.expo.version).toBe(rootPackage.version);
  });

  it('keeps native identifiers stable across mobile platforms', () => {
    expect(appConfig.expo.android.package).toBe('com.nightfall.werewolfhost');
    expect(appConfig.expo.ios.bundleIdentifier).toBe('com.nightfall.werewolfhost');
    expect(appConfig.expo.ios.supportsTablet).toBe(true);
    expect(appConfig.expo.ios.buildNumber).toBe('15');
    expect(appConfig.expo.android.versionCode).toBe(15);
  });

  it('uses the supplied artwork and a light application surface', () => {
    expect(appConfig.expo.icon).toBe('./assets/icon.png');
    expect(appConfig.expo.plugins).toContainEqual(expect.arrayContaining(['expo-splash-screen']));
    expect(appConfig.expo.userInterfaceStyle).toBe('light');
  });

  it('creates stable, filesystem-safe backup names', () => {
    expect(backupFilename(new Date('2026-11-17T12:00:00Z'))).toBe('nightfall-backup-2026-11-17');
  });
});
