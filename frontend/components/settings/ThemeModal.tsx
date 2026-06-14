/**
 * Settings → modal sheet for picking the active theme. Locked premium themes
 * trigger the paywall via `onLockedTap`.
 */
import React from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { commonStyles } from './commonStyles';
import { ThemeColors } from '../../contexts/ThemeContext';

interface ThemeOption {
  id: string;
  name: string;
  accent: string;
  accentLight: string;
  backgroundGradient: string[];
  isPremium?: boolean;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  theme: ThemeColors;
  themeName: string;
  availableThemes: ThemeOption[];
  isPremium: boolean;
  onSelect: (id: string) => void;
  onLockedTap: () => void;
  t: (key: string) => string;
}

export default function ThemeModal({
  visible,
  onClose,
  theme,
  themeName,
  availableThemes,
  isPremium,
  onSelect,
  onLockedTap,
  t,
}: Props) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={commonStyles.modalOverlay}>
        <View style={[commonStyles.modalContent, { backgroundColor: theme.cardBackground }]}>
          <View style={commonStyles.modalHeader}>
            <Text style={commonStyles.modalTitle}>{t('selectTheme')}</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#e9d5ff" />
            </TouchableOpacity>
          </View>
          <ScrollView style={commonStyles.modalScrollContent}>
            {availableThemes.map((opt) => {
              const isSelected = opt.id === themeName;
              const isLocked = !!opt.isPremium && !isPremium;
              return (
                <TouchableOpacity
                  key={opt.id}
                  style={[
                    styles.themeOption,
                    isSelected && styles.themeOptionSelected,
                    { borderColor: isSelected ? opt.accent : '#2d1b4e' },
                  ]}
                  onPress={() => (isLocked ? onLockedTap() : onSelect(opt.id))}
                >
                  <View style={styles.themePreview}>
                    <View style={[styles.themeColorSwatch, { backgroundColor: opt.backgroundGradient[0] }]} />
                    <View style={[styles.themeColorSwatch, { backgroundColor: opt.accent }]} />
                    <View style={[styles.themeColorSwatch, { backgroundColor: opt.accentLight }]} />
                  </View>
                  <View style={styles.themeInfo}>
                    <Text style={styles.themeName}>{opt.name}</Text>
                    {isLocked && (
                      <View style={styles.themePremiumBadge}>
                        <Ionicons name="lock-closed" size={12} color="#fbbf24" />
                        <Text style={styles.themePremiumBadgeText}>Premium</Text>
                      </View>
                    )}
                    {isSelected && (
                      <Text style={[styles.currentBadge, { color: opt.accent }]}>
                        {t('currentTheme')}
                      </Text>
                    )}
                  </View>
                  {isSelected && (
                    <Ionicons name="checkmark-circle" size={24} color={opt.accent} />
                  )}
                  {isLocked && !isSelected && (
                    <Ionicons name="lock-closed" size={20} color="#9f7aea" />
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  themeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    marginBottom: 12,
    backgroundColor: 'rgba(45, 27, 78, 0.5)',
  },
  themeOptionSelected: { backgroundColor: 'rgba(124, 58, 237, 0.2)' },
  themePreview: { flexDirection: 'row', gap: 4, marginRight: 16 },
  themeColorSwatch: { width: 24, height: 24, borderRadius: 4 },
  themeInfo: { flex: 1 },
  themeName: { fontSize: 16, fontWeight: '600', color: '#e9d5ff' },
  themePremiumBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  themePremiumBadgeText: { fontSize: 12, color: '#fbbf24', fontWeight: '500' },
  currentBadge: { fontSize: 12, fontWeight: '500', marginTop: 4 },
});
