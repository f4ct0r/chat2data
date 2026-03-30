const hasMacSigningIdentity = Boolean(process.env.CSC_LINK || process.env.CSC_NAME);
const hasNotarizationCredentials =
  Boolean(process.env.APPLE_ID && process.env.APPLE_APP_SPECIFIC_PASSWORD && process.env.APPLE_TEAM_ID) ||
  Boolean(process.env.APPLE_API_KEY && process.env.APPLE_API_KEY_ID && process.env.APPLE_API_ISSUER);

module.exports = {
  appId: 'com.chat2data.app',
  productName: 'Chat2Data',
  copyright: 'Copyright © 2026 Chat2Data',
  asar: true,
  directories: {
    output: 'release',
    buildResources: 'assets',
  },
  artifactName: '${productName}-${version}-${arch}.${ext}',
  files: [
    'dist',
    'package.json',
    '!**/*.sqlite',
    '!**/*.sqlite3',
    '!**/*.db',
    '!**/*.db3',
    '!**/*-wal',
    '!**/*-shm',
  ],
  mac: {
    target: ['dmg'],
    icon: 'assets/icon.icns',
    category: 'public.app-category.developer-tools',
    hardenedRuntime: hasMacSigningIdentity,
    gatekeeperAssess: false,
    identity: hasMacSigningIdentity ? undefined : null,
  },
  dmg: {
    sign: hasMacSigningIdentity,
    writeUpdateInfo: false,
  },
  afterAllArtifactBuild: async (context) => {
    if (process.platform !== 'darwin') {
      return;
    }

    if (!hasMacSigningIdentity) {
      console.warn('[electron-builder] No macOS signing identity found. Building an unsigned DMG.');
      return;
    }

    if (!hasNotarizationCredentials) {
      console.warn(
        '[electron-builder] Signing identity detected, but notarization credentials are missing. The DMG will be signed only.'
      );
      return;
    }

    console.log('[electron-builder] Signing credentials and notarization credentials are available for this build.');
    void context;
  },
  win: {
    target: ['nsis'],
    icon: 'assets/icon.ico',
  },
  nsis: {
    oneClick: false,
    perMachine: false,
    allowToChangeInstallationDirectory: true,
  },
};
