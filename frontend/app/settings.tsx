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
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useTheme, THEMES, ThemeColors } from '../contexts/ThemeContext';
import { useLanguage, LANGUAGES, Language } from '../contexts/LanguageContext';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { Paywall } from '../components/Paywall';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import * as WebBrowser from 'expo-web-browser';
import { CosmicBackdrop } from '../components/ui';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

export default function Settings() {
  const { user, logout, isPremium, subscription, refreshSubscription } = useAuth();
  const { theme, themeName, setTheme, availableThemes } = useTheme();
  const { language, languageCode, setLanguage, t, availableLanguages } = useLanguage();
  const router = useRouter();
  const params = useLocalSearchParams();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.name || '');
  const [saving, setSaving] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [checkingPayment, setCheckingPayment] = useState(false);
  
  // Theme and Language modals
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  
  // Gift Code State
  const [showCodeInput, setShowCodeInput] = useState(false);
  const [giftCode, setGiftCode] = useState('');
  const [redeemingCode, setRedeemingCode] = useState(false);
  
  // Profile Picture State
  const [profilePicture, setProfilePicture] = useState<string | null>(null);
  const [uploadingPicture, setUploadingPicture] = useState(false);
  const [showPictureModal, setShowPictureModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkModalData, setLinkModalData] = useState({ title: '', url: '' });

  // Load profile picture on mount
  useEffect(() => {
    loadProfilePicture();
  }, []);

  const loadProfilePicture = async () => {
    try {
      const stored = await AsyncStorage.getItem('profile_picture');
      if (stored) {
        setProfilePicture(stored);
      }
    } catch (error) {
      console.error('Error loading profile picture:', error);
    }
  };

  const pickImage = async () => {
    try {
      // Request permission
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant access to your photo library to upload a profile picture.');
        return;
      }

      // Pick image
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
        base64: true,
      });

      if (!result.canceled && result.assets[0]) {
        setUploadingPicture(true);
        const base64Image = `data:image/jpeg;base64,${result.assets[0].base64}`;
        
        // Save locally
        await AsyncStorage.setItem('profile_picture', base64Image);
        setProfilePicture(base64Image);
        
        // Also save to backend
        try {
          const sessionToken = await AsyncStorage.getItem('session_token');
          await fetch(`${BACKEND_URL}/api/auth/update-profile`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${sessionToken}`,
            },
            body: JSON.stringify({ picture: base64Image }),
          });
        } catch (error) {
          console.log('Could not sync profile picture to server');
        }
        
        setUploadingPicture(false);
        Alert.alert('Success', 'Profile picture updated!');
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to update profile picture');
      setUploadingPicture(false);
    }
  };

  const takePhoto = async () => {
    try {
      // Request camera permission
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant access to your camera to take a profile picture.');
        return;
      }

      // Take photo
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
        base64: true,
      });

      if (!result.canceled && result.assets[0]) {
        setUploadingPicture(true);
        const base64Image = `data:image/jpeg;base64,${result.assets[0].base64}`;
        
        // Save locally
        await AsyncStorage.setItem('profile_picture', base64Image);
        setProfilePicture(base64Image);
        
        // Also save to backend
        try {
          const sessionToken = await AsyncStorage.getItem('session_token');
          await fetch(`${BACKEND_URL}/api/auth/update-profile`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${sessionToken}`,
            },
            body: JSON.stringify({ picture: base64Image }),
          });
        } catch (error) {
          console.log('Could not sync profile picture to server');
        }
        
        setUploadingPicture(false);
        Alert.alert('Success', 'Profile picture updated!');
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo');
      setUploadingPicture(false);
    }
  };

  const showImageOptions = () => {
    setShowPictureModal(true);
  };

  const handleEmailPress = () => {
    // Show modal with email address instead of trying to open mailto
    setShowEmailModal(true);
  };

  const handleOpenLink = async (url: string, title: string) => {
    try {
      // Use WebBrowser for in-app browser experience
      if (Platform.OS !== 'web') {
        await WebBrowser.openBrowserAsync(url, {
          dismissButtonStyle: 'close',
          presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
        });
      } else {
        // For web, open in new tab
        const canOpen = await Linking.canOpenURL(url);
        if (canOpen) {
          await Linking.openURL(url);
        } else {
          setLinkModalData({ title, url });
          setShowLinkModal(true);
        }
      }
    } catch (error) {
      // Fallback to showing modal with the URL
      setLinkModalData({ title, url });
      setShowLinkModal(true);
    }
  };

  const tryOpenEmail = async () => {
    const email = 'etheriasystems@gmail.com';
    const mailtoUrl = `mailto:${email}`;
    
    try {
      const canOpen = await Linking.canOpenURL(mailtoUrl);
      if (canOpen) {
        await Linking.openURL(mailtoUrl);
        setShowEmailModal(false);
      }
    } catch (error) {
      // Keep modal open if mailto fails
      console.log('Could not open email app');
    }
  };

  // Check for payment success on mount
  useEffect(() => {
    if (params.session_id && params.success === 'true') {
      handlePaymentSuccess(params.session_id as string);
    }
  }, [params]);

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

  const [showLogoutModal, setShowLogoutModal] = useState(false);
  
  const handleLogout = () => {
    setShowLogoutModal(true);
  };
  
  const confirmLogout = async () => {
    setShowLogoutModal(false);
    await logout();
    router.replace('/auth/login');
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
        <TouchableOpacity style={styles.avatarContainer} onPress={showImageOptions} disabled={uploadingPicture}>
          {uploadingPicture ? (
            <View style={styles.avatarPlaceholder}>
              <ActivityIndicator size="large" color="#a855f7" />
            </View>
          ) : profilePicture || user?.picture ? (
            <Image source={{ uri: profilePicture || user?.picture }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Ionicons name="person" size={48} color="#e9d5ff" />
            </View>
          )}
          <View style={styles.cameraOverlay}>
            <Ionicons name="camera" size={20} color="#fff" />
          </View>
          {isPremium && (
            <View style={styles.premiumBadge}>
              <Ionicons name="star" size={16} color="#ffd700" />
            </View>
          )}
        </TouchableOpacity>
        <Text style={styles.avatarHint}>Tap to change photo</Text>
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
        <Text style={styles.sectionTitle}>{t('appSettings')}</Text>

        <TouchableOpacity 
          style={styles.settingItem}
          onPress={() => setShowThemeModal(true)}
        >
          <Ionicons name="color-palette" size={24} color={theme.accentLight} />
          <View style={styles.settingTextContainer}>
            <Text style={styles.settingText}>{t('theme')}</Text>
            <Text style={styles.settingSubtext}>{THEMES[themeName]?.name || 'Mystic Purple'}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={theme.accent} />
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.settingItem}
          onPress={() => setShowLanguageModal(true)}
        >
          <Ionicons name="language" size={24} color={theme.accentLight} />
          <View style={styles.settingTextContainer}>
            <Text style={styles.settingText}>{t('language')}</Text>
            <Text style={styles.settingSubtext}>{language.nativeName}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={theme.accent} />
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('contact')}</Text>
        
        <TouchableOpacity 
          style={styles.settingItem}
          onPress={() => router.push('/feedback')}
        >
          <Ionicons name="chatbubble-ellipses" size={24} color="#ec4899" />
          <Text style={styles.settingText}>{t('feedbackBugReports')}</Text>
          <Ionicons name="chevron-forward" size={20} color="#9f7aea" />
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.settingItem}
          onPress={handleEmailPress}
        >
          <Ionicons name="mail" size={24} color="#b794f6" />
          <View style={styles.settingTextContainer}>
            <Text style={styles.settingText}>{t('emailUs')}</Text>
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
            <Text style={styles.settingText}>{t('visitWebsite')}</Text>
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
            <Text style={styles.settingText}>{t('whatsappSupport')}</Text>
            <Text style={styles.settingSubtext}>{t('chatDirectly')}</Text>
          </View>
          <Ionicons name="open-outline" size={20} color="#9f7aea" />
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.settingItem}
          onPress={() => Linking.openURL('https://www.facebook.com/share/1SD7PKBJQ3/')}
        >
          <Ionicons name="logo-facebook" size={24} color="#1877F2" />
          <View style={styles.settingTextContainer}>
            <Text style={styles.settingText}>{t('followFacebook')}</Text>
            <Text style={styles.settingSubtext}>@EtheriaSystems</Text>
          </View>
          <Ionicons name="open-outline" size={20} color="#9f7aea" />
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.settingItem}
          onPress={() => router.push('/privacy')}
        >
          <Ionicons name="shield-checkmark" size={24} color="#b794f6" />
          <Text style={styles.settingText}>{t('privacyPolicy')}</Text>
          <Ionicons name="chevron-forward" size={20} color="#9f7aea" />
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.settingItem}
          onPress={() => router.push('/community-guidelines')}
        >
          <Ionicons name="people-circle" size={24} color="#b794f6" />
          <Text style={styles.settingText}>Community Guidelines</Text>
          <Ionicons name="chevron-forward" size={20} color="#9f7aea" />
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.settingItem}
          onPress={() => router.push('/terms')}
        >
          <Ionicons name="document-text" size={24} color="#b794f6" />
          <Text style={styles.settingText}>{t('termsOfService')}</Text>
          <Ionicons name="chevron-forward" size={20} color="#9f7aea" />
        </TouchableOpacity>
      </View>

      {/* Admin Panel - Only visible to admins */}
      {user?.is_admin && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Administration</Text>
          <TouchableOpacity 
            style={styles.settingItem}
            onPress={() => router.push('/admin-panel')}
          >
            <Ionicons name="shield" size={24} color="#f59e0b" />
            <Text style={styles.settingText}>Admin Panel</Text>
            <Ionicons name="chevron-forward" size={20} color="#9f7aea" />
          </TouchableOpacity>
        </View>
      )}

      {/* Hidden Admin Setup - Only for owner email without admin status */}
      {user?.email === 'etheriasystems@gmail.com' && !user?.is_admin && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Owner Setup</Text>
          <TouchableOpacity 
            style={[styles.settingItem, { backgroundColor: 'rgba(245, 158, 11, 0.1)' }]}
            onPress={async () => {
              try {
                const response = await fetch(`${BACKEND_URL}/api/admin/setup-owner`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    email: user.email,
                    admin_secret: 'etheria_admin_secret_2026'
                  })
                });
                const data = await response.json();
                if (response.ok) {
                  alert('Admin privileges granted! Please log out and log back in.');
                } else {
                  alert(data.detail || 'Failed to setup admin');
                }
              } catch (err) {
                alert('Error setting up admin privileges');
              }
            }}
          >
            <Ionicons name="key" size={24} color="#f59e0b" />
            <Text style={[styles.settingText, { color: '#f59e0b' }]}>Activate Admin Access</Text>
            <Ionicons name="chevron-forward" size={20} color="#f59e0b" />
          </TouchableOpacity>
        </View>
      )}

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Ionicons name="log-out" size={24} color="#ef4444" />
        <Text style={styles.logoutText}>{t('logout')}</Text>
      </TouchableOpacity>

      <Text style={styles.version}>Version 1.0.0</Text>

      {/* Paywall Modal */}
      <Paywall
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
      />

      {/* Logout Confirmation Modal */}
      <Modal
        visible={showLogoutModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowLogoutModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.logoutModalContent, { backgroundColor: theme.cardBackground }]}>
            <Ionicons name="log-out-outline" size={50} color="#ef4444" style={{ marginBottom: 16 }} />
            <Text style={styles.logoutModalTitle}>Logout</Text>
            <Text style={styles.logoutModalText}>Are you sure you want to logout?</Text>
            <View style={styles.logoutModalButtons}>
              <TouchableOpacity 
                style={styles.logoutCancelButton}
                onPress={() => setShowLogoutModal(false)}
              >
                <Text style={styles.logoutCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.logoutConfirmButton}
                onPress={confirmLogout}
              >
                <Text style={styles.logoutConfirmText}>Logout</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Theme Selection Modal */}
      <Modal
        visible={showThemeModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowThemeModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.cardBackground }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('selectTheme')}</Text>
              <TouchableOpacity onPress={() => setShowThemeModal(false)}>
                <Ionicons name="close" size={24} color="#e9d5ff" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScrollContent}>
              {availableThemes.map((themeOption) => {
                const isSelected = themeOption.id === themeName;
                const isLocked = themeOption.isPremium && !isPremium;
                
                return (
                  <TouchableOpacity
                    key={themeOption.id}
                    style={[
                      styles.themeOption,
                      isSelected && styles.themeOptionSelected,
                      { borderColor: isSelected ? themeOption.accent : '#2d1b4e' }
                    ]}
                    onPress={() => {
                      if (isLocked) {
                        setShowThemeModal(false);
                        setShowPaywall(true);
                      } else {
                        setTheme(themeOption.id);
                      }
                    }}
                  >
                    <View style={styles.themePreview}>
                      <View style={[styles.themeColorSwatch, { backgroundColor: themeOption.backgroundGradient[0] }]} />
                      <View style={[styles.themeColorSwatch, { backgroundColor: themeOption.accent }]} />
                      <View style={[styles.themeColorSwatch, { backgroundColor: themeOption.accentLight }]} />
                    </View>
                    <View style={styles.themeInfo}>
                      <Text style={styles.themeName}>{themeOption.name}</Text>
                      {isLocked && (
                        <View style={styles.themePremiumBadge}>
                          <Ionicons name="lock-closed" size={12} color="#fbbf24" />
                          <Text style={styles.themePremiumBadgeText}>Premium</Text>
                        </View>
                      )}
                      {isSelected && (
                        <Text style={[styles.currentBadge, { color: themeOption.accent }]}>{t('currentTheme')}</Text>
                      )}
                    </View>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={24} color={themeOption.accent} />
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

      {/* Language Selection Modal */}
      <Modal
        visible={showLanguageModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowLanguageModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.cardBackground }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('selectLanguage')}</Text>
              <TouchableOpacity onPress={() => setShowLanguageModal(false)}>
                <Ionicons name="close" size={24} color="#e9d5ff" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScrollContent}>
              {availableLanguages.map((lang) => {
                const isSelected = lang.code === languageCode;
                
                return (
                  <TouchableOpacity
                    key={lang.code}
                    style={[
                      styles.languageOption,
                      isSelected && styles.languageOptionSelected,
                      { borderColor: isSelected ? theme.accent : '#2d1b4e' }
                    ]}
                    onPress={() => {
                      setLanguage(lang.code);
                      Alert.alert(t('success'), t('languageChanged'));
                    }}
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

      {/* Profile Picture Options Modal */}
      <Modal
        visible={showPictureModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowPictureModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.cardBackground }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Change Profile Picture</Text>
              <TouchableOpacity onPress={() => setShowPictureModal(false)}>
                <Ionicons name="close" size={24} color="#e9d5ff" />
              </TouchableOpacity>
            </View>
            <View style={styles.pictureOptionsContainer}>
              <TouchableOpacity 
                style={styles.pictureOption}
                onPress={() => {
                  setShowPictureModal(false);
                  takePhoto();
                }}
              >
                <View style={styles.pictureOptionIcon}>
                  <Ionicons name="camera" size={32} color="#a855f7" />
                </View>
                <Text style={styles.pictureOptionText}>Take Photo</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.pictureOption}
                onPress={() => {
                  setShowPictureModal(false);
                  pickImage();
                }}
              >
                <View style={styles.pictureOptionIcon}>
                  <Ionicons name="images" size={32} color="#a855f7" />
                </View>
                <Text style={styles.pictureOptionText}>Choose from Library</Text>
              </TouchableOpacity>
            </View>
            
            <TouchableOpacity 
              style={styles.cancelButton}
              onPress={() => setShowPictureModal(false)}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Email Contact Modal */}
      <Modal
        visible={showEmailModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowEmailModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.cardBackground }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Contact Us</Text>
              <TouchableOpacity onPress={() => setShowEmailModal(false)}>
                <Ionicons name="close" size={24} color="#e9d5ff" />
              </TouchableOpacity>
            </View>
            <View style={styles.emailModalContent}>
              <Ionicons name="mail" size={48} color="#a855f7" />
              <Text style={styles.emailModalTitle}>Email Us</Text>
              <Text style={styles.emailModalAddress}>etheriasystems@gmail.com</Text>
              <Text style={styles.emailModalHint}>Copy the email address above to contact us</Text>
              
              <TouchableOpacity 
                style={styles.emailOpenButton}
                onPress={tryOpenEmail}
              >
                <Ionicons name="open-outline" size={20} color="#fff" />
                <Text style={styles.emailOpenButtonText}>Open Email App</Text>
              </TouchableOpacity>
            </View>
            
            <TouchableOpacity 
              style={styles.cancelButton}
              onPress={() => setShowEmailModal(false)}
            >
              <Text style={styles.cancelButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* External Link Modal */}
      <Modal
        visible={showLinkModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowLinkModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.cardBackground }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{linkModalData.title}</Text>
              <TouchableOpacity onPress={() => setShowLinkModal(false)}>
                <Ionicons name="close" size={24} color="#e9d5ff" />
              </TouchableOpacity>
            </View>
            <View style={styles.emailModalContent}>
              <Ionicons name="link" size={48} color="#a855f7" />
              <Text style={styles.emailModalTitle}>Visit Link</Text>
              <Text style={styles.emailModalAddress}>{linkModalData.url}</Text>
              <Text style={styles.emailModalHint}>Copy the URL above to open in your browser</Text>
              
              <TouchableOpacity 
                style={styles.emailOpenButton}
                onPress={async () => {
                  try {
                    await Linking.openURL(linkModalData.url);
                    setShowLinkModal(false);
                  } catch (e) {
                    console.log('Could not open link');
                  }
                }}
              >
                <Ionicons name="open-outline" size={20} color="#fff" />
                <Text style={styles.emailOpenButtonText}>Open in Browser</Text>
              </TouchableOpacity>
            </View>
            
            <TouchableOpacity 
              style={styles.cancelButton}
              onPress={() => setShowLinkModal(false)}
            >
              <Text style={styles.cancelButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0d0015',
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
  cameraOverlay: {
    position: 'absolute',
    bottom: 5,
    right: 5,
    backgroundColor: '#7c3aed',
    borderRadius: 16,
    padding: 8,
    borderWidth: 2,
    borderColor: '#0a0014',
  },
  avatarHint: {
    fontSize: 12,
    color: '#9f7aea',
    marginTop: 8,
    marginBottom: 4,
  },
  premiumBadge: {
    position: 'absolute',
    top: 0,
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
  logoutModalContent: {
    width: '85%',
    maxWidth: 340,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  logoutModalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  logoutModalText: {
    fontSize: 16,
    color: '#c4b5fd',
    textAlign: 'center',
    marginBottom: 24,
  },
  logoutModalButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  logoutCancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#2d1b4e',
    alignItems: 'center',
  },
  logoutCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#c4b5fd',
  },
  logoutConfirmButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#ef4444',
    alignItems: 'center',
  },
  logoutConfirmText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
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
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2d1b4e',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#e9d5ff',
  },
  modalScrollContent: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  // Theme Option Styles
  themeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    marginBottom: 12,
    backgroundColor: 'rgba(45, 27, 78, 0.5)',
  },
  themeOptionSelected: {
    backgroundColor: 'rgba(124, 58, 237, 0.2)',
  },
  themePreview: {
    flexDirection: 'row',
    gap: 4,
    marginRight: 16,
  },
  themeColorSwatch: {
    width: 24,
    height: 24,
    borderRadius: 4,
  },
  themeInfo: {
    flex: 1,
  },
  themeName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#e9d5ff',
  },
  themePremiumBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  themePremiumBadgeText: {
    fontSize: 12,
    color: '#fbbf24',
    fontWeight: '500',
  },
  currentBadge: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4,
  },
  // Language Option Styles
  languageOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    marginBottom: 12,
    backgroundColor: 'rgba(45, 27, 78, 0.5)',
  },
  languageOptionSelected: {
    backgroundColor: 'rgba(124, 58, 237, 0.2)',
  },
  languageInfo: {
    flex: 1,
  },
  languageName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#e9d5ff',
  },
  languageNative: {
    fontSize: 14,
    color: '#9f7aea',
    marginTop: 2,
  },
  // Profile Picture Options Styles
  pictureOptionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 24,
    paddingHorizontal: 20,
  },
  pictureOption: {
    alignItems: 'center',
    padding: 16,
  },
  pictureOptionIcon: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(168, 85, 247, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  pictureOptionText: {
    fontSize: 14,
    color: '#e9d5ff',
    fontWeight: '500',
  },
  cancelButton: {
    paddingVertical: 14,
    marginHorizontal: 20,
    marginBottom: 20,
    backgroundColor: 'rgba(45, 27, 78, 0.5)',
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#9f7aea',
    fontWeight: '600',
  },
  // Email Modal Styles
  emailModalContent: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 20,
  },
  emailModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#e9d5ff',
    marginTop: 16,
  },
  emailModalAddress: {
    fontSize: 18,
    color: '#a855f7',
    marginTop: 8,
    fontWeight: '600',
  },
  emailModalHint: {
    fontSize: 14,
    color: '#9f7aea',
    marginTop: 8,
    textAlign: 'center',
  },
  emailOpenButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#7c3aed',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginTop: 20,
    gap: 8,
  },
  emailOpenButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
});
