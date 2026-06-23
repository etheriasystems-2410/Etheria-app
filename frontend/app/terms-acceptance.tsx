/**
 * Terms of Use acceptance gate.
 *
 * Mandatory one-time agreement shown after sign-up / sign-in for any user
 * whose `terms_accepted_at` is not yet set on their profile. Decline → logout
 * (user cannot proceed without accepting).
 *
 * After acceptance the screen calls `POST /api/auth/accept-terms`, refreshes
 * the auth context, and lets the protected-layout effect route them to the
 * home screen.
 */
import React, { useState, useRef } from 'react';
import {
  ActivityIndicator,
  Alert,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';

import { useAuth } from '../contexts/AuthContext';
import { CosmicBackdrop } from '../components/ui';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

export default function TermsAcceptance() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, logout, refreshAuth } = useAuth();

  const [hasScrolledToEnd, setHasScrolledToEnd] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  // Detect when the user has scrolled to (or near) the bottom — required
  // before the "I Accept" button enables.
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
    const paddingThreshold = 32;
    if (
      layoutMeasurement.height + contentOffset.y >=
      contentSize.height - paddingThreshold
    ) {
      setHasScrolledToEnd(true);
    }
  };

  const handleAccept = async () => {
    setAccepting(true);
    try {
      const sessionToken = await AsyncStorage.getItem('session_token');
      const r = await fetch(`${BACKEND_URL}/api/auth/accept-terms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.detail || 'Could not record acceptance.');
      }
      await refreshAuth(); // pulls down the updated user with terms_accepted_at
      router.replace('/');
    } catch (e: any) {
      Alert.alert('Could not save your acceptance', e?.message || 'Please try again.');
    } finally {
      setAccepting(false);
    }
  };

  const handleDecline = () => {
    Alert.alert(
      'Decline & Sign Out?',
      'You must accept the Terms of Use to use Etheria. Declining will sign you out.',
      [
        { text: 'Stay & Review', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await logout();
            router.replace('/auth/login');
          },
        },
      ],
    );
  };

  return (
    <CosmicBackdrop>
      <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.iconWrap}>
            <Ionicons name="scale" size={32} color="#fbbf24" />
          </View>
          <Text style={styles.eyebrow}>✦ Welcome to Etheria ✦</Text>
          <Text style={styles.title}>Terms of Use</Text>
          <Text style={styles.subtitle}>
            Please read carefully. You must accept these terms to continue.
          </Text>
        </View>

        {/* Scrollable terms */}
        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          onScroll={onScroll}
          scrollEventThrottle={64}
          showsVerticalScrollIndicator
        >
          <Section title="1. Acceptance of Terms">
            By tapping <Bold>I Accept</Bold> below, you agree to be bound by
            these Terms of Use. If you do not agree, you must decline and you
            will not be able to use Etheria.
          </Section>

          <Section title="2. About Etheria">
            Etheria is a spiritual & meditation platform that offers AI-powered
            tools for psychic exploration, including Oracle divination, AI
            Spirit Guides, guided meditation, dream interpretation, and a
            personal journal. All content is provided{' '}
            <Bold>for entertainment, educational, and personal-growth purposes only</Bold>.
            Nothing in Etheria constitutes medical, legal, psychological,
            financial, or professional advice.
          </Section>

          <Section title="3. Age Requirement">
            You must be at least <Bold>16 years old</Bold> to use Etheria. By
            accepting these terms you confirm that you meet this requirement,
            or that you have a parent / legal guardian&rsquo;s permission and they
            have reviewed these terms with you.
          </Section>

          <Section title="4. User Responsibilities">
            You agree to:
            {'\n'}• Use Etheria only for lawful purposes
            {'\n'}• Treat all members of the community with respect
            {'\n'}• Not harass, threaten, dox, or harm any user
            {'\n'}• Not impersonate another person or organisation
            {'\n'}• Not attempt to disrupt or hack the service
            {'\n'}• Keep your account password confidential
            {'\n'}• Take full personal responsibility for any decisions you make based on content you receive in the app
          </Section>

          <Section title="5. AI-Generated Content Disclaimer">
            Etheria uses generative AI to produce readings, meditations,
            spirit-guide messages, dream interpretations, and other content. AI
            output is <Bold>experimental and probabilistic</Bold>. It may be
            inaccurate, incomplete, or surprising. Always apply your own
            judgment, intuition, and — for matters of health, law, finance, or
            mental wellbeing — consult a qualified human professional.
          </Section>

          <Section title="6. Subscriptions & Payments">
            Some features require a paid Premium subscription, billed via
            Stripe. Subscriptions renew automatically until cancelled.
            Cancellation takes effect at the end of the current billing period
            — you keep access until then. Promotional codes and gifts are
            non-transferable and may be revoked if obtained fraudulently.
          </Section>

          <Section title="7. Community Conduct & Moderation">
            Posts, messages, and profiles you share with other users are
            subject to community guidelines. Repeated violations may result in
            warnings, temporary suspensions, or permanent account cancellation
            at Etheria&rsquo;s discretion. You may also be removed for behaviour
            that endangers other users.
          </Section>

          <Section title="8. Privacy">
            Your personal information is handled per our Privacy Policy. We do
            not sell your data. We collect only what is necessary to operate
            the app (account info, in-app content you create, payment metadata
            via Stripe). You may request export or deletion of your data at
            any time by emailing <Bold>etheriasystems@gmail.com</Bold>.
          </Section>

          <Section title="9. Intellectual Property">
            All Etheria branding, original content, code, and designs are owned
            by Etheria Systems. Content you create within Etheria (journal
            entries, profile details, messages) remains yours; you grant us a
            limited licence to display it back to you and to share it with
            other users when you explicitly post or send it.
          </Section>

          <Section title="10. Limitation of Liability">
            Etheria is provided <Bold>as-is, without warranties of any kind</Bold>.
            To the maximum extent permitted by law, Etheria Systems will not
            be liable for any indirect, incidental, special, consequential,
            or punitive damages arising from your use of the service. Our
            total cumulative liability shall not exceed the amount you paid
            us in the twelve months preceding any claim.
          </Section>

          <Section title="11. Changes to These Terms">
            We may update these terms from time to time. Material changes
            will be communicated in-app and may require re-acceptance.
            Continued use after notification constitutes acceptance.
          </Section>

          <Section title="12. Contact">
            Questions, concerns, or appeals? Email{'\n'}
            <Bold>etheriasystems@gmail.com</Bold>
          </Section>

          <Text style={styles.footerNote}>
            Last updated: June 14, 2026 • Version 1.0
          </Text>

          {/* Scroll-to-end marker */}
          <View style={styles.endMarker}>
            <Ionicons
              name="sparkles"
              size={16}
              color={hasScrolledToEnd ? '#fbbf24' : '#6b7280'}
            />
            <Text
              style={[
                styles.endMarkerText,
                hasScrolledToEnd && { color: '#fbbf24' },
              ]}
            >
              {hasScrolledToEnd
                ? 'You have reviewed the full Terms of Use'
                : 'Scroll to the bottom to enable acceptance'}
            </Text>
          </View>
        </ScrollView>

        {/* Sticky action bar */}
        <View style={[styles.actionBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          {user?.email && (
            <Text style={styles.signedInAs}>
              Signed in as <Text style={styles.signedInAsEmail}>{user.email}</Text>
            </Text>
          )}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.btn, styles.btnDecline]}
              onPress={handleDecline}
              disabled={accepting}
            >
              <Text style={styles.btnDeclineText}>Decline & Sign Out</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.btn,
                styles.btnAccept,
                (!hasScrolledToEnd || accepting) && styles.btnDisabled,
              ]}
              onPress={handleAccept}
              disabled={!hasScrolledToEnd || accepting}
            >
              {accepting ? (
                <ActivityIndicator size="small" color="#1a0033" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={16} color="#1a0033" />
                  <Text style={styles.btnAcceptText}>I Accept</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </CosmicBackdrop>
  );
}

// ─── Small inline helpers ─────────────────────────────────────────────────
const Bold = ({ children }: { children: React.ReactNode }) => (
  <Text style={styles.bold}>{children}</Text>
);

const Section = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>{title}</Text>
    <Text style={styles.sectionBody}>{children}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { alignItems: 'center', paddingHorizontal: 20, paddingBottom: 12 },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(251,191,36,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  eyebrow: {
    color: '#fbbf24',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
    marginTop: 10,
  },
  title: {
    color: '#e9d5ff',
    fontSize: 24,
    fontWeight: '800',
    marginTop: 4,
    textShadowColor: 'rgba(168,85,247,0.6)',
    textShadowRadius: 8,
  },
  subtitle: {
    color: '#c4b5fd',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
    paddingHorizontal: 12,
  },

  scroll: { flex: 1, marginTop: 10 },
  scrollContent: { paddingHorizontal: 18, paddingBottom: 24 },
  section: { marginBottom: 18 },
  sectionTitle: {
    color: '#fbbf24',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 6,
    letterSpacing: 0.4,
  },
  sectionBody: { color: '#e9d5ff', fontSize: 14, lineHeight: 22 },
  bold: { color: '#fbbf24', fontWeight: '700' },
  footerNote: {
    color: 'rgba(203,182,255,0.6)',
    fontSize: 11,
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: 8,
  },
  endMarker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.3)',
    backgroundColor: 'rgba(15,5,35,0.55)',
  },
  endMarkerText: {
    color: '#6b7280',
    fontSize: 12,
    fontWeight: '600',
  },

  actionBar: {
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(251,191,36,0.2)',
    backgroundColor: 'rgba(13,0,21,0.85)',
  },
  signedInAs: {
    color: '#9f7aea',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 8,
  },
  signedInAsEmail: { color: '#e9d5ff', fontWeight: '600' },
  actionRow: { flexDirection: 'row', gap: 10 },
  btn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  btnDecline: {
    backgroundColor: 'rgba(45,27,78,0.7)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.4)',
  },
  btnDeclineText: { color: '#ef4444', fontWeight: '700', fontSize: 14 },
  btnAccept: { backgroundColor: '#fbbf24' },
  btnAcceptText: { color: '#1a0033', fontWeight: '800', fontSize: 14 },
  btnDisabled: { opacity: 0.5 },
});
