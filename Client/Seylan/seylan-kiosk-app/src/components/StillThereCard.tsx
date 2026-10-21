import { useEffect, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';

import { colors, fonts, neonGradient, radius } from '../theme';
import { HomeIcon } from './icons';

type Props = {
  secondsLeft: number;
  totalSeconds: number;
  onStay: () => void;
  onLeave: () => void;
};

/** Below this width (phones, portrait) the card shrinks and the buttons stack. */
const COMPACT_WIDTH = 560;
const STROKE = 7;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** The bot's mood as time runs out. */
function moodFor(fraction: number) {
  if (fraction > 0.66) return '🙂';
  if (fraction > 0.33) return '🤔';
  return '😴';
}

/** Speech bubble beside the bot. Remounted on each mood change, so it pops in. */
function MoodBubble({ emoji }: { emoji: string }) {
  const [pop] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const anim = Animated.spring(pop, { toValue: 1, friction: 5, tension: 120, useNativeDriver: true });
    anim.start();
    return () => anim.stop();
  }, [pop]);

  const scale = pop.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] });

  return (
    <Animated.View style={[styles.bubble, { opacity: pop, transform: [{ scale }] }]}>
      <Text style={styles.bubbleEmoji}>{emoji}</Text>
      <View style={styles.bubbleTail} />
    </Animated.View>
  );
}

/**
 * "Are you still there?" on Seylan's site. The Emojot bot hovers inside a
 * countdown ring, its speech bubble getting sleepier as time runs out, with a
 * clear choice between continuing and returning to the start.
 */
