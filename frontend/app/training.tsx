import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface Module {
  id: string;
  title: string;
  description: string;
  lessons: number;
  category: 'beginner' | 'intermediate' | 'advanced';
}

export default function Training() {
  const [modules, setModules] = useState<Module[]>([]);
  const [completedModules, setCompletedModules] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTrainingData();
    loadProgress();
  }, []);

  const loadTrainingData = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/training/modules`);
      const data = await response.json();
      setModules(data);
    } catch (error) {
      console.error('Error loading training modules:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadProgress = async () => {
    try {
      const progress = await AsyncStorage.getItem('training_progress');
      if (progress) {
        setCompletedModules(JSON.parse(progress));
      }
    } catch (error) {
      console.error('Error loading progress:', error);
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'beginner':
        return '#10b981';
      case 'intermediate':
        return '#f59e0b';
      case 'advanced':
        return '#ef4444';
      default:
        return '#8b5cf6';
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color="#b794f6" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Psychic Training Programs</Text>
        <Text style={styles.headerSubtitle}>Develop your abilities step by step</Text>
      </View>

      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{completedModules.length}</Text>
          <Text style={styles.statLabel}>Completed</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{modules.length}</Text>
          <Text style={styles.statLabel}>Total Modules</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>
            {modules.length > 0 ? Math.round((completedModules.length / modules.length) * 100) : 0}%
          </Text>
          <Text style={styles.statLabel}>Progress</Text>
        </View>
      </View>

      <View style={styles.modulesContainer}>
        {modules.map((module) => {
          const isCompleted = completedModules.includes(module.id);
          return (
            <TouchableOpacity key={module.id} style={styles.moduleCard} activeOpacity={0.7}>
              <View style={styles.moduleHeader}>
                <View
                  style={[
                    styles.categoryBadge,
                    { backgroundColor: getCategoryColor(module.category) },
                  ]}
                >
                  <Text style={styles.categoryText}>{module.category}</Text>
                </View>
                {isCompleted && <Ionicons name="checkmark-circle" size={24} color="#10b981" />}
              </View>
              <Text style={styles.moduleTitle}>{module.title}</Text>
              <Text style={styles.moduleDescription}>{module.description}</Text>
              <View style={styles.moduleFooter}>
                <Ionicons name="book-outline" size={16} color="#c4b5fd" />
                <Text style={styles.lessonCount}>{module.lessons} lessons</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0321',
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    padding: 20,
    paddingTop: 24,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#e9d5ff',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#c4b5fd',
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 24,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#1a0033',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2d1b4e',
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
  modulesContainer: {
    padding: 16,
  },
  moduleCard: {
    backgroundColor: '#1a0033',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2d1b4e',
  },
  moduleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  categoryBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  categoryText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  moduleTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#e9d5ff',
    marginBottom: 8,
  },
  moduleDescription: {
    fontSize: 14,
    color: '#c4b5fd',
    lineHeight: 20,
    marginBottom: 12,
  },
  moduleFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  lessonCount: {
    fontSize: 14,
    color: '#c4b5fd',
  },
});
