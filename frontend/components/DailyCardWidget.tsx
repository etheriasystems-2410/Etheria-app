/**
 * DailyCardWidget — surfaces today's Oracle card + streak count on the home
 * screen. Tapping it opens a modal that shows the card meaning + a "Tell me
 * more" CTA that routes to the full Oracle reading flow.
 *
 * Same card all day (deterministic per user + date). Streak grows on first
 * call of a new day; one grace day per week prevents accidental resets.
 */
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface DailyCard {
  name: string;
  meaning: string;
  energy?: string;
  element?: string;
  color?: string;
  symbol?: string;
}

interface DailyResponse {
  card: DailyCard;
  date: string;
  streak_count: number;
  longest_streak?: number;
  streak_emoji: string;
  is_new_draw: boolean;
  grace_used?: boolean;
}

export default function DailyCardWidget() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DailyResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showDetail, setShowDetail] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = await AsyncStorage.getItem('session_token');
        if (!token) {
          if (!cancelled) {
            setError('not-signed-in');
            setLoading(false);
          }
          return;
        }
        const res = await fetch(`${BACKEND_URL}/api/daily/card`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          if (!cancelled) {
            setError(`HTTP ${res.status}`);
            setLoading(false);
          }
          return;
        }
        const json: DailyResponse = await res.json();
        if (!cancelled) {
          setData(json);
          setLoading(false);
        }
      } catch (e) {
        if (!cancelled) {
          setError('network');
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator color="#b794f6" />
      </View>
    );
  }

  if (error === 'not-signed-in' || !data) {
    return null; // gracefully hide when signed out / errored
  }

  const card = data.card;
  const streakLabel =
    data.streak_count <= 1
      ? data.is_new_draw
        ? 'Streak begun'
        : `${data.streak_count}-day streak`
      : `${data.streak_count}-day streak`;

  return (
    <>
      <TouchableOpacity
        style={styles.container}
        activeOpacity={0.85}
        onPress={() => setShowDetail(true)}
      >
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Ionicons name="sparkles" size={14} color="#fbbf24" />
            <Text style={styles.headerLabel}>Today's Oracle</Text>
          </View>
          <View style={styles.streakPill}>
            <Text style={styles.streakEmoji}>{data.streak_emoji}</Text>
            <Text style={styles.streakText}>{streakLabel}</Text>
          </View>
        </View>

        <View style={styles.cardBody}>
          {card.symbol ? <Text style={styles.symbol}>{card.symbol}</Text> : null}
          <View style={styles.cardInfo}>
            <Text style={styles.cardName}>{card.name}</Text>
            {card.energy ? <Text style={styles.cardEnergy}>{card.energy}</Text> : null}
            <Text style={styles.cardMeaning} numberOfLines={2}>
              {card.meaning}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#9f7aea" />
        </View>

        {data.grace_used ? (
          <View style={styles.graceBadge}>
            <Ionicons name="shield-checkmark" size={12} color="#10b981" />
            <Text style={styles.graceText}>Grace day used — streak saved</Text>
          </View>
        ) : null}
      </TouchableOpacity>

      <Modal
        visible={showDetail}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDetail(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Today's Card</Text>
              <TouchableOpacity onPress={() => setShowDetail(false)}>
                <Ionicons name="close" size={24} color="#e9d5ff" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              {card.symbol ? (
                <Text style={styles.modalSymbol}>{card.symbol}</Text>
              ) : null}
              <Text style={styles.modalCardName}>{card.name}</Text>
              {card.energy ? (
                <Text style={styles.modalEnergy}>{card.energy}</Text>
              ) : null}
              {card.element ? (
                <View style={styles.modalElementRow}>
                  <Ionicons name="prism" size={14} color="#b794f6" />
                  <Text style={styles.modalElement}>{card.element}</Text>
                </View>
              ) : null}
              <Text style={styles.modalMeaning}>{card.meaning}</Text>

              <View style={styles.streakBlock}>
                <Text style={styles.streakBigEmoji}>{data.streak_emoji}</Text>
                <Text style={styles.streakBigNumber}>{data.streak_count}</Text>
                <Text style={styles.streakBigLabel}>day streak</Text>
                {data.longest_streak ? (
                  <Text style={styles.streakLongest}>
                    Longest: {data.longest_streak} days
                  </Text>
                ) : null}
              </View>

              <TouchableOpacity
                style={styles.ctaButton}
                onPress={() => {
                  setShowDetail(false);
                  router.push('/oracle');
                }}
              >
                <Ionicons name="book" size={18} color="#1a0033" />
                <Text style={styles.ctaText}>Pull a Full Reading</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(124, 58, 237, 0.12)',
    borderColor: 'rgba(183, 148, 246, 0.35)',
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerLabel: { color: '#fbbf24', fontSize: 12, fontWeight: '700', letterSpacing: 0.6 },
  streakPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(251, 191, 36, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  streakEmoji: { fontSize: 14 },
  streakText: { color: '#fbbf24', fontSize: 11, fontWeight: '600' },
  cardBody: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  symbol: { fontSize: 28 },
  cardInfo: { flex: 1 },
  cardName: { color: '#fff', fontSize: 16, fontWeight: '700' },
  cardEnergy: { color: '#b794f6', fontSize: 12, marginTop: 2, fontStyle: 'italic' },
  cardMeaning: { color: '#c4b5fd', fontSize: 12, marginTop: 4, lineHeight: 16 },
  graceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  graceText: { color: '#10b981', fontSize: 10, fontWeight: '600' },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: '#1a0033',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    padding: 20,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  modalBody: { paddingBottom: 32 },
  modalSymbol: { fontSize: 64, textAlign: 'center', marginBottom: 12 },
  modalCardName: { color: '#fff', fontSize: 26, fontWeight: '700', textAlign: 'center' },
  modalEnergy: { color: '#fbbf24', fontSize: 13, fontStyle: 'italic', textAlign: 'center', marginTop: 4 },
  modalElementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 6,
  },
  modalElement: { color: '#b794f6', fontSize: 12, fontWeight: '600' },
  modalMeaning: { color: '#e9d5ff', fontSize: 14, lineHeight: 22, marginTop: 18, textAlign: 'center' },

  streakBlock: { alignItems: 'center', marginTop: 24, paddingVertical: 16, borderTopWidth: 1, borderBottomWidth: 1, borderColor: 'rgba(183,148,246,0.2)' },
  streakBigEmoji: { fontSize: 32 },
  streakBigNumber: { color: '#fff', fontSize: 36, fontWeight: '800', marginTop: 4 },
  streakBigLabel: { color: '#b794f6', fontSize: 12, letterSpacing: 1, textTransform: 'uppercase' },
  streakLongest: { color: '#9f7aea', fontSize: 11, marginTop: 8 },

  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#fbbf24',
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 24,
  },
  ctaText: { color: '#1a0033', fontSize: 15, fontWeight: '700' },
});
