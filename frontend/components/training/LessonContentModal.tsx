/**
 * LessonContentModal — full-screen view of a single lesson: title, prose
 * content, optional MeditationPlayer, and a sticky "Complete" CTA at the
 * bottom which advances to the next lesson (or closes if last).
 */
import React from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import MeditationPlayer from './MeditationPlayer';
import LessonWorkbook from './LessonWorkbook';
import type { Lesson } from './types';

interface Props {
  visible: boolean;
  onClose: () => void;
  lesson: Lesson | null;
  lessons: Lesson[];
  onComplete: () => void;
  /** Needed for the workbook (notes/quiz) so we can persist per module+lesson. */
  moduleId?: string;
  /** Fired whenever the certificate progress changes so the parent screen
   *  can refresh its own indicators. */
  onCertificateChange?: (cert: any) => void;

  isPlayingMeditation: boolean;
  isGeneratingTTS: boolean;
  ttsProgress: string;
  onPlayMeditation: () => void;
  onStopMeditation: () => void;
}

export default function LessonContentModal({
  visible,
  onClose,
  lesson,
  lessons,
  onComplete,
  moduleId,
  onCertificateChange,
  isPlayingMeditation,
  isGeneratingTTS,
  ttsProgress,
  onPlayMeditation,
  onStopMeditation,
}: Props) {
  const isLast = lessons.findIndex((l) => l.id === lesson?.id) >= lessons.length - 1;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#e9d5ff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            Lesson {lesson?.id}
          </Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView contentContainerStyle={styles.lessonContentContainer}>
          <Text style={styles.lessonContentTitle}>{lesson?.title}</Text>
          <View style={styles.lessonContentBox}>
            <Text style={styles.lessonContentText}>{lesson?.content}</Text>
          </View>

          {lesson?.meditation && (
            <MeditationPlayer
              meditation={lesson.meditation}
              isPlayingMeditation={isPlayingMeditation}
              isGeneratingTTS={isGeneratingTTS}
              ttsProgress={ttsProgress}
              onPlay={onPlayMeditation}
              onStop={onStopMeditation}
            />
          )}

          {moduleId && lesson ? (
            <LessonWorkbook
              moduleId={moduleId}
              lessonId={lesson.id}
              onCertificateChange={onCertificateChange}
            />
          ) : null}
        </ScrollView>

        <View style={styles.lessonFooter}>
          <TouchableOpacity style={styles.completeButton} onPress={onComplete}>
            <Ionicons name="checkmark-circle" size={20} color="#0f0321" />
            <Text style={styles.completeButtonText}>
              {isLast ? 'Complete Lesson' : 'Complete & Next'}
            </Text>
          </TouchableOpacity>
        </View>
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
  lessonContentContainer: { padding: 16, paddingBottom: 100 },
  lessonContentTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#e9d5ff',
    marginBottom: 20,
  },
  lessonContentBox: {
    backgroundColor: '#1a0033',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#2d1b4e',
  },
  lessonContentText: { fontSize: 16, color: '#c4b5fd', lineHeight: 26 },
  lessonFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: '#0d0015',
    borderTopWidth: 1,
    borderTopColor: '#2d1b4e',
  },
  completeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10b981',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  completeButtonText: { color: '#0f0321', fontSize: 17, fontWeight: 'bold' },
});
