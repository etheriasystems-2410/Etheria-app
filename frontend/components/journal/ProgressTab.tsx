import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { JournalEntry, TrainingProgress } from './types';
import EmptyState from './EmptyState';

interface ProgressTabProps {
  trainingProgress: TrainingProgress | null;
  trainingCompletions: JournalEntry[];
  loading: boolean;
}

const CATEGORY_COLORS: { [key: string]: string } = {
  'beginner': '#10b981',
  'intermediate': '#f59e0b',
  'advanced': '#ef4444',
};

export const ProgressTab: React.FC<ProgressTabProps> = ({ 
  trainingProgress, 
  trainingCompletions,
  loading 
}) => {
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#a855f7" />
        <Text style={styles.loadingText}>Loading progress...</Text>
      </View>
    );
  }

  if (!trainingProgress) {
    return (
      <EmptyState
        icon="school-outline"
        title="Start your training"
        subtitle="Complete lessons to track your progress here"
        iconColor="#a855f7"
      />
    );
  }

  const overallPercent = trainingProgress.total_lessons > 0 
    ? Math.round((trainingProgress.completed_lessons / trainingProgress.total_lessons) * 100) 
    : 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Overall Progress */}
      <View style={styles.overallCard}>
        <View style={styles.overallHeader}>
          <Ionicons name="trophy" size={28} color="#fbbf24" />
          <View style={styles.overallInfo}>
            <Text style={styles.overallTitle}>Overall Training Progress</Text>
            <Text style={styles.overallStats}>
              {trainingProgress.completed_lessons} of {trainingProgress.total_lessons} lessons completed
            </Text>
          </View>
          <Text style={styles.overallPercent}>{overallPercent}%</Text>
        </View>
        <View style={styles.overallProgressContainer}>
          <View style={[styles.overallProgressBar, { width: `${overallPercent}%` }]} />
        </View>
      </View>

      {/* Module Progress */}
      <Text style={styles.sectionTitle}>Module Progress</Text>
      
      {trainingProgress.modules.map((module, index) => {
        const modulePercent = module.total > 0 
          ? Math.round((module.completed / module.total) * 100) 
          : 0;
        const categoryColor = CATEGORY_COLORS[module.category] || '#8b5cf6';

        return (
          <View key={index} style={styles.moduleCard}>
            <View style={styles.moduleHeader}>
              <View style={[styles.categoryBadge, { backgroundColor: categoryColor }]}>
                <Text style={styles.categoryText}>{module.category}</Text>
              </View>
              <Text style={styles.modulePercent}>{modulePercent}%</Text>
            </View>
            <Text style={styles.moduleName}>{module.name}</Text>
            <View style={styles.moduleProgressContainer}>
              <View 
                style={[
                  styles.moduleProgressBar, 
                  { width: `${modulePercent}%`, backgroundColor: categoryColor }
                ]} 
              />
            </View>
            <Text style={styles.moduleLessons}>
              {module.completed} of {module.total} lessons
            </Text>
          </View>
        );
      })}

      {/* Training Completions / Astral Progress */}
      {trainingCompletions.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Astral Travel Progress</Text>
          {trainingCompletions.map((completion) => (
            <View key={completion.id} style={styles.completionCard}>
              <View style={styles.completionHeader}>
                <Ionicons name="rocket" size={20} color="#a855f7" />
                <Text style={styles.completionTitle}>{completion.title}</Text>
              </View>
              {completion.metadata?.astral_level && (
                <Text style={styles.completionLevel}>
                  Level {completion.metadata.astral_level}: {completion.metadata.astral_title || 'Completed'}
                </Text>
              )}
              <Text style={styles.completionContent} numberOfLines={2}>
                {completion.content}
              </Text>
            </View>
          ))}
        </>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    color: '#c4b5fd',
    marginTop: 12,
    fontSize: 14,
  },
  overallCard: {
    backgroundColor: 'linear-gradient(135deg, #2d1b4e 0%, #1a0a2e 100%)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#7c3aed',
    backgroundColor: '#1a0a2e',
  },
  overallHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  overallInfo: {
    flex: 1,
    marginLeft: 12,
  },
  overallTitle: {
    color: '#e9d5ff',
    fontSize: 16,
    fontWeight: '600',
  },
  overallStats: {
    color: '#9f7aea',
    fontSize: 12,
    marginTop: 4,
  },
  overallPercent: {
    color: '#fbbf24',
    fontSize: 24,
    fontWeight: 'bold',
  },
  overallProgressContainer: {
    height: 10,
    backgroundColor: '#2d1b4e',
    borderRadius: 5,
    overflow: 'hidden',
  },
  overallProgressBar: {
    height: '100%',
    backgroundColor: '#fbbf24',
    borderRadius: 5,
  },
  sectionTitle: {
    color: '#e9d5ff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    marginTop: 8,
  },
  moduleCard: {
    backgroundColor: '#1a0a2e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2d1b4e',
  },
  moduleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  categoryText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  modulePercent: {
    color: '#c4b5fd',
    fontSize: 14,
    fontWeight: '600',
  },
  moduleName: {
    color: '#e9d5ff',
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 12,
  },
  moduleProgressContainer: {
    height: 6,
    backgroundColor: '#2d1b4e',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  moduleProgressBar: {
    height: '100%',
    borderRadius: 3,
  },
  moduleLessons: {
    color: '#9f7aea',
    fontSize: 12,
  },
  completionCard: {
    backgroundColor: '#1a0a2e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#7c3aed',
  },
  completionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  completionTitle: {
    color: '#e9d5ff',
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  completionLevel: {
    color: '#a855f7',
    fontSize: 13,
    marginBottom: 6,
  },
  completionContent: {
    color: '#c4b5fd',
    fontSize: 13,
    lineHeight: 18,
  },
});

export default ProgressTab;
