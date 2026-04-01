import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';

const ETHERIA_IMAGE = 'https://customer-assets.emergentagent.com/job_meditation-nexus/artifacts/bfuvm2xh_4327b8ef020d7d471270d8452f31001dbd0d1e664d07a7235c64a236b0e6f6e6.jpg';

export default function Home() {
  const router = useRouter();

  const features = [
    {
      title: 'Psychic Training',
      description: 'Develop your psychic abilities with guided lessons',
      icon: 'school' as const,
      route: '/training',
    },
    {
      title: 'Oracle Divination',
      description: 'Receive guidance from spirit guide oracle cards',
      icon: 'sparkles' as const,
      route: '/oracle',
    },
    {
      title: 'Spirit Guides',
      description: 'Chat with elemental spirit guides',
      icon: 'chatbubbles' as const,
      route: '/spirit-guides',
    },
    {
      title: 'Meditation',
      description: 'Practice meditation and astral travel',
      icon: 'fitness' as const,
      route: '/meditation',
    },
    {
      title: 'Journal',
      description: 'Track your spiritual journey',
      icon: 'book' as const,
      route: '/journal',
    },
  ];

  return (
    <ScrollView style={styles.container}>
      {/* Hero Section with Image */}
      <View style={styles.heroSection}>
        <Image
          source={{ uri: ETHERIA_IMAGE }}
          style={styles.heroImage}
          contentFit="cover"
        />
        <View style={styles.heroOverlay}>
          <Text style={styles.heroTitle}>Welcome to Etheria</Text>
        </View>
      </View>

      {/* Welcome Message */}
      <View style={styles.welcomeSection}>
        <Text style={styles.welcomeText}>
          Here you will find and discover tools to help you progress on your spiritual path, whether it be discovering latent psychic abilities and practicing those abilities, guided meditations in this and the astral realm, a fully-intuitive oracle deck to consult your spirit guides, or receiving communications directly from a spirit guide in tune to your zodiac sign.
        </Text>

        <View style={styles.pricingCard}>
          <Ionicons name="diamond" size={28} color="#ffd700" />
          <Text style={styles.pricingTitle}>Unlock Full Access</Text>
          <Text style={styles.pricingText}>
            However, to access all Etheria has to offer it does require a monthly commitment of only{' '}
            <Text style={styles.priceHighlight}>$3.99</Text>.
          </Text>
          <Text style={styles.pricingText}>
            What a small sum for all this little app has to offer! Join today and completely unlock your potential.
          </Text>
          <TouchableOpacity 
            style={styles.subscribeButton}
            onPress={() => router.push('/settings')}
          >
            <Ionicons name="star" size={20} color="#1a0033" />
            <Text style={styles.subscribeButtonText}>Subscribe Now</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Features Grid */}
      <View style={styles.featuresHeader}>
        <Text style={styles.featuresHeaderText}>Explore Features</Text>
      </View>

      <View style={styles.featuresContainer}>
        {features.map((feature, index) => (
          <TouchableOpacity
            key={index}
            style={styles.featureCard}
            onPress={() => router.push(feature.route as any)}
            activeOpacity={0.7}
          >
            <View style={styles.featureIcon}>
              <Ionicons name={feature.icon} size={32} color="#e9d5ff" />
            </View>
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>{feature.title}</Text>
              <Text style={styles.featureDescription}>{feature.description}</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#9f7aea" />
          </TouchableOpacity>
        ))}
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          We hope you enjoy our first application from Etheria Systems.
        </Text>
        <Text style={styles.signature}>-Etheria Developer</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0321',
  },
  heroSection: {
    height: 280,
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 24,
    paddingBottom: 32,
    backgroundColor: 'rgba(15, 3, 33, 0.7)',
  },
  heroTitle: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#e9d5ff',
    textAlign: 'center',
  },
  welcomeSection: {
    padding: 20,
  },
  welcomeText: {
    fontSize: 16,
    lineHeight: 26,
    color: '#c4b5fd',
    textAlign: 'center',
    marginBottom: 24,
  },
  pricingCard: {
    backgroundColor: '#1a0033',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#7c3aed',
    marginTop: 8,
  },
  pricingTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#ffd700',
    marginTop: 12,
    marginBottom: 16,
  },
  pricingText: {
    fontSize: 15,
    lineHeight: 24,
    color: '#c4b5fd',
    textAlign: 'center',
    marginBottom: 12,
  },
  priceHighlight: {
    color: '#ffd700',
    fontWeight: 'bold',
    fontSize: 18,
  },
  subscribeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#b794f6',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 25,
    marginTop: 16,
    gap: 8,
  },
  subscribeButtonText: {
    color: '#1a0033',
    fontSize: 18,
    fontWeight: 'bold',
  },
  featuresHeader: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 12,
  },
  featuresHeaderText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#e9d5ff',
  },
  featuresContainer: {
    padding: 16,
    paddingTop: 4,
  },
  featureCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a0033',
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2d1b4e',
  },
  featureIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2d1b4e',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#e9d5ff',
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 14,
    color: '#c4b5fd',
  },
  footer: {
    padding: 24,
    paddingBottom: 40,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 15,
    color: '#9f7aea',
    textAlign: 'center',
    fontStyle: 'italic',
    lineHeight: 22,
  },
  signature: {
    fontSize: 16,
    color: '#b794f6',
    marginTop: 12,
    fontWeight: '600',
  },
});
