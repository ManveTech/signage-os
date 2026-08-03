import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.signageOS.app',
  appName: 'SignageOS',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    // Only allow cleartext in development. Production should use HTTPS only.
    cleartext: process.env.NODE_ENV === 'development'
  },
  android: {
    // Disable mixed content - all resources should be HTTPS in production
    allowMixedContent: process.env.NODE_ENV === 'development',
    // Enable hardware acceleration for better video playback
    webContentsDebuggingEnabled: process.env.NODE_ENV === 'development'
  }
};

export default config;
