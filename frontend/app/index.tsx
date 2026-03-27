import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

export default function Home() {
  const router = useRouter();

  const features = [
    {
      title: 'Psychic Training',
      description: 'Develop your psychic abilities with guided lessons',
      icon: 'school' as const,
      route: '/training',
      gradient: ['#7c3aed', '#5b21b6'],
    },
    {
      title: 'Oracle Divination',
      description: 'Receive guidance from spirit guide oracle cards',
      icon: 'sparkles' as const,
      route: '/oracle',
      gradient: ['#db2777', '#be185d'],
    },
    {
      title: 'Spirit Guides',
      description: 'Chat with elemental spirit guides',
      icon: 'chatbubbles' as const,
      route: '/spirit-guides',
      gradient: ['#0891b2', '#0e7490'],
    },
    {
      title: 'Meditation',
      description: 'Practice meditation and astral travel',
      icon: 'fitness' as const,
      route: '/meditation',
      gradient: ['#059669', '#047857'],
    },
    {
      title: 'Journal',
      description: 'Track your spiritual journey',
      icon: 'book' as const,
      route: '/journal',
      gradient: ['#ea580c', '#c2410c'],
    },
  ];

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="moon" size={60} color="#b794f6" />
        <Text style={styles.title}>Psychic Awareness</Text>
        <Text style={styles.subtitle}>Awaken Your Inner Sight</Text>
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0321',
  },
  header: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#e9d5ff',
    marginTop: 16,
  },
  subtitle: {
    fontSize: 16,
    color: '#c4b5fd',
    marginTop: 8,
  },
  featuresContainer: {
    padding: 16,
  },
  featureCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a0033',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
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
});
