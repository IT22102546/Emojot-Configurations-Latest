import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { config } from '../config';
import {
  claimLocation,
  fetchLocations,
  fetchStatus,
  type ClaimedLocation,
  type ClaimResult,
  type RegistryLocation,
} from '../lib/registry';
import { useAssignmentStore } from '../store/assignmentStore';
import { colors, fonts, radius } from '../theme';
import { SeylanButton } from './SeylanButton';

type Status = 'checking' | 'ready' | 'error';

function errorMessage(result: Extract<ClaimResult, { ok: false }>, name: string): string {
  switch (result.error) {
    case 'wrong_pin':
      return `Incorrect PIN. ${result.attemptsLeft ?? 0} attempt(s) left.`;
    case 'locked_out':
      return `Too many incorrect PINs. Try again in ${result.minutes ?? 15} minutes.`;
    case 'taken':
      return `${name} is already set up on another tablet.`;
    case 'device_already_assigned':
      return `This tablet is already set up for ${result.location?.name ?? 'another branch'}.`;
    case 'pin_not_configured':
      return 'No PIN has been set for this branch yet.';
    case 'build_disabled':
      return 'This app version is no longer in use.';
    case 'network':
      return 'No connection. Check the internet and try again.';
    default:
      return 'Setup failed. Please try again.';
  }
}

/**
 * First-launch setup: staff pick this tablet's branch and confirm with the
 * branch's PIN. The registry makes sure each branch is used by only its allowed
 * number of tablets for this APK build. Shown once; the choice is then saved.
 */
