import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../contexts/AuthContext';
import { Paywall } from '../components/Paywall';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface Module {
  id: string;
  title: string;
  description: string;
  lessons: number;
  category: 'beginner' | 'intermediate' | 'advanced';
  free: boolean;
}

export default function Training() {
  const { isPremium } = useAuth();
  const [modules, setModules] = useState<Module[]>([]);
  const [completedModules, setCompletedModules] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPaywall, setShowPaywall] = useState(false);
  const [selectedModule, setSelectedModule] = useState<Module | null>(null);

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

  const handleModulePress = (module: Module) => {
    // Check if user can access this module
    if (module.free || isPremium) {
      // Allow access - in future this would navigate to module details
      Alert.alert(
        module.title,
        `Starting ${module.lessons} lessons on ${module.title}`,
        [{ text: 'Begin', style: 'default' }]
      );
    } else {
      // Show paywall
      setSelectedModule(module);
      setShowPaywall(true);
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

  // Count free vs premium modules
  const freeModules = modules.filter(m => m.free);
  const premiumModules = modules.filter(m => !m.free);

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

      {/* Free Modules Section */}
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleRow}>
          <Ionicons name="gift" size={20} color="#10b981" />
          <Text style={styles.sectionTitle}>Free Modules</Text>
        </View>
        <Text style={styles.sectionSubtitle}>Start your journey here</Text>
      </View>

      <View style={styles.modulesContainer}>
        {freeModules.map((module) => {
          const isCompleted = completedModules.includes(module.id);
          return (
            <TouchableOpacity 
              key={module.id} 
              style={styles.moduleCard} 
              activeOpacity={0.7}
              onPress={() => handleModulePress(module)}
            >
              <View style={styles.moduleHeader}>
                <View style={styles.badgeRow}>
                  <View
                    style={[
                      styles.categoryBadge,
                      { backgroundColor: getCategoryColor(module.category) },
                    ]}
                  >
                    <Text style={styles.categoryText}>{module.category}</Text>
                  </View>
                  <View style={styles.freeBadge}>
                    <Text style={styles.freeBadgeText}>FREE</Text>
                  </View>
                </View>
                {isCompleted && <Ionicons name="checkmark-circle" size={24} color="#10b981" />}
              </View>
              <Text style={styles.moduleTitle}>{module.title}</Text>
              <Text style={styles.moduleDescription}>{module.description}</Text>
              <View style={styles.moduleFooter}>
                <View style={styles.lessonInfo}>
                  <Ionicons name="book-outline" size={16} color="#c4b5fd" />
                  <Text style={styles.lessonCount}>{module.lessons} lessons</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#b794f6" />
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Premium Modules Section */}
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleRow}>
          <Ionicons name="diamond" size={20} color="#ffd700" />
          <Text style={styles.sectionTitle}>Premium Modules</Text>
          {!isPremium && (
            <View style={styles.premiumRequiredBadge}>
              <Ionicons name="lock-closed" size={12} color="#ffd700" />
              <Text style={styles.premiumRequiredText}>Premium</Text>
            </View>
          )}
        </View>
        <Text style={styles.sectionSubtitle}>
          {isPremium ? 'Advanced training unlocked' : 'Unlock with subscription'}
        </Text>
      </View>

      <View style={styles.modulesContainer}>
        {premiumModules.map((module) => {
          const isCompleted = completedModules.includes(module.id);
          const isLocked = !isPremium;
          
          return (
            <TouchableOpacity 
              key={module.id} 
              style={[styles.moduleCard, isLocked && styles.lockedModuleCard]} 
              activeOpacity={0.7}
              onPress={() => handleModulePress(module)}
            >
              <View style={styles.moduleHeader}>
                <View style={styles.badgeRow}>
                  <View
                    style={[
                      styles.categoryBadge,
                      { backgroundColor: getCategoryColor(module.category) },
                    ]}
                  >
                    <Text style={styles.categoryText}>{module.category}</Text>
                  </View>
                  {isLocked && (
                    <View style={styles.lockedBadge}>
                      <Ionicons name="lock-closed" size={12} color="#ffd700" />
                    </View>
                  )}
                </View>
                {isCompleted && <Ionicons name="checkmark-circle" size={24} color="#10b981" />}
                {isLocked && !isCompleted && (
                  <Ionicons name="lock-closed" size={20} color="#9f7aea" />
                )}
              </View>
              <Text style={[styles.moduleTitle, isLocked && styles.lockedText]}>{module.title}</Text>
              <Text style={[styles.moduleDescription, isLocked && styles.lockedText]}>{module.description}</Text>
              <View style={styles.moduleFooter}>
                <View style={styles.lessonInfo}>
                  <Ionicons name="book-outline" size={16} color={isLocked ? '#6b5b8a' : '#c4b5fd'} />
                  <Text style={[styles.lessonCount, isLocked && styles.lockedText]}>{module.lessons} lessons</Text>
                </View>
                {isLocked ? (
                  <Text style={styles.unlockText}>Tap to unlock</Text>
                ) : (
                  <Ionicons name="chevron-forward" size={20} color="#b794f6" />
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Paywall Modal */}
      <Paywall
        visible={showPaywall}
        onClose={() => {
          setShowPaywall(false);
          setSelectedModule(null);
        }}
        feature={selectedModule?.title || 'Premium Training Module'}
      />
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
  sectionHeader: {
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#e9d5ff',
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#9f7aea',
    marginLeft: 28,
  },
  premiumRequiredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
    marginLeft: 8,
  },
  premiumRequiredText: {
    fontSize: 11,
    color: '#ffd700',
    fontWeight: '600',
  },
  modulesContainer: {
    padding: 16,
    paddingTop: 4,
  },
  moduleCard: {
    backgroundColor: '#1a0033',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2d1b4e',
  },
  lockedModuleCard: {
    opacity: 0.8,
    borderColor: '#3d2b5e',
  },
  moduleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  freeBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  freeBadgeText: {
    color: '#10b981',
    fontSize: 10,
    fontWeight: 'bold',
  },
  lockedBadge: {
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    padding: 4,
    borderRadius: 6,
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
  lockedText: {
    color: '#8b7ba0',
  },
  moduleFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  lessonInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  lessonCount: {
    fontSize: 14,
    color: '#c4b5fd',
  },
  unlockText: {
    fontSize: 12,
    color: '#ffd700',
    fontWeight: '600',
  },
});
