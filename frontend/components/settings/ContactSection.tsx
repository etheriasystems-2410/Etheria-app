/**
 * Settings → "Contact" section: Feedback, Email Us, Visit Website, WhatsApp,
 * Facebook, Privacy, Community Guidelines, Terms of Service.
 *
 * The parent supplies routing & deep-link callbacks because some links use
 * Linking, some use a custom email modal, etc.
 */
import React from 'react';
import { Linking, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { commonStyles } from './commonStyles';

interface Props {
  t: (key: string) => string;
  onFeedback: () => void;
  onEmailUs: () => void;
  onPrivacy: () => void;
  onCommunityGuidelines: () => void;
  onTerms: () => void;
}

export default function ContactSection({
  t,
  onFeedback,
  onEmailUs,
  onPrivacy,
  onCommunityGuidelines,
  onTerms,
}: Props) {
  return (
    <View style={commonStyles.section}>
      <Text style={commonStyles.sectionTitle}>{t('contact')}</Text>

      <TouchableOpacity style={commonStyles.settingItem} onPress={onFeedback}>
        <Ionicons name="chatbubble-ellipses" size={24} color="#ec4899" />
        <Text style={commonStyles.settingText}>{t('feedbackBugReports')}</Text>
        <Ionicons name="chevron-forward" size={20} color="#9f7aea" />
      </TouchableOpacity>

      <TouchableOpacity style={commonStyles.settingItem} onPress={onEmailUs}>
        <Ionicons name="mail" size={24} color="#b794f6" />
        <View style={commonStyles.settingTextContainer}>
          <Text style={commonStyles.settingText}>{t('emailUs')}</Text>
          <Text style={commonStyles.settingSubtext}>etheriasystems@gmail.com</Text>
        </View>
        <Ionicons name="open-outline" size={20} color="#9f7aea" />
      </TouchableOpacity>

      <TouchableOpacity
        style={commonStyles.settingItem}
        onPress={() => Linking.openURL('https://www.etheriasystems.online')}
      >
        <Ionicons name="globe" size={24} color="#b794f6" />
        <View style={commonStyles.settingTextContainer}>
          <Text style={commonStyles.settingText}>{t('visitWebsite')}</Text>
          <Text style={commonStyles.settingSubtext}>www.etheriasystems.online</Text>
        </View>
        <Ionicons name="open-outline" size={20} color="#9f7aea" />
      </TouchableOpacity>

      <TouchableOpacity
        style={commonStyles.settingItem}
        onPress={() => Linking.openURL('https://wa.me/16152603626')}
      >
        <Ionicons name="logo-whatsapp" size={24} color="#25D366" />
        <View style={commonStyles.settingTextContainer}>
          <Text style={commonStyles.settingText}>{t('whatsappSupport')}</Text>
          <Text style={commonStyles.settingSubtext}>{t('chatDirectly')}</Text>
        </View>
        <Ionicons name="open-outline" size={20} color="#9f7aea" />
      </TouchableOpacity>

      <TouchableOpacity
        style={commonStyles.settingItem}
        onPress={() => Linking.openURL('https://www.facebook.com/share/1SD7PKBJQ3/')}
      >
        <Ionicons name="logo-facebook" size={24} color="#1877F2" />
        <View style={commonStyles.settingTextContainer}>
          <Text style={commonStyles.settingText}>{t('followFacebook')}</Text>
          <Text style={commonStyles.settingSubtext}>@EtheriaSystems</Text>
        </View>
        <Ionicons name="open-outline" size={20} color="#9f7aea" />
      </TouchableOpacity>

      <TouchableOpacity style={commonStyles.settingItem} onPress={onPrivacy}>
        <Ionicons name="shield-checkmark" size={24} color="#b794f6" />
        <Text style={commonStyles.settingText}>{t('privacyPolicy')}</Text>
        <Ionicons name="chevron-forward" size={20} color="#9f7aea" />
      </TouchableOpacity>

      <TouchableOpacity
        style={commonStyles.settingItem}
        onPress={onCommunityGuidelines}
      >
        <Ionicons name="people-circle" size={24} color="#b794f6" />
        <Text style={commonStyles.settingText}>Community Guidelines</Text>
        <Ionicons name="chevron-forward" size={20} color="#9f7aea" />
      </TouchableOpacity>

      <TouchableOpacity style={commonStyles.settingItem} onPress={onTerms}>
        <Ionicons name="document-text" size={24} color="#b794f6" />
        <Text style={commonStyles.settingText}>{t('termsOfService')}</Text>
        <Ionicons name="chevron-forward" size={20} color="#9f7aea" />
      </TouchableOpacity>
    </View>
  );
}
