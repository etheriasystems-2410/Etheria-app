/**
 * GuideCard — unified renderer for all four guide categories
 * (Elemental, LGBTQ+, Custom, Divine). Variants are controlled by props:
 *  - `isSuggested`  → applies the suggested-card highlight
 *  - `isLocked`     → renders the lock overlay
 *  - `borderColor`  → optional override for the image border (e.g. LGBTQ+/Divine glow)
 *  - `genderSymbol` → falls back to ♀/♂/⚧ if not provided
 *  - `extraOverlay` → e.g. the rename pencil for Custom Guides
 *  - `elementOverride` → e.g. 'Custom' instead of guide.element
 */
import React, { ReactNode } from 'react';
import { Image, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Guide } from '../../constants/guides';
import { styles } from './styles';

interface GuideCardProps {
  guide: Guide;
  isSuggested?: boolean;
  isLocked?: boolean;
  borderColor?: string;
  elementOverride?: string;
  extraOverlay?: ReactNode;
  /** Familiarity tier symbol (✦/✧/★) — shown as a corner badge */
  familiaritySymbol?: string;
  /** Familiarity tier label (Acquaintance/Confidant/Soul-bonded) */
  familiarityLabel?: string;
  onPress: () => void;
}

export default function GuideCard({
  guide,
  isSuggested,
  isLocked,
  borderColor,
  elementOverride,
  extraOverlay,
  familiaritySymbol,
  familiarityLabel,
  onPress,
}: GuideCardProps) {
  const symbol =
    guide.genderSymbol ||
    (guide.gender === 'transgender' || guide.gender === 'non-binary'
      ? '⚧'
      : guide.gender === 'feminine'
      ? '♀'
      : '♂');

  return (
    <TouchableOpacity
      style={[styles.guideCard, isSuggested && styles.guideCardSuggested]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {guide.image ? (
        <View style={[styles.guideImageContainer, borderColor ? { borderColor } : undefined]}>
          <Image source={guide.image} style={styles.guideImage} resizeMode="cover" />
        </View>
      ) : (
        <View style={[styles.guideIcon, { backgroundColor: guide.color }]}>
          <Ionicons name={guide.icon as any} size={40} color="#fff" />
        </View>
      )}
      {extraOverlay ? (
        <View style={styles.customNameRow}>
          <Text style={styles.guideName}>{guide.name}</Text>
          {extraOverlay}
        </View>
      ) : (
        <Text style={styles.guideName}>{guide.name}</Text>
      )}
      <Text style={styles.guideElement}>{elementOverride ?? guide.element}</Text>
      <Text style={styles.guideGender}>
        {symbol} {guide.gender}
      </Text>
      <Text style={styles.guideDescription}>{guide.description}</Text>
      {isLocked && (
        <View style={styles.lockOverlay}>
          <Ionicons name="lock-closed" size={20} color="#fbbf24" />
          <Text style={styles.lockText}>Premium</Text>
        </View>
      )}
      {familiaritySymbol ? (
        <View style={guideCardExtraStyles.familiarityBadge}>
          <Text style={guideCardExtraStyles.familiaritySymbol}>{familiaritySymbol}</Text>
          {familiarityLabel ? (
            <Text style={guideCardExtraStyles.familiarityLabel}>{familiarityLabel}</Text>
          ) : null}
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

import { StyleSheet } from 'react-native';
const guideCardExtraStyles = StyleSheet.create({
  familiarityBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(251, 191, 36, 0.18)',
    borderColor: 'rgba(251, 191, 36, 0.55)',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  familiaritySymbol: { color: '#fbbf24', fontSize: 14, fontWeight: '700' },
  familiarityLabel: { color: '#fbbf24', fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },
});
