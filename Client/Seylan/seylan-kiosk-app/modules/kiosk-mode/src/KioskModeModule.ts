import { NativeModule, requireOptionalNativeModule } from 'expo';

/** none: not locked · locked: full kiosk (device owner) · pinned: screen pinning */
export type LockTask = 'none' | 'locked' | 'pinned';
export type KioskState = { deviceOwner: boolean; lockTask: LockTask };

declare class KioskModeModule extends NativeModule<Record<string, never>> {
  getState(): KioskState;
  lock(): Promise<LockTask>;
  unlock(): Promise<LockTask>;
}

// Optional, so Expo Go and the web preview (which don't include this module) keep working.
const native = requireOptionalNativeModule<KioskModeModule>('KioskMode');

/** True when the app was built with the kiosk module (an EAS build on Android). */
export const isKioskAvailable = native != null;

export function getKioskState(): KioskState {
  return native?.getState() ?? { deviceOwner: false, lockTask: 'none' };
}

export async function lockKiosk(): Promise<LockTask> {
  return native ? native.lock() : 'none';
}

export async function unlockKiosk(): Promise<LockTask> {
  return native ? native.unlock() : 'none';
}
