import { useImperativeHandle, useRef, useState, type Ref } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { WebViewMessageEvent } from 'react-native-webview';
import type { ShouldStartLoadRequest } from 'react-native-webview/lib/WebViewTypes';

import { ACTIVITY_SCRIPT, parseMessage } from '../lib/injected';
import { WebView, type WebViewHandle } from '../lib/webview';
import { isBrowseUrl, isInternal, isPdf } from '../lib/url';
import { colors, fonts, radius } from '../theme';
import { TopBar } from './TopBar';

export type BrowseViewHandle = {
  /** Steps back inside the site. Returns false when there is no page to go back to. */
  goBack: () => boolean;
};

type Props = {
  startUrl: string;
  onActivity: () => void;
  onReturn: () => void;
  ref?: Ref<BrowseViewHandle>;
};

/**
 * Seylan's site inside a controlled, private WebView. Mounted fresh for each
 * customer (the parent changes its key), so nothing carries over between them.
 */
export function BrowseView({ startUrl, onActivity, onReturn, ref }: Props) {
  const web = useRef<WebViewHandle>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  // Shown in the address bar: the page being loaded, then the page on screen.
  const [address, setAddress] = useState(startUrl);
  const [progress, setProgress] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useImperativeHandle(ref, () => ({
    goBack: () => {
      if (!canGoBack) return false;
      web.current?.goBack();
      return true;
    },
  }));

  const showNotice = (text: string) => {
    setNotice(text);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 3500);
  };

  const allowed = (url: string) => isInternal(url) || isBrowseUrl(url);

  const handleRequest = (req: ShouldStartLoadRequest) => {
    if (req.isTopFrame === false) return true;
    if (isPdf(req.url)) {
      showNotice('Brochures (PDF) can’t be opened on this kiosk.');
      return false;
    }
    if (!allowed(req.url)) {
      showNotice('This kiosk only shows Seylan Bank pages.');
      return false;
    }
    return true;
  };

  /** Links that would open a new tab load here instead, if they are allowed. */
  const openInPlace = (url: string) => {
    onActivity();
    if (handleRequest({ url, isTopFrame: true } as ShouldStartLoadRequest)) {
      web.current?.injectJavaScript(`window.location.href = ${JSON.stringify(url)}; true;`);
    }
  };

  const handleMessage = (e: WebViewMessageEvent) => {
    if (parseMessage(e.nativeEvent.data)) onActivity();
  };

  return (
    <View style={styles.container}>
      <TopBar
        url={address}
        canGoBack={canGoBack}
        progress={progress}
        onPageBack={() => {
          onActivity();
          web.current?.goBack();
        }}
        onReturn={onReturn}
      />

      {failed ? (
        <View style={styles.error}>
          <Text style={styles.errorTitle}>We couldn’t load this page</Text>
          <Text style={styles.errorBody}>Please check the connection and try again.</Text>
          <Pressable
            style={({ pressed }) => [styles.retry, pressed && { opacity: 0.75 }]}
            onPress={() => {
              setFailed(false);
              web.current?.reload();
            }}
          >
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      ) : null}

      <WebView
        ref={web}
        style={[styles.web, failed && styles.hidden]}
        source={{ uri: startUrl }}
        // Private session: no cookies, cache or form data outlive this view.
        incognito
        cacheEnabled={false}
        injectedJavaScript={ACTIVITY_SCRIPT}
        onMessage={handleMessage}
        onShouldStartLoadWithRequest={handleRequest}
        setSupportMultipleWindows
        onOpenWindow={(e) => openInPlace(e.nativeEvent.targetUrl)}
        onLoadStart={(e) => {
          onActivity();
          setProgress(0.1);
          if (e.nativeEvent.url) setAddress(e.nativeEvent.url);
        }}
        onLoadProgress={(e) => setProgress(e.nativeEvent.progress)}
        onLoadEnd={() => setProgress(1)}
        onNavigationStateChange={(nav) => {
          setCanGoBack(nav.canGoBack);
          if (nav.url) setAddress(nav.url);
        }}
        onError={() => setFailed(true)}
        javaScriptEnabled
        domStorageEnabled
        mediaPlaybackRequiresUserAction
        allowsBackForwardNavigationGestures={false}
        bounces={false}
      />

      {notice ? (
        <View style={styles.notice} pointerEvents="none">
          <Text style={styles.noticeText}>{notice}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#FFFFFF',
  },
  web: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  hidden: {
    height: 0,
    flex: 0,
  },
  error: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: colors.background,
  },
  errorTitle: {
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: 20,
    marginBottom: 8,
  },
  errorBody: {
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 15,
    marginBottom: 24,
  },
  retry: {
    borderRadius: radius.pill,
    paddingHorizontal: 28,
    paddingVertical: 13,
    backgroundColor: colors.pink,
  },
  retryText: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 15,
  },
  notice: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 32,
    alignItems: 'center',
  },
  noticeText: {
    overflow: 'hidden',
    color: colors.text,
    fontFamily: fonts.medium,
    fontSize: 14,
    backgroundColor: colors.surfaceTint,
    borderColor: colors.purple,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 18,
    paddingVertical: 11,
  },
});
