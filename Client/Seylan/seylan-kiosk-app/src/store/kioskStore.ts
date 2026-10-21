import { create } from 'zustand';

import { config } from '../config';

export type Screen = 'sensor' | 'browse';
export type ReturnReason = 'button' | 'timeout';

type KioskState = {
  /** Which view the customer is on. The Sensor stays loaded underneath the browse view. */
  screen: Screen;
  /** Page the browse view opens on. */
  browseUrl: string;
  /** Bumped on every return, so the next browse view mounts as a brand-new private WebView. */
  browseSession: number;
  /** Bumped after a timeout, so the Sensor reloads for the next customer. */
  sensorSession: number;
  /** False while the Sensor is (re)loading; the branded loading screen covers it. */
  sensorLoaded: boolean;

  openBrowse: (url?: string) => void;
  returnToSensor: (reason: ReturnReason) => void;
  markSensorLoaded: () => void;
};

export const useKioskStore = create<KioskState>()((set) => ({
  screen: 'sensor',
  browseUrl: config.browseStartUrl,
  browseSession: 0,
  sensorSession: 0,
  sensorLoaded: false,

  openBrowse: (url = config.browseStartUrl) => set({ screen: 'browse', browseUrl: url }),

  returnToSensor: (reason) =>
    set((state) => {
      const reload = reason === 'timeout' && config.reloadSensorOnTimeout;
      return {
        screen: 'sensor',
        browseSession: state.browseSession + 1,
        sensorSession: reload ? state.sensorSession + 1 : state.sensorSession,
        sensorLoaded: reload ? false : state.sensorLoaded,
      };
    }),

  markSensorLoaded: () => set({ sensorLoaded: true }),
}));
