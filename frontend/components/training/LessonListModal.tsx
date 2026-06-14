/**
 * LessonListModal — full-screen modal that lists the lessons for the
 * currently selected module. Tapping a lesson hands control back to the
 * parent (which then opens the LessonContentModal).
 */
import React from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { CosmicBackdrop } from '../ui';
import type { Lesson, Module } from './types';

interface Props {
  visible: boolean;
  onClose: () => void;
  module: Module | null;
  lessons: Lesson[];
  loadingLessons: boolean;
  isLessonCompleted: (moduleId: string, lessonId: number) => boolean;
  onLessonPress: (lesson: Lesson) => void;
}

export default function LessonListModal({
  visible,
  onClose,
  module,
  lessons,
  loadingLessons,
  isLessonCompleted,
  onLessonPress,
}: Props) {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <CosmicBackdrop />
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#e9d5ff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {module?.title || 'Lessons'}
          </Text>
          <View style={{ width: 24 }} />
        </View>

        {loadingLessons ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#a855f7" />
            <Text style={styles.loadingText}>Loading lessons...</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.lessonListContent}>
            <Text style={styles.moduleDescHeader}>{module?.description}</Text>

            {lessons.map((lesson, index) => {
              const completed = module
                ? isLessonCompleted(module.id, lesson.id)
                : false;
              return (
                <TouchableOpacity
                  key={lesson.id}
                  style={[styles.lessonCard, completed && styles.lessonCompleted]}
                  onPress={() => onLessonPress(lesson)}
                >
                  <View
                    style={[
                      styles.lessonNumber,
                      completed && styles.lessonNumberCompleted,
                    ]}
                  >
                    {completed ? (
                      <Ionicons name="checkmark" size={18} color="#10b981" />
                    ) : (
                      <Text style={styles.lessonNumberText}>{index + 1}</Text>
                    )}
                  </View>
                  <View style={styles.lessonInfo}>
                    <Text style={styles.lessonTitle}>{lesson.title}</Text>
                    <Text style={styles.lessonStatus}>
                      {completed ? 'Completed' : 'Tap to start'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#9f7aea" />
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d0015' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#1a0033',
    borderBottomWidth: 1,
    borderBottomColor: '#2d1b4e',
  },
  backButton: { padding: 4 },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#e9d5ff',
    flex: 1,
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0d0015',
  },
  loadingText: { color: '#c4b5fd', marginTop: 16, fontSize: 16 },
  lessonListContent: { padding: 16 },
  moduleDescHeader: {
    fontSize: 15,
    color: '#9f7aea',
    marginBottom: 20,
    lineHeight: 22,
  },
  lessonCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a0033',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#2d1b4e',
  },
  lessonCompleted: {
    borderColor: '#10b981',
    backgroundColor: 'rgba(16, 185, 129, 0.05)',
  },
  lessonNumber: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#2d1b4e',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  lessonNumberCompleted: { backgroundColor: 'rgba(16, 185, 129, 0.2)' },
  lessonNumberText: { color: '#e9d5ff', fontSize: 16, fontWeight: 'bold' },
  lessonInfo: { flex: 1 },
  lessonTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#e9d5ff',
    marginBottom: 2,
  },
  lessonStatus: { fontSize: 13, color: '#9f7aea' },
});
