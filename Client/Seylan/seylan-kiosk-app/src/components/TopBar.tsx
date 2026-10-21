import { ActivityIndicator, Image, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { displayAddress } from '../lib/url';
import { colors, fonts, radius } from '../theme';
import { ChevronLeftIcon, HomeIcon, LockIcon } from './icons';
import { SeylanButton } from './SeylanButton';

type Props = {
  url: string;
  canGoBack: boolean;
  progress: number;
  onPageBack: () => void;
  onReturn: () => void;
};

/**
 * Browser-style bar above Seylan's site, in Seylan's dark tab colour:
 * previous page, a read-only address bar showing the page that is loading or
 * open, and a compact red "Back to Sensor". A thin red line shows loading.
 */
export function TopBar({ url, canGoBack, progress, onPageBack, onReturn }: Props) {
  const loading = progress < 1;
  const { host, path, secure } = displayAddress(url);
  // On phones a labelled button would squeeze the address; use a round home button instead.
  const compact = useWindowDimensions().width < 600;

  return (
    <View style={styles.wrap}>
      <View style={styles.bar}>
        <Pressable
          onPress={onPageBack}
          disabled={!canGoBack}
          accessibilityRole="button"
          accessibilityLabel="Previous page"
          hitSlop={8}
          style={({ pressed }) => [styles.iconButton, !canGoBack && styles.disabled, pressed && styles.pressed]}
        >
          <ChevronLeftIcon size={20} color="#FFFFFF" />
        </Pressable>

        <View style={styles.address} accessibilityRole="text" accessibilityLabel={`Page address ${host}${path}`}>
          <Image source={require('../../assets/seylan-logo.png')} style={styles.favicon} resizeMode="contain" />
          {loading ? (
            <ActivityIndicator size="small" color="rgba(255,255,255,0.7)" style={styles.status} />
          ) : secure ? (
            <View style={styles.status}>
              <LockIcon size={13} color="rgba(255,255,255,0.7)" />
            </View>
          ) : null}
          <Text style={styles.url} numberOfLines={1} ellipsizeMode="tail">
            <Text style={styles.urlHost}>{host || 'Loading…'}</Text>
            <Text style={styles.urlPath}>{path}</Text>
          </Text>
        </View>

        {compact ? (
          <Pressable
            onPress={onReturn}
            accessibilityRole="button"
            accessibilityLabel="Back to Sensor"
            hitSlop={8}
            style={({ pressed }) => [styles.homeButton, pressed && styles.homePressed]}
          >
            <HomeIcon size={19} />
          </Pressable>
        ) : (
          <SeylanButton size="md" label="Back to Sensor" icon={<HomeIcon size={17} />} onPress={onReturn} />
        )}
      </View>

      <View style={styles.track}>
        {loading ? <View style={[styles.fill, { width: `${Math.max(0.05, progress) * 100}%` }]} /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.seylanDark,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  homeButton: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.seylanRed,
  },
  homePressed: {
    backgroundColor: colors.seylanRedDeep,
  },
  address: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 38,
    paddingLeft: 10,
    paddingRight: 14,
    borderRadius: radius.pill,
    backgroundColor: colors.seylanDarkRaised,
  },
  favicon: {
    width: 20,
    height: 20,
  },
  status: {
    marginLeft: 8,
    width: 14,
    alignItems: 'center',
    transform: [{ scale: 0.8 }],
  },
  url: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
  },
  urlHost: {
    color: '#FFFFFF',
    fontFamily: fonts.medium,
  },
  urlPath: {
    color: 'rgba(255,255,255,0.55)',
    fontFamily: fonts.regular,
  },
  track: {
    height: 2,
    backgroundColor: colors.seylanDarkRaised,
  },
  fill: {
    height: 2,
    backgroundColor: colors.seylanRed,
  },
  disabled: {
    opacity: 0.35,
  },
  pressed: {
    opacity: 0.7,
  },
});
