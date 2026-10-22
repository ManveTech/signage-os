import { registerPlugin } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Keyboard } from '@capacitor/keyboard';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar } from '@capacitor/status-bar';

/**
 * The phone app's native plugins. They used to be read off the global
 * `Capacitor.Plugins`, which since Capacitor 3 is only filled in for plugins
 * that are imported — and none were, so the Android back button, keyboard
 * handling, splash and status-bar colouring never ran.
 */
export const SgWindow = registerPlugin<{ setBackground(opts: { color: string }): Promise<void> }>('SgWindow');
/** Android's print dialog for the current page (see SgPrintPlugin.java). */
export const SgPrint = registerPlugin<{ print(opts: { title: string }): Promise<void> }>('SgPrint');
export { App, Keyboard, SplashScreen, StatusBar };
