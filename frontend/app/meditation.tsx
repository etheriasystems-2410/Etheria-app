import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

interface MeditationType {
  title: string;
  description: string;
  icon: string;
  color: string;
  route: string;
}

const meditationTypes: MeditationType[] = [
  {
    title: 'Binaural Meditation',
    description: 'Brain wave synchronization through sound',
    icon: 'headset',
    color: '#8b5cf6',
    route: '/meditation/binaural',
  },
  {
    title: 'AI Guided Meditation',
    description: 'Personalized meditation with AI guidance',
    icon: 'mic',
    color: '#3b82f6',
    route: '/meditation/ai-guided',
  },
  {
    title: 'Timed Meditation',
    description: 'Meditate with ambient sounds and timer',
    icon: 'timer',
    color: '#10b981',
    route: '/meditation/timed',
  },
  {
    title: 'Astral Travel Practice',
    description: 'Guided journey beyond the physical',
    icon: 'planet',
    color: '#f59e0b',
    route: '/meditation/astral',
  },
];

export default function Meditation() {
  const router = useRouter();

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="fitness" size={60} color="#b794f6" />
        <Text style={styles.title}>Meditation Hub</Text>
        <Text style={styles.subtitle}>Choose your meditation practice</Text>
      </View>

      <View style={styles.typesContainer}>
        {meditationTypes.map((type, index) => (
          <TouchableOpacity
            key={index}
            style={styles.typeCard}
            onPress={() => router.push(type.route as any)}
            activeOpacity={0.7}
          >
            <View style={[styles.typeIcon, { backgroundColor: type.color }]}>
              <Ionicons name={type.icon as any} size={32} color="#fff" />
            </View>
            <View style={styles.typeContent}>
              <Text style={styles.typeTitle}>{type.title}</Text>
              <Text style={styles.typeDescription}>{type.description}</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#9f7aea" />
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.statsCard}>
        <Text style={styles.statsTitle}>Your Practice</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>0</Text>
            <Text style={styles.statLabel}>Sessions</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>0m</Text>
            <Text style={styles.statLabel}>Total Time</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>0</Text>
            <Text style={styles.statLabel}>This Week</Text>
          </View>
        </View>
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
    paddingVertical: 32,
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#e9d5ff',
    marginTop: 16,
  },
  subtitle: {
    fontSize: 16,
    color: '#c4b5fd',
    marginTop: 8,
  },
  typesContainer: {
    padding: 16,
  },
  typeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a0033',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2d1b4e',
  },
  typeIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  typeContent: {
    flex: 1,
  },
  typeTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#e9d5ff',
    marginBottom: 4,
  },
  typeDescription: {
    fontSize: 14,
    color: '#c4b5fd',
  },
  statsCard: {
    margin: 16,
    backgroundColor: '#1a0033',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#2d1b4e',
  },
  statsTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#e9d5ff',
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#b794f6',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#c4b5fd',
  },
});
