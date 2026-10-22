import { Image, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radius } from '../theme';

type Props = {
  locationName?: string;
  title?: string;
  message?: string;
};

/**
 * Shown instead of the Sensor while the service at this branch is stopped in
 * the registry (Active unticked). The tablet stays set up; it returns to the
 * Sensor on its own once the branch is active again. Also used, with its own
 * title and message, when the whole APK build has been retired.
 */
export function ServiceStoppedScreen({
  locationName,
  title = 'Service unavailable',
  message = 'This service is not available at the moment. Thank you for your patience.',
}: Props) {
  return (
    <View style={styles.root}>
      <View style={styles.card}>
        <Image source={require('../../assets/seylan-logo.png')} style={styles.logo} resizeMode="contain" />
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.body}>{message}</Text>
        {locationName ? <Text style={styles.branch}>Seylan Bank · {locationName}</Text> : null}
      </View>
      <Text style={styles.powered}>
        Powered by <Text style={styles.emo}>emo</Text>
        <Text style={styles.jot}>jot</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: colors.seylanSoft,
  },
  card: {
    width: '100%',
    maxWidth: 520,
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 32,
    borderRadius: radius.lg,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 4,
    borderTopColor: colors.seylanRed,
    shadowColor: '#000000',
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  logo: {
    width: 96,
    height: 96,
    marginBottom: 20,
  },
  title: {
    color: colors.seylanInk,
    fontFamily: fonts.bold,
    fontSize: 26,
    textAlign: 'center',
  },
  body: {
    marginTop: 10,
    color: colors.seylanGrey,
    fontFamily: fonts.regular,
    fontSize: 16,
    lineHeight: 23,
    textAlign: 'center',
  },
  branch: {
    marginTop: 18,
    color: colors.seylanRed,
    fontFamily: fonts.semibold,
    fontSize: 14,
  },
  powered: {
    position: 'absolute',
    bottom: 32,
    color: colors.seylanGrey,
    fontFamily: fonts.regular,
    fontSize: 13,
    letterSpacing: 0.4,
  },
  emo: {
    color: '#1E88D8',
    fontFamily: fonts.bold,
  },
  jot: {
    color: colors.pink,
    fontFamily: fonts.bold,
  },
});
