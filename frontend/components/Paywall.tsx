import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  ActivityIndicator,
  Linking,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface PaywallProps {
  visible: boolean;
  onClose: () => void;
  feature?: string;
}

const PREMIUM_FEATURES = [
  { icon: 'sparkles', text: 'Unlimited AI Oracle Readings' },
  { icon: 'chatbubbles', text: 'Access to All Spirit Guides' },
  { icon: 'fitness', text: 'AI Guided Meditation' },
  { icon: 'pulse', text: 'Binaural Beat Meditation' },
  { icon: 'planet', text: 'Astral Travel Practice' },
  { icon: 'book', text: 'Unlimited Journal Entries' },
  { icon: 'school', text: 'All Training Modules' },
  { icon: 'volume-high', text: 'Spirit Guide Voice (TTS)' },
];

export function Paywall({ visible, onClose, feature }: PaywallProps) {
  const { isAuthenticated, refreshSubscription } = useAuth();
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleSubscribe = async () => {
    if (!isAuthenticated) {
      setError('Please login to subscribe');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const sessionToken = await AsyncStorage.getItem('session_token');
      
      // Get current origin for redirect URLs
      const originUrl = Platform.OS === 'web' 
        ? window.location.origin 
        : BACKEND_URL;

      const response = await fetch(`${BACKEND_URL}/api/subscription/create-checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify({
          plan_id: 'premium_monthly',
          origin_url: originUrl
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Failed to create checkout');
      }

      const data = await response.json();
      
      // Open Stripe checkout
      if (Platform.OS === 'web') {
        window.location.href = data.checkout_url;
      } else {
        await Linking.openURL(data.checkout_url);
      }

      onClose();
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={28} color="#9f7aea" />
          </TouchableOpacity>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Premium Badge */}
            <View style={styles.premiumBadge}>
              <Ionicons name="star" size={32} color="#ffd700" />
            </View>

            <Text style={styles.title}>Unlock Etheria Premium</Text>
            
            {feature && (
              <Text style={styles.featureNote}>
                "{feature}" requires a premium subscription
              </Text>
            )}

            <Text style={styles.price}>$3.99/month</Text>
            <Text style={styles.subtitle}>Unlock your full spiritual potential</Text>

            {/* Features List */}
            <View style={styles.featuresList}>
              {PREMIUM_FEATURES.map((item, index) => (
                <View key={index} style={styles.featureItem}>
                  <View style={styles.featureIcon}>
                    <Ionicons name={item.icon as any} size={20} color="#b794f6" />
                  </View>
                  <Text style={styles.featureText}>{item.text}</Text>
                </View>
              ))}
            </View>

            {error && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {/* Subscribe Button */}
            <TouchableOpacity
              style={[styles.subscribeButton, loading && styles.buttonDisabled]}
              onPress={handleSubscribe}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#1a0033" />
              ) : (
                <>
                  <Ionicons name="diamond" size={20} color="#1a0033" />
                  <Text style={styles.subscribeButtonText}>Subscribe Now</Text>
                </>
              )}
            </TouchableOpacity>

            <Text style={styles.terms}>
              Cancel anytime. Subscription renews monthly.
            </Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

interface PremiumFeatureGateProps {
  feature: string;
  featureLabel?: string;
  children: React.ReactNode;
}

export function PremiumFeatureGate({ feature, featureLabel, children }: PremiumFeatureGateProps) {
  const { checkFeatureAccess, isPremium } = useAuth();
  const [showPaywall, setShowPaywall] = React.useState(false);

  const hasAccess = checkFeatureAccess(feature);

  if (hasAccess || isPremium) {
    return <>{children}</>;
  }

  return (
    <>
      <TouchableOpacity
        style={styles.lockedOverlay}
        onPress={() => setShowPaywall(true)}
      >
        <View style={styles.lockContainer}>
          <Ionicons name="lock-closed" size={32} color="#ffd700" />
          <Text style={styles.lockText}>Premium Feature</Text>
          <Text style={styles.unlockText}>Tap to unlock</Text>
        </View>
      </TouchableOpacity>
      <Paywall
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
        feature={featureLabel || feature}
      />
    </>
  );
}

// Small banner for inline premium prompts
export function PremiumBanner({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.banner} onPress={onPress}>
      <Ionicons name="star" size={20} color="#ffd700" />
      <Text style={styles.bannerText}>Upgrade to Premium for full access</Text>
      <Ionicons name="chevron-forward" size={20} color="#b794f6" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    backgroundColor: '#1a0033',
    borderRadius: 24,
    padding: 24,
    width: '90%',
    maxWidth: 400,
    maxHeight: '85%',
    borderWidth: 1,
    borderColor: '#7c3aed',
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 10,
    padding: 8,
  },
  premiumBadge: {
    alignSelf: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    padding: 16,
    borderRadius: 50,
    marginBottom: 16,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#e9d5ff',
    textAlign: 'center',
    marginBottom: 8,
  },
  featureNote: {
    fontSize: 14,
    color: '#c084fc',
    textAlign: 'center',
    marginBottom: 16,
    fontStyle: 'italic',
  },
  price: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#ffd700',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#9f7aea',
    textAlign: 'center',
    marginBottom: 24,
  },
  featuresList: {
    marginBottom: 24,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  featureIcon: {
    width: 36,
    height: 36,
    backgroundColor: 'rgba(183, 148, 246, 0.15)',
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  featureText: {
    fontSize: 15,
    color: '#e9d5ff',
    flex: 1,
  },
  subscribeButton: {
    backgroundColor: '#b794f6',
    paddingVertical: 16,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  subscribeButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a0033',
  },
  terms: {
    fontSize: 12,
    color: '#9f7aea',
    textAlign: 'center',
    marginTop: 16,
  },
  errorContainer: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    color: '#ef4444',
    textAlign: 'center',
  },
  lockedOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(26, 0, 51, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 16,
    zIndex: 100,
  },
  lockContainer: {
    alignItems: 'center',
  },
  lockText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffd700',
    marginTop: 12,
  },
  unlockText: {
    fontSize: 14,
    color: '#9f7aea',
    marginTop: 4,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(183, 148, 246, 0.15)',
    padding: 12,
    borderRadius: 12,
    marginVertical: 8,
    gap: 8,
  },
  bannerText: {
    flex: 1,
    color: '#e9d5ff',
    fontSize: 14,
  },
});
