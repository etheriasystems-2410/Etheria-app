/**
 * Bi-weekly Contest — hidden page (drawer entry hidden). Reachable from:
 *   • Settings → "Bi-weekly Contest" row
 *   • The "Contest rules" section on this page cross-links to itself so
 *     users landing here from a shared URL know they are in the right spot.
 *
 * Contents (in scroll order):
 *   1. Header with back button
 *   2. Opt-in card (moved off the home page) — shows weekly usage, an
 *      "Enter Drawing" CTA, and an opt-out state.
 *   3. Leaderboard of past winners — masked member IDs + date.
 *   4. Contest rules text.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { CosmicBackdrop } from '../components/ui';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface PrizeStatus {
  opted_in: boolean;
  eligible: boolean;
  weekly_usage_minutes: number;
  required_minutes: number;
  next_drawing?: string;
}

interface Winner {
  member_id: string;
  won_at?: string | null;
  contest_id?: string;
}

const authHeaders = async () => {
  const token = await AsyncStorage.getItem('session_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export default function BiWeeklyContest() {
  const router = useRouter();
  const [status, setStatus] = useState<PrizeStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [winners, setWinners] = useState<Winner[]>([]);
  const [winnersLoading, setWinnersLoading] = useState(true);
  const [opting, setOpting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadStatus = useCallback(async () => {
    try {
      const h = await authHeaders();
      const r = await fetch(`${BACKEND_URL}/api/prize-drawing/status`, { headers: h });
      if (r.ok) setStatus(await r.json());
    } finally {
      setStatusLoading(false);
    }
  }, []);

  const loadWinners = useCallback(async () => {
    try {
      const r = await fetch(`${BACKEND_URL}/api/prize-drawing/winners?limit=30`);
      if (r.ok) {
        const data = await r.json();
        setWinners(data.winners || []);
      }
    } finally {
      setWinnersLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
    loadWinners();
  }, [loadStatus, loadWinners]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadStatus(), loadWinners()]);
    setRefreshing(false);
  };

  const handleOptIn = async (optIn: boolean) => {
    setOpting(true);
    try {
      const h = await authHeaders();
      const r = await fetch(`${BACKEND_URL}/api/prize-drawing/opt-in`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...h },
        body: JSON.stringify({ opt_in: optIn }),
      });
      if (r.ok) {
        setStatus((prev) => (prev ? { ...prev, opted_in: optIn } : prev));
        Alert.alert(
          optIn ? 'Entered!' : 'Opted Out',
          optIn
            ? 'You are entered into the next drawing. Keep practising to stay eligible.'
            : 'You have opted out of future drawings.',
        );
      } else {
        Alert.alert('Please try again', 'Could not update your entry.');
      }
    } finally {
      setOpting(false);
    }
  };

  const percent = status
    ? Math.min(
        100,
        (status.weekly_usage_minutes / Math.max(1, status.required_minutes)) * 100,
      )
    : 0;

  return (
    <CosmicBackdrop>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#e9d5ff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Bi-weekly Contest</Text>
          <View style={{ width: 22 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#a855f7" />
          }
        >
          {/* Opt-in card */}
          <View style={styles.prizeCard}>
            <View style={styles.prizeHeader}>
              <View style={styles.giftBubble}>
                <Ionicons name="gift" size={18} color="#fbbf24" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.prizeTitle}>Bi-weekly Prize Drawing</Text>
                <Text style={styles.prizeSubtitle}>Win a FREE month of Premium</Text>
              </View>
            </View>

            {statusLoading ? (
              <ActivityIndicator color="#c4b5fd" style={{ marginVertical: 8 }} />
            ) : status ? (
              <>
                <View style={styles.usageRow}>
                  <Text style={styles.usageLabel}>This week</Text>
                  <Text style={styles.usageValue}>
                    {status.weekly_usage_minutes.toFixed(0)}/{status.required_minutes} min
                  </Text>
                </View>
                <View style={styles.progressBar}>
                  <LinearGradient
                    colors={['#fcd34d', '#fbbf24']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[styles.progressFill, { width: `${percent}%` }]}
                  />
                </View>

                {status.opted_in ? (
                  <View style={styles.optedInRow}>
                    <View style={styles.optedInBadge}>
                      <Ionicons name="checkmark-circle" size={14} color="#22c55e" />
                      <Text style={styles.optedInText}>Entered</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => handleOptIn(false)}
                      disabled={opting}
                      hitSlop={8}
                    >
                      <Text style={styles.optOutText}>Opt out</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => handleOptIn(true)}
                    disabled={opting}
                    style={styles.enterBtn}
                  >
                    {opting ? (
                      <ActivityIndicator color="#1a0033" size="small" />
                    ) : (
                      <>
                        <Ionicons name="ticket" size={14} color="#1a0033" />
                        <Text style={styles.enterBtnText}>Enter Drawing</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}

                {status.next_drawing ? (
                  <Text style={styles.nextDrawingText}>
                    Next drawing:{' '}
                    {new Date(status.next_drawing).toLocaleDateString()}
                  </Text>
                ) : null}
              </>
            ) : null}
          </View>

          {/* Leaderboard */}
          <View style={styles.sectionHeader}>
            <Ionicons name="trophy" size={16} color="#fbbf24" />
            <Text style={styles.sectionTitle}>Past Winners</Text>
          </View>
          <View style={styles.leaderboard}>
            {winnersLoading ? (
              <ActivityIndicator color="#c4b5fd" style={{ padding: 16 }} />
            ) : winners.length === 0 ? (
              <Text style={styles.emptyText}>
                No winners yet. The next drawing could be you.
              </Text>
            ) : (
              winners.map((w, idx) => (
                <View
                  key={`${w.member_id}-${idx}`}
                  style={[
                    styles.winnerRow,
                    idx === 0 && styles.winnerRowLatest,
                  ]}
                >
                  <View style={styles.winnerRankWrap}>
                    <Text style={styles.winnerRank}>{idx + 1}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.winnerId}>{w.member_id}</Text>
                    <Text style={styles.winnerDate}>
                      Won{' '}
                      {w.won_at
                        ? new Date(w.won_at).toLocaleDateString(undefined, {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })
                        : '—'}
                    </Text>
                  </View>
                  {idx === 0 ? (
                    <Ionicons name="ribbon" size={18} color="#fbbf24" />
                  ) : null}
                </View>
              ))
            )}
          </View>

          {/* Contest rules */}
          <View style={styles.sectionHeader}>
            <Ionicons name="document-text-outline" size={16} color="#fbbf24" />
            <Text style={styles.sectionTitle}>Contest Rules</Text>
          </View>
          <View style={styles.rulesCard}>
            <Text style={styles.rulesBody}>
              • Any signed-in member may opt in to the bi-weekly drawing.
              {'\n\n'}
              • To be eligible for the next drawing you must log at least{' '}
              {status?.required_minutes ?? 30} minutes of practice inside
              Etheria during that week.
              {'\n\n'}
              • Winners are drawn at random from the eligible pool and
              receive one full free month of Premium via a redemption code
              emailed to the account on file.
              {'\n\n'}
              • You can opt out at any time from this page — it will not
              affect any prior wins.
              {'\n\n'}
              • Etheria staff and family are excluded. One prize per household
              per calendar quarter.
            </Text>
            <TouchableOpacity
              onPress={() => router.push('/bi-weekly-contest')}
              style={styles.rulesSelfLink}
            >
              <Ionicons name="link" size={12} color="#a855f7" />
              <Text style={styles.rulesSelfLinkText}>
                Direct link to this contest page
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </CosmicBackdrop>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(45,27,78,0.7)',
  },
  backBtn: { padding: 4 },
  headerTitle: {
    color: '#e9d5ff',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.4,
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 12,
  },

  scroll: { padding: 16, paddingBottom: 40 },

  prizeCard: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.4)',
    backgroundColor: 'rgba(30,14,58,0.65)',
  },
  prizeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  giftBubble: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(251,191,36,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.55)',
  },
  prizeTitle: { color: '#e9d5ff', fontSize: 16, fontWeight: '800' },
  prizeSubtitle: { color: '#c4b5fd', fontSize: 12, marginTop: 2 },

  usageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  usageLabel: { color: '#9f7aea', fontSize: 12 },
  usageValue: { color: '#e9d5ff', fontSize: 12, fontWeight: '700' },
  progressBar: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(45,27,78,0.8)',
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 3 },

  optedInRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optedInBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.55)',
    backgroundColor: 'rgba(34,197,94,0.1)',
  },
  optedInText: { color: '#22c55e', fontSize: 11, fontWeight: '800' },
  optOutText: {
    color: '#9f7aea',
    fontSize: 11,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  enterBtn: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: '#fbbf24',
  },
  enterBtnText: { color: '#1a0033', fontWeight: '800', fontSize: 14 },
  nextDrawingText: {
    color: '#9f7aea',
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: 10,
    textAlign: 'center',
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 20,
    marginBottom: 8,
  },
  sectionTitle: {
    color: '#fbbf24',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
  },

  leaderboard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(159,122,234,0.25)',
    backgroundColor: 'rgba(30,14,58,0.55)',
    overflow: 'hidden',
  },
  emptyText: {
    color: '#9f7aea',
    fontSize: 12,
    fontStyle: 'italic',
    padding: 16,
    textAlign: 'center',
  },
  winnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(45,27,78,0.5)',
  },
  winnerRowLatest: {
    backgroundColor: 'rgba(251,191,36,0.06)',
  },
  winnerRankWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(168,85,247,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.5)',
  },
  winnerRank: { color: '#e9d5ff', fontSize: 12, fontWeight: '800' },
  winnerId: {
    color: '#e9d5ff',
    fontSize: 13,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  winnerDate: {
    color: '#9f7aea',
    fontSize: 11,
    marginTop: 2,
  },

  rulesCard: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(159,122,234,0.25)',
    backgroundColor: 'rgba(30,14,58,0.55)',
  },
  rulesBody: {
    color: '#c4b5fd',
    fontSize: 13,
    lineHeight: 19,
  },
  rulesSelfLink: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
  },
  rulesSelfLinkText: {
    color: '#a855f7',
    fontSize: 11,
    fontWeight: '700',
  },
});
