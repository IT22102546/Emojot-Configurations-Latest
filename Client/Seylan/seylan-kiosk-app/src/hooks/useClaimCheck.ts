import { useEffect } from 'react';

import { config } from '../config';
import { fetchStatus } from '../lib/registry';
import { useAssignmentStore } from '../store/assignmentStore';

/**
 * Keeps a set-up tablet in step with the registry: on start and every
 * config.claimCheckSeconds it asks for this tablet's claim. Released in the
 * sheet → back to the setup screen. Branch service stopped (Active unticked) →
 * "Service unavailable" until it is ticked again. Moved to another branch → that Sensor.
 * Whole APK build retired (Builds sheet) → "no longer in use", also on the setup screen.
 * Without a connection nothing changes, so the kiosk keeps working offline.
 */
export function useClaimCheck(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    const check = async () => {
      let status;
      try {
        status = await fetchStatus();
      } catch {
        return;
      }
      if (cancelled) return;
      const { assignment, setAssignment, clearAssignment, setServiceStopped, setBuildDisabled } =
        useAssignmentStore.getState();
      setBuildDisabled(status.buildDisabled);
      const { claim } = status;
      if (!claim) {
        // Only a tablet set up for this build can be released; the setup screen has nothing to clear.
        if (assignment?.buildId === config.buildId) clearAssignment();
        return;
      }
      if (assignment && (claim.id !== assignment.locationId || claim.url !== assignment.sensorUrl)) {
        setAssignment({ buildId: config.buildId, locationId: claim.id, locationName: claim.name, sensorUrl: claim.url });
      }
      setServiceStopped(claim.active === false);
    };

    const start = setTimeout(check, 0);
    const timer = setInterval(check, Math.max(15, config.claimCheckSeconds) * 1000);
    return () => {
      cancelled = true;
      clearTimeout(start);
      clearInterval(timer);
    };
  }, [enabled]);
}
