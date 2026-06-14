/**
 * Settings → "App Settings" section (Theme + Language pickers).
 * Tapping each row opens the matching modal owned by the parent screen.
 */
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { commonStyles } from './commonStyles';
import { THEMES, ThemeColors } from '../../contexts/ThemeContext';
import { Language } from '../../contexts/LanguageContext';

interface Props {
  theme: ThemeColors;
  themeName: string;
  language: Language;
  t: (key: string) => string;
  onOpenTheme: () => void;
  onOpenLanguage: () => void;
}

export default function AppSettingsSection({
  theme,
  themeName,
  language,
  t,
  onOpenTheme,
  onOpenLanguage,
}: Props) {
  return (
    <View style={commonStyles.section}>
      <Text style={commonStyles.sectionTitle}>{t('appSettings')}</Text>

      <TouchableOpacity style={commonStyles.settingItem} onPress={onOpenTheme}>
        <Ionicons name="color-palette" size={24} color={theme.accentLight} />
        <View style={commonStyles.settingTextContainer}>
          <Text style={commonStyles.settingText}>{t('theme')}</Text>
          <Text style={commonStyles.settingSubtext}>
            {THEMES[themeName]?.name || 'Mystic Purple'}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={theme.accent} />
      </TouchableOpacity>

      <TouchableOpacity style={commonStyles.settingItem} onPress={onOpenLanguage}>
        <Ionicons name="language" size={24} color={theme.accentLight} />
        <View style={commonStyles.settingTextContainer}>
          <Text style={commonStyles.settingText}>{t('language')}</Text>
          <Text style={commonStyles.settingSubtext}>{language.nativeName}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={theme.accent} />
      </TouchableOpacity>
    </View>
  );
}
