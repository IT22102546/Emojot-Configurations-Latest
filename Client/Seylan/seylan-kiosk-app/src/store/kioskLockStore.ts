import { create } from 'zustand';

type KioskLockState = {
  /** True while staff have unlocked the tablet from the admin menu. Never saved: a restart locks again. */
  unlocked: boolean;
  /** True while the "Exit kiosk" PIN box is open after someone left pinning with Back + Recents. */
  exitPrompt: boolean;
  setUnlocked: (unlocked: boolean) => void;
  setExitPrompt: (exitPrompt: boolean) => void;
};

export const useKioskLockStore = create<KioskLockState>()((set) => ({
  unlocked: false,
  exitPrompt: false,
  setUnlocked: (unlocked) => set({ unlocked, exitPrompt: false }),
  setExitPrompt: (exitPrompt) => set({ exitPrompt }),
}));
