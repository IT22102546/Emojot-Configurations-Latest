import { useEffect, useState, type ReactNode } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text } from 'react-native';

import { colors, fonts, radius } from '../theme';

type Props = {
  label: string;
  onPress: () => void;
  icon?: ReactNode;
  trailing?: ReactNode;
  accessibilityLabel?: string;
  /** 'lg' floats over the Sensor, 'md' sits in the top bar. */
  size?: 'md' | 'lg';
  /** A slow, small pulse so the button gets noticed without flashing. */
  pulse?: boolean;
};

/**
 * Solid Seylan-red pill, matching the buttons on Seylan's Sensor and website
 * ("Next", "Accept All"). Used for "View products" and "Back to Sensor".
 */
export function SeylanButton({ label, onPress, icon, trailing, accessibilityLabel, size = 'lg', pulse = false }: Props) {
  const [beat] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!pulse) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(beat, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(beat, { toValue: 0, duration: 1500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [beat, pulse]);

  const scale = beat.interpolate({ inputRange: [0, 1], outputRange: [1, 1.03] });
  const large = size === 'lg';

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
        hitSlop={8}
        style={({ pressed }) => [styles.button, large ? styles.lg : styles.md, pressed && styles.pressed]}
      >
        {icon}
        <Text style={[styles.label, large ? styles.labelLg : styles.labelMd]} numberOfLines={1}>
          {label}
        </Text>
        {trailing}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.seylanRed,
    shadowColor: '#000000',
    shadowOpacity: 0.22,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  lg: {
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 24,
  },
  md: {
    gap: 7,
    paddingVertical: 9,
    paddingHorizontal: 15,
    shadowOpacity: 0.16,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  pressed: {
    backgroundColor: colors.seylanRedDeep,
  },
  label: {
    color: '#FFFFFF',
    fontFamily: fonts.bold,
    letterSpacing: 0.2,
  },
  labelLg: {
    fontSize: 16,
  },
  labelMd: {
    fontSize: 14,
  },
});
