/**
 * Settings → modal sheet for picking the active language.
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
import { Language } from '../../contexts/LanguageContext';
import { ThemeColors } from '../../contexts/ThemeContext';

interface Props {
  visible: boolean;
  onClose: () => void;
  theme: ThemeColors;
  languageCode: string;
  availableLanguages: Language[];
  onSelect: (code: string) => void;
  t: (key: string) => string;
}

export default function LanguageModal({
  visible,
  onClose,
  theme,
  languageCode,
  availableLanguages,
  onSelect,
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
            <Text style={commonStyles.modalTitle}>{t('selectLanguage')}</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#e9d5ff" />
            </TouchableOpacity>
          </View>
          <ScrollView style={commonStyles.modalScrollContent}>
            {availableLanguages.map((lang) => {
              const isSelected = lang.code === languageCode;
              return (
                <TouchableOpacity
                  key={lang.code}
                  style={[
                    styles.languageOption,
                    isSelected && styles.languageOptionSelected,
                    { borderColor: isSelected ? theme.accent : '#2d1b4e' },
                  ]}
                  onPress={() => onSelect(lang.code)}
                >
                  <View style={styles.languageInfo}>
                    <Text style={styles.languageName}>{lang.name}</Text>
                    <Text style={styles.languageNative}>{lang.nativeName}</Text>
                  </View>
                  {isSelected && (
                    <Ionicons name="checkmark-circle" size={24} color={theme.accent} />
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
  languageOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    marginBottom: 12,
    backgroundColor: 'rgba(45, 27, 78, 0.5)',
  },
  languageOptionSelected: { backgroundColor: 'rgba(124, 58, 237, 0.2)' },
  languageInfo: { flex: 1 },
  languageName: { fontSize: 16, fontWeight: '600', color: '#e9d5ff' },
  languageNative: { fontSize: 14, color: '#9f7aea', marginTop: 2 },
});
