import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type Assignment = {
  /** APK build the tablet was set up with (config.buildId). */
  buildId: string;
  locationId: string;
  locationName: string;
  sensorUrl: string;
};

type AssignmentState = {
  assignment: Assignment | null;
  /** True while the service at this tablet's branch is stopped in the registry. */
  serviceStopped: boolean;
  /** True while this APK build is retired in the registry. */
  buildDisabled: boolean;
  setAssignment: (assignment: Assignment) => void;
  clearAssignment: () => void;
  setServiceStopped: (stopped: boolean) => void;
  setBuildDisabled: (disabled: boolean) => void;
};

/**
 * The branch this tablet is locked to, saved on the device so the app opens
 * straight into that branch's Sensor on every start. Staff can't clear it from the
 * app; it is cleared when the claim is released in the registry sheet, and a new
 * APK build (new buildId) asks for setup again. serviceStopped and buildDisabled
 * are saved too, so they hold after a restart without internet.
 */
export const useAssignmentStore = create<AssignmentState>()(
  persist(
    (set) => ({
      assignment: null,
      serviceStopped: false,
      buildDisabled: false,
      setAssignment: (assignment) => set({ assignment, serviceStopped: false }),
      clearAssignment: () => set({ assignment: null, serviceStopped: false }),
      setServiceStopped: (serviceStopped) => set({ serviceStopped }),
      setBuildDisabled: (buildDisabled) => set({ buildDisabled }),
    }),
    {
      name: 'seylan-kiosk-assignment',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
