import { StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import type { ShouldStartLoadRequest } from 'react-native-webview/lib/WebViewTypes';

import { config } from '../config';
import { DEMO_SENSOR_HTML } from '../lib/demoSensor';
import { ACTIVITY_SCRIPT } from '../lib/injected';
import { isBrowseUrl, isInternal, isSensorUrl } from '../lib/url';
import { useKioskStore } from '../store/kioskStore';
import { colors } from '../theme';

/**
 * The existing Emojot Sensor, full screen. Links to Seylan's site are caught
 * here and handed to the browse view; anything else outside the Sensor's own
 * domains is ignored, so the tablet never wanders off.
 */
export function SensorView() {
  const openBrowse = useKioskStore((s) => s.openBrowse);
  const markSensorLoaded = useKioskStore((s) => s.markSensorLoaded);

  const source = config.sensorUrl
    ? { uri: config.sensorUrl }
    : { html: DEMO_SENSOR_HTML, baseUrl: 'https://demo.emojot.com/' };

  const handleRequest = (req: ShouldStartLoadRequest) => {
    // iOS also asks for iframes (ads, embeds); only top-level navigations matter.
    if (req.isTopFrame === false) return true;
    if (isBrowseUrl(req.url)) {
      openBrowse(req.url);
      return false;
    }
    return isInternal(req.url) || isSensorUrl(req.url);
  };

  return (
    <WebView
      style={styles.web}
      source={source}
      originWhitelist={['*']}
      onShouldStartLoadWithRequest={handleRequest}
      // "Browse the Product" may open a new tab (target="_blank"): catch it here too.
      setSupportMultipleWindows
      onOpenWindow={(e) => {
        const url = e.nativeEvent.targetUrl;
        if (isBrowseUrl(url)) openBrowse(url);
      }}
      // Turns window.open into a normal navigation, so a new-tab "Browse" link is caught above.
      injectedJavaScript={ACTIVITY_SCRIPT}
      // The branded LoadingScreen covers the Sensor until this fires.
      onLoadEnd={markSensorLoaded}
      javaScriptEnabled
      domStorageEnabled
      mediaPlaybackRequiresUserAction
      allowsBackForwardNavigationGestures={false}
      bounces={false}
    />
  );
}

const styles = StyleSheet.create({
  web: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
