import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getKioskState, isKioskAvailable, lockKiosk } from '../../modules/kiosk-mode';
import { config } from '../config';
import { checkExitPin, deviceId, type ExitPinResult } from '../lib/registry';
import { useAssignmentStore } from '../store/assignmentStore';
import { useKioskLockStore } from '../store/kioskLockStore';
import { colors, fonts, radius } from '../theme';
import { SeylanButton } from './SeylanButton';

const TAPS = 5;
const TAP_WINDOW_MS = 3000;
const HOTSPOT = 72;
/** Seconds the "Exit kiosk" box waits for the PIN before the app pins itself again. */
const EXIT_PROMPT_SECONDS = 30;

type Step = 'pin' | 'menu';

function pinError(result: Extract<ExitPinResult, { ok: false }>): string {
  switch (result.error) {
    case 'wrong_pin':
      return `Incorrect PIN. ${result.attemptsLeft ?? 0} attempt(s) left.`;
    case 'locked_out':
      return `Too many incorrect PINs. Try again in ${result.minutes ?? 15} minutes.`;
    case 'pin_not_configured':
      return 'No exit PIN has been set in the registry yet.';
    case 'network':
      return 'No connection. The exit PIN is checked online.';
    default:
      return 'Could not check the PIN. Please try again.';
  }
}

function lockLabel(): string {
  if (!isKioskAvailable) return 'Not available in this preview';
  const { deviceOwner, lockTask } = getKioskState();
  if (lockTask === 'locked') return 'Full kiosk (device owner)';
  if (lockTask === 'pinned') return deviceOwner ? 'Pinned' : 'Screen pinning';
  return 'Unlocked';
}

/**
 * Staff access for the kiosk lock. Holding Back + Recents (Android's unpin
 * gesture) opens an "Exit kiosk" PIN box; the right exit PIN unlocks the
 * tablet, Cancel or 30 seconds pins it again. Five quick taps in the
 * bottom-left corner open the same PIN box and then the admin menu. The exit
 * PIN is checked by the registry, never stored in the app. The menu unlocks the tablet (it locks itself again after
 * config.kioskRelockMinutes or on restart) and shows the tablet's details.
 * While unlocked, a small bar at the top offers "Lock now".
 */
