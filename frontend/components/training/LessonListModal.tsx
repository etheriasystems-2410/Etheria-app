/**
 * LessonListModal — full-screen modal that lists the lessons for the
 * currently selected module. Tapping a lesson hands control back to the
 * parent (which then opens the LessonContentModal).
 */
import React, { useEffect, useState } from 'react';
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
import AsyncStorage from '@react-native-async-storage/async-storage';

import { CosmicBackdrop } from '../ui';
import LessonHeroBanner from './LessonHeroBanner';
import CertificateProgressRing, { CertificateData } from './CertificateProgressRing';
import CertificateModal from './CertificateModal';
import { useAuth } from '../../contexts/AuthContext';
import type { Lesson, Module } from './types';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

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
  const { user } = useAuth();
  const [cert, setCert] = useState<CertificateData | null>(null);
  const [showCert, setShowCert] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!visible || !module?.id) {
        setCert(null);
        return;
      }
      try {
        const token = await AsyncStorage.getItem('session_token');
        const r = await fetch(
          `${BACKEND_URL}/api/training-workbook/certificate/${module.id}`,
          { headers: token ? { Authorization: `Bearer ${token}` } : {} },
        );
        if (!r.ok) return;
        const data = await r.json();
        if (!cancelled) setCert(data);
      } catch {
        /* silent */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, module?.id]);

  const lessonTitles: Record<string, string> = React.useMemo(() => {
    const map: Record<string, string> = {};
    lessons.forEach((l) => {
      map[String(l.id)] = l.title;
    });
    return map;
  }, [lessons]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <CosmicBackdrop />

        {loadingLessons ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#a855f7" />
            <Text style={styles.loadingText}>Loading lessons...</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.lessonListContent}>
            <LessonHeroBanner
              eyebrow="Module"
              title={module?.title}
              height={180}
            />
            <View style={styles.innerPad}>
              <Text style={styles.moduleDescHeader}>{module?.description}</Text>

              {cert && cert.lessons_total > 0 && (
                <View style={{ marginBottom: 14 }}>
                  <CertificateProgressRing
                    cert={cert}
                    variant="compact"
                    onPress={() => setShowCert(true)}
                  />
                </View>
              )}

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
            </View>
          </ScrollView>
        )}

        {/* Floating transparent header — sits above the hero. */}
        <View style={styles.floatHeader} pointerEvents="box-none">
          <TouchableOpacity onPress={onClose} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#e9d5ff" />
          </TouchableOpacity>
          <Text style={styles.floatHeaderTitle} numberOfLines={1}>
            {module?.title || 'Lessons'}
          </Text>
          <View style={{ width: 40 }} />
        </View>

        <CertificateModal
          visible={showCert}
          onClose={() => setShowCert(false)}
          cert={cert}
          learnerName={user?.display_name || user?.name}
          perLessonPct={cert?.per_lesson_pct}
          lessonTitles={lessonTitles}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d0015' },
  floatHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 44,
    paddingHorizontal: 12,
    paddingBottom: 8,
    zIndex: 10,
  },
  floatHeaderTitle: {
    color: '#e9d5ff',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.4,
    flex: 1,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#1a0033',
    borderBottomWidth: 1,
    borderBottomColor: '#2d1b4e',
  },
  backButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(15,3,33,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(159,122,234,0.35)',
  },
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
  lessonListContent: { paddingBottom: 20 },
  innerPad: { paddingHorizontal: 16, paddingTop: 12 },
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
