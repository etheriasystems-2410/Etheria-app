/**
 * Settings screen — orchestrator for all per-section sub-components in
 * `/app/frontend/components/settings/`. This screen owns all state + handlers
 * and delegates rendering to focused, testable components.
 *
 * Previously a 1671-line file with 600+ lines of styles. After Phase B refactor
 * the screen is a slim controller (~300 lines) and 13 sub-components live in
 * `/components/settings/`.
 */
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import * as WebBrowser from 'expo-web-browser';

import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Paywall } from '../components/Paywall';

import HeaderCard from '../components/settings/HeaderCard';
import SubscriptionSection from '../components/settings/SubscriptionSection';
import ProfileInfoSection from '../components/settings/ProfileInfoSection';
import AppSettingsSection from '../components/settings/AppSettingsSection';
import ContactSection from '../components/settings/ContactSection';
import AdminSection from '../components/settings/AdminSection';
import ThemeModal from '../components/settings/ThemeModal';
import LanguageModal from '../components/settings/LanguageModal';
import PictureModal from '../components/settings/PictureModal';
import EmailModal from '../components/settings/EmailModal';
import LinkModal from '../components/settings/LinkModal';
import LogoutModal from '../components/settings/LogoutModal';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

export default function Settings() {
  const { user, logout, isPremium, subscription, refreshSubscription } = useAuth();
  const { theme, themeName, setTheme, availableThemes } = useTheme();
  const { language, languageCode, setLanguage, t, availableLanguages } = useLanguage();
  const router = useRouter();
  const params = useLocalSearchParams();

  // ── Profile editing ────────────────────────────────────────────────────────
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.name || '');
  const [saving, setSaving] = useState(false);

  // ── Paywall + payment polling ─────────────────────────────────────────────
  const [showPaywall, setShowPaywall] = useState(false);
  const [checkingPayment, setCheckingPayment] = useState(false);

  // ── Modal visibility ──────────────────────────────────────────────────────
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [showPictureModal, setShowPictureModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [linkModalData, setLinkModalData] = useState({ title: '', url: '' });

  // ── Gift code ─────────────────────────────────────────────────────────────
  const [showCodeInput, setShowCodeInput] = useState(false);
  const [giftCode, setGiftCode] = useState('');
  const [redeemingCode, setRedeemingCode] = useState(false);

  // ── Profile picture ───────────────────────────────────────────────────────
  const [profilePicture, setProfilePicture] = useState<string | null>(null);
  const [uploadingPicture, setUploadingPicture] = useState(false);

  // Load locally-cached profile picture once on mount
  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem('profile_picture');
        if (stored) setProfilePicture(stored);
      } catch (e) {
        console.error('Error loading profile picture:', e);
      }
    })();
  }, []);

  // Detect Stripe redirect on mount
  useEffect(() => {
    if (params.session_id && params.success === 'true') {
      handlePaymentSuccess(params.session_id as string);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  // ────────────────────────────────────────────────────────────────────────────
  // Profile picture handlers
  // ────────────────────────────────────────────────────────────────────────────
  const handlePickedImage = async (base64: string) => {
    setUploadingPicture(true);
    try {
      await AsyncStorage.setItem('profile_picture', base64);
      setProfilePicture(base64);
      try {
        const sessionToken = await AsyncStorage.getItem('session_token');
        await fetch(`${BACKEND_URL}/api/auth/update-profile`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${sessionToken}`,
          },
          body: JSON.stringify({ picture: base64 }),
        });
      } catch {
        console.log('Could not sync profile picture to server');
      }
      Alert.alert('Success', 'Profile picture updated!');
    } finally {
      setUploadingPicture(false);
    }
  };

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Please grant access to your photo library to upload a profile picture.',
        );
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
        base64: true,
      });
      if (!result.canceled && result.assets[0]?.base64) {
        await handlePickedImage(`data:image/jpeg;base64,${result.assets[0].base64}`);
      }
    } catch (e) {
      console.error('Error picking image:', e);
      Alert.alert('Error', 'Failed to update profile picture');
    }
  };

  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Please grant access to your camera to take a profile picture.',
        );
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
        base64: true,
      });
      if (!result.canceled && result.assets[0]?.base64) {
        await handlePickedImage(`data:image/jpeg;base64,${result.assets[0].base64}`);
      }
    } catch (e) {
      console.error('Error taking photo:', e);
      Alert.alert('Error', 'Failed to take photo');
    }
  };

  // ────────────────────────────────────────────────────────────────────────────
  // Contact handlers
  // ────────────────────────────────────────────────────────────────────────────
  const handleOpenLink = async (url: string, title: string) => {
    try {
      if (Platform.OS !== 'web') {
        await WebBrowser.openBrowserAsync(url, {
          dismissButtonStyle: 'close',
          presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
        });
      } else {
        const canOpen = await Linking.canOpenURL(url);
        if (canOpen) {
          await Linking.openURL(url);
        } else {
          setLinkModalData({ title, url });
          setShowLinkModal(true);
        }
      }
    } catch {
      setLinkModalData({ title, url });
      setShowLinkModal(true);
    }
  };

  const tryOpenEmail = async () => {
    const mailtoUrl = 'mailto:etheriasystems@gmail.com';
    try {
      const canOpen = await Linking.canOpenURL(mailtoUrl);
      if (canOpen) {
        await Linking.openURL(mailtoUrl);
        setShowEmailModal(false);
      }
    } catch {
      console.log('Could not open email app');
    }
  };

  // ────────────────────────────────────────────────────────────────────────────
  // Subscription / gift code
  // ────────────────────────────────────────────────────────────────────────────
  const handleRedeemCode = async () => {
    if (!giftCode.trim()) {
      Alert.alert('Error', 'Please enter a code');
      return;
    }
    setRedeemingCode(true);
    try {
      const sessionToken = await AsyncStorage.getItem('session_token');
      const r = await fetch(`${BACKEND_URL}/api/gift-code/redeem`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({ code: giftCode.trim().toUpperCase() }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.detail || 'Invalid code');
      setGiftCode('');
      setShowCodeInput(false);
      await refreshSubscription();
      Alert.alert('Success!', data.message);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to redeem code');
    } finally {
      setRedeemingCode(false);
    }
  };

  const handlePaymentSuccess = async (sessionId: string) => {
    setCheckingPayment(true);
    try {
      const sessionToken = await AsyncStorage.getItem('session_token');
      const maxAttempts = 5;
      const pollInterval = 2000;
      let attempts = 0;

      const pollStatus = async (): Promise<boolean> => {
        const r = await fetch(
          `${BACKEND_URL}/api/subscription/checkout-status/${sessionId}`,
          { headers: { Authorization: `Bearer ${sessionToken}` } },
        );
        if (!r.ok) throw new Error('Failed to check payment status');
        const data = await r.json();
        if (data.payment_status === 'paid') return true;
        if (data.status === 'expired') throw new Error('Payment session expired');
        return false;
      };

      while (attempts < maxAttempts) {
        const ok = await pollStatus();
        if (ok) {
          await refreshSubscription();
          Alert.alert(
            'Welcome to Premium!',
            'Your subscription is now active. Enjoy all premium features!',
          );
          router.replace('/settings');
          break;
        }
        attempts++;
        await new Promise((res) => setTimeout(res, pollInterval));
      }

      if (attempts >= maxAttempts) {
        Alert.alert(
          'Payment Processing',
          'Your payment is being processed. Please check back in a moment.',
        );
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to verify payment');
    } finally {
      setCheckingPayment(false);
    }
  };

  // ────────────────────────────────────────────────────────────────────────────
  // Profile-name save + logout
  // ────────────────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Name cannot be empty');
      return;
    }
    setSaving(true);
    try {
      const sessionToken = await AsyncStorage.getItem('session_token');
      const r = await fetch(`${BACKEND_URL}/api/user/update-profile`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (r.ok) {
        Alert.alert('Success', 'Profile updated successfully');
        setEditing(false);
      } else {
        throw new Error('Failed to update profile');
      }
    } catch {
      Alert.alert('Error', 'Could not update profile');
    } finally {
      setSaving(false);
    }
  };

  const confirmLogout = async () => {
    setShowLogoutModal(false);
    await logout();
    router.replace('/auth/login');
  };

  // ────────────────────────────────────────────────────────────────────────────
  // Admin setup
  // ────────────────────────────────────────────────────────────────────────────
  const handleSetupOwner = async () => {
    try {
      const r = await fetch(`${BACKEND_URL}/api/admin/setup-owner`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user?.email,
          admin_secret: 'etheria_admin_secret_2026',
        }),
      });
      const data = await r.json();
      if (r.ok) {
        Alert.alert('Success', 'Admin privileges granted! Please log out and log back in.');
      } else {
        Alert.alert('Error', data.detail || 'Failed to setup admin');
      }
    } catch {
      Alert.alert('Error', 'Error setting up admin privileges');
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  // ────────────────────────────────────────────────────────────────────────────
  // Render
  // ────────────────────────────────────────────────────────────────────────────
  return (
    <ScrollView style={styles.container}>
      {checkingPayment && (
        <View style={styles.processingOverlay}>
          <ActivityIndicator size="large" color="#b794f6" />
          <Text style={styles.processingText}>Verifying payment...</Text>
        </View>
      )}

      <HeaderCard
        user={user}
        profilePicture={profilePicture}
        uploadingPicture={uploadingPicture}
        isPremium={isPremium}
        onOpenPicker={() => setShowPictureModal(true)}
      />

      <SubscriptionSection
        isPremium={isPremium}
        subscription={subscription}
        formatDate={formatDate}
        onUpgrade={() => setShowPaywall(true)}
        showCodeInput={showCodeInput}
        setShowCodeInput={setShowCodeInput}
        giftCode={giftCode}
        setGiftCode={setGiftCode}
        redeemingCode={redeemingCode}
        onRedeem={handleRedeemCode}
      />

      <ProfileInfoSection
        user={user}
        editing={editing}
        setEditing={setEditing}
        name={name}
        setName={setName}
        saving={saving}
        onSave={handleSave}
      />

      <AppSettingsSection
        theme={theme}
        themeName={themeName}
        language={language}
        t={t}
        onOpenTheme={() => setShowThemeModal(true)}
        onOpenLanguage={() => setShowLanguageModal(true)}
      />

      <ContactSection
        t={t}
        onFeedback={() => router.push('/feedback')}
        onEmailUs={() => setShowEmailModal(true)}
        onPrivacy={() => router.push('/privacy')}
        onCommunityGuidelines={() => router.push('/community-guidelines')}
        onTerms={() => router.push('/terms')}
      />

      {/* Bi-weekly Contest — hidden page, only reachable from here or the
          contest rules card. */}
      <TouchableOpacity
        style={styles.contestRow}
        onPress={() => router.push('/bi-weekly-contest' as any)}
        activeOpacity={0.85}
      >
        <View style={styles.contestIconWrap}>
          <Ionicons name="gift" size={16} color="#fbbf24" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.contestTitle}>Bi-weekly Contest</Text>
          <Text style={styles.contestSubtitle}>
            Opt-in, leaderboard, and rules
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#9f7aea" />
      </TouchableOpacity>

      <AdminSection
        user={user}
        onAdminPanel={() => router.push('/admin-panel')}
        onSetupOwner={handleSetupOwner}
      />

      <TouchableOpacity
        style={styles.logoutButton}
        onPress={() => setShowLogoutModal(true)}
      >
        <Ionicons name="log-out" size={24} color="#ef4444" />
        <Text style={styles.logoutText}>{t('logout')}</Text>
      </TouchableOpacity>

      <Text style={styles.version}>Version 1.0.0</Text>

      {/* Modals */}
      <Paywall visible={showPaywall} onClose={() => setShowPaywall(false)} />

      <LogoutModal
        visible={showLogoutModal}
        onCancel={() => setShowLogoutModal(false)}
        onConfirm={confirmLogout}
        theme={theme}
      />

      <ThemeModal
        visible={showThemeModal}
        onClose={() => setShowThemeModal(false)}
        theme={theme}
        themeName={themeName}
        availableThemes={availableThemes}
        isPremium={isPremium}
        onSelect={(id) => setTheme(id)}
        onLockedTap={() => {
          setShowThemeModal(false);
          setShowPaywall(true);
        }}
        t={t}
      />

      <LanguageModal
        visible={showLanguageModal}
        onClose={() => setShowLanguageModal(false)}
        theme={theme}
        languageCode={languageCode}
        availableLanguages={availableLanguages}
        onSelect={(code) => {
          setLanguage(code);
          Alert.alert(t('success'), t('languageChanged'));
        }}
        t={t}
      />

      <PictureModal
        visible={showPictureModal}
        onClose={() => setShowPictureModal(false)}
        theme={theme}
        onTakePhoto={takePhoto}
        onPickLibrary={pickImage}
      />

      <EmailModal
        visible={showEmailModal}
        onClose={() => setShowEmailModal(false)}
        theme={theme}
        onTryOpenEmail={tryOpenEmail}
      />

      <LinkModal
        visible={showLinkModal}
        onClose={() => setShowLinkModal(false)}
        theme={theme}
        title={linkModalData.title}
        url={linkModalData.url}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d0015' },
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
  processingText: { marginTop: 16, fontSize: 16, color: '#e9d5ff' },
  contestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    marginTop: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.35)',
    backgroundColor: 'rgba(30,14,58,0.65)',
  },
  contestIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(251,191,36,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.55)',
  },
  contestTitle: { color: '#e9d5ff', fontSize: 14, fontWeight: '700' },
  contestSubtitle: { color: '#c4b5fd', fontSize: 11, marginTop: 2 },
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
  logoutText: { fontSize: 18, fontWeight: '600', color: '#ef4444' },
  version: {
    textAlign: 'center',
    color: '#9f7aea',
    fontSize: 14,
    paddingBottom: 32,
  },
});
