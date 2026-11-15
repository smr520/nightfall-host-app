const { AndroidConfig, withAndroidManifest } = require('expo/config-plugins');

const PRIVATE_PERMISSIONS = [
  'android.permission.INTERNET',
  'android.permission.SYSTEM_ALERT_WINDOW',
];

function blockPermission(androidManifest, permissionName) {
  const permissionKey = 'uses-permission';
  const permissions = Array.isArray(androidManifest.manifest[permissionKey])
    ? androidManifest.manifest[permissionKey]
    : [];
  const existing = permissions.find(item => item?.$?.['android:name'] === permissionName);

  if (existing) {
    existing.$['tools:node'] = 'remove';
  } else {
    permissions.push({
      $: {
        'android:name': permissionName,
        'tools:node': 'remove',
      },
    });
  }

  androidManifest.manifest[permissionKey] = permissions;
}

/**
 * Release builds contain private role and player notes. Keep them inside the
 * app sandbox by removing dormant network access and Android auto backup.
 */
function applyAndroidPrivacy(androidManifest) {
  const mainApplication = AndroidConfig.Manifest.getMainApplicationOrThrow(androidManifest);

  mainApplication.$['android:allowBackup'] = 'false';
  PRIVATE_PERMISSIONS.forEach(permissionName => blockPermission(androidManifest, permissionName));

  return androidManifest;
}

module.exports = function withAndroidPrivacy(config) {
  return withAndroidManifest(config, configWithManifest => {
    configWithManifest.modResults = applyAndroidPrivacy(configWithManifest.modResults);
    return configWithManifest;
  });
};

module.exports.applyAndroidPrivacy = applyAndroidPrivacy;
module.exports.PRIVATE_PERMISSIONS = PRIVATE_PERMISSIONS;
