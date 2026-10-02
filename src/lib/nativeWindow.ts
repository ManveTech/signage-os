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
  // The boot screen owns the bars while it's up — the dashboard mounts
  // underneath it at the same time and asks for white on startup, which
  // would otherwise paint white strips over the black splash. Remember the
  // latest request and apply it once the boot screen lets go.
  if (bootHold) {
    pendingAfterBoot = { color, style };
    return;
  }
  await applyBarColor(color, style);
}

let bootHold = false;
let pendingAfterBoot: { color: string; style: 'LIGHT' | 'DARK' } | null = null;

/**
 * Locks the bars to black for the boot screen. Returns a release function
 * (safe to call more than once) that unlocks them and applies whatever color
 * was requested in the meantime — white by default, matching the app.
 */
export function holdBarsForBoot(): () => void {
  bootHold = true;
  pendingAfterBoot = null;
  if (Capacitor.getPlatform() === 'android') {
    void applyBarColor('#000000', 'DARK'); // light icons for the black bar
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    bootHold = false;
    const next = pendingAfterBoot ?? { color: '#ffffff', style: 'LIGHT' as const };
    pendingAfterBoot = null;
    void setNativeBarColor(next.color, next.style);
  };
}

async function applyBarColor(color: string, style: 'LIGHT' | 'DARK'): Promise<void> {

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