export function StillThereCard({ secondsLeft, totalSeconds, onStay, onLeave }: Props) {
  const { width } = useWindowDimensions();
  const compact = width < COMPACT_WIDTH;
  const ring = compact ? 150 : 180;
  const bot = compact ? 92 : 112;
  const r = (ring - STROKE) / 2;
  const circumference = 2 * Math.PI * r;

  const [appear] = useState(() => new Animated.Value(0));
  const [drain] = useState(() => new Animated.Value(0));
  const [float] = useState(() => new Animated.Value(0));
  const [tilt] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const animations = [
      Animated.timing(appear, { toValue: 1, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      // SVG props are not on the native driver; one 0→1 sweep is cheap.
      Animated.timing(drain, {
        toValue: 1,
        duration: totalSeconds * 1000,
        easing: Easing.linear,
        useNativeDriver: false,
      }),
      // The bot hovers gently...
      Animated.loop(
        Animated.sequence([
          Animated.timing(float, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(float, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]),
      ),
      // ...and gives a small wave every few seconds.
      Animated.loop(
        Animated.sequence([
          Animated.delay(1800),
          Animated.timing(tilt, { toValue: 1, duration: 180, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(tilt, { toValue: -1, duration: 260, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(tilt, { toValue: 0.6, duration: 220, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(tilt, { toValue: 0, duration: 200, easing: Easing.in(Easing.quad), useNativeDriver: true }),
        ]),
      ),
    ];
    animations.forEach((a) => a.start());
    return () => animations.forEach((a) => a.stop());
  }, [appear, drain, float, tilt, totalSeconds]);

  const fraction = totalSeconds > 0 ? secondsLeft / totalSeconds : 0;
  const urgent = fraction <= 0.33;
  const mood = moodFor(fraction);

  const cardScale = appear.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] });
  const cardLift = appear.interpolate({ inputRange: [0, 1], outputRange: [16, 0] });
  const dashOffset = drain.interpolate({ inputRange: [0, 1], outputRange: [0, circumference] });
  const floatY = float.interpolate({ inputRange: [0, 1], outputRange: [-5, 5] });
  const rotate = tilt.interpolate({ inputRange: [-1, 1], outputRange: ['-7deg', '7deg'] });

  const primary = (
    <Pressable
      onPress={onStay}
      accessibilityRole="button"
      style={({ pressed }) => [compact ? styles.fullWidth : styles.primaryWrap, pressed && styles.pressed]}
    >
      <LinearGradient
        colors={[colors.pink, colors.purple, colors.violet]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.primary}
      >
        <Text style={styles.primaryText} numberOfLines={1} adjustsFontSizeToFit>
          Continue browsing
        </Text>
      </LinearGradient>
    </Pressable>
  );

  const secondary = (
    <Pressable
      onPress={onLeave}
      accessibilityRole="button"
      style={({ pressed }) => [styles.secondary, compact ? styles.fullWidth : styles.secondaryWrap, pressed && styles.pressed]}
    >
      <HomeIcon size={18} color={colors.text} />
      <Text style={styles.secondaryText} numberOfLines={1} adjustsFontSizeToFit>
        Return to start
      </Text>
    </Pressable>
  );

  return (
    <Animated.View style={[styles.backdrop, { opacity: appear }]}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onStay} accessibilityLabel="Continue browsing" />

      <Animated.View
        style={[
          styles.frameWrap,
          { maxWidth: compact ? 420 : 480, transform: [{ translateY: cardLift }, { scale: cardScale }] },
        ]}
      >
        <LinearGradient colors={neonGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.frame}>
          <Pressable style={[styles.card, compact && styles.cardCompact]} onPress={onStay}>
            <View style={{ width: ring, height: ring, alignItems: 'center', justifyContent: 'center' }}>
              <Svg width={ring} height={ring} style={styles.ringSvg}>
                <Defs>
                  <SvgGradient id="ring" x1="0" y1="0" x2="1" y2="1">
                    <Stop offset="0" stopColor={colors.blue} />
                    <Stop offset="0.45" stopColor={colors.violet} />
                    <Stop offset="1" stopColor={colors.pink} />
                  </SvgGradient>
                </Defs>
                <Circle cx={ring / 2} cy={ring / 2} r={r} stroke="rgba(255,255,255,0.08)" strokeWidth={STROKE} fill="none" />
                <AnimatedCircle
                  cx={ring / 2}
                  cy={ring / 2}
                  r={r}
                  stroke="url(#ring)"
                  strokeWidth={STROKE}
                  strokeLinecap="round"
                  fill="none"
                  strokeDasharray={`${circumference} ${circumference}`}
                  strokeDashoffset={dashOffset}
                />
              </Svg>

              <Animated.Image
                source={require('../../assets/emojot-bot.png')}
                style={{ width: bot, height: bot, transform: [{ translateY: floatY }, { rotate }] }}
                resizeMode="contain"
                accessibilityLabel="Emojot assistant"
              />

              <View style={[styles.bubbleAnchor, { top: ring * 0.08, right: -ring * 0.06 }]}>
                <MoodBubble key={mood} emoji={mood} />
              </View>
            </View>

            <View style={[styles.timer, urgent && styles.timerUrgent]}>
              <View style={[styles.timerDot, urgent && styles.timerDotUrgent]} />
              <Text style={[styles.timerText, urgent && styles.timerTextUrgent]}>
                Returning to start in {secondsLeft}s
              </Text>
            </View>

            <Text style={[styles.title, compact && styles.titleCompact]}>Are you still there?</Text>
            <Text style={[styles.body, compact && styles.bodyCompact]}>
              For your privacy, this browsing session will close and the screen will return to the start for the
              next customer.
            </Text>

            {compact ? (
              <View style={styles.actionsColumn}>
                {primary}
                {secondary}
              </View>
            ) : (
              <View style={styles.actionsRow}>
                {secondary}
                {primary}
              </View>
            )}
          </Pressable>
        </LinearGradient>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(1,1,1,0.78)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  frameWrap: {
    width: '100%',
  },
  frame: {
    borderRadius: radius.lg + 1.5,
    padding: 1.5,
    shadowColor: colors.violet,
    shadowOpacity: 0.55,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 10 },
    elevation: 14,
  },
  card: {
    borderRadius: radius.lg,
    backgroundColor: '#0B0B10',
    paddingTop: 30,
    paddingBottom: 26,
    paddingHorizontal: 30,
    alignItems: 'center',
  },
  cardCompact: {
    paddingTop: 24,
    paddingBottom: 22,
    paddingHorizontal: 20,
  },
  ringSvg: {
    position: 'absolute',
    transform: [{ rotate: '-90deg' }],
  },
  bubbleAnchor: {
    position: 'absolute',
  },
  bubble: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#1B1A26',
    borderWidth: 1.5,
    borderColor: `${colors.purple}99`,
    shadowColor: colors.purple,
    shadowOpacity: 0.6,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  bubbleEmoji: {
    fontSize: 24,
    lineHeight: 30,
  },
  bubbleTail: {
    position: 'absolute',
    bottom: -4,
    left: 8,
    width: 10,
    height: 10,
    backgroundColor: '#1B1A26',
    borderLeftWidth: 1.5,
    borderBottomWidth: 1.5,
    borderColor: `${colors.purple}99`,
    transform: [{ rotate: '-20deg' }],
  },
  timer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 18,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: `${colors.blue}1A`,
    borderWidth: 1,
    borderColor: `${colors.blue}40`,
  },
  timerUrgent: {
    backgroundColor: `${colors.pink}1F`,
    borderColor: `${colors.pink}66`,
  },
  timerDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.blue,
  },
  timerDotUrgent: {
    backgroundColor: colors.pink,
  },
  timerText: {
    color: colors.blue,
    fontFamily: fonts.semibold,
    fontSize: 13.5,
  },
  timerTextUrgent: {
    color: colors.pink,
  },
  title: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 25,
    textAlign: 'center',
    marginTop: 16,
  },
  titleCompact: {
    fontSize: 22,
    marginTop: 14,
  },
  body: {
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 24,
  },
  bodyCompact: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
  },
  actionsRow: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    gap: 12,
  },
  actionsColumn: {
    alignSelf: 'stretch',
    gap: 10,
  },
  fullWidth: {
    alignSelf: 'stretch',
  },
  primaryWrap: {
    flex: 1.15,
  },
  secondaryWrap: {
    flex: 1,
  },
  primary: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: radius.pill,
  },
  primaryText: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 15.5,
  },
  secondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 15,
    paddingHorizontal: 18,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  secondaryText: {
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: 15,
  },
  pressed: {
    opacity: 0.8,
  },
});
