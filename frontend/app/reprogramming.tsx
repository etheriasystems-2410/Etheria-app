/**
 * Reprogramming — grid of self-hypnosis sessions.
 *
 * • FREE sessions (Deep Sleep, Confidence) open directly for everyone.
 * • Premium sessions show a lock badge for free users and route to the
 *   subscription paywall on tap.
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { CosmicBackdrop } from '../components/ui';
import { SubscriptionOnlyBanner } from '../components/SubscriptionOnlyBanner';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface Session {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  color: string;
  duration_minutes: number;
  category: string;
  is_free: boolean;
  is_premium: boolean;
  locked: boolean;
}

export default function Reprogramming() {
  const router = useRouter();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isPremium, setIsPremium] = useState(false);

  const load = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('session_token');
      const r = await fetch(`${BACKEND_URL}/api/reprogramming/sessions`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      const data = await r.json();
      setSessions(data.sessions || []);
      setIsPremium(Boolean(data.is_premium));
    } catch {
      // Fail quietly — the list is optional content
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const openSession = (s: Session) => {
    if (s.locked) {
      // Route free users to the paywall in settings
      router.push('/settings');
      return;
    }
    router.push(`/reprogramming/${s.id}` as any);
  };

  return (
    <CosmicBackdrop>
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#a855f7" />
          }
        >
          <View style={styles.hero}>
            <Text style={styles.eyebrow}>✦ Sleep-time transformation ✦</Text>
            <Text style={styles.title}>Reprogramming</Text>
            <Text style={styles.subtitle}>
              Voice-guided hypnosis and subliminal sessions designed to reshape
              your inner world as you drift into sleep.
            </Text>
          </View>

          <View style={styles.disclaimer}>
            <Ionicons name="information-circle" size={14} color="#9f7aea" />
            <Text style={styles.disclaimerText}>
              For entertainment and personal-growth purposes. Not medical advice.
              Never listen while driving or operating machinery.
            </Text>
          </View>

          {!isPremium ? (
            <View style={styles.freeCallout}>
              <Ionicons name="gift" size={16} color="#22c55e" />
              <Text style={styles.freeCalloutText}>
                Deep Sleep and Deep Confidence are free for everyone. Unlock all
                12 sessions with Premium.
              </Text>
            </View>
          ) : null}

          {loading ? (
            <ActivityIndicator size="large" color="#a855f7" style={{ marginTop: 60 }} />
          ) : (
            <View style={styles.grid}>
              {sessions.map((s) => (
                <TouchableOpacity
                  key={s.id}
                  style={[
                    styles.card,
                    { borderColor: s.color + '88' },
                    s.locked && styles.cardLocked,
                  ]}
                  onPress={() => openSession(s)}
                  activeOpacity={0.85}
                >
                  <View style={styles.cardHeaderRow}>
                    <View
                      style={[styles.iconWrap, { backgroundColor: s.color + '22' }]}
                    >
                      <Ionicons name={s.icon as any} size={22} color={s.color} />
                    </View>
                    {s.is_free ? (
                      <View style={styles.freeBadge}>
                        <Text style={styles.freeBadgeText}>FREE</Text>
                      </View>
                    ) : s.locked ? (
                      <View style={styles.lockBadge}>
                        <Ionicons name="lock-closed" size={10} color="#fbbf24" />
                        <Text style={styles.lockBadgeText}>PREMIUM</Text>
                      </View>
                    ) : (
                      <View style={styles.unlockedBadge}>
                        <Ionicons name="sparkles" size={10} color="#e9d5ff" />
                      </View>
                    )}
                  </View>

                  <Text style={styles.cardTitle}>{s.title}</Text>
                  <Text style={styles.cardSubtitle} numberOfLines={2}>
                    {s.subtitle}
                  </Text>
                  <View style={styles.metaRow}>
                    <Ionicons name="time-outline" size={12} color="#9f7aea" />
                    <Text style={styles.metaText}>Choose 10–60 min</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {!isPremium ? (
            <View style={{ marginTop: 20, paddingHorizontal: 4 }}>
              <SubscriptionOnlyBanner
                variant="banner"
                label="Unlock all 12 sessions — tap to upgrade"
              />
            </View>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </CosmicBackdrop>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: 12, paddingBottom: 40 },
  hero: { alignItems: 'center', paddingTop: 12, paddingBottom: 8 },
  eyebrow: {
    color: '#fbbf24',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
  },
  title: {
    color: '#e9d5ff',
    fontSize: 28,
    fontWeight: '800',
    marginTop: 4,
    textShadowColor: 'rgba(168,85,247,0.6)',
    textShadowRadius: 8,
  },
  subtitle: {
    color: '#c4b5fd',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 6,
    paddingHorizontal: 16,
  },
  disclaimer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 12,
    marginHorizontal: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(124,58,237,0.15)',
  },
  disclaimerText: {
    color: '#9f7aea',
    fontSize: 11,
    flex: 1,
    fontStyle: 'italic',
  },
  freeCallout: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 8,
    marginHorizontal: 4,
    borderRadius: 10,
    backgroundColor: 'rgba(34,197,94,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.35)',
  },
  freeCalloutText: {
    color: '#86efac',
    fontSize: 12,
    flex: 1,
    lineHeight: 16,
  },
  grid: {
    marginTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  card: {
    flexBasis: '48%',
    flexGrow: 1,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    backgroundColor: 'rgba(15,5,35,0.65)',
  },
  cardLocked: {
    opacity: 0.78,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  freeBadge: {
    backgroundColor: 'rgba(34,197,94,0.20)',
    borderColor: 'rgba(34,197,94,0.60)',
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
  },
  freeBadgeText: {
    color: '#22c55e',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  lockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(251,191,36,0.14)',
    borderColor: 'rgba(251,191,36,0.55)',
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
  },
  lockBadgeText: {
    color: '#fbbf24',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  unlockedBadge: {
    padding: 4,
  },
  cardTitle: { color: '#e9d5ff', fontSize: 15, fontWeight: '800' },
  cardSubtitle: {
    color: '#9f7aea',
    fontSize: 12,
    marginTop: 3,
    lineHeight: 16,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 10,
  },
  metaText: { color: '#9f7aea', fontSize: 11 },
});
