/**
 * Notification Preferences
 *
 * Lets the user enable/disable daily reminders and pick the local hour each
 * one fires. Saves to /api/notifications/preferences. The backend scheduler
 * (services/notification_scheduler.py) reads these every 15 minutes and
 * dispatches pushes via the Emergent push relay.
 *
 * The page also has a "Send test push" button so users can verify their
 * registration end-to-end. Note: real push delivery only works in a built
 * app (TestFlight / Play Internal Testing) — Expo Go doesn't deliver pushes.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface Prefs {
  oracle_reminder_enabled: boolean;
  oracle_reminder_hour: number;
  dream_reminder_enabled: boolean;
  dream_reminder_hour: number;
  timezone_offset_minutes: number;
}

const DEFAULT_PREFS: Prefs = {
  oracle_reminder_enabled: true,
  oracle_reminder_hour: 9,
  dream_reminder_enabled: true,
  dream_reminder_hour: 7,
  timezone_offset_minutes: 0,
};

function formatHour(h: number) {
  const period = h < 12 ? 'AM' : 'PM';
  const display = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${display}:00 ${period}`;
}

export default function NotificationPreferencesScreen() {
  const { theme } = useTheme();
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const styles = useMemo(() => createStyles(theme), [theme]);

  // Capture the user's TZ once on mount — getTimezoneOffset() returns minutes
  // WEST of UTC, we want minutes EAST so we negate.
  useEffect(() => {
    (async () => {
      try {
        const auth = await AsyncStorage.getItem('session_token');
        if (!auth) {
          setLoading(false);
          return;
        }
        const res = await fetch(`${BACKEND_URL}/api/notifications/preferences`, {
          headers: { Authorization: `Bearer ${auth}` },
        });
        if (res.ok) {
          const data = await res.json();
          setPrefs({
            ...DEFAULT_PREFS,
            ...data,
            // Always update tz offset to current device value
            timezone_offset_minutes: -new Date().getTimezoneOffset(),
          });
        }
      } catch (e) {
        console.warn('[Prefs] load failed:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const savePrefs = async (next: Prefs) => {
    setSaving(true);
    try {
      const auth = await AsyncStorage.getItem('session_token');
      const res = await fetch(`${BACKEND_URL}/api/notifications/preferences`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(auth ? { Authorization: `Bearer ${auth}` } : {}),
        },
        body: JSON.stringify(next),
      });
      if (!res.ok) throw new Error('Save failed');
      setPrefs(next);
    } catch (e) {
      Alert.alert('Could not save', 'Please check your connection and try again.');
    } finally {
      setSaving(false);
    }
  };

  const sendTest = async () => {
    setTesting(true);
    try {
      const auth = await AsyncStorage.getItem('session_token');
      const res = await fetch(`${BACKEND_URL}/api/notifications/test`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${auth}` },
      });
      const data = await res.json().catch(() => ({}));
      if (data?.success) {
        Alert.alert(
          'Test sent ✨',
          Platform.OS === 'web'
            ? 'Push notifications require a built app — open Etheria on your phone to verify delivery.'
            : 'Check your notification tray. If nothing arrives, you may be on Expo Go (pushes require a built app).',
        );
      } else {
        Alert.alert('Test failed', 'No registered device — open the app on your phone and try again.');
      }
    } catch (e) {
      Alert.alert('Test failed', 'Could not reach the server.');
    } finally {
      setTesting(false);
    }
  };

  const updateHour = (key: 'oracle_reminder_hour' | 'dream_reminder_hour', delta: number) => {
    const next = { ...prefs, [key]: (prefs[key] + delta + 24) % 24 };
    setPrefs(next); // optimistic
    savePrefs(next);
  };

  if (loading) {
    return (
      <View style={styles.loaderWrap}>
        <ActivityIndicator color={theme.accent} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.intro}>
        Choose when Etheria nudges you each day. We&apos;ll only send a reminder if
        you haven&apos;t already drawn your card or logged your dreams.
      </Text>

      {/* Oracle reminder */}
      <View style={styles.card}>
        <View style={styles.row}>
          <View style={styles.iconBubble}>
            <Ionicons name="sparkles" size={20} color="#fbbf24" />
          </View>
          <View style={styles.rowText}>
            <Text style={styles.title}>Daily Oracle Card</Text>
            <Text style={styles.subtitle}>
              Keep your streak alive with a gentle morning nudge.
            </Text>
          </View>
          <Switch
            value={prefs.oracle_reminder_enabled}
            onValueChange={(v) =>
              savePrefs({ ...prefs, oracle_reminder_enabled: v })
            }
            trackColor={{ false: '#3b1f5e', true: '#7c3aed' }}
            thumbColor={prefs.oracle_reminder_enabled ? '#fbbf24' : '#9f7aea'}
          />
        </View>

        {prefs.oracle_reminder_enabled && (
          <View style={styles.hourPicker}>
            <Text style={styles.hourLabel}>Remind me at</Text>
            <View style={styles.hourControls}>
              <TouchableOpacity
                style={styles.hourBtn}
                onPress={() => updateHour('oracle_reminder_hour', -1)}
              >
                <Ionicons name="chevron-back" size={18} color="#e9d5ff" />
              </TouchableOpacity>
              <Text style={styles.hourValue}>
                {formatHour(prefs.oracle_reminder_hour)}
              </Text>
              <TouchableOpacity
                style={styles.hourBtn}
                onPress={() => updateHour('oracle_reminder_hour', 1)}
              >
                <Ionicons name="chevron-forward" size={18} color="#e9d5ff" />
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {/* Dream reminder */}
      <View style={styles.card}>
        <View style={styles.row}>
          <View style={styles.iconBubble}>
            <Ionicons name="moon" size={20} color="#a78bfa" />
          </View>
          <View style={styles.rowText}>
            <Text style={styles.title}>Dream Journal</Text>
            <Text style={styles.subtitle}>
              Capture last night&apos;s dreams before they fade.
            </Text>
          </View>
          <Switch
            value={prefs.dream_reminder_enabled}
            onValueChange={(v) =>
              savePrefs({ ...prefs, dream_reminder_enabled: v })
            }
            trackColor={{ false: '#3b1f5e', true: '#7c3aed' }}
            thumbColor={prefs.dream_reminder_enabled ? '#a78bfa' : '#9f7aea'}
          />
        </View>

        {prefs.dream_reminder_enabled && (
          <View style={styles.hourPicker}>
            <Text style={styles.hourLabel}>Remind me at</Text>
            <View style={styles.hourControls}>
              <TouchableOpacity
                style={styles.hourBtn}
                onPress={() => updateHour('dream_reminder_hour', -1)}
              >
                <Ionicons name="chevron-back" size={18} color="#e9d5ff" />
              </TouchableOpacity>
              <Text style={styles.hourValue}>
                {formatHour(prefs.dream_reminder_hour)}
              </Text>
              <TouchableOpacity
                style={styles.hourBtn}
                onPress={() => updateHour('dream_reminder_hour', 1)}
              >
                <Ionicons name="chevron-forward" size={18} color="#e9d5ff" />
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      <TouchableOpacity
        style={[styles.testBtn, testing && styles.testBtnDisabled]}
        onPress={sendTest}
        disabled={testing}
      >
        {testing ? (
          <ActivityIndicator color="#fbbf24" />
        ) : (
          <>
            <Ionicons name="paper-plane" size={16} color="#fbbf24" />
            <Text style={styles.testText}>Send test notification</Text>
          </>
        )}
      </TouchableOpacity>

      <Text style={styles.footnote}>
        Push notifications only deliver on a published build (TestFlight / Play Store / production).
        On Expo Go they won&apos;t arrive — that&apos;s an OS limitation, not a bug.
      </Text>

      {saving && (
        <View style={styles.savingBar}>
          <ActivityIndicator size="small" color="#fbbf24" />
          <Text style={styles.savingText}>Saving…</Text>
        </View>
      )}
    </ScrollView>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    content: { padding: 16, paddingBottom: 48 },
    loaderWrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.background,
    },
    intro: {
      color: theme.textSecondary,
      fontSize: 14,
      lineHeight: 20,
      marginBottom: 18,
    },
    card: {
      backgroundColor: theme.cardBackground,
      borderRadius: 14,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.border,
      marginBottom: 14,
    },
    row: { flexDirection: 'row', alignItems: 'center' },
    iconBubble: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: 'rgba(251, 191, 36, 0.12)',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    rowText: { flex: 1 },
    title: { color: theme.text, fontSize: 16, fontWeight: '700' },
    subtitle: {
      color: theme.textSecondary,
      fontSize: 12,
      marginTop: 2,
      lineHeight: 16,
    },
    hourPicker: {
      marginTop: 14,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: 'rgba(124, 58, 237, 0.10)',
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    hourLabel: { color: theme.textSecondary, fontSize: 13 },
    hourControls: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    hourBtn: {
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: 'rgba(251, 191, 36, 0.18)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    hourValue: {
      color: theme.text,
      fontSize: 15,
      fontWeight: '700',
      minWidth: 90,
      textAlign: 'center',
    },
    testBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginTop: 6,
      paddingVertical: 14,
      borderRadius: 12,
      backgroundColor: 'rgba(251, 191, 36, 0.16)',
      borderWidth: 1,
      borderColor: 'rgba(251, 191, 36, 0.5)',
    },
    testBtnDisabled: { opacity: 0.6 },
    testText: { color: '#fbbf24', fontSize: 14, fontWeight: '700' },
    footnote: {
      color: theme.textSecondary,
      fontSize: 12,
      lineHeight: 17,
      marginTop: 16,
      fontStyle: 'italic',
    },
    savingBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginTop: 14,
    },
    savingText: { color: '#fbbf24', fontSize: 12 },
  });
