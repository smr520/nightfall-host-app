type ManifestPermission = {
  $: {
    'android:name': string;
    'tools:node'?: string;
  };
};

type AndroidManifest = {
  manifest: {
    $: {
      'xmlns:android': string;
    };
    'uses-permission'?: ManifestPermission[];
    application: {
      $: Record<string, string>;
    }[];
  };
};

type PrivacyPlugin = {
  applyAndroidPrivacy: (manifest: AndroidManifest) => AndroidManifest;
  PRIVATE_PERMISSIONS: string[];
};

describe('offline Android privacy release configuration', () => {
  const app = jest.requireActual<{
    expo: {
      android: {
        blockedPermissions: string[];
      };
      plugins: string[];
    };
  }>('../app.json');
  const privacyPlugin = jest.requireActual<PrivacyPlugin>('../plugins/with-android-privacy');

  it('registers the privacy plugin after the Expo and signing plugins', () => {
    expect(app.expo.plugins).toContain('./plugins/with-android-privacy');
    expect(app.expo.android.blockedPermissions).toEqual(expect.arrayContaining([
      'android.permission.INTERNET',
      'android.permission.SYSTEM_ALERT_WINDOW',
      'android.permission.CAMERA',
      'android.permission.RECORD_AUDIO',
    ]));
  });

  it('installs manifest-merger removal markers and disables Android auto backup', () => {
    const manifest: AndroidManifest = {
      manifest: {
        $: { 'xmlns:android': 'http://schemas.android.com/apk/res/android' },
        'uses-permission': privacyPlugin.PRIVATE_PERMISSIONS.map(name => ({ $: { 'android:name': name } })),
        application: [{
          $: {
            'android:name': '.MainApplication',
            'android:allowBackup': 'true',
          },
        }],
      },
    };

    const result = privacyPlugin.applyAndroidPrivacy(manifest);

    expect(result.manifest['uses-permission']).toEqual([
      { $: { 'android:name': 'android.permission.INTERNET', 'tools:node': 'remove' } },
      { $: { 'android:name': 'android.permission.SYSTEM_ALERT_WINDOW', 'tools:node': 'remove' } },
    ]);
    expect(result.manifest.application[0].$['android:allowBackup']).toBe('false');
  });
});
