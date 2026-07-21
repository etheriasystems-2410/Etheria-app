/**
 * LessonWorkbook — shared per-lesson content boxes used by both Psychic
 * Training and Astral Travel Self-Study.
 *
 * Three sections in order:
 *   1. My Notes          — free-form textarea, autosaves on blur
 *   2. Practice Log      — timestamped list of user-authored entries
 *   3. Quiz              — 5 MCQs generated once per lesson via
 *                          Gemini and cached in Mongo, then the user's
 *                          score and a per-module certificate progress
 *                          ring based on average across module lessons.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface QuizQuestion {
  q: string;
  options: string[];
}

interface Certificate {
  module_id: string;
  module_title: string;
  earned: boolean;
  threshold_pct: number;
  average_pct: number;
  lessons_taken: number;
  lessons_total: number;
}

interface Workbook {
  module_id: string;
  lesson_id: string;
  lesson_title: string;
  notes: string;
  practice_log: { text: string; at: string }[];
  quiz: { questions: QuizQuestion[] } | null;
  quiz_generated: boolean;
  latest_attempt: {
    score: number;
    total: number;
    answers: number[];
    attempted_at?: string;
  } | null;
  certificate: Certificate;
  certificate_threshold_pct: number;
}

interface Props {
  moduleId: string;
  lessonId: string | number;
  /** Called any time the certificate progress changes so the parent screen
   *  can refresh its own certificate ring / badges. */
  onCertificateChange?: (cert: Certificate) => void;
}

