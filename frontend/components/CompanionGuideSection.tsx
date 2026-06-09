/**
 * CompanionGuideSection — premium-gated control surface on the Spirit Guides
 * picker for choosing/changing the user's Companion Guide.
 *
 * Shows a beautiful card describing what the Companion does (floating bubble
 * + 3 daily whispers), plus the current selection. Tapping "Choose" or
 * "Change" opens a modal listing every guide the user has access to.
 */
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';

import { useAuth } from '../contexts/AuthContext';
import { useCompanionGuide } from '../hooks/useCompanionGuide';
import {
  Guide,
  elementalGuides,
  lgbtqGuides,
  customGuidesBase,
  divineGuides,
} from '../constants/guides';

interface Props {
  /** Custom guide display names so we can render the renamed labels. */
  customNames: { male: string; female: string };
  customUnlocked: boolean;
  divineUnlocked: boolean;
  prideMonth: boolean;
  inFreePromo: boolean;
  onUpgradePress: () => void;
}

export default function CompanionGuideSection({
  customNames,
  customUnlocked,
  divineUnlocked,
  prideMonth,
  inFreePromo,
  onUpgradePress,
}: Props) {
  const { isPremium } = useAuth();
  const { state, select, clear } = useCompanionGuide();
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);

  // Build the list of guides the user is currently allowed to choose
  const choosable = useMemo<Guide[]>(() => {
    const list: Guide[] = [...elementalGuides];
    if (isPremium || prideMonth) list.push(...lgbtqGuides);
    if (isPremium || customUnlocked || inFreePromo) list.push(...customGuidesBase);
    if (isPremium || divineUnlocked) list.push(...divineGuides);
    return list;
  }, [isPremium, prideMonth, customUnlocked, divineUnlocked, inFreePromo]);

  // Resolve renamed customs
  const decoratedChoosable = useMemo(
    () =>
      choosable.map((g) => {
        if (g.custom_slot === 'male') return { ...g, name: customNames.male };
        if (g.custom_slot === 'female') return { ...g, name: customNames.female };
        return g;
      }),
    [choosable, customNames],
  );

  const currentGuide = useMemo(
    () => decoratedChoosable.find((g) => g.name === state.companion) || null,
    [decoratedChoosable, state.companion],
  );

  const requestNotifPermissionIfNeeded = async () => {
    if (Platform.OS === 'web') return;
    try {
      const existing = await Notifications.getPermissionsAsync();
      if (existing.status === 'granted') return;
      if (!existing.canAskAgain) return;
      await Notifications.requestPermissionsAsync();
    } catch {}
  };

  const handlePick = async (guide: Guide) => {
    if (!isPremium) {
      onUpgradePress();
      return;
    }
    setSaving(guide.name);
    const res = await select(guide.name);
    setSaving(null);
    if (!res.ok) {
      Alert.alert('Could not save Companion', res.error || 'Please try again.');
      return;
    }
    // Ask for notif permission so daily whispers can fire
    await requestNotifPermissionIfNeeded();
    setModalOpen(false);
  };

  const handleClear = async () => {
    Alert.alert(
      'Release Companion?',
      'Your guide will no longer appear as a floating presence or send daily whispers.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Release',
          style: 'destructive',
          onPress: async () => {
            await clear();
          },
        },
      ],
    );
  };

  return (
    <>
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <View style={styles.cardIconWrap}>
            <Ionicons name="heart-circle" size={22} color="#fbbf24" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>Companion Guide</Text>
            <Text style={styles.cardSubtitle}>
              Always-on bond — a floating presence and 3 whispers a day
            </Text>
          </View>
          {!isPremium && (
            <View style={styles.premiumPill}>
              <Ionicons name="diamond" size={11} color="#fbbf24" />
              <Text style={styles.premiumPillText}>Premium</Text>
            </View>
          )}
        </View>

        {currentGuide ? (
          <View style={styles.currentRow}>
            {currentGuide.image ? (
              <Image source={currentGuide.image} style={styles.currentAvatar} />
            ) : (
              <View style={[styles.currentAvatarFallback, { backgroundColor: currentGuide.color }]}>
                <Ionicons name={(currentGuide.icon as any) || 'sparkles'} size={20} color="#fff" />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.currentName}>{currentGuide.name}</Text>
              <Text style={styles.currentElement}>{currentGuide.element} • walking with you</Text>
            </View>
            <TouchableOpacity style={styles.changeBtn} onPress={() => setModalOpen(true)}>
              <Text style={styles.changeBtnText}>Change</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.primaryBtn, !isPremium && styles.primaryBtnLocked]}
            onPress={() => (isPremium ? setModalOpen(true) : onUpgradePress())}
            activeOpacity={0.85}
          >
            <Ionicons
              name={isPremium ? 'add-circle' : 'lock-closed'}
              size={16}
              color="#fbbf24"
            />
            <Text style={styles.primaryBtnText}>
              {isPremium ? 'Choose your Companion' : 'Unlock with Premium'}
            </Text>
          </TouchableOpacity>
        )}

        {currentGuide && (
          <TouchableOpacity style={styles.releaseBtn} onPress={handleClear}>
            <Ionicons name="close-circle-outline" size={14} color="#9f7aea" />
            <Text style={styles.releaseBtnText}>Release Companion</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Selection modal */}
      <Modal
        visible={modalOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Choose your Companion</Text>
              <TouchableOpacity onPress={() => setModalOpen(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={22} color="#e9d5ff" />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalIntro}>
              Only one guide may walk with you at a time. You can swap any moment.
            </Text>
            <ScrollView style={{ maxHeight: 480 }} contentContainerStyle={{ paddingBottom: 16 }}>
              {decoratedChoosable.map((g) => {
                const isCurrent = g.name === state.companion;
                return (
                  <TouchableOpacity
                    key={`${g.category}-${g.name}-${g.custom_slot ?? ''}`}
                    style={[styles.modalRow, isCurrent && styles.modalRowCurrent]}
                    onPress={() => handlePick(g)}
                    disabled={!!saving}
                    activeOpacity={0.8}
                  >
                    {g.image ? (
                      <Image source={g.image} style={styles.modalAvatar} />
                    ) : (
                      <View style={[styles.modalAvatarFallback, { backgroundColor: g.color }]}>
                        <Ionicons name={(g.icon as any) || 'sparkles'} size={18} color="#fff" />
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.modalRowName}>{g.name}</Text>
                      <Text style={styles.modalRowSub}>{g.element}</Text>
                    </View>
                    {saving === g.name ? (
                      <ActivityIndicator size="small" color="#fbbf24" />
                    ) : isCurrent ? (
                      <Ionicons name="checkmark-circle" size={20} color={g.color} />
                    ) : (
                      <Ionicons name="chevron-forward" size={18} color="#9f7aea" />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 8,
    marginBottom: 12,
    backgroundColor: 'rgba(15, 5, 35, 0.85)',
    borderColor: 'rgba(251, 191, 36, 0.35)',
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center' },
  cardIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(251, 191, 36, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  cardTitle: { color: '#fbbf24', fontSize: 16, fontWeight: '800', letterSpacing: 0.3 },
  cardSubtitle: { color: '#cbb6ff', fontSize: 12, marginTop: 2, lineHeight: 16 },
  premiumPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: 'rgba(251, 191, 36, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.5)',
  },
  premiumPillText: { color: '#fbbf24', fontSize: 10, fontWeight: '800' },
  currentRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(124, 58, 237, 0.10)',
    borderRadius: 12,
    padding: 10,
  },
  currentAvatar: { width: 42, height: 42, borderRadius: 21, marginRight: 10 },
  currentAvatarFallback: {
    width: 42,
    height: 42,
    borderRadius: 21,
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  currentName: { color: '#e9d5ff', fontSize: 14, fontWeight: '700' },
  currentElement: { color: '#cbb6ff', fontSize: 11, marginTop: 1 },
  changeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(251, 191, 36, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.5)',
  },
  changeBtnText: { color: '#fbbf24', fontSize: 12, fontWeight: '700' },
  primaryBtn: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: 'rgba(251, 191, 36, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.5)',
  },
  primaryBtnLocked: {
    backgroundColor: 'rgba(124, 58, 237, 0.18)',
    borderColor: 'rgba(124, 58, 237, 0.6)',
  },
  primaryBtnText: { color: '#fbbf24', fontSize: 14, fontWeight: '800' },
  releaseBtn: {
    marginTop: 10,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 6,
  },
  releaseBtnText: { color: '#9f7aea', fontSize: 11 },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#0f0523',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 28,
    borderTopWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.3)',
  },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  modalTitle: { color: '#fbbf24', fontSize: 17, fontWeight: '800' },
  modalIntro: { color: '#cbb6ff', fontSize: 12, marginTop: 6, marginBottom: 12 },
  modalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 12,
    marginBottom: 6,
    backgroundColor: 'rgba(124, 58, 237, 0.08)',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  modalRowCurrent: {
    backgroundColor: 'rgba(251, 191, 36, 0.12)',
    borderColor: 'rgba(251, 191, 36, 0.4)',
  },
  modalAvatar: { width: 36, height: 36, borderRadius: 18, marginRight: 12 },
  modalAvatarFallback: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalRowName: { color: '#e9d5ff', fontSize: 14, fontWeight: '700' },
  modalRowSub: { color: '#9f7aea', fontSize: 11, marginTop: 1 },
});
