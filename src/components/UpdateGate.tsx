import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { Download } from 'lucide-react';
import { API_BASE } from '../config';

/**
 * Stops an out-of-date phone app at the door.
 *
 * The app ships its own bundled copy of the dashboard, so an install nobody
 * updates keeps its old screens and old bugs for as long as it is left alone,
 * and there is otherwise no way to retire one. On launch, and each time the
 * app comes back to the front, it asks the server for the oldest build still
 * allowed (Settings › App version) and shows a full-screen page if it is
 * older. The only way on is the store.
 *
 * Fails open by design. No network, a server error, or no minimum set lets the
 * app run exactly as before — a flaky connection must never lock someone out
 * of their screens. Does nothing in a browser, where there is nothing to
 * update and the newest build is already being served.
 */

const PACKAGE = 'com.bluestardigitech.app';
const ANDROID_STORE = `market://details?id=${PACKAGE}`;
const ANDROID_STORE_WEB = `https://play.google.com/store/apps/details?id=${PACKAGE}`;

/** Whether the installed build is below the minimum. Exported for tests. */
export function isBelowMinimum(installedBuild: number, minBuild: number): boolean {
  // A missing or nonsensical figure on either side means "don't block".
  if (!Number.isFinite(installedBuild) || installedBuild <= 0) return false;
  if (!Number.isFinite(minBuild) || minBuild <= 0) return false;
  return installedBuild < minBuild;
}

export default function UpdateGate() {
  const [blocked, setBlocked] = useState<{ version: string } | null>(null);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const platform = Capacitor.getPlatform() === 'ios' ? 'ios' : 'android';
    let cancelled = false;

    const check = async () => {
      try {
        const [info, res] = await Promise.all([
          CapApp.getInfo(),
          fetch(`${API_BASE}/public/app-version`, { cache: 'no-store' })
        ]);
        if (!res.ok || cancelled) return;
        const data = await res.json();
        const min = Number(data?.[platform]?.minBuild) || 0;
        setBlocked(isBelowMinimum(Number(info.build), min) ? { version: info.version } : null);
      } catch {
        // Offline, or the server is down. Let them in.
      }
    };

    void check();
    // Checked again on resume so someone who leaves the app open for days
    // still sees it, and so the page clears itself once they come back from
    // the store without needing a restart.
    const sub = CapApp.addListener('appStateChange', ({ isActive }) => {
      if (isActive) void check();
    });
    return () => {
      cancelled = true;
      void sub.then(s => s.remove());
    };
  }, []);

  if (!blocked) return null;

  const openStore = () => {
    // market:// opens the Play Store app directly. If nothing handles it the
    // page stays put, so fall back to the website a moment later.
    const before = Date.now();
    window.location.href = ANDROID_STORE;
    setTimeout(() => {
      if (document.visibilityState === 'visible' && Date.now() - before < 2500) {
        window.location.href = ANDROID_STORE_WEB;
      }
    }, 1500);
  };

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="update-gate-title"
      // Above everything else the app can show, including the boot screen's
      // neighbours — nothing should be reachable past this.
      className="fixed inset-0 z-[2000] flex flex-col bg-slate-950 px-6 text-white"
      style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 24px)', paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 24px)' }}
    >
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <div aria-hidden className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-600">
          <Download size={28} />
        </div>
        <h1 id="update-gate-title" className="mt-6 text-2xl font-bold leading-tight">Update BlueStar DigiTech</h1>
        <p className="mt-2 max-w-xs text-[15px] leading-relaxed text-slate-400">
          This version is no longer supported. Update to carry on managing your screens.
        </p>
        <p className="mt-4 text-[13px] text-slate-500">You have version {blocked.version}</p>
      </div>
      <button
        type="button"
        onClick={openStore}
        className="mx-auto h-12 w-full max-w-sm rounded-xl bg-blue-600 text-[15px] font-semibold text-white active:scale-[0.99]"
      >
        Update now
      </button>
    </div>
  );
}
