import { useSyncExternalStore } from 'react';
// Import only the weights the app uses; the package root would bundle all 18.
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { useFonts } from 'expo-font';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { config } from './src/config';
import { KioskAdmin } from './src/components/KioskAdmin';
import { KioskScreen } from './src/components/KioskScreen';
import { LoadingScreen } from './src/components/LoadingScreen';
import { ServiceStoppedScreen } from './src/components/ServiceStoppedScreen';
import { SetupScreen } from './src/components/SetupScreen';
import { useClaimCheck } from './src/hooks/useClaimCheck';
import { useKioskLock } from './src/hooks/useKioskLock';
import { useAssignmentStore } from './src/store/assignmentStore';

/** True once the saved branch choice has been read from the device. */
function useAssignmentHydrated() {
  return useSyncExternalStore(
    (onChange) => useAssignmentStore.persist.onFinishHydration(onChange),
    () => useAssignmentStore.persist.hasHydrated(),
  );
}

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  const hydrated = useAssignmentHydrated();
  useKioskLock();
  const assignment = useAssignmentStore((s) => s.assignment);
  const serviceStopped = useAssignmentStore((s) => s.serviceStopped);
  const buildDisabled = useAssignmentStore((s) => s.buildDisabled);

  // With a registry, each tablet is set up once per APK build for one branch.
  const usesRegistry = !!config.registryUrl;
  const needsSetup = usesRegistry && (!assignment || assignment.buildId !== config.buildId);
  useClaimCheck(hydrated && usesRegistry && (!needsSetup || buildDisabled));

  // If the fonts fail to load, carry on with the system font rather than block the kiosk.
  if ((!fontsLoaded && !fontError) || !hydrated) {
    return <LoadingScreen />;
  }

  return (
    <SafeAreaProvider>
      {usesRegistry && buildDisabled ? (
        <ServiceStoppedScreen
          title="This app version is no longer in use"
          message="Please contact Emojot to install the latest version of the app."
          locationName={assignment?.locationName}
        />
      ) : needsSetup ? (
        <SetupScreen />
      ) : usesRegistry && serviceStopped ? (
        <ServiceStoppedScreen locationName={assignment?.locationName} />
      ) : (
        <KioskScreen
          sensorUrl={usesRegistry && assignment ? assignment.sensorUrl : config.sensorUrl}
          locationName={usesRegistry ? assignment?.locationName : undefined}
        />
      )}
      <KioskAdmin />
    </SafeAreaProvider>
  );
}
