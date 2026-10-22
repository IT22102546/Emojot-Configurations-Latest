import { useEffect } from 'react';
import { AppState } from 'react-native';

import { getKioskState, isKioskAvailable, lockKiosk, unlockKiosk, type LockTask } from '../../modules/kiosk-mode';
import { config } from '../config';
import { useKioskLockStore } from '../store/kioskLockStore';

/**
 * Keeps the tablet locked to the app: locks on start and whenever the app comes
 * back to the front. Leaving screen pinning with Android's Back + Recents
 * gesture opens the "Exit kiosk" PIN box; the right exit PIN unlocks the
 * tablet, anything else pins it again. After staff unlock it, it stays
 * unlocked for config.kioskRelockMinutes, then locks itself again.
 */
export function useKioskLock() {
  const unlocked = useKioskLockStore((s) => s.unlocked);

  useEffect(() => {
    if (!config.kioskLock) return;
    if (unlocked) {
      unlockKiosk().catch(() => undefined);
      const relock = setTimeout(
        () => useKioskLockStore.getState().setUnlocked(false),
        Math.max(1, config.kioskRelockMinutes) * 60_000,
      );
      return () => clearTimeout(relock);
    }

    // Spaced out, so Android's "pin this app?" prompt isn't requested over and over.
    let lastLock = 0;
    const lock = () => {
      if (useKioskLockStore.getState().exitPrompt || Date.now() - lastLock < 4000) return;
      lastLock = Date.now();
      lockKiosk().catch(() => undefined);
    };
    lock();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') lock();
    });
    let previous: LockTask = 'none';
    const watch = isKioskAvailable
      ? setInterval(() => {
          const now = getKioskState().lockTask;
          if (previous !== 'none' && now === 'none') {
            // Someone left pinning (Back + Recents): ask for the exit PIN.
            useKioskLockStore.getState().setExitPrompt(true);
          } else if (now === 'none' && AppState.currentState === 'active') {
            lock();
          }
          previous = now;
        }, 700)
      : undefined;
    return () => {
      sub.remove();
      if (watch) clearInterval(watch);
    };
  }, [unlocked]);
}
