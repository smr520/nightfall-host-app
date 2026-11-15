const { withAppBuildGradle } = require('expo/config-plugins');

const SIGNING_ENV = [
  'NIGHTFALL_RELEASE_STORE_FILE',
  'NIGHTFALL_RELEASE_STORE_PASSWORD',
  'NIGHTFALL_RELEASE_KEY_ALIAS',
  'NIGHTFALL_RELEASE_KEY_PASSWORD',
];

module.exports = function withAndroidReleaseSigning(config) {
  return withAppBuildGradle(config, configWithGradle => {
    if (configWithGradle.modResults.language !== 'groovy') {
      throw new Error('Android release signing requires the Groovy app build file.');
    }

    if (!SIGNING_ENV.every(name => !!process.env[name])) {
      return configWithGradle;
    }

    let contents = configWithGradle.modResults.contents;
    if (contents.includes('nightfallRelease')) {
      return configWithGradle;
    }

    const signingBlock = [
      '        nightfallRelease {',
      '            storeFile file(System.getenv("NIGHTFALL_RELEASE_STORE_FILE"))',
      '            storePassword System.getenv("NIGHTFALL_RELEASE_STORE_PASSWORD")',
      '            keyAlias System.getenv("NIGHTFALL_RELEASE_KEY_ALIAS")',
      '            keyPassword System.getenv("NIGHTFALL_RELEASE_KEY_PASSWORD")',
      '        }',
    ].join('\n');

    const signingStart = contents.indexOf('    signingConfigs {');
    if (signingStart < 0) {
      throw new Error('Could not find Android signingConfigs.');
    }
    contents = `${contents.slice(0, signingStart + '    signingConfigs {'.length)}\n${signingBlock}${contents.slice(signingStart + '    signingConfigs {'.length)}`;

    const releaseStart = contents.indexOf('        release {');
    const debugSigning = 'signingConfig signingConfigs.debug';
    const releaseSigningStart = contents.indexOf(debugSigning, releaseStart);
    if (releaseStart < 0 || releaseSigningStart < 0) {
      throw new Error('Could not find the Android release signing configuration.');
    }
    contents = `${contents.slice(0, releaseSigningStart)}signingConfig signingConfigs.nightfallRelease${contents.slice(releaseSigningStart + debugSigning.length)}`;

    configWithGradle.modResults.contents = contents;
    return configWithGradle;
  });
};
