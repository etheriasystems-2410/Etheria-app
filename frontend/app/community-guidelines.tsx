import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import HeaderBanner from '../components/HeaderBanner';
import { CosmicBackdrop } from '../components/ui';

export default function CommunityGuidelines() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header Banner */}
      <HeaderBanner title="Guidelines" height={100} />
      
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <Ionicons name="people-circle" size={40} color="#9f7aea" />
          </View>
          <Text style={styles.title}>Community Guidelines</Text>
          <Text style={styles.lastUpdated}>Last updated: June 2025</Text>
        </View>

        {/* Section 1 - Welcome */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. Welcome to the Etheria Community</Text>
          <Text style={styles.paragraph}>
            The Etheria community is a sacred space for spiritual seekers to connect, share experiences, and support each other on their journeys. We are committed to maintaining a safe, respectful, and nurturing environment for all members.
          </Text>
        </View>

        {/* Section 2 - AI Moderation */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. AI Moderation Disclaimer</Text>
          <Text style={styles.paragraph}>
            Our community is monitored by an AI-powered moderation system that automatically reviews content for compliance with our guidelines. This system:
          </Text>
          <View style={styles.bulletList}>
            <Text style={styles.bulletItem}>• Analyzes posts, comments, and messages in real-time</Text>
            <Text style={styles.bulletItem}>• Detects potentially harmful, offensive, or inappropriate content</Text>
            <Text style={styles.bulletItem}>• May automatically flag or remove content that violates guidelines</Text>
            <Text style={styles.bulletItem}>• Escalates serious violations to human moderators for review</Text>
          </View>
          <Text style={styles.paragraph}>
            While we strive for accuracy, automated systems may occasionally make errors. If you believe your content was incorrectly flagged, you may submit an appeal.
          </Text>
        </View>

        {/* Section 3 - Community Standards */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>3. Community Standards</Text>
          <Text style={styles.paragraph}>All members must:</Text>
          <View style={styles.bulletList}>
            <Text style={styles.bulletItem}>• Treat others with respect and kindness</Text>
            <Text style={styles.bulletItem}>• Refrain from hate speech, discrimination, or harassment</Text>
            <Text style={styles.bulletItem}>• Not post spam, advertisements, or promotional content</Text>
            <Text style={styles.bulletItem}>• Keep discussions relevant and constructive</Text>
            <Text style={styles.bulletItem}>• Respect others' spiritual beliefs and practices</Text>
            <Text style={styles.bulletItem}>• Not share misleading health or medical advice</Text>
            <Text style={styles.bulletItem}>• Protect personal privacy (yours and others')</Text>
          </View>
        </View>

        {/* Section 4 - Suspension Policy */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>4. Suspension Policy</Text>
          <Text style={styles.paragraph}>
            Violations of community guidelines will result in the following progressive actions:
          </Text>
          <View style={styles.warningBox}>
            <View style={styles.warningRow}>
              <Ionicons name="warning" size={18} color="#f59e0b" />
              <Text style={styles.warningTitle}>First Offense:</Text>
            </View>
            <Text style={styles.warningText}>Written warning via email with explanation of the violation.</Text>
          </View>
          <View style={styles.warningBox}>
            <View style={styles.warningRow}>
              <Ionicons name="time" size={18} color="#f59e0b" />
              <Text style={styles.warningTitle}>Second Offense (3+ flags):</Text>
            </View>
            <Text style={styles.warningText}>2-week suspension from community features.</Text>
          </View>
          <View style={styles.warningBox}>
            <View style={styles.warningRow}>
              <Ionicons name="ban" size={18} color="#ef4444" />
              <Text style={styles.warningTitle}>Third Offense:</Text>
            </View>
            <Text style={styles.warningText}>30-day suspension from community features.</Text>
          </View>
          <View style={styles.warningBox}>
            <View style={styles.warningRow}>
              <Ionicons name="close-circle" size={18} color="#ef4444" />
              <Text style={styles.warningTitle}>Continued Violations:</Text>
            </View>
            <Text style={styles.warningText}>Permanent account cancellation and removal from the community.</Text>
          </View>
          <Text style={styles.paragraph}>
            Severe violations (threats, illegal content, doxxing) may result in immediate permanent ban without prior warnings.
          </Text>
        </View>

        {/* Section 5 - Appeals */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>5. Appeals Process</Text>
          <Text style={styles.paragraph}>
            If you believe a moderation action was taken in error, you have the right to appeal:
          </Text>
          <View style={styles.bulletList}>
            <Text style={styles.bulletItem}>• When you receive a warning or suspension notice, an appeal link will be included in the email</Text>
            <Text style={styles.bulletItem}>• Click the appeal link to submit your case for human review</Text>
            <Text style={styles.bulletItem}>• Provide context and explanation for your content</Text>
            <Text style={styles.bulletItem}>• Appeals are typically reviewed within 3-5 business days</Text>
            <Text style={styles.bulletItem}>• You will receive an email notification of the appeal decision</Text>
          </View>
          <Text style={styles.paragraph}>
            Please note that appeal decisions are final. Repeated frivolous appeals may be considered harassment.
          </Text>
        </View>

        {/* Section 6 - Account Cancellation */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>6. Account Cancellation</Text>
          <Text style={styles.paragraph}>
            Accounts may be permanently cancelled for:
          </Text>
          <View style={styles.bulletList}>
            <Text style={styles.bulletItem}>• Repeated violations after multiple warnings and suspensions</Text>
            <Text style={styles.bulletItem}>• Severe violations including threats, harassment, or illegal activity</Text>
            <Text style={styles.bulletItem}>• Circumventing suspensions with alternate accounts</Text>
            <Text style={styles.bulletItem}>• Fraud or abuse of the platform</Text>
          </View>
          <Text style={styles.paragraph}>
            Cancelled accounts lose access to all app features, including premium subscriptions. Account cancellation does not entitle users to any refunds.
          </Text>
        </View>

        {/* Section 7 - No Refunds */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>7. No Refunds Policy</Text>
          <View style={styles.importantBox}>
            <Ionicons name="information-circle" size={20} color="#9f7aea" />
            <Text style={styles.importantText}>
              All subscription payments are final. No refunds will be issued for accounts suspended or cancelled due to violations of these Community Guidelines.
            </Text>
          </View>
          <Text style={styles.paragraph}>
            By using community features, you acknowledge that:
          </Text>
          <View style={styles.bulletList}>
            <Text style={styles.bulletItem}>• Violation of guidelines may result in loss of access</Text>
            <Text style={styles.bulletItem}>• Suspended or cancelled accounts forfeit remaining subscription time</Text>
            <Text style={styles.bulletItem}>• Premium features are subject to compliance with community standards</Text>
          </View>
        </View>

        {/* Section 8 - Reporting */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>8. Reporting Violations</Text>
          <Text style={styles.paragraph}>
            Help us maintain a safe community by reporting content that violates these guidelines. Use the flag button on any post, comment, or message to report it for review.
          </Text>
          <Text style={styles.paragraph}>
            False or malicious reports may result in action against the reporting account.
          </Text>
        </View>

        {/* Section 9 - Updates */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>9. Changes to Guidelines</Text>
          <Text style={styles.paragraph}>
            We may update these Community Guidelines from time to time. Continued use of community features after changes constitutes acceptance of the updated guidelines.
          </Text>
        </View>

        {/* Section 10 - Contact */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>10. Contact Us</Text>
          <Text style={styles.paragraph}>
            For questions about these guidelines or moderation decisions, please contact us at etheriasystems@gmail.com
          </Text>
        </View>

        {/* Return Button */}
        <TouchableOpacity
          style={styles.returnButton}
          onPress={() => router.push('/settings')}
        >
          <Ionicons name="arrow-back" size={20} color="#fff" />
          <Text style={styles.returnButtonText}>Return to Settings</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0014',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 30,
    borderBottomWidth: 1,
    borderBottomColor: '#2d1b4e',
    marginBottom: 20,
  },
  iconContainer: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#1a0033',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
  },
  lastUpdated: {
    fontSize: 14,
    color: '#9f7aea',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  paragraph: {
    fontSize: 15,
    color: '#c4b5fd',
    lineHeight: 24,
    marginBottom: 8,
  },
  bulletList: {
    marginTop: 8,
    marginLeft: 8,
    marginBottom: 8,
  },
  bulletItem: {
    fontSize: 15,
    color: '#c4b5fd',
    lineHeight: 28,
  },
  warningBox: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderLeftWidth: 3,
    borderLeftColor: '#f59e0b',
    padding: 12,
    marginVertical: 8,
    borderRadius: 8,
  },
  warningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  warningTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#f59e0b',
  },
  warningText: {
    fontSize: 14,
    color: '#c4b5fd',
    marginLeft: 26,
  },
  importantBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(159, 122, 234, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(159, 122, 234, 0.3)',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    gap: 12,
  },
  importantText: {
    flex: 1,
    fontSize: 15,
    color: '#e9d5ff',
    lineHeight: 22,
    fontWeight: '500',
  },
  returnButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#7c3aed',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginTop: 20,
    gap: 8,
  },
  returnButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
