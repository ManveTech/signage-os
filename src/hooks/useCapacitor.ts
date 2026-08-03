import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';

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
      const { SplashScreen, StatusBar, Keyboard, App: CapacitorApp } = plugins;

      // Hide splash screen after app is ready
      if (SplashScreen && typeof SplashScreen.hide === 'function') {
        await SplashScreen.hide({ fadeOutDuration: 300 });
      }

      // Configure status bar
      if (Capacitor.getPlatform() === 'android' && StatusBar) {
        if (typeof StatusBar.setBackgroundColor === 'function') {
          await StatusBar.setBackgroundColor({ color: '#ffffff' });
        }
      }

      // Handle hardware back button on Android
      if (Capacitor.getPlatform() === 'android' && CapacitorApp) {
        if (typeof CapacitorApp.addListener === 'function') {
          CapacitorApp.addListener('backButton', ({ canGoBack }: any) => {
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
