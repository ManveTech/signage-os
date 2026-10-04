import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { stopActiveTour } from '../lib/tour/active';
import { setNativeBarColor } from '../lib/nativeWindow';
import { App, Keyboard, SplashScreen } from '../lib/nativePlugins';

export function useCapacitor() {
  const [isNative, setIsNative] = useState(false);
  const [platform, setPlatform] = useState<'ios' | 'android' | 'web'>('web');

  useEffect(() => {
    const native = Capacitor.isNativePlatform();
    const plat = Capacitor.getPlatform() as 'ios' | 'android' | 'web';

    setIsNative(native);
    setPlatform(plat);

    if (native) {
      initializeNativeFeatures();
    }
  }, []);

  const initializeNativeFeatures = async () => {
    try {
      if (!Capacitor.isNativePlatform()) return;

      const CapacitorApp = App;

      // Android back button. Registered first, before anything awaited.
      // Android's own "can go back" is always false here (moving between
      // pages doesn't add WebView history), so it decided to exit the app on
      // every press; the app's own state decides instead.
      if (Capacitor.getPlatform() === 'android') {
        CapacitorApp.addListener('backButton', () => {
          // A guided tour owns the screen while it runs.
          if (stopActiveTour()) return;
          // An open sheet or dialog closes first.
          if (document.querySelector('[role="dialog"], [aria-modal="true"]')) {
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
            return;
          }
          const hash = window.location.hash.replace(/^#/, '') || '/';
          const home = hash.startsWith('/admin') ? '/admin/dashboard' : '/dashboard';
          if (hash === home || hash === '/' || hash === '/login') {
            // Leave the app running in the background, like other apps.
            CapacitorApp.minimizeApp().catch(() => CapacitorApp.exitApp());
            return;
          }
          window.history.back();
          // Nothing to go back to (opened straight onto this page): go home.
          setTimeout(() => {
            if ((window.location.hash.replace(/^#/, '') || '/') === hash) window.location.hash = home;
          }, 350);
        });
      }

      // Hide splash screen after app is ready
      await SplashScreen.hide({ fadeOutDuration: 300 }).catch(() => {});

      // Configure the status/nav bars — white to match the login/dashboard
      // screens, which is what's on screen almost the entire time the app is
      // open. BootScreen briefly overrides this to black for its own
      // duration and restores it on the way out.
      await setNativeBarColor('#ffffff', 'LIGHT');

      // (No keyboard padding here: Android already resizes the page for the
      // keyboard, and the layouts are built for that.)

      // Handle app state changes
      if (CapacitorApp && typeof CapacitorApp.addListener === 'function') {
        CapacitorApp.addListener('appStateChange', ({ isActive }: any) => {
          if (isActive) {
            window.dispatchEvent(new Event('app-resumed'));
          }
        });

        CapacitorApp.addListener('pause', () => {
          window.dispatchEvent(new Event('app-paused'));
        });

        CapacitorApp.addListener('resume', () => {
          window.dispatchEvent(new Event('app-resumed'));
        });
      }
    } catch (error) {
      console.error('Error initializing native features:', error);
    }
  };

  return {
    isNative,
    platform,
    isIOS: platform === 'ios',
    isAndroid: platform === 'android',
    isWeb: platform === 'web',
  };
}

export function useKeyboardVisible() {
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const showListener = Keyboard.addListener('keyboardWillShow', () => {
      setIsKeyboardVisible(true);
    });

    const hideListener = Keyboard.addListener('keyboardWillHide', () => {
      setIsKeyboardVisible(false);
    });

    return () => {
      if (showListener && typeof showListener.then === 'function') {
        showListener.then((l: any) => l?.remove()).catch(() => {});
      }
      if (hideListener && typeof hideListener.then === 'function') {
        hideListener.then((l: any) => l?.remove()).catch(() => {});
      }
    };
  }, []);

  return isKeyboardVisible;
}

export function useAppState() {
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const CapacitorApp = App;

    const listener = CapacitorApp.addListener('appStateChange', ({ isActive }: any) => {
      setIsActive(isActive);
    });

    return () => {
      if (listener && typeof listener.then === 'function') {
        listener.then((l: any) => l?.remove()).catch(() => {});
      }
    };
  }, []);

  return { isActive };
}
