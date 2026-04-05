import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
  Linking,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { Paywall } from '../components/Paywall';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  registerForPushNotificationsAsync,
  getNotificationPreferences,
  saveNotificationPreferences,
  checkNotificationPermission,
  NotificationPreferences,
} from '../utils/notifications';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

export default function Settings() {
  const { user, logout, isPremium, subscription, refreshSubscription } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.name || '');
  const [saving, setSaving] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [checkingPayment, setCheckingPayment] = useState(false);
  
  // Gift Code State
  const [showCodeInput, setShowCodeInput] = useState(false);
  const [giftCode, setGiftCode] = useState('');
  const [redeemingCode, setRedeemingCode] = useState(false);

  // Notification State
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPreferences>({
    dailyOracle: true,
    oracleReadings: true,
    spiritGuideMessages: true,
    contestWinner: true,
    creatorMessages: true,
    dailyOracleTime: '09:00',
  });
  const [loadingNotifications, setLoadingNotifications] = useState(true);

  // Check for payment success on mount
  useEffect(() => {
    if (params.session_id && params.success === 'true') {
      handlePaymentSuccess(params.session_id as string);
    }
  }, [params]);

  // Load notification settings
  useEffect(() => {
    loadNotificationSettings();
  }, []);

  const loadNotificationSettings = async () => {
    try {
      const hasPermission = await checkNotificationPermission();
      setNotificationsEnabled(hasPermission);
      
      const prefs = await getNotificationPreferences();
      setNotificationPrefs(prefs);
    } catch (error) {
      console.error('Error loading notification settings:', error);
    } finally {
      setLoadingNotifications(false);
    }
  };

  const handleEnableNotifications = async () => {
    try {
      const token = await registerForPushNotificationsAsync();
      if (token) {
        setNotificationsEnabled(true);
        
        // Save token to backend
        if (user) {
          await fetch(`${BACKEND_URL}/api/notifications/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              user_id: user.user_id,
              push_token: token,
              platform: Platform.OS,
            }),
          });
        }
        
        Alert.alert('Success', 'Push notifications enabled! You will receive spiritual guidance reminders.');
      } else {
        Alert.alert(
          'Permission Required',
          'Please enable notifications in your device settings to receive spiritual guidance reminders.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
          ]
        );
      }
    } catch (error) {
      console.error('Error enabling notifications:', error);
      Alert.alert('Error', 'Failed to enable notifications. Please try again.');
    }
  };

  const handleToggleNotificationPref = async (key: keyof NotificationPreferences, value: boolean) => {
    const newPrefs = { ...notificationPrefs, [key]: value };
    setNotificationPrefs(newPrefs);
    await saveNotificationPreferences(newPrefs);
  };

  const handleRedeemCode = async () => {
    if (!giftCode.trim()) {
      Alert.alert('Error', 'Please enter a code');
      return;
    }

    setRedeemingCode(true);
    try {
      const sessionToken = await AsyncStorage.getItem('session_token');
      
      const response = await fetch(`${BACKEND_URL}/api/gift-code/redeem`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify({
          code: giftCode.trim().toUpperCase()
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Invalid code');
      }

      setGiftCode('');
      setShowCodeInput(false);
      await refreshSubscription();
      
      Alert.alert('Success!', data.message);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to redeem code');
    } finally {
      setRedeemingCode(false);
    }
  };

  const handlePaymentSuccess = async (sessionId: string) => {
    setCheckingPayment(true);
    try {
      const sessionToken = await AsyncStorage.getItem('session_token');
      
      // Poll for payment status
      let attempts = 0;
      const maxAttempts = 5;
      const pollInterval = 2000;

      const pollStatus = async (): Promise<boolean> => {
        const response = await fetch(
          `${BACKEND_URL}/api/subscription/checkout-status/${sessionId}`,
          {
            headers: {
              'Authorization': `Bearer ${sessionToken}`
            }
          }
        );

        if (!response.ok) {
          throw new Error('Failed to check payment status');
        }

        const data = await response.json();

        if (data.payment_status === 'paid') {
          return true;
        } else if (data.status === 'expired') {
          throw new Error('Payment session expired');
        }

        return false;
      };

      while (attempts < maxAttempts) {
        const success = await pollStatus();
        if (success) {
          await refreshSubscription();
          Alert.alert(
            'Welcome to Premium!',
            'Your subscription is now active. Enjoy all premium features!'
          );
          // Clear URL params
          router.replace('/settings');
          break;
        }
        attempts++;
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      }

      if (attempts >= maxAttempts) {
        Alert.alert(
          'Payment Processing',
          'Your payment is being processed. Please check back in a moment.'
        );
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to verify payment');
    } finally {
      setCheckingPayment(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await logout();
            router.replace('/auth/login');
          },
        },
      ]
    );
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Name cannot be empty');
      return;
    }

    setSaving(true);
    try {
      const sessionToken = await AsyncStorage.getItem('session_token');

      const response = await fetch(`${BACKEND_URL}/api/user/update-profile`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({ name: name.trim() }),
      });

      if (response.ok) {
        Alert.alert('Success', 'Profile updated successfully');
        setEditing(false);
      } else {
        throw new Error('Failed to update profile');
      }
    } catch (error) {
      Alert.alert('Error', 'Could not update profile');
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <ScrollView style={styles.container}>
      {/* Payment Processing Overlay */}
      {checkingPayment && (
        <View style={styles.processingOverlay}>
          <ActivityIndicator size="large" color="#b794f6" />
          <Text style={styles.processingText}>Verifying payment...</Text>
        </View>
      )}

      <View style={styles.header}>
        <View style={styles.avatarContainer}>
          {user?.picture ? (
            <Image source={{ uri: user.picture }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Ionicons name="person" size={48} color="#e9d5ff" />
            </View>
          )}
          {isPremium && (
            <View style={styles.premiumBadge}>
              <Ionicons name="star" size={16} color="#ffd700" />
            </View>
          )}
        </View>
        <Text style={styles.email}>{user?.email}</Text>
        {isPremium && (
          <View style={styles.premiumTag}>
            <Ionicons name="diamond" size={14} color="#ffd700" />
            <Text style={styles.premiumTagText}>Premium Member</Text>
          </View>
        )}
      </View>

      {/* Subscription Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Subscription</Text>
        
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
          <TouchableOpacity
            style={styles.upgradeCard}
            onPress={() => setShowPaywall(true)}
          >
            <View style={styles.upgradeHeader}>
              <View style={styles.upgradeIcon}>
                <Ionicons name="diamond" size={32} color="#ffd700" />
              </View>
              <View style={styles.upgradeInfo}>
                <Text style={styles.upgradeTitle}>Upgrade to Premium</Text>
                <Text style={styles.upgradePrice}>$3.99/month</Text>
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
              name={showCodeInput ? "chevron-up" : "chevron-down"} 
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
                onChangeText={(text) => setGiftCode(text.toUpperCase())}
                autoCapitalize="characters"
                autoCorrect={false}
              />
              <TouchableOpacity
                style={[styles.redeemButton, redeemingCode && styles.buttonDisabled]}
                onPress={handleRedeemCode}
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

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Profile Information</Text>
        
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Name</Text>
            {editing ? (
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Your name"
                placeholderTextColor="#9f7aea"
              />
            ) : (
              <Text style={styles.infoValue}>{user?.name}</Text>
            )}
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>User ID</Text>
            <Text style={styles.infoValue}>{user?.user_id}</Text>
          </View>

          {editing ? (
            <View style={styles.editButtons}>
              <TouchableOpacity
                style={[styles.editButton, styles.cancelButton]}
                onPress={() => {
                  setName(user?.name || '');
                  setEditing(false);
                }}
              >
                <Text style={styles.editButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.editButton, styles.saveButton]}
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.editButtonText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.editProfileButton}
              onPress={() => setEditing(true)}
            >
              <Ionicons name="create" size={20} color="#b794f6" />
              <Text style={styles.editProfileText}>Edit Profile</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Notifications</Text>
        
        {!notificationsEnabled ? (
          <TouchableOpacity 
            style={styles.enableNotificationsButton}
            onPress={handleEnableNotifications}
          >
            <Ionicons name="notifications" size={24} color="#fff" />
            <View style={styles.settingTextContainer}>
              <Text style={styles.enableNotificationsText}>Enable Push Notifications</Text>
              <Text style={styles.enableNotificationsSubtext}>
                Receive spiritual guidance reminders
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#fff" />
          </TouchableOpacity>
        ) : (
          <>
            <View style={styles.notificationRow}>
              <Ionicons name="sunny" size={22} color="#fbbf24" />
              <View style={styles.notificationTextContainer}>
                <Text style={styles.notificationTitle}>Daily Oracle Reminder</Text>
                <Text style={styles.notificationSubtext}>Daily reminder to draw your oracle card</Text>
              </View>
              <Switch
                value={notificationPrefs.dailyOracle}
                onValueChange={(v) => handleToggleNotificationPref('dailyOracle', v)}
                trackColor={{ false: '#2d1b4e', true: '#7c3aed' }}
                thumbColor={notificationPrefs.dailyOracle ? '#a855f7' : '#666'}
              />
            </View>

            <View style={styles.notificationRow}>
              <Ionicons name="sparkles" size={22} color="#ec4899" />
              <View style={styles.notificationTextContainer}>
                <Text style={styles.notificationTitle}>Oracle Readings</Text>
                <Text style={styles.notificationSubtext}>Insights about your readings</Text>
              </View>
              <Switch
                value={notificationPrefs.oracleReadings}
                onValueChange={(v) => handleToggleNotificationPref('oracleReadings', v)}
                trackColor={{ false: '#2d1b4e', true: '#7c3aed' }}
                thumbColor={notificationPrefs.oracleReadings ? '#a855f7' : '#666'}
              />
            </View>

            <View style={styles.notificationRow}>
              <Ionicons name="person" size={22} color="#8b5cf6" />
              <View style={styles.notificationTextContainer}>
                <Text style={styles.notificationTitle}>Spirit Guide Messages</Text>
                <Text style={styles.notificationSubtext}>Messages from your matched guide</Text>
              </View>
              <Switch
                value={notificationPrefs.spiritGuideMessages}
                onValueChange={(v) => handleToggleNotificationPref('spiritGuideMessages', v)}
                trackColor={{ false: '#2d1b4e', true: '#7c3aed' }}
                thumbColor={notificationPrefs.spiritGuideMessages ? '#a855f7' : '#666'}
              />
            </View>

            <View style={styles.notificationRow}>
              <Ionicons name="trophy" size={22} color="#ffd700" />
              <View style={styles.notificationTextContainer}>
                <Text style={styles.notificationTitle}>Contest Winner</Text>
                <Text style={styles.notificationSubtext}>Get notified if you win</Text>
              </View>
              <Switch
                value={notificationPrefs.contestWinner}
                onValueChange={(v) => handleToggleNotificationPref('contestWinner', v)}
                trackColor={{ false: '#2d1b4e', true: '#7c3aed' }}
                thumbColor={notificationPrefs.contestWinner ? '#a855f7' : '#666'}
              />
            </View>

            <View style={styles.notificationRow}>
              <Ionicons name="megaphone" size={22} color="#60a5fa" />
              <View style={styles.notificationTextContainer}>
                <Text style={styles.notificationTitle}>Etheria Updates</Text>
                <Text style={styles.notificationSubtext}>News and announcements</Text>
              </View>
              <Switch
                value={notificationPrefs.creatorMessages}
                onValueChange={(v) => handleToggleNotificationPref('creatorMessages', v)}
                trackColor={{ false: '#2d1b4e', true: '#7c3aed' }}
                thumbColor={notificationPrefs.creatorMessages ? '#a855f7' : '#666'}
              />
            </View>
          </>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>App Settings</Text>

        <TouchableOpacity style={styles.settingItem}>
          <Ionicons name="moon" size={24} color="#b794f6" />
          <Text style={styles.settingText}>Theme</Text>
          <Ionicons name="chevron-forward" size={20} color="#9f7aea" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.settingItem}>
          <Ionicons name="language" size={24} color="#b794f6" />
          <Text style={styles.settingText}>Language</Text>
          <Ionicons name="chevron-forward" size={20} color="#9f7aea" />
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Contact</Text>
        
        <TouchableOpacity 
          style={styles.settingItem}
          onPress={() => router.push('/feedback')}
        >
          <Ionicons name="chatbubble-ellipses" size={24} color="#ec4899" />
          <Text style={styles.settingText}>Feedback & Bug Reports</Text>
          <Ionicons name="chevron-forward" size={20} color="#9f7aea" />
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.settingItem}
          onPress={() => Linking.openURL('mailto:etheriasystems@gmail.com')}
        >
          <Ionicons name="mail" size={24} color="#b794f6" />
          <View style={styles.settingTextContainer}>
            <Text style={styles.settingText}>Email Us</Text>
            <Text style={styles.settingSubtext}>etheriasystems@gmail.com</Text>
          </View>
          <Ionicons name="open-outline" size={20} color="#9f7aea" />
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.settingItem}
          onPress={() => Linking.openURL('https://www.etheriasystems.online')}
        >
          <Ionicons name="globe" size={24} color="#b794f6" />
          <View style={styles.settingTextContainer}>
            <Text style={styles.settingText}>Visit Our Website</Text>
            <Text style={styles.settingSubtext}>www.etheriasystems.online</Text>
          </View>
          <Ionicons name="open-outline" size={20} color="#9f7aea" />
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.settingItem}
          onPress={() => Linking.openURL('https://wa.me/16152603626')}
        >
          <Ionicons name="logo-whatsapp" size={24} color="#25D366" />
          <View style={styles.settingTextContainer}>
            <Text style={styles.settingText}>WhatsApp Support</Text>
            <Text style={styles.settingSubtext}>Chat with us directly</Text>
          </View>
          <Ionicons name="open-outline" size={20} color="#9f7aea" />
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.settingItem}
          onPress={() => Linking.openURL('https://www.facebook.com/share/1SD7PKBJQ3/')}
        >
          <Ionicons name="logo-facebook" size={24} color="#1877F2" />
          <View style={styles.settingTextContainer}>
            <Text style={styles.settingText}>Follow on Facebook</Text>
            <Text style={styles.settingSubtext}>@EtheriaSystems</Text>
          </View>
          <Ionicons name="open-outline" size={20} color="#9f7aea" />
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.settingItem}
          onPress={() => Linking.openURL('https://www.etheriasystems.online/privacy')}
        >
          <Ionicons name="shield-checkmark" size={24} color="#b794f6" />
          <Text style={styles.settingText}>Privacy Policy</Text>
          <Ionicons name="open-outline" size={20} color="#9f7aea" />
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.settingItem}
          onPress={() => Linking.openURL('https://www.etheriasystems.online/terms')}
        >
          <Ionicons name="document-text" size={24} color="#b794f6" />
          <Text style={styles.settingText}>Terms of Service</Text>
          <Ionicons name="open-outline" size={20} color="#9f7aea" />
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Ionicons name="log-out" size={24} color="#ef4444" />
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>

      <Text style={styles.version}>Version 1.0.0</Text>

      {/* Paywall Modal */}
      <Paywall
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0321',
  },
  processingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 3, 33, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  processingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#e9d5ff',
  },
  header: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 12,
  },
  avatarContainer: {
    marginBottom: 16,
    position: 'relative',
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: '#7c3aed',
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#2d1b4e',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#7c3aed',
  },
  premiumBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#2d1b4e',
    borderRadius: 12,
    padding: 6,
    borderWidth: 2,
    borderColor: '#ffd700',
  },
  email: {
    fontSize: 16,
    color: '#c4b5fd',
  },
  premiumTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 8,
    gap: 6,
  },
  premiumTagText: {
    color: '#ffd700',
    fontSize: 12,
    fontWeight: '600',
  },
  section: {
    paddingHorizontal: 12,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#e9d5ff',
    marginBottom: 12,
  },
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
  subscriptionInfo: {
    flex: 1,
  },
  subscriptionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffd700',
  },
  subscriptionStatus: {
    fontSize: 14,
    color: '#22c55e',
  },
  subscriptionDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  subscriptionDetailText: {
    color: '#9f7aea',
    fontSize: 14,
  },
  featureGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  featureText: {
    color: '#e9d5ff',
    fontSize: 12,
  },
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
  upgradeInfo: {
    flex: 1,
  },
  upgradeTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#e9d5ff',
  },
  upgradePrice: {
    fontSize: 16,
    color: '#ffd700',
    fontWeight: '600',
  },
  upgradeFeatures: {
    backgroundColor: 'rgba(124, 58, 237, 0.15)',
    padding: 12,
    borderRadius: 12,
  },
  upgradeFeaturesTitle: {
    color: '#b794f6',
    fontSize: 12,
    marginBottom: 4,
  },
  upgradeFeatureText: {
    color: '#e9d5ff',
    fontSize: 14,
  },
  infoCard: {
    backgroundColor: '#1a0033',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#2d1b4e',
  },
  infoRow: {
    marginBottom: 16,
  },
  infoLabel: {
    fontSize: 14,
    color: '#9f7aea',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    color: '#e9d5ff',
    fontWeight: '500',
  },
  input: {
    backgroundColor: '#2d1b4e',
    borderRadius: 8,
    padding: 12,
    color: '#e9d5ff',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#7c3aed',
  },
  editButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  editButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#2d1b4e',
  },
  saveButton: {
    backgroundColor: '#7c3aed',
  },
  editButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  editProfileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  editProfileText: {
    color: '#b794f6',
    fontSize: 16,
    fontWeight: '600',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a0033',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#2d1b4e',
  },
  settingText: {
    flex: 1,
    fontSize: 16,
    color: '#e9d5ff',
    marginLeft: 12,
  },
  settingTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  settingSubtext: {
    fontSize: 12,
    color: '#9f7aea',
    marginTop: 2,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a0033',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 20,
    marginTop: 8,
    marginBottom: 24,
    borderWidth: 2,
    borderColor: '#ef4444',
    gap: 12,
  },
  logoutText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ef4444',
  },
  version: {
    textAlign: 'center',
    color: '#9f7aea',
    fontSize: 14,
    paddingBottom: 32,
  },
  // Redeem Code Styles
  redeemCodeSection: {
    marginTop: 16,
  },
  haveCodeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  haveCodeText: {
    color: '#b794f6',
    fontSize: 15,
    fontWeight: '500',
  },
  codeInputContainer: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 8,
  },
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
  redeemButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  enableNotificationsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#7c3aed',
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  enableNotificationsText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  enableNotificationsSubtext: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 13,
    marginTop: 2,
  },
  notificationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#2d1b4e',
  },
  notificationTextContainer: {
    flex: 1,
    marginLeft: 14,
  },
  notificationTitle: {
    color: '#e9d5ff',
    fontSize: 15,
    fontWeight: '500',
  },
  notificationSubtext: {
    color: '#9f7aea',
    fontSize: 12,
    marginTop: 2,
  },
});