export function SetupScreen() {
  const setAssignment = useAssignmentStore((s) => s.setAssignment);
  const setBuildDisabled = useAssignmentStore((s) => s.setBuildDisabled);

  const [status, setStatus] = useState<Status>('checking');
  const [locations, setLocations] = useState<RegistryLocation[]>([]);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<RegistryLocation | null>(null);
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const finish = useCallback(
    (location: ClaimedLocation) =>
      setAssignment({
        buildId: config.buildId,
        locationId: location.id,
        locationName: location.name,
        sensorUrl: location.url,
      }),
    [setAssignment],
  );

  const load = useCallback(async () => {
    setStatus('checking');
    try {
      // A reinstalled tablet gets its own branch back without the PIN.
      const { claim, buildDisabled } = await fetchStatus();
      if (buildDisabled) {
        setBuildDisabled(true);
        return;
      }
      if (claim) {
        finish(claim);
        return;
      }
      setLocations(await fetchLocations());
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, [finish, setBuildDisabled]);

  useEffect(() => {
    // Network work starts on mount; state is only set once the requests answer.
    const start = setTimeout(load, 0);
    return () => clearTimeout(start);
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? locations.filter((l) => l.name.toLowerCase().includes(q)) : locations;
  }, [locations, query]);

  const submit = async () => {
    if (!selected || pin.length < 4) return;
    setBusy(true);
    setError(null);
    const result = await claimLocation(selected.id, pin);
    setBusy(false);
    if (result.ok) {
      finish(result.location);
      return;
    }
    setError(errorMessage(result, selected.name));
    if (result.error === 'taken') {
      setSelected(null);
      fetchLocations().then(setLocations).catch(() => undefined);
    }
    if (result.error === 'wrong_pin') setPin('');
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.page}>
          <View style={styles.header}>
            <Image source={require('../../assets/seylan-logo.png')} style={styles.logo} resizeMode="contain" />
            <View style={styles.flex}>
              <Text style={styles.title}>Set up this tablet</Text>
              <Text style={styles.subtitle}>Choose the branch this tablet belongs to.</Text>
            </View>
          </View>

          <View style={styles.notice}>
            <Text style={styles.noticeText}>
              Each branch can be set up on its own tablet only. Once set up, this tablet always opens that branch’s
              Sensor.
            </Text>
          </View>

          {status === 'checking' ? (
            <View style={styles.center}>
              <ActivityIndicator color={colors.seylanRed} size="large" />
              <Text style={styles.muted}>Checking this tablet…</Text>
            </View>
          ) : status === 'error' ? (
            <View style={styles.center}>
              <Text style={styles.errorTitle}>Can’t reach the registry</Text>
              <Text style={styles.muted}>Check the internet connection and try again.</Text>
              <View style={styles.retry}>
                <SeylanButton size="md" label="Try again" onPress={load} />
              </View>
            </View>
          ) : (
            <>
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search branch"
                placeholderTextColor={colors.seylanGrey}
                style={styles.search}
                autoCorrect={false}
              />

              <FlatList
                data={filtered}
                keyExtractor={(l) => l.id}
                style={styles.list}
                keyboardShouldPersistTaps="handled"
                ItemSeparatorComponent={() => <View style={styles.separator} />}
                renderItem={({ item }) => {
                  const free = item.available > 0;
                  const isSelected = selected?.id === item.id;
                  return (
                    <Pressable
                      disabled={!free}
                      onPress={() => {
                        setSelected(item);
                        setError(null);
                      }}
                      style={[styles.row, isSelected && styles.rowSelected, !free && styles.rowTaken]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isSelected, disabled: !free }}
                    >
                      <View style={[styles.radio, isSelected && styles.radioOn]}>
                        {isSelected ? <View style={styles.radioDot} /> : null}
                      </View>
                      <Text style={[styles.rowName, !free && styles.rowNameTaken]} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <Text style={[styles.chip, free ? styles.chipFree : styles.chipTaken]}>
                        {!free ? 'Taken' : item.max > 1 ? `${item.available} of ${item.max} free` : 'Available'}
                      </Text>
                    </Pressable>
                  );
                }}
                ListEmptyComponent={<Text style={[styles.muted, styles.empty]}>No branch matches “{query}”.</Text>}
              />

              <View style={styles.footer}>
                <Text style={styles.footerLabel}>
                  {selected ? `Selected: ${selected.name}` : 'Select a branch above'}
                </Text>
                <View style={styles.footerRow}>
                  <TextInput
                    value={pin}
                    onChangeText={(t) => setPin(t.replace(/\D/g, '').slice(0, 8))}
                    placeholder="Branch PIN"
                    placeholderTextColor={colors.seylanGrey}
                    secureTextEntry
                    keyboardType="number-pad"
                    style={styles.pin}
                    editable={!!selected && !busy}
                  />
                  {busy ? (
                    <ActivityIndicator color={colors.seylanRed} style={styles.spinner} />
                  ) : (
                    <View style={[!selected || pin.length < 4 ? styles.dimmed : null]}>
                      <SeylanButton size="md" label="Set up tablet" onPress={submit} />
                    </View>
                  )}
                </View>
                {error ? <Text style={styles.error}>{error}</Text> : null}
              </View>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  flex: {
    flex: 1,
  },
  page: {
    flex: 1,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  logo: {
    width: 48,
    height: 48,
  },
  title: {
    color: colors.seylanInk,
    fontFamily: fonts.bold,
    fontSize: 22,
  },
  subtitle: {
    color: colors.seylanGrey,
    fontFamily: fonts.regular,
    fontSize: 14,
    marginTop: 2,
  },
  notice: {
    marginTop: 16,
    padding: 12,
    borderRadius: radius.sm,
    backgroundColor: `${colors.seylanRed}0D`,
    borderLeftWidth: 3,
    borderLeftColor: colors.seylanRed,
  },
  noticeText: {
    color: colors.seylanInk,
    fontFamily: fonts.regular,
    fontSize: 13.5,
    lineHeight: 19,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  muted: {
    color: colors.seylanGrey,
    fontFamily: fonts.regular,
    fontSize: 14,
  },
  errorTitle: {
    color: colors.seylanInk,
    fontFamily: fonts.semibold,
    fontSize: 18,
  },
  retry: {
    marginTop: 8,
  },
  search: {
    marginTop: 16,
    height: 46,
    paddingHorizontal: 16,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.seylanLine,
    backgroundColor: colors.seylanSoft,
    color: colors.seylanInk,
    fontFamily: fonts.regular,
    fontSize: 15,
  },
  list: {
    flex: 1,
    marginTop: 12,
  },
  separator: {
    height: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.seylanLine,
    backgroundColor: '#FFFFFF',
  },
  rowSelected: {
    borderColor: colors.seylanRed,
    borderWidth: 1.5,
    backgroundColor: `${colors.seylanRed}08`,
  },
  rowTaken: {
    backgroundColor: colors.seylanSoft,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.seylanLine,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: {
    borderColor: colors.seylanRed,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.seylanRed,
  },
  rowName: {
    flex: 1,
    color: colors.seylanInk,
    fontFamily: fonts.medium,
    fontSize: 15.5,
  },
  rowNameTaken: {
    color: colors.seylanGrey,
  },
  chip: {
    overflow: 'hidden',
    fontFamily: fonts.semibold,
    fontSize: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  chipFree: {
    color: '#1C7C3A',
    backgroundColor: '#E7F5EC',
  },
  chipTaken: {
    color: colors.seylanGrey,
    backgroundColor: colors.seylanLine,
  },
  empty: {
    textAlign: 'center',
    marginTop: 24,
  },
  footer: {
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: colors.seylanLine,
    backgroundColor: '#FFFFFF',
  },
  footerLabel: {
    color: colors.seylanInk,
    fontFamily: fonts.semibold,
    fontSize: 14,
    marginBottom: 10,
  },
  footerRow: {
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
    paddingHorizontal: 40,
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
});
