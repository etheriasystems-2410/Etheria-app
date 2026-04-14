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

export default function Privacy() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <Ionicons name="shield-checkmark" size={40} color="#d4a852" />
          </View>
          <Text style={styles.title}>Privacy Policy</Text>
          <Text style={styles.lastUpdated}>Last updated: April 2025</Text>
        </View>

        {/* Section 1 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. Introduction</Text>
          <Text style={styles.paragraph}>
            At Etheria Systems, we take your privacy seriously. This Privacy Policy explains how we collect, use, store, and protect your personal information when you use our websites and services.
          </Text>
        </View>

        {/* Section 2 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. Information We Collect</Text>
          <Text style={styles.paragraph}>We may collect the following types of information:</Text>
          <View style={styles.bulletList}>
            <Text style={styles.bulletItem}>• Personal information (name, email address) when you contact us</Text>
            <Text style={styles.bulletItem}>• Usage data and analytics about how you interact with our services</Text>
            <Text style={styles.bulletItem}>• Device and browser information</Text>
            <Text style={styles.bulletItem}>• Cookies and similar tracking technologies</Text>
          </View>
        </View>

        {/* Section 3 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>3. How We Use Your Information</Text>
          <Text style={styles.paragraph}>We use your information to:</Text>
          <View style={styles.bulletList}>
            <Text style={styles.bulletItem}>• Provide and improve our services</Text>
            <Text style={styles.bulletItem}>• Respond to your inquiries and support requests</Text>
            <Text style={styles.bulletItem}>• Send updates and promotional materials (with your consent)</Text>
            <Text style={styles.bulletItem}>• Analyze usage patterns to enhance user experience</Text>
            <Text style={styles.bulletItem}>• Protect against fraud and abuse</Text>
          </View>
        </View>

        {/* Section 4 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>4. Data Security</Text>
          <Text style={styles.paragraph}>
            We implement appropriate technical and organizational measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction. However, no method of transmission over the internet is 100% secure.
          </Text>
        </View>

        {/* Section 5 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>5. Third-Party Services</Text>
          <Text style={styles.paragraph}>
            We may use third-party services (such as analytics providers and email services) that collect, monitor, and analyze information. These third parties have their own privacy policies governing how they use such information.
          </Text>
        </View>

        {/* Section 6 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>6. Your Rights</Text>
          <Text style={styles.paragraph}>Depending on your location, you may have the right to:</Text>
          <View style={styles.bulletList}>
            <Text style={styles.bulletItem}>• Access the personal information we hold about you</Text>
            <Text style={styles.bulletItem}>• Request correction or deletion of your personal information</Text>
            <Text style={styles.bulletItem}>• Object to or restrict certain processing of your data</Text>
            <Text style={styles.bulletItem}>• Request portability of your data</Text>
            <Text style={styles.bulletItem}>• Withdraw consent at any time</Text>
          </View>
        </View>

        {/* Section 7 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>7. Cookies</Text>
          <Text style={styles.paragraph}>
            We use cookies and similar tracking technologies to enhance your experience on our website. You can set your browser to refuse cookies, but this may affect the functionality of our services.
          </Text>
        </View>

        {/* Section 8 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>8. Changes to This Policy</Text>
          <Text style={styles.paragraph}>
            We may update this Privacy Policy from time to time. We will notify you of any significant changes by posting the new policy on our website with an updated revision date.
          </Text>
        </View>

        {/* Section 9 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>9. Contact Us</Text>
          <Text style={styles.paragraph}>
            If you have any questions about this Privacy Policy or our data practices, please contact us at contact@etheriasystems.online
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
