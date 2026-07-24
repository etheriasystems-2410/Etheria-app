/**
 * CertificateModal — full-screen mystical certificate that opens when the
 * user taps the CertificateProgressRing. It shows either:
 *   • the earned certificate (gold, with seal, ribbon, and date), or
 *   • the current progress with a subtle "keep going" state.
 *
 * Includes a "Share" affordance (copies certificate text to clipboard).
 */
import React, { useMemo } from 'react';
import {
  Alert,
  Modal,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import type { CertificateData } from './CertificateProgressRing';

interface Props {
  visible: boolean;
  onClose: () => void;
  cert: CertificateData | null;
  learnerName?: string;
  /** When the parent has finer per-lesson percentages, we render a checklist. */
  perLessonPct?: Record<string, number>;
  /** Optional lesson id → title map for the checklist. */
  lessonTitles?: Record<string, string>;
}

const dateString = (d = new Date()) =>
  d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

export default function CertificateModal({
  visible,
  onClose,
  cert,
  learnerName,
  perLessonPct,
  lessonTitles,
}: Props) {
  const today = useMemo(() => dateString(), []);
  if (!cert) return null;
  const earned = cert.earned;

  const shareText = earned
    ? `✨ Certificate of Awakening ✨\n\n${learnerName || 'Seeker'} has completed the "${
        cert.module_title
      }" curriculum on Etheria with a mastery score of ${cert.average_pct}%.\n\nAwarded on ${today}.`
    : `I'm ${cert.average_pct}% of the way to earning my "${cert.module_title}" Certificate of Awakening on Etheria. ${cert.lessons_taken}/${cert.lessons_total} lessons complete.`;

  const handleShare = async () => {
    try {
      if (Platform.OS === 'web') {
        // Best-effort: copy to clipboard on web
        // @ts-ignore navigator exists on web
        await navigator?.clipboard?.writeText(shareText);
        Alert.alert('Copied', 'Certificate text copied to clipboard.');
        return;
      }
      await Share.share({ message: shareText });
    } catch (e) {
      // ignore
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        {/* Deep cosmic underlay */}
        <LinearGradient
          colors={['rgba(13,0,21,0.96)', 'rgba(24,4,44,0.98)', 'rgba(6,0,12,0.99)']}
          style={StyleSheet.absoluteFill}
        />

        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          {/* Certificate frame */}
          <View style={[styles.certOuter, earned && styles.certOuterEarned]}>
            <LinearGradient
              colors={
                earned
                  ? ['rgba(251,191,36,0.18)', 'rgba(124,58,237,0.15)', 'rgba(251,191,36,0.18)']
                  : ['rgba(124,58,237,0.18)', 'rgba(30,14,58,0.9)', 'rgba(124,58,237,0.18)']
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.certInner}
            >
              {/* Corner ornaments */}
              <Ionicons name="sparkles" size={16} color={earned ? '#fde68a' : '#c084fc'} style={[styles.corner, styles.tl]} />
              <Ionicons name="sparkles" size={16} color={earned ? '#fde68a' : '#c084fc'} style={[styles.corner, styles.tr]} />
              <Ionicons name="sparkles" size={16} color={earned ? '#fde68a' : '#c084fc'} style={[styles.corner, styles.bl]} />
              <Ionicons name="sparkles" size={16} color={earned ? '#fde68a' : '#c084fc'} style={[styles.corner, styles.br]} />

              {/* Header */}
              <Text style={styles.eyebrow}>✦ Etheria ✦</Text>
              <Text style={[styles.title, earned && styles.titleEarned]}>
                Certificate of Awakening
              </Text>
              <View style={[styles.divider, earned && { backgroundColor: '#fbbf24' }]} />

              <Text style={styles.presented}>This certificate is presented to</Text>
              <Text style={styles.learner}>{learnerName || 'Seeker'}</Text>

              <Text style={styles.forCompleting}>for {earned ? 'completing' : 'progressing through'} the study of</Text>
              <Text style={styles.moduleTitle}>“{cert.module_title}”</Text>

              {earned ? (
                <>
                  <View style={styles.sealWrap}>
                    <View style={styles.seal}>
                      <Ionicons name="ribbon" size={40} color="#0f0321" />
                    </View>
                    <Text style={styles.sealCaption}>Awarded {today}</Text>
                  </View>
                  <Text style={styles.scoreLine}>
                    with a mastery score of{' '}
                    <Text style={styles.scoreValue}>{cert.average_pct}%</Text>
                  </Text>
                  <Text style={styles.blessing}>
                    May the light of understanding continue to illuminate your path.
                  </Text>
                </>
              ) : (
                <>
                  <View style={styles.progressWrap}>
                    <View style={styles.progressBar}>
                      <View
                        style={[
                          styles.progressFill,
                          {
                            width: `${Math.max(2, Math.min(100, cert.average_pct))}%`,
                          },
                        ]}
                      />
                    </View>
                    <Text style={styles.progressText}>
                      {cert.average_pct}% average · need {cert.threshold_pct}% to earn
                    </Text>
                    <Text style={styles.progressSub}>
                      {cert.lessons_taken}/{cert.lessons_total} lessons quizzed
                    </Text>
                  </View>
                  <Text style={styles.blessing}>
                    Take a quiz after each lesson to raise your average and earn the seal.
                  </Text>
                </>
              )}

              {/* Per-lesson checklist */}
              {perLessonPct && Object.keys(perLessonPct).length > 0 && (
                <View style={styles.checklist}>
                  <Text style={styles.checklistHeader}>Lesson Scores</Text>
                  {Object.entries(perLessonPct).map(([lid, p]) => (
                    <View key={lid} style={styles.checklistRow}>
                      <Ionicons
                        name={p >= cert.threshold_pct ? 'checkmark-circle' : 'ellipse-outline'}
                        size={14}
                        color={p >= cert.threshold_pct ? '#10b981' : '#c4b5fd'}
                      />
                      <Text style={styles.checklistText} numberOfLines={1}>
                        {(lessonTitles && lessonTitles[lid]) || `Lesson ${lid}`}
                      </Text>
                      <Text
                        style={[
                          styles.checklistPct,
                          p >= cert.threshold_pct && { color: '#fbbf24' },
                        ]}
                      >
                        {p}%
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </LinearGradient>
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            {earned && (
              <TouchableOpacity
                onPress={handleShare}
                style={[styles.actionBtn, styles.actionBtnPrimary]}
                activeOpacity={0.85}
              >
                <Ionicons name="share-social" size={16} color="#0f0321" />
                <Text style={[styles.actionBtnText, { color: '#0f0321' }]}>Share</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={onClose}
              style={styles.actionBtn}
              activeOpacity={0.85}
            >
              <Ionicons name="close" size={16} color="#e9d5ff" />
              <Text style={styles.actionBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1 },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 40,
  },
  certOuter: {
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'rgba(168,85,247,0.6)',
    padding: 4,
    backgroundColor: 'rgba(15,3,33,0.95)',
    shadowColor: '#a855f7',
    shadowOpacity: 0.5,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  certOuterEarned: {
    borderColor: 'rgba(251,191,36,0.85)',
    shadowColor: '#fbbf24',
    shadowOpacity: 0.7,
  },
  certInner: {
    borderRadius: 16,
    paddingHorizontal: 22,
    paddingVertical: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    position: 'relative',
  },
  corner: {
    position: 'absolute',
  },
  tl: { top: 10, left: 10 },
  tr: { top: 10, right: 10 },
  bl: { bottom: 10, left: 10 },
  br: { bottom: 10, right: 10 },
  eyebrow: {
    textAlign: 'center',
    color: '#c4b5fd',
    fontSize: 10,
    letterSpacing: 4,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  title: {
    textAlign: 'center',
    color: '#e9d5ff',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 1,
    fontStyle: 'italic',
  },
  titleEarned: { color: '#fde68a' },
  divider: {
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 16,
    width: 60,
    height: 2,
    backgroundColor: 'rgba(168,85,247,0.6)',
    borderRadius: 1,
  },
  presented: {
    textAlign: 'center',
    color: '#c4b5fd',
    fontSize: 12,
    letterSpacing: 0.6,
  },
  learner: {
    textAlign: 'center',
    color: '#e9d5ff',
    fontSize: 24,
    fontWeight: '800',
    marginTop: 4,
    marginBottom: 10,
    letterSpacing: 0.5,
  },
  forCompleting: {
    textAlign: 'center',
    color: '#c4b5fd',
    fontSize: 12,
    fontStyle: 'italic',
  },
  moduleTitle: {
    textAlign: 'center',
    color: '#fde68a',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 6,
    marginBottom: 14,
  },
  sealWrap: {
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 10,
  },
  seal: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: '#fbbf24',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#fde68a',
    shadowColor: '#fbbf24',
    shadowOpacity: 0.6,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  sealCaption: {
    marginTop: 8,
    color: '#c4b5fd',
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  scoreLine: {
    textAlign: 'center',
    color: '#e9d5ff',
    fontSize: 13,
    marginTop: 4,
  },
  scoreValue: { color: '#fbbf24', fontWeight: '900' },
  blessing: {
    textAlign: 'center',
    color: '#c4b5fd',
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 14,
    lineHeight: 18,
    paddingHorizontal: 6,
  },
  progressWrap: {
    marginTop: 8,
    marginBottom: 4,
    alignItems: 'center',
  },
  progressBar: {
    width: '85%',
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(45,27,78,0.9)',
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: '#a855f7',
  },
  progressText: { color: '#e9d5ff', fontSize: 12, fontWeight: '700' },
  progressSub: { color: '#7c6ba0', fontSize: 11, marginTop: 2 },
  checklist: {
    marginTop: 18,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(168,85,247,0.25)',
  },
  checklistHeader: {
    color: '#c4b5fd',
    fontSize: 10,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 8,
    textAlign: 'center',
  },
  checklistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  checklistText: { flex: 1, color: '#e9d5ff', fontSize: 12 },
  checklistPct: { color: '#c4b5fd', fontSize: 12, fontWeight: '700' },
  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginTop: 18,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(45,27,78,0.85)',
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.5)',
  },
  actionBtnPrimary: {
    backgroundColor: '#fbbf24',
    borderColor: '#fde68a',
  },
  actionBtnText: {
    color: '#e9d5ff',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
});
