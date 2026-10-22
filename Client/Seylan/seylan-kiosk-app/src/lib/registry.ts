import * as Application from 'expo-application';
import { Platform } from 'react-native';

import { config } from '../config';

export type RegistryLocation = {
  id: string;
  name: string;
  max: number;
  used: number;
  available: number;
};

/** active is false when the service at this branch has been stopped in the registry. */
export type ClaimedLocation = { id: string; name: string; url: string; active?: boolean };

export type ClaimError =
  | 'wrong_pin'
  | 'locked_out'
  | 'taken'
  | 'device_already_assigned'
  | 'unknown_location'
  | 'pin_not_configured'
  | 'invalid'
  | 'build_disabled'
  | 'server'
  | 'network';

export type ClaimResult =
  | { ok: true; location: ClaimedLocation }
  | { ok: false; error: ClaimError; attemptsLeft?: number; minutes?: number; location?: ClaimedLocation };

/**
 * Stable ID for this tablet. On Android this is the Android ID, which stays the
 * same across reinstalls of the same APK, so a reinstalled tablet can reclaim
 * its own location (but no other tablet can).
 */
export function deviceId(): string {
  if (Platform.OS === 'android') return Application.getAndroidId();
  return `${Platform.OS}-${Application.applicationId ?? 'app'}`;
}

function deviceName(): string {
  return `${Platform.OS} ${String(Platform.Version)}`;
}

function url(params: Record<string, string>): string {
  const query = Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  return `${config.registryUrl}${config.registryUrl.includes('?') ? '&' : '?'}${query}`;
}

export async function fetchLocations(): Promise<RegistryLocation[]> {
  const res = await fetch(url({ action: 'locations', build: config.buildId }));
  const json = await res.json();
  if (!json.ok) throw new Error(json.message || json.error || 'Could not load locations');
  return json.locations as RegistryLocation[];
}

export type TabletStatus = {
  /** The location this tablet holds for this build, if any (e.g. after a reinstall). */
  claim: ClaimedLocation | null;
  /** True when this APK build has been retired in the registry (Builds sheet). */
  buildDisabled: boolean;
};

export async function fetchStatus(): Promise<TabletStatus> {
  const res = await fetch(url({ action: 'status', build: config.buildId, device: deviceId() }));
  const json = await res.json();
  if (!json.ok) throw new Error(json.message || json.error || 'Could not check this tablet');
  return { claim: (json.claim as ClaimedLocation | null) ?? null, buildDisabled: json.buildDisabled === true };
}

async function post<T>(body: Record<string, string>): Promise<T | { ok: false; error: 'network' }> {
  try {
    // text/plain avoids a CORS preflight, which Apps Script cannot answer.
    const res = await fetch(config.registryUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ build: config.buildId, device: deviceId(), ...body }),
    });
    return (await res.json()) as T;
  } catch {
    return { ok: false, error: 'network' };
  }
}

export function claimLocation(locationId: string, pin: string): Promise<ClaimResult> {
  return post<ClaimResult>({ action: 'claim', location: locationId, deviceName: deviceName(), pin });
}

export type ExitPinResult =
  | { ok: true }
  | { ok: false; error: 'wrong_pin' | 'locked_out' | 'pin_not_configured' | 'invalid' | 'server' | 'network'; attemptsLeft?: number; minutes?: number };

/** Checks the kiosk exit PIN (EXIT_PIN in the registry), which opens the admin menu. */
export function checkExitPin(pin: string): Promise<ExitPinResult> {
  return post<ExitPinResult>({ action: 'unlock', pin });
}
