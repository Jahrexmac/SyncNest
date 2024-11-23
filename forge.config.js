const path = require('path');
const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');

module.exports = {
  packagerConfig: {
    asar: true, // Bundle source files into ASAR for protection
    icon: path.resolve(__dirname, 'assets/icons/syncnest'), // Base name for app icons
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: 'SyncNest',
        setupIcon: path.resolve(__dirname, 'assets/icons/syncnest.ico'), // Windows setup icon
        setupExe: 'SyncNestSetup.exe', // Installer name
        noMsi: true, // Avoid creating an MSI installer
      },
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin'],
    },
    {
      name: '@electron-forge/maker-deb',
      config: {
        productName: 'SyncNest',
        description: 'A file syncing and streaming app',
        icon: path.resolve(__dirname, 'assets/icons/syncnest.png'),
        section: 'utils',
      },
    },
    {
      name: '@electron-forge/maker-rpm',
      config: {
        productName: 'SyncNest',
        description: 'A file syncing and streaming app',
        icon: path.resolve(__dirname, 'assets/icons/syncnest.png'),
      },
    },
  ],
  plugins: [
    {
      name: '@electron-forge/plugin-auto-unpack-natives',
      config: {},
    },
    new FusesPlugin({
      version: FuseVersion.V1, // Specify Fuse version
      [FuseV1Options.RunAsNode]: false, // Disable running the app as Node.js
      [FuseV1Options.EnableCookieEncryption]: true, // Enable cookie encryption
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false, // Disable NODE_OPTIONS
      [FuseV1Options.EnableNodeCliInspectArguments]: false, // Disable Node.js CLI debugging
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true, // Validate ASAR integrity
      [FuseV1Options.OnlyLoadAppFromAsar]: true, // Restrict app loading to ASAR only
    }),
  ],
};
