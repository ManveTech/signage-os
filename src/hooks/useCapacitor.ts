import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { stopActiveTour } from '../lib/tour/active';
import { setNativeBarColor } from '../lib/nativeWindow';

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

      const plugins = (Capacitor as any).Plugins || {};
      const { SplashScreen, Keyboard, App: CapacitorApp } = plugins;

      // Hide splash screen after app is ready
      if (SplashScreen && typeof SplashScreen.hide === 'function') {
        await SplashScreen.hide({ fadeOutDuration: 300 });
      }

      // Configure the status/nav bars — white to match the login/dashboard
      // screens, which is what's on screen almost the entire time the app is
      // open. BootScreen briefly overrides this to black for its own
      // duration and restores it on the way out.
      await setNativeBarColor('#ffffff', 'LIGHT');

      // Handle hardware back button on Android
      if (Capacitor.getPlatform() === 'android' && CapacitorApp) {
        if (typeof CapacitorApp.addListener === 'function') {
          CapacitorApp.addListener('backButton', ({ canGoBack }: any) => {
            // A guided tour (lib/tour/runner.ts) owns the screen while it's
            // running — back should close it, not navigate the page or exit
            // the app underneath it. active.ts has no dependency on the tour
            // engine itself (driver.js), so importing it here doesn't pull
            // that into every page's bundle.
            if (stopActiveTour()) return;
            if (!canGoBack && typeof CapacitorApp.exitApp === 'function') {
              CapacitorApp.exitApp();
            } else {
              window.history.back();
            }
          });
        }
      }

      // Handle keyboard events
      if (Keyboard && typeof Keyboard.addListener === 'function') {
        Keyboard.addListener('keyboardWillShow', (info: any) => {
          document.body.style.paddingBottom = `${info.keyboardHeight}px`;
        });

        Keyboard.addListener('keyboardWillHide', () => {
          document.body.style.paddingBottom = '0px';
        });
      }

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
    const Keyboard = (Capacitor as any).Plugins?.Keyboard;
    if (!Keyboard || typeof Keyboard.addListener !== 'function') return;

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
    const CapacitorApp = (Capacitor as any).Plugins?.App;
    if (!CapacitorApp || typeof CapacitorApp.addListener !== 'function') return;

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
