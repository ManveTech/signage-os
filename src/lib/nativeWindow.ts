import { Capacitor } from '@capacitor/core';

/**
 * Sets the status/navigation bar color and icon style on Android.
 *
 * Two code paths, because neither one alone covers every device: on Android
 * 15+ every app is forced edge-to-edge and StatusBar.setBackgroundColor is
 * silently ignored — what shows through the now-transparent bars is the
 * activity window's own background instead, which only the native SgWindow
 * plugin (android/.../SgWindowPlugin.java) can set. Pre-15 devices don't
 * have that problem, and go on honoring StatusBar.setBackgroundColor
 * directly, so both calls are made every time rather than branching on OS
 * version.
 */
export async function setNativeBarColor(color: string, style: 'LIGHT' | 'DARK'): Promise<void> {
  if (Capacitor.getPlatform() !== 'android') return;

  const plugins = (Capacitor as any).Plugins || {};
  const { StatusBar, SgWindow } = plugins;

  if (SgWindow?.setBackground) {
    await SgWindow.setBackground({ color }).catch(() => {});
  }
  if (StatusBar?.setOverlaysWebView) {
    // Without this the WebView draws under the status bar instead of below it.
    await StatusBar.setOverlaysWebView({ overlay: false }).catch(() => {});
  }
  if (StatusBar?.setBackgroundColor) {
    await StatusBar.setBackgroundColor({ color }).catch(() => {});
  }
  if (StatusBar?.setStyle) {
    await StatusBar.setStyle({ style }).catch(() => {});
  }
}