const authHeaders = async () => {
  const token = await AsyncStorage.getItem('session_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export default function LessonWorkbook({
  moduleId,
  lessonId,
  onCertificateChange,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [workbook, setWorkbook] = useState<Workbook | null>(null);

  const [notesDraft, setNotesDraft] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);

  const [practiceDraft, setPracticeDraft] = useState('');
  const [addingPractice, setAddingPractice] = useState(false);

  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [quizResult, setQuizResult] = useState<{
    score: number;
    total: number;
    correct_flags: boolean[];
    correct_indices: number[];
    explanations: string[];
  } | null>(null);
  const [loadingQuiz, setLoadingQuiz] = useState(false);
  const [submittingQuiz, setSubmittingQuiz] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const h = await authHeaders();
      const r = await fetch(
        `${BACKEND_URL}/api/training-workbook/${moduleId}/${lessonId}`,
        { headers: h },
      );
      if (!r.ok) {
        throw new Error('Could not load workbook');
      }
      const data: Workbook = await r.json();
      setWorkbook(data);
      setNotesDraft(data.notes || '');
      if (data.latest_attempt) {
        const map: Record<number, number> = {};
        (data.latest_attempt.answers || []).forEach((a, i) => {
          map[i] = a;
        });
        setQuizAnswers(map);
      } else {
        setQuizAnswers({});
      }
      setQuizResult(null);
      onCertificateChange?.(data.certificate);
    } catch {
      // fail quiet — parent still renders lesson content
    } finally {
      setLoading(false);
    }
  }, [moduleId, lessonId, onCertificateChange]);

  useEffect(() => {
    load();
  }, [load]);

  // ---- Notes ----
  const saveNotesIfDirty = async () => {
    if (!workbook) return;
    if ((workbook.notes || '') === notesDraft) return;
    setSavingNotes(true);
    try {
      const h = await authHeaders();
      await fetch(
        `${BACKEND_URL}/api/training-workbook/${moduleId}/${lessonId}/notes`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', ...h },
          body: JSON.stringify({ notes: notesDraft }),
        },
      );
      setWorkbook({ ...workbook, notes: notesDraft });
    } catch {
      // keep local draft — user can retry
    } finally {
      setSavingNotes(false);
    }
  };

  // ---- Practice log ----
  const addPractice = async () => {
    const text = practiceDraft.trim();
    if (!text || !workbook) return;
    setAddingPractice(true);
    try {
      const h = await authHeaders();
      const r = await fetch(
        `${BACKEND_URL}/api/training-workbook/${moduleId}/${lessonId}/practice`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...h },
          body: JSON.stringify({ text }),
        },
      );
      const data = await r.json();
      if (r.ok && data?.entry) {
        setWorkbook({
          ...workbook,
          practice_log: [...(workbook.practice_log || []), data.entry],
        });
        setPracticeDraft('');
      }
    } finally {
      setAddingPractice(false);
    }
  };

  const removePractice = async (idx: number) => {
    if (!workbook) return;
    const h = await authHeaders();
    const r = await fetch(
      `${BACKEND_URL}/api/training-workbook/${moduleId}/${lessonId}/practice/${idx}`,
      { method: 'DELETE', headers: h },
    );
    if (r.ok) {
      const nextLog = [...workbook.practice_log];
      nextLog.splice(idx, 1);
      setWorkbook({ ...workbook, practice_log: nextLog });
    }
  };

  // ---- Quiz ----
  const generateQuiz = async () => {
    setLoadingQuiz(true);
    try {
      const h = await authHeaders();
      const r = await fetch(
        `${BACKEND_URL}/api/training-workbook/${moduleId}/${lessonId}/quiz`,
        { headers: h },
      );
      const data = await r.json();
      if (r.ok && data?.questions) {
        setWorkbook((w) =>
          w ? { ...w, quiz: data, quiz_generated: true } : w,
        );
        setQuizAnswers({});
        setQuizResult(null);
      } else {
        Alert.alert(
          'Quiz unavailable',
          data?.detail || 'Please try again shortly.',
        );
      }
    } catch {
      Alert.alert('Quiz unavailable', 'Please try again shortly.');
    } finally {
      setLoadingQuiz(false);
    }
  };

  const submitQuiz = async () => {
    if (!workbook?.quiz) return;
    const total = workbook.quiz.questions.length;
    // Coerce to array in question order; unanswered = -1 which is guaranteed wrong.
    const answers: number[] = [];
    for (let i = 0; i < total; i += 1) {
      answers.push(quizAnswers[i] ?? -1);
    }
    if (answers.some((a) => a === -1)) {
      Alert.alert(
        'Answer every question',
        'Please choose an option for each question before submitting.',
      );
      return;
    }
    setSubmittingQuiz(true);
    try {
      const h = await authHeaders();
      const r = await fetch(
        `${BACKEND_URL}/api/training-workbook/${moduleId}/${lessonId}/quiz/attempt`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...h },
          body: JSON.stringify({ answers }),
        },
      );
      const data = await r.json();
      if (r.ok) {
        setQuizResult({
          score: data.score,
          total: data.total,
          correct_flags: data.correct_flags,
          correct_indices: data.correct_indices,
          explanations: data.explanations,
        });
        setWorkbook((w) =>
          w
            ? {
                ...w,
                latest_attempt: {
                  score: data.score,
                  total: data.total,
                  answers,
                  attempted_at: data.attempted_at,
                },
                certificate: data.certificate,
              }
            : w,
        );
        onCertificateChange?.(data.certificate);
      } else {
        Alert.alert('Could not submit', data?.detail || 'Please try again.');
      }
    } finally {
      setSubmittingQuiz(false);
    }
  };

  const retakeQuiz = () => {
    setQuizResult(null);
    setQuizAnswers({});
  };

  // ---- Render ----
  if (loading) {
    return (
      <View style={styles.loadingBox}>
        <ActivityIndicator color="#a855f7" />
      </View>
    );
  }
  if (!workbook) return null;

  const cert = workbook.certificate;
  const progressPct = Math.max(
    0,
    Math.min(100, cert.lessons_total ? (cert.lessons_taken / cert.lessons_total) * 100 : 0),
  );

  return (
    <View style={styles.wrap}>
      {/* Certificate progress ring */}
      <View style={styles.certBox}>
        <View style={styles.certLeft}>
          <View
            style={[
              styles.certRing,
              cert.earned && { borderColor: '#fbbf24', backgroundColor: 'rgba(251,191,36,0.1)' },
            ]}
          >
            <Ionicons
              name={cert.earned ? 'ribbon' : 'school'}
              size={22}
              color={cert.earned ? '#fbbf24' : '#a855f7'}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.certTitle}>
              {cert.earned ? 'Certificate earned' : 'Certificate progress'}
            </Text>
            <Text style={styles.certSub}>
              {cert.lessons_taken}/{cert.lessons_total} lessons quizzed · avg{' '}
              {cert.average_pct}% · need {cert.threshold_pct}%
            </Text>
            <View style={styles.certBar}>
              <View
                style={[
                  styles.certBarFill,
                  {
                    width: `${progressPct}%`,
                    backgroundColor: cert.earned ? '#fbbf24' : '#a855f7',
                  },
                ]}
              />
            </View>
          </View>
        </View>
      </View>

      {/* ---- Notes ---- */}
      <SectionHeader icon="create-outline" title="My Notes" />
      <TextInput
        style={styles.notesInput}
        value={notesDraft}
        onChangeText={setNotesDraft}
        placeholder="Write your reflections, insights, or questions about this lesson…"
        placeholderTextColor="#7c6ba0"
        multiline
        maxLength={20000}
        onBlur={saveNotesIfDirty}
      />
      <View style={styles.notesFooter}>
        {savingNotes ? (
          <Text style={styles.notesFooterText}>Saving…</Text>
        ) : notesDraft !== (workbook.notes || '') ? (
          <TouchableOpacity onPress={saveNotesIfDirty}>
            <Text style={[styles.notesFooterText, { color: '#fbbf24' }]}>
              Tap to save
            </Text>
          </TouchableOpacity>
        ) : (
          <Text style={styles.notesFooterText}>Autosaved on blur</Text>
        )}
      </View>

      {/* ---- Practice log ---- */}
      <SectionHeader icon="footsteps-outline" title="Practice Log" />
      <View style={styles.practiceInputRow}>
        <TextInput
          style={styles.practiceInput}
          value={practiceDraft}
          onChangeText={setPracticeDraft}
          placeholder="What did you notice when you tried this?"
          placeholderTextColor="#7c6ba0"
          multiline
          maxLength={4000}
          editable={!addingPractice}
        />
        <TouchableOpacity
          style={[
            styles.practiceAddBtn,
            (!practiceDraft.trim() || addingPractice) && styles.practiceAddBtnDisabled,
          ]}
          onPress={addPractice}
          disabled={!practiceDraft.trim() || addingPractice}
        >
          {addingPractice ? (
            <ActivityIndicator size="small" color="#0f0321" />
          ) : (
            <Ionicons name="add" size={20} color="#0f0321" />
          )}
        </TouchableOpacity>
      </View>
      {(workbook.practice_log || []).length === 0 ? (
        <Text style={styles.practiceEmpty}>
          No practice entries yet. Log what you notice each time you sit with
          this material.
        </Text>
      ) : (
        (workbook.practice_log || []).map((entry, idx) => (
          <View key={idx} style={styles.practiceEntry}>
            <View style={{ flex: 1 }}>
              <Text style={styles.practiceEntryText}>{entry.text}</Text>
              <Text style={styles.practiceEntryDate}>
                {new Date(entry.at).toLocaleString()}
              </Text>
            </View>
            <TouchableOpacity onPress={() => removePractice(idx)}>
              <Ionicons name="trash-outline" size={16} color="#c4b5fd" />
            </TouchableOpacity>
          </View>
        ))
      )}

      {/* ---- Quiz ---- */}
      <SectionHeader icon="help-circle-outline" title="Quiz" />
      {!workbook.quiz ? (
        <View>
          <Text style={styles.quizIntro}>
            Test what you learned. Five multiple-choice questions written from
            this lesson.
          </Text>
          <TouchableOpacity
            style={styles.quizGenBtn}
            onPress={generateQuiz}
            disabled={loadingQuiz}
          >
            {loadingQuiz ? (
              <ActivityIndicator color="#0f0321" />
            ) : (
              <>
                <Ionicons name="sparkles" size={16} color="#0f0321" />
                <Text style={styles.quizGenBtnText}>Load Quiz</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      ) : (
        <View>
          {workbook.quiz.questions.map((q, qIdx) => {
            const chosen = quizAnswers[qIdx];
            const result = quizResult;
            const correctIdx = result?.correct_indices?.[qIdx];
            const isSubmitted = !!result;
            return (
              <View key={qIdx} style={styles.quizQuestion}>
                <Text style={styles.quizQuestionText}>
                  {qIdx + 1}. {q.q}
                </Text>
                {q.options.map((opt, oIdx) => {
                  const selected = chosen === oIdx;
                  let optionStyle: any = styles.quizOption;
                  let iconName: any = 'ellipse-outline';
                  let iconColor = '#c4b5fd';
                  if (isSubmitted) {
                    if (oIdx === correctIdx) {
                      optionStyle = [styles.quizOption, styles.quizOptionCorrect];
                      iconName = 'checkmark-circle';
                      iconColor = '#22c55e';
                    } else if (selected) {
                      optionStyle = [styles.quizOption, styles.quizOptionWrong];
                      iconName = 'close-circle';
                      iconColor = '#ef4444';
                    }
                  } else if (selected) {
                    optionStyle = [styles.quizOption, styles.quizOptionSelected];
                    iconName = 'radio-button-on';
                    iconColor = '#a855f7';
                  }
                  return (
                    <TouchableOpacity
                      key={oIdx}
                      style={optionStyle}
                      onPress={() =>
                        !isSubmitted &&
                        setQuizAnswers((prev) => ({ ...prev, [qIdx]: oIdx }))
                      }
                      disabled={isSubmitted}
                      activeOpacity={0.8}
                    >
                      <Ionicons name={iconName} size={18} color={iconColor} />
                      <Text style={styles.quizOptionText}>{opt}</Text>
                    </TouchableOpacity>
                  );
                })}
                {isSubmitted && result?.explanations?.[qIdx] ? (
                  <Text style={styles.quizExplanation}>
                    {result.correct_flags[qIdx] ? '✓ ' : '✗ '}
                    {result.explanations[qIdx]}
                  </Text>
                ) : null}
              </View>
            );
          })}

          {!quizResult ? (
            <TouchableOpacity
              style={styles.quizSubmitBtn}
              onPress={submitQuiz}
              disabled={submittingQuiz}
            >
              {submittingQuiz ? (
                <ActivityIndicator color="#0f0321" />
              ) : (
                <>
                  <Ionicons name="send" size={16} color="#0f0321" />
                  <Text style={styles.quizSubmitBtnText}>Submit Answers</Text>
                </>
              )}
            </TouchableOpacity>
          ) : (
            <View style={styles.quizResultBox}>
              <Ionicons
                name={
                  (quizResult.score / quizResult.total) >= 0.8
                    ? 'trophy'
                    : 'ribbon-outline'
                }
                size={22}
                color="#fbbf24"
              />
              <Text style={styles.quizResultText}>
                You scored {quizResult.score} / {quizResult.total} (
                {Math.round((quizResult.score / quizResult.total) * 100)}%)
              </Text>
              <TouchableOpacity onPress={retakeQuiz}>
                <Text style={styles.quizRetakeText}>Retake</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

function SectionHeader({ icon, title }: { icon: any; title: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Ionicons name={icon} size={16} color="#fbbf24" />
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 24, gap: 6 },
  loadingBox: { padding: 24, alignItems: 'center' },

  // Certificate
  certBox: {
    marginBottom: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.35)',
    backgroundColor: 'rgba(30,14,58,0.65)',
  },
  certLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  certRing: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#a855f7',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(168,85,247,0.15)',
  },
  certTitle: { color: '#e9d5ff', fontSize: 14, fontWeight: '800' },
  certSub: { color: '#c4b5fd', fontSize: 11, marginTop: 2 },
  certBar: {
    marginTop: 6,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(45,27,78,0.7)',
    overflow: 'hidden',
  },
  certBarFill: { height: '100%', borderRadius: 2 },

  // Section header
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 14,
    marginBottom: 8,
  },
  sectionTitle: {
    color: '#fbbf24',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
  },

  // Notes
  notesInput: {
    minHeight: 90,
    maxHeight: 220,
    color: '#e9d5ff',
    fontSize: 14,
    lineHeight: 20,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(159,122,234,0.35)',
    backgroundColor: 'rgba(15,5,35,0.75)',
    textAlignVertical: 'top',
  },
  notesFooter: {
    alignItems: 'flex-end',
    marginTop: 4,
    marginRight: 2,
  },
  notesFooterText: {
    color: '#7c6ba0',
    fontSize: 11,
    fontStyle: 'italic',
  },

  // Practice
  practiceInputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  practiceInput: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    color: '#e9d5ff',
    fontSize: 14,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(159,122,234,0.35)',
    backgroundColor: 'rgba(15,5,35,0.75)',
    textAlignVertical: 'top',
  },
  practiceAddBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fbbf24',
    alignItems: 'center',
    justifyContent: 'center',
  },
  practiceAddBtnDisabled: { backgroundColor: 'rgba(45,27,78,0.7)' },
  practiceEmpty: {
    color: '#9f7aea',
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 8,
    textAlign: 'center',
  },
  practiceEntry: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 8,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(159,122,234,0.25)',
    backgroundColor: 'rgba(30,14,58,0.55)',
  },
  practiceEntryText: { color: '#e9d5ff', fontSize: 13, lineHeight: 19 },
  practiceEntryDate: {
    color: '#7c6ba0',
    fontSize: 10,
    marginTop: 4,
  },

  // Quiz
  quizIntro: {
    color: '#c4b5fd',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 10,
  },
  quizGenBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: '#fbbf24',
    alignSelf: 'flex-start',
  },
  quizGenBtnText: { color: '#0f0321', fontWeight: '800', fontSize: 14 },
  quizQuestion: {
    marginTop: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(159,122,234,0.25)',
    backgroundColor: 'rgba(30,14,58,0.55)',
  },
  quizQuestionText: {
    color: '#e9d5ff',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
    lineHeight: 20,
  },
  quizOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginTop: 4,
    borderWidth: 1,
    borderColor: 'rgba(159,122,234,0.2)',
  },
  quizOptionSelected: {
    borderColor: '#a855f7',
    backgroundColor: 'rgba(168,85,247,0.15)',
  },
  quizOptionCorrect: {
    borderColor: '#22c55e',
    backgroundColor: 'rgba(34,197,94,0.12)',
  },
  quizOptionWrong: {
    borderColor: '#ef4444',
    backgroundColor: 'rgba(239,68,68,0.12)',
  },
  quizOptionText: {
    color: '#e9d5ff',
    fontSize: 13,
    flex: 1,
    lineHeight: 19,
  },
  quizExplanation: {
    color: '#c4b5fd',
    fontSize: 12,
    marginTop: 8,
    fontStyle: 'italic',
    lineHeight: 17,
  },
  quizSubmitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: '#fbbf24',
    marginTop: 14,
  },
  quizSubmitBtnText: { color: '#0f0321', fontWeight: '800', fontSize: 14 },
  quizResultBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 14,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.5)',
    backgroundColor: 'rgba(251,191,36,0.1)',
  },
  quizResultText: {
    color: '#fbbf24',
    fontSize: 13,
    fontWeight: '800',
    flex: 1,
  },
  quizRetakeText: {
    color: '#a855f7',
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
});
