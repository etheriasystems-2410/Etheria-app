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

export default function Terms() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <Ionicons name="scale" size={40} color="#d4a852" />
          </View>
          <Text style={styles.title}>Terms of Service</Text>
          <Text style={styles.lastUpdated}>Last updated: April 2025</Text>
        </View>

        {/* Section 1 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. Acceptance of Terms</Text>
          <Text style={styles.paragraph}>
            By accessing and using Etheria Systems websites, products, and services, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our services.
          </Text>
        </View>

        {/* Section 2 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. Description of Services</Text>
          <Text style={styles.paragraph}>
            Etheria Systems provides AI-powered spiritual and mystical tools and platforms. Our services are for entertainment, educational, and personal growth purposes only. We do not provide medical, legal, financial, or professional advice.
          </Text>
        </View>

        {/* Section 3 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>3. User Responsibilities</Text>
          <Text style={styles.paragraph}>You agree to:</Text>
          <View style={styles.bulletList}>
            <Text style={styles.bulletItem}>• Use our services only for lawful purposes</Text>
            <Text style={styles.bulletItem}>• Not attempt to disrupt or interfere with our services</Text>
            <Text style={styles.bulletItem}>• Not use our services to harm others or yourself</Text>
            <Text style={styles.bulletItem}>• Maintain the confidentiality of your account information</Text>
            <Text style={styles.bulletItem}>• Accept full responsibility for decisions made based on our services</Text>
          </View>
        </View>

        {/* Section 4 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>4. Disclaimer</Text>
          <Text style={styles.paragraph}>
            Our AI-powered spiritual services are experimental and for entertainment purposes. We make no guarantees about the accuracy, completeness, or usefulness of any information provided. Always use your own judgment and consult appropriate professionals for important life decisions.
          </Text>
        </View>

        {/* Section 5 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>5. Intellectual Property</Text>
          <Text style={styles.paragraph}>
            All content, trademarks, logos, and intellectual property on our platforms are owned by Etheria Systems or our licensors. You may not reproduce, distribute, or create derivative works without our express permission.
          </Text>
        </View>

        {/* Section 6 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>6. Limitation of Liability</Text>
          <Text style={styles.paragraph}>
            Etheria Systems shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of our services. Our total liability shall not exceed the amount you have paid us in the past twelve months.
          </Text>
        </View>

        {/* Section 7 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>7. Changes to Terms</Text>
          <Text style={styles.paragraph}>
            We reserve the right to modify these terms at any time. We will notify users of significant changes. Continued use of our services after changes constitutes acceptance of the new terms.
          </Text>
        </View>

        {/* Section 8 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>8. Contact</Text>
          <Text style={styles.paragraph}>
            If you have any questions about these Terms of Service, please contact us at contact@etheriasystems.online
          </Text>
        </View>

        {/* Return Button */}
        <TouchableOpacity
          style={styles.returnButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={20} color="#fff" />
          <Text style={styles.returnButtonText}>Return to App</Text>
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
  },
  bulletList: {
    marginTop: 8,
    marginLeft: 8,
  },
  bulletItem: {
    fontSize: 15,
    color: '#c4b5fd',
    lineHeight: 28,
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
