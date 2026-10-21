import { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, StyleSheet, View } from 'react-native';
import { useKeepAwake } from 'expo-keep-awake';
import { NavigationBar } from 'expo-navigation-bar';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';

import { config } from '../config';
import { useIdleTimer } from '../hooks/useIdleTimer';
import { useKioskStore } from '../store/kioskStore';
import { BrowseView, type BrowseViewHandle } from './BrowseView';
import { LoadingScreen } from './LoadingScreen';
import { SensorView } from './SensorView';
import { StillThereCard } from './StillThereCard';
import { ViewProductsButton } from './ViewProductsButton';

/** The loading screen shows for at least this long, and never longer than the max. */
const SPLASH_MIN_MS = 2000;
const SPLASH_MAX_MS = 15000;

/**
 * Customer journey:
 * 1. The Sensor loads.
 * 2. The customer taps "View products" (or the Sensor's own "Browse the
 *    Product" link) → Seylan's site. Nothing opens it automatically.
 * 3. Nobody touches Seylan's site for idleSeconds → "Still exploring?".
 * 4. Still no touch → back to the Sensor, browsing cleared for the next customer.
 */
export function KioskScreen() {
  useKeepAwake();

  const screen = useKioskStore((s) => s.screen);
  const browseUrl = useKioskStore((s) => s.browseUrl);
  const browseSession = useKioskStore((s) => s.browseSession);
  const sensorSession = useKioskStore((s) => s.sensorSession);
  const sensorLoaded = useKioskStore((s) => s.sensorLoaded);
  const openBrowse = useKioskStore((s) => s.openBrowse);
  const returnToSensor = useKioskStore((s) => s.returnToSensor);
  const browseRef = useRef<BrowseViewHandle>(null);

  // Branded loading screen over the Sensor at start-up and after each reload.
  const [splash, setSplash] = useState({ session: sensorSession, minDone: false, maxDone: false, hidden: false });
  if (splash.session !== sensorSession) {
    setSplash({ session: sensorSession, minDone: false, maxDone: false, hidden: false });
  }
  useEffect(() => {
    const mark = (key: 'minDone' | 'maxDone') => () =>
      setSplash((s) => (s.session === sensorSession ? { ...s, [key]: true } : s));
    const min = setTimeout(mark('minDone'), SPLASH_MIN_MS);
    const max = setTimeout(mark('maxDone'), SPLASH_MAX_MS);
    return () => {
      clearTimeout(min);
      clearTimeout(max);
    };
  }, [sensorSession]);
  const hideSplash = useCallback(() => setSplash((s) => ({ ...s, hidden: true })), []);
  const splashDone = (sensorLoaded && splash.minDone) || splash.maxDone;

  const browseIdle = useIdleTimer({
    enabled: screen === 'browse',
    idleMs: config.idleSeconds * 1000,
    warningMs: config.warningSeconds * 1000,
    onTimeout: () => returnToSensor('timeout'),
  });
  const resetBrowseIdle = browseIdle.reset;

  // Android back button: step back inside Seylan's site, then to the Sensor.
  // It never closes the app.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (screen === 'browse') {
        resetBrowseIdle();
        if (!browseRef.current?.goBack()) returnToSensor('button');
      }
      return true;
    });
    return () => sub.remove();
  }, [screen, resetBrowseIdle, returnToSensor]);

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <StatusBar hidden style="light" />
      <NavigationBar hidden />

      <SensorView key={`sensor-${sensorSession}`} />

      {screen === 'sensor' && splash.hidden ? <ViewProductsButton onPress={() => openBrowse()} /> : null}

      {screen === 'browse' ? (
        <View style={StyleSheet.absoluteFill}>
          <BrowseView
            key={`browse-${browseSession}`}
            ref={browseRef}
            startUrl={browseUrl}
            onActivity={browseIdle.reset}
            onReturn={() => returnToSensor('button')}
          />
          {browseIdle.phase === 'warning' ? (
            <StillThereCard
              secondsLeft={browseIdle.secondsLeft}
              totalSeconds={config.warningSeconds}
              onStay={browseIdle.reset}
              onLeave={() => returnToSensor('timeout')}
            />
          ) : null}
        </View>
      ) : null}

      {!splash.hidden ? <LoadingScreen done={splashDone} onHidden={hideSplash} /> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    // Seylan's Sensor and site are white; the loading screen brings its own dark background.
    backgroundColor: '#FFFFFF',
  },
});
