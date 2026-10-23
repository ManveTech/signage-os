import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.bluestardigitech.app',
  appName: 'BlueStar DigiTech',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    // Only allow cleartext in development. Production should use HTTPS only.
    cleartext: process.env.NODE_ENV === 'development'
  },
  plugins: {
    // Only Google sign-in is used. Every other provider is left out of the
    // build: the Facebook one ships Facebook's SDK, whose advertising-ID
    // permissions contradict the Play listing (no ads, no device IDs).
    SocialLogin: {
      providers: { google: true, facebook: false, apple: false, twitter: false, linkedin: false, tiktok: false, telegram: false },
      logLevel: 1,
    },
  },
  android: {
    // Disable mixed content - all resources should be HTTPS in production
    allowMixedContent: process.env.NODE_ENV === 'development',
    // Enable hardware acceleration for better video playback
    webContentsDebuggingEnabled: process.env.NODE_ENV === 'development'
  }
};

export default config;
