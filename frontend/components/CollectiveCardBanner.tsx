/**
 * CollectiveCardBanner — pinned card on the Community page showing today's
 * Collective Oracle card. Every user sees the SAME card on a given day.
 * Tapping opens a modal showing meaning + a discussion-prompt section.
 */
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface Collective {
  card: {
    name: string;
    meaning: string;
    energy?: string;
    element?: string;
    symbol?: string;
  };
  date: string;
  title: string;
  prompt: string;
}

export default function CollectiveCardBanner() {
  const [data, setData] = useState<Collective | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDetail, setShowDetail] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/daily/collective`);
        const json = await res.json();
        if (!cancelled && res.ok) setData(json);
      } catch (e) {
        // silent fail — banner just hides
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <View style={s.loadingBanner}>
        <ActivityIndicator size="small" color="#b794f6" />
      </View>
    );
  }

  if (!data) return null;

  return (
    <>
      <TouchableOpacity style={s.banner} activeOpacity={0.85} onPress={() => setShowDetail(true)}>
        <View style={s.bannerHeader}>
          <View style={s.bannerHeaderLeft}>
            <Ionicons name="globe" size={14} color="#fbbf24" />
            <Text style={s.bannerEyebrow}>TODAY'S COLLECTIVE READING</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#fbbf24" />
        </View>
        <View style={s.bannerBody}>
          {data.card.symbol ? <Text style={s.bannerSymbol}>{data.card.symbol}</Text> : null}
          <View style={{ flex: 1 }}>
            <Text style={s.bannerCardName}>{data.card.name}</Text>
            <Text style={s.bannerPrompt} numberOfLines={2}>
              {data.prompt}
            </Text>
          </View>
        </View>
      </TouchableOpacity>

      <Modal visible={showDetail} animationType="slide" transparent onRequestClose={() => setShowDetail(false)}>
        <View style={s.modalBackdrop}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Collective Reading</Text>
              <TouchableOpacity onPress={() => setShowDetail(false)}>
                <Ionicons name="close" size={24} color="#e9d5ff" />
              </TouchableOpacity>
            </View>
            <ScrollView style={s.modalBody}>
              {data.card.symbol ? <Text style={s.modalSymbol}>{data.card.symbol}</Text> : null}
              <Text style={s.modalCardName}>{data.card.name}</Text>
              {data.card.energy ? <Text style={s.modalEnergy}>{data.card.energy}</Text> : null}
              {data.card.element ? (
                <View style={s.modalElementRow}>
                  <Ionicons name="prism" size={14} color="#b794f6" />
                  <Text style={s.modalElement}>{data.card.element}</Text>
                </View>
              ) : null}
              <Text style={s.modalMeaning}>{data.card.meaning}</Text>
              <View style={s.promptBox}>
                <Text style={s.promptLabel}>TODAY'S COMMUNITY PROMPT</Text>
                <Text style={s.promptText}>{data.prompt}</Text>
              </View>
              <Text style={s.hint}>Share what stirs in your day with the community below.</Text>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  loadingBanner: { padding: 16, alignItems: 'center' },
  banner: {
    backgroundColor: 'rgba(251, 191, 36, 0.10)',
    borderColor: 'rgba(251, 191, 36, 0.45)',
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
  },
  bannerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  bannerHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  bannerEyebrow: { color: '#fbbf24', fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  bannerBody: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bannerSymbol: { fontSize: 24 },
  bannerCardName: { color: '#fff', fontSize: 15, fontWeight: '700' },
  bannerPrompt: { color: '#c4b5fd', fontSize: 12, marginTop: 3, lineHeight: 16 },

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
  modalSymbol: { fontSize: 60, textAlign: 'center', marginBottom: 8 },
  modalCardName: { color: '#fff', fontSize: 26, fontWeight: '700', textAlign: 'center' },
  modalEnergy: { color: '#fbbf24', fontSize: 13, fontStyle: 'italic', textAlign: 'center', marginTop: 4 },
  modalElementRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 6 },
  modalElement: { color: '#b794f6', fontSize: 12, fontWeight: '600' },
  modalMeaning: { color: '#e9d5ff', fontSize: 14, lineHeight: 22, marginTop: 16, textAlign: 'center' },
  promptBox: { marginTop: 24, backgroundColor: '#2d1b4e', padding: 14, borderRadius: 12 },
  promptLabel: { color: '#fbbf24', fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 6 },
  promptText: { color: '#fff', fontSize: 14, lineHeight: 20 },
  hint: { color: '#9f7aea', fontSize: 12, textAlign: 'center', marginTop: 16, fontStyle: 'italic' },
});
