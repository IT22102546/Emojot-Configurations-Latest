import type { ComponentType, Ref } from 'react';
import { WebView as RNWebView, type WebViewProps } from 'react-native-webview';

/** Commands the app calls on a WebView (react-native-webview 14 exports no ref type). */
export type WebViewHandle = {
  goBack: () => void;
  reload: () => void;
  injectJavaScript: (script: string) => void;
};

/**
 * The library's typings declare WebView without a `ref`, although it forwards
 * one at runtime. This re-types it so refs are checked.
 */
export const WebView = RNWebView as unknown as ComponentType<WebViewProps & { ref?: Ref<WebViewHandle> }>;
