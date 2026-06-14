/**
 * useTrainingProgress — owns the lesson-completion state.
 *
 * Responsibilities:
 *  • Load completed-lesson keys from AsyncStorage on first mount.
 *  • One-time backfill: replay any locally-completed lessons that don't yet
 *    exist on the backend (so Profile → Progress → "Modules completed" reflects
 *    history made before backend tracking shipped).
 *  • Persist new completions to AsyncStorage AND POST them to
 *    `/api/training/lesson-complete` (best-effort).
 *
 * Returns convenience selectors `isLessonCompleted` / `getModuleProgress` so
 * UI components don't need direct access to the underlying array.
 */
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Lesson, Module } from '../components/training/types';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

export function useTrainingProgress(lessons: Lesson[]) {
  const [completedLessons, setCompletedLessons] = useState<string[]>([]);

  // ── Initial load + one-time backfill ────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const progress = await AsyncStorage.getItem('completed_lessons');
        const local: string[] = progress ? JSON.parse(progress) : [];
        if (local.length) setCompletedLessons(local);

        const alreadyBackfilled = await AsyncStorage.getItem('training_backfill_v1');
        if (alreadyBackfilled === 'done' || local.length === 0) return;

        const auth = await AsyncStorage.getItem('session_token');
        if (!auth) return;

        try {
          const r = await fetch(`${BACKEND_URL}/api/training/progress`, {
            headers: { Authorization: `Bearer ${auth}` },
          });
          if (!r.ok) return;
          const data = await r.json();
          const remote: string[] = Array.isArray(data.completed_lessons)
            ? data.completed_lessons
            : [];
          const remoteSet = new Set(remote);
          const missing = local.filter((k) => !remoteSet.has(k));

          await Promise.allSettled(
            missing.map((key) => {
              const [moduleId, lessonIdStr] = key.split('-');
              const lessonId = parseInt(lessonIdStr, 10);
              if (!moduleId || Number.isNaN(lessonId)) return Promise.resolve();
              return fetch(`${BACKEND_URL}/api/training/lesson-complete`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${auth}`,
                },
                body: JSON.stringify({ module_id: moduleId, lesson_id: lessonId }),
              });
            }),
          );
          await AsyncStorage.setItem('training_backfill_v1', 'done');
          if (missing.length) {
            console.log(`[Training] Backfilled ${missing.length} lessons to backend`);
          }
        } catch (syncErr) {
          console.warn('[Training] backfill failed:', syncErr);
        }
      } catch (error) {
        console.error('Error loading progress:', error);
      }
    })();
  }, []);

  // ── Mutation ────────────────────────────────────────────────────────────
  const saveProgress = async (lessonKey: string) => {
    try {
      // Read-modify-write the lessons list and mirror to disk.
      let nextList: string[] = [];
      setCompletedLessons((prev) => {
        nextList = prev.includes(lessonKey) ? prev : [...prev, lessonKey];
        return nextList;
      });
      await AsyncStorage.setItem('completed_lessons', JSON.stringify(nextList));

      try {
        const auth = await AsyncStorage.getItem('session_token');
        if (!auth) return;
        const [moduleId, lessonIdStr] = lessonKey.split('-');
        const lessonId = parseInt(lessonIdStr, 10);
        if (!moduleId || Number.isNaN(lessonId)) return;
        await fetch(`${BACKEND_URL}/api/training/lesson-complete`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${auth}`,
          },
          body: JSON.stringify({ module_id: moduleId, lesson_id: lessonId }),
        });
      } catch (syncErr) {
        console.warn('[Training] backend sync failed:', syncErr);
      }
    } catch (error) {
      console.error('Error saving progress:', error);
    }
  };

  // ── Selectors ───────────────────────────────────────────────────────────
  const isLessonCompleted = (moduleId: string, lessonId: number) =>
    completedLessons.includes(`${moduleId}-${lessonId}`);

  const getModuleProgress = (module: Module) => {
    const completed = lessons.filter((l) =>
      isLessonCompleted(module.id, l.id),
    ).length;
    return { completed, total: module.lessons };
  };

  return {
    completedLessons,
    isLessonCompleted,
    getModuleProgress,
    saveProgress,
  };
}