export function KioskAdmin() {
  const insets = useSafeAreaInsets();
  const assignment = useAssignmentStore((s) => s.assignment);
  const unlocked = useKioskLockStore((s) => s.unlocked);
  const setUnlocked = useKioskLockStore((s) => s.setUnlocked);
  const exitPrompt = useKioskLockStore((s) => s.exitPrompt);
  const setExitPrompt = useKioskLockStore((s) => s.setExitPrompt);

  const taps = useRef<number[]>([]);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>('pin');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onHotspot = () => {
    const now = Date.now();
    taps.current = [...taps.current.filter((t) => now - t < TAP_WINDOW_MS), now];
    if (taps.current.length >= TAPS) {
      taps.current = [];
      setStep(unlocked ? 'menu' : 'pin');
      setPin('');
      setError(null);
      setOpen(true);
    }
  };

  const close = () => {
    setOpen(false);
    setExitPrompt(false);
    setStep('pin');
    setPin('');
    setError(null);
  };

  // Nobody entered the exit PIN in time: drop the box so the app pins itself again.
  useEffect(() => {
    if (!exitPrompt) return;
    const timer = setTimeout(() => setExitPrompt(false), EXIT_PROMPT_SECONDS * 1000);
    return () => clearTimeout(timer);
  }, [exitPrompt, setExitPrompt]);

  const submitPin = async () => {
    if (pin.length < 4 || busy) return;
    setBusy(true);
    setError(null);
    const result = await checkExitPin(pin);
    setBusy(false);
    setPin('');
    if (!result.ok) {
      setError(pinError(result));
    } else if (exitPrompt) {
      // Back + Recents + right PIN: exit the kiosk straight away.
      setUnlocked(true);
      close();
    } else {
      setStep('menu');
    }
  };

  const lockNow = () => {
    setUnlocked(false);
    lockKiosk().catch(() => undefined);
    close();
  };

  if (!config.kioskLock) return null;

  return (
    <>
      <Pressable
        onPress={onHotspot}
        style={styles.hotspot}
        accessible={false}
      />

      {unlocked && !open && !exitPrompt ? (
        <View style={[styles.unlockedBar, { top: insets.top + 8 }]} pointerEvents="box-none">
          <View style={styles.unlockedPill}>
            <View style={styles.unlockedDot} />
            <Text style={styles.unlockedText}>Kiosk unlocked</Text>
            <Pressable onPress={lockNow} style={styles.unlockedAction} accessibilityRole="button">
              <Text style={styles.unlockedActionText}>Lock now</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      <Modal visible={open || exitPrompt} transparent animationType="fade" onRequestClose={close} statusBarTranslucent>
        <KeyboardAvoidingView
          style={styles.backdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.card}>
            <View style={styles.header}>
              <Image source={require('../../assets/seylan-logo.png')} style={styles.logo} resizeMode="contain" />
              <View style={styles.flex}>
                <Text style={styles.title}>{exitPrompt ? 'Exit kiosk' : 'Kiosk admin'}</Text>
                <Text style={styles.subtitle}>
                  {assignment ? `Seylan Bank · ${assignment.locationName}` : 'Seylan Bank kiosk'}
                </Text>
              </View>
            </View>

            {step === 'pin' ? (
              <>
                <Text style={styles.label}>
                  {exitPrompt ? 'Enter the exit PIN to unlock this tablet.' : 'Enter the exit PIN'}
                </Text>
                <View style={styles.row}>
                  <TextInput
                    value={pin}
                    onChangeText={(t) => setPin(t.replace(/\D/g, '').slice(0, 8))}
                    onSubmitEditing={submitPin}
                    placeholder="Exit PIN"
                    placeholderTextColor={colors.seylanGrey}
                    secureTextEntry
                    keyboardType="number-pad"
                    autoFocus
                    editable={!busy}
                    style={styles.pin}
                  />
                  {busy ? (
                    <ActivityIndicator color={colors.seylanRed} style={styles.spinner} />
                  ) : (
                    <View style={pin.length < 4 ? styles.dimmed : null}>
                      <SeylanButton size="md" label="Continue" onPress={submitPin} />
                    </View>
                  )}
                </View>
                {error ? <Text style={styles.error}>{error}</Text> : null}
              </>
            ) : (
              <>
                <View style={styles.details}>
                  <Detail label="Lock" value={unlocked ? 'Unlocked by staff' : lockLabel()} />
                  <Detail label="Branch" value={assignment?.locationName ?? 'Not set up'} />
                  <Detail label="App build" value={config.buildId} />
                  <Detail label="Tablet ID" value={deviceId()} />
                </View>

                <View style={styles.actions}>
                  {unlocked ? (
                    <>
                      <SeylanButton size="md" label="Lock now" onPress={lockNow} />
                      {Platform.OS === 'android' ? (
                        <Pressable
                          onPress={() => Linking.sendIntent('android.settings.SETTINGS').catch(() => undefined)}
                          style={styles.secondary}
                          accessibilityRole="button"
                        >
                          <Text style={styles.secondaryText}>Open Android settings</Text>
                        </Pressable>
                      ) : null}
                      {Platform.OS === 'android' ? (
                        <Pressable
                          onPress={() => Linking.sendIntent('android.settings.HOME_SETTINGS').catch(() => undefined)}
                          style={styles.secondary}
                          accessibilityRole="button"
                        >
                          <Text style={styles.secondaryText}>Change Home app</Text>
                        </Pressable>
                      ) : null}
                    </>
                  ) : (
                    <SeylanButton
                      size="md"
                      label={`Unlock for ${config.kioskRelockMinutes} min`}
                      onPress={() => {
                        setUnlocked(true);
                        close();
                      }}
                    />
                  )}
                </View>
              </>
            )}

            <Pressable onPress={close} style={styles.cancel} accessibilityRole="button">
              <Text style={styles.cancelText}>{exitPrompt ? 'Cancel' : 'Close'}</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detail}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hotspot: {
    position: 'absolute',
    left: 0,
    bottom: 0,
    width: HOTSPOT,
    height: HOTSPOT,
    zIndex: 50,
  },
  unlockedBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 60,
  },
  unlockedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: 14,
    paddingRight: 6,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.seylanDark,
  },
  unlockedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F5A524',
  },
  unlockedText: {
    color: '#FFFFFF',
    fontFamily: fonts.medium,
    fontSize: 13,
  },
  unlockedAction: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.seylanRed,
  },
  unlockedActionText: {
    color: '#FFFFFF',
    fontFamily: fonts.semibold,
    fontSize: 13,
  },
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  card: {
    width: '100%',
    maxWidth: 460,
    padding: 24,
    borderRadius: radius.lg,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 4,
    borderTopColor: colors.seylanRed,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 18,
  },
  logo: {
    width: 40,
    height: 40,
  },
  flex: {
    flex: 1,
  },
  title: {
    color: colors.seylanInk,
    fontFamily: fonts.bold,
    fontSize: 20,
  },
  subtitle: {
    color: colors.seylanGrey,
    fontFamily: fonts.regular,
    fontSize: 13.5,
    marginTop: 2,
  },
  label: {
    color: colors.seylanInk,
    fontFamily: fonts.semibold,
    fontSize: 14,
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  pin: {
    flex: 1,
    height: 46,
    paddingHorizontal: 16,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.seylanLine,
    color: colors.seylanInk,
    fontFamily: fonts.semibold,
    fontSize: 16,
    letterSpacing: 4,
  },
  spinner: {
    paddingHorizontal: 32,
  },
  dimmed: {
    opacity: 0.45,
  },
  error: {
    marginTop: 10,
    color: colors.seylanRed,
    fontFamily: fonts.medium,
    fontSize: 13.5,
  },
  details: {
    borderRadius: radius.md,
    backgroundColor: colors.seylanSoft,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  detail: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
    paddingVertical: 8,
  },
  detailLabel: {
    color: colors.seylanGrey,
    fontFamily: fonts.regular,
    fontSize: 13.5,
  },
  detailValue: {
    flexShrink: 1,
    color: colors.seylanInk,
    fontFamily: fonts.semibold,
    fontSize: 13.5,
  },
  actions: {
    marginTop: 18,
    gap: 10,
    alignItems: 'flex-start',
  },
  secondary: {
    paddingVertical: 10,
  },
  secondaryText: {
    color: colors.seylanRed,
    fontFamily: fonts.semibold,
    fontSize: 14,
  },
  cancel: {
    alignSelf: 'flex-end',
    marginTop: 14,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  cancelText: {
    color: colors.seylanGrey,
    fontFamily: fonts.semibold,
    fontSize: 14,
  },
});
