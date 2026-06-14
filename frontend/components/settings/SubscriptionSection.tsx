/**
 * Settings → "Subscription" section.
 * Renders either the Premium summary card or the Upgrade CTA, plus a
 * collapsible "Have a promotional code?" redeem row.
 */
import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { commonStyles } from './commonStyles';

interface SubscriptionData {
  expires_at?: string | null;
}

interface Props {
  isPremium: boolean;
  subscription: SubscriptionData | null | undefined;
  formatDate: (d: string | null) => string;
  onUpgrade: () => void;

  showCodeInput: boolean;
  setShowCodeInput: (v: boolean) => void;
  giftCode: string;
  setGiftCode: (v: string) => void;
  redeemingCode: boolean;
  onRedeem: () => void;
}

export default function SubscriptionSection({
  isPremium,
  subscription,
  formatDate,
  onUpgrade,
  showCodeInput,
  setShowCodeInput,
  giftCode,
  setGiftCode,
  redeemingCode,
  onRedeem,
}: Props) {
  return (
    <View style={commonStyles.section}>
      <Text style={commonStyles.sectionTitle}>Subscription</Text>

      {isPremium ? (
        <View style={styles.subscriptionCard}>
          <View style={styles.subscriptionHeader}>
            <View style={styles.subscriptionBadge}>
              <Ionicons name="star" size={24} color="#ffd700" />
            </View>
            <View style={styles.subscriptionInfo}>
              <Text style={styles.subscriptionTitle}>Etheria Premium</Text>
              <Text style={styles.subscriptionStatus}>Active</Text>
            </View>
          </View>

          {subscription?.expires_at && (
            <View style={styles.subscriptionDetail}>
              <Ionicons name="calendar" size={16} color="#9f7aea" />
              <Text style={styles.subscriptionDetailText}>
                Renews on {formatDate(subscription.expires_at)}
              </Text>
            </View>
          )}

          <View style={styles.featureGrid}>
            <View style={styles.featureItem}>
              <Ionicons name="checkmark-circle" size={16} color="#22c55e" />
              <Text style={styles.featureText}>Unlimited Oracle</Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="checkmark-circle" size={16} color="#22c55e" />
              <Text style={styles.featureText}>Spirit Guides</Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="checkmark-circle" size={16} color="#22c55e" />
              <Text style={styles.featureText}>AI Meditation</Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="checkmark-circle" size={16} color="#22c55e" />
              <Text style={styles.featureText}>Voice TTS</Text>
            </View>
          </View>
        </View>
      ) : (
        <TouchableOpacity style={styles.upgradeCard} onPress={onUpgrade}>
          <View style={styles.upgradeHeader}>
            <View style={styles.upgradeIcon}>
              <Ionicons name="diamond" size={32} color="#ffd700" />
            </View>
            <View style={styles.upgradeInfo}>
              <Text style={styles.upgradeTitle}>Upgrade to Premium</Text>
              <Text style={styles.upgradePrice}>From $3.08/mo</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#b794f6" />
          </View>

          <View style={styles.upgradeFeatures}>
            <Text style={styles.upgradeFeaturesTitle}>Unlock all features:</Text>
            <Text style={styles.upgradeFeatureText}>
              Unlimited AI Oracle, Spirit Guides, Binaural Meditation, and more!
            </Text>
          </View>
        </TouchableOpacity>
      )}

      {/* Redeem Code Section */}
      <View style={styles.redeemCodeSection}>
        <TouchableOpacity
          style={styles.haveCodeButton}
          onPress={() => setShowCodeInput(!showCodeInput)}
        >
          <Ionicons name="gift" size={20} color="#b794f6" />
          <Text style={styles.haveCodeText}>Have a promotional code?</Text>
          <Ionicons
            name={showCodeInput ? 'chevron-up' : 'chevron-down'}
            size={20}
            color="#b794f6"
          />
        </TouchableOpacity>

        {showCodeInput && (
          <View style={styles.codeInputContainer}>
            <TextInput
              style={styles.codeInput}
              placeholder="Enter your code"
              placeholderTextColor="#6b7280"
              value={giftCode}
              onChangeText={(t) => setGiftCode(t.toUpperCase())}
              autoCapitalize="characters"
              autoCorrect={false}
            />
            <TouchableOpacity
              style={[styles.redeemButton, redeemingCode && styles.buttonDisabled]}
              onPress={onRedeem}
              disabled={redeemingCode || !giftCode.trim()}
            >
              {redeemingCode ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.redeemButtonText}>Redeem</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  subscriptionCard: {
    backgroundColor: '#1a0033',
    borderRadius: 16,
    padding: 12,
    borderWidth: 2,
    borderColor: '#ffd700',
  },
  subscriptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  subscriptionBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  subscriptionInfo: { flex: 1 },
  subscriptionTitle: { fontSize: 18, fontWeight: 'bold', color: '#ffd700' },
  subscriptionStatus: { fontSize: 14, color: '#22c55e' },
  subscriptionDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  subscriptionDetailText: { color: '#9f7aea', fontSize: 14 },
  featureGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  featureText: { color: '#e9d5ff', fontSize: 12 },
  upgradeCard: {
    backgroundColor: '#1a0033',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#7c3aed',
  },
  upgradeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  upgradeIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  upgradeInfo: { flex: 1 },
  upgradeTitle: { fontSize: 18, fontWeight: 'bold', color: '#e9d5ff' },
  upgradePrice: { fontSize: 16, color: '#ffd700', fontWeight: '600' },
  upgradeFeatures: {
    backgroundColor: 'rgba(124, 58, 237, 0.15)',
    padding: 12,
    borderRadius: 12,
  },
  upgradeFeaturesTitle: { color: '#b794f6', fontSize: 12, marginBottom: 4 },
  upgradeFeatureText: { color: '#e9d5ff', fontSize: 14 },

  redeemCodeSection: { marginTop: 16 },
  haveCodeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  haveCodeText: { color: '#b794f6', fontSize: 15, fontWeight: '500' },
  codeInputContainer: { flexDirection: 'row', marginTop: 12, gap: 8 },
  codeInput: {
    flex: 1,
    backgroundColor: '#2d1b4e',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#e9d5ff',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 1,
    borderWidth: 1,
    borderColor: '#7c3aed',
  },
  redeemButton: {
    backgroundColor: '#7c3aed',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  redeemButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  buttonDisabled: { opacity: 0.7 },
});
