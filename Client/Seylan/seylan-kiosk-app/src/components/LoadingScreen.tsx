import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { colors } from '../theme';

type Props = {
  /** When true the screen fades out, then calls onHidden. */
  done?: boolean;
  onHidden?: () => void;
  /** Branch name shown under "Seylan Bank". */
  subtitle?: string;
};

const RING = 236;
const RING_WIDTH = 7;
const HALO = RING + 56;
const LOGO = 150;
const BAR = 220;

/** Seylan red, deep to bright, for the ring and the loading bar. */
const seylanGradient = [colors.seylanRedDeep, colors.seylanRed, '#FF5A5F'] as const;

/**
 * Seylan Bank loading screen: the Seylan logo inside a spinning Seylan-red
 * ring on white, soft red tints behind, animated dots and "Powered by emojot".
 * Shown at start-up and while the Sensor loads. Uses the system font, because
 * it can appear before Inter has loaded.
 */
export function LoadingScreen({ done = false, onHidden, subtitle }: Props) {
  const [spin] = useState(() => new Animated.Value(0));
  const [pulse] = useState(() => new Animated.Value(0));
  const [dots] = useState(() => new Animated.Value(0));
  const [fade] = useState(() => new Animated.Value(1));
  const [sweep] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const loops = [
      Animated.loop(
        Animated.timing(spin, { toValue: 1, duration: 2600, easing: Easing.linear, useNativeDriver: true }),
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 0, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        ]),
      ),
      Animated.loop(
        Animated.timing(dots, { toValue: 1, duration: 1200, easing: Easing.linear, useNativeDriver: true }),
      ),
      Animated.loop(
        Animated.timing(sweep, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
      ),
    ];
    loops.forEach((loop) => loop.start());
    return () => loops.forEach((loop) => loop.stop());
  }, [spin, pulse, dots, sweep]);

  useEffect(() => {
    if (!done) return;
    const out = Animated.timing(fade, {
      toValue: 0,
      duration: 500,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    });
    out.start(({ finished }) => {
      if (finished) onHidden?.();
    });
    return () => out.stop();
  }, [done, fade, onHidden]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const sweepX = sweep.interpolate({ inputRange: [0, 1], outputRange: [-BAR * 0.45, BAR] });
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1.03] });
  const glow = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] });
  const dot = (offset: number) =>
    dots.interpolate({
      inputRange: [0, 0.33, 0.66, 1],
      outputRange: [0, 1, 2, 3].map((i) => ((i + 3 - offset) % 3 === 0 ? 1 : 0.25)),
    });

  return (
    <Animated.View style={[styles.root, { opacity: fade }]} pointerEvents={done ? 'none' : 'auto'}>
      {/* Soft Seylan tints from three corners: red, grey, red. */}
      <LinearGradient
        colors={[`${colors.seylanRed}10`, `${colors.seylanRed}00`]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.65, y: 0.6 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={[`${colors.seylanMenuGrey}0D`, `${colors.seylanMenuGrey}00`]}
        start={{ x: 1, y: 0 }}
        end={{ x: 0.45, y: 0.55 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={[`${colors.seylanRed}14`, `${colors.seylanRed}00`]}
        start={{ x: 1, y: 1 }}
        end={{ x: 0.35, y: 0.4 }}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.badge}>
        {/* Soft red glow around the ring, breathing with the logo. */}
        <Animated.View style={[styles.glowOuter, { opacity: glow, transform: [{ scale }] }]} />
        <Animated.View style={[styles.glowInner, { opacity: glow, transform: [{ scale }] }]} />
        <Animated.View style={[styles.ringWrap, { transform: [{ rotate }] }]}>
          <LinearGradient colors={seylanGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.fill} />
        </Animated.View>
        <View style={styles.ringHole} />
        <Animated.Image
          source={require('../../assets/seylan-logo.png')}
          style={[styles.logo, { transform: [{ scale }] }]}
          resizeMode="contain"
          accessibilityLabel="Seylan Bank"
        />
      </View>

      <Text style={styles.title}>Seylan Bank</Text>
      {subtitle ? <Text style={styles.branch}>{subtitle}</Text> : null}
      <View style={styles.loadingRow}>
        <Text style={styles.subtitle}>Getting things ready</Text>
        {[0, 1, 2].map((i) => (
          <Animated.View key={i} style={[styles.dot, { opacity: dot(i) }]} />
        ))}
      </View>

      <View style={styles.barTrack}>
        <Animated.View style={[styles.barSweep, { transform: [{ translateX: sweepX }] }]}>
          <LinearGradient colors={seylanGradient} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={styles.fill} />
        </Animated.View>
      </View>

      <Text style={styles.powered}>
        Powered by <Text style={styles.emo}>emo</Text>
        <Text style={styles.jot}>jot</Text>
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    zIndex: 10,
  },
  badge: {
    width: HALO + 24,
    height: HALO + 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  glowOuter: {
    position: 'absolute',
    width: HALO,
    height: HALO,
    borderRadius: HALO / 2,
    backgroundColor: `${colors.seylanRed}0F`,
  },
  glowInner: {
    position: 'absolute',
    width: RING + 26,
    height: RING + 26,
    borderRadius: (RING + 26) / 2,
    backgroundColor: `${colors.seylanRed}1C`,
  },
  ringWrap: {
    position: 'absolute',
    width: RING,
    height: RING,
    borderRadius: RING / 2,
    overflow: 'hidden',
  },
  fill: {
    flex: 1,
  },
  ringHole: {
    position: 'absolute',
    width: RING - RING_WIDTH * 2,
    height: RING - RING_WIDTH * 2,
    borderRadius: (RING - RING_WIDTH * 2) / 2,
    backgroundColor: '#FFFFFF',
  },
  logo: {
    width: LOGO,
    height: LOGO,
  },
  title: {
    color: colors.seylanInk,
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  branch: {
    color: colors.seylanRed,
    fontSize: 15,
    fontWeight: '600',
    marginTop: 4,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 5,
  },
  subtitle: {
    color: colors.seylanGrey,
    fontSize: 15,
    marginRight: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.seylanRed,
  },
  barTrack: {
    width: BAR,
    height: 4,
    marginTop: 26,
    borderRadius: 2,
    overflow: 'hidden',
    backgroundColor: colors.seylanLine,
  },
  barSweep: {
    width: BAR * 0.45,
    height: 4,
  },
  powered: {
    position: 'absolute',
    bottom: 36,
    color: colors.seylanGrey,
    fontSize: 13,
    letterSpacing: 0.4,
  },
  emo: {
    color: '#1E88D8',
    fontWeight: '700',
  },
  jot: {
    color: colors.pink,
    fontWeight: '700',
  },
});
