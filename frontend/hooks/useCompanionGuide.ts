/**
 * useCompanionGuide — global hook that owns the user's Companion Guide
 * state (current selection + latest whisper) and exposes mutations.
 *
 * The bubble lives at the root layout level so this hook is also imported
 * from the Spirit Guides screen (via CompanionSelectorModal) to share the
 * same source of truth.
 *
 * Whispers refresh every 60 minutes while the app is foregrounded so the
 * bubble stays "alive" without hammering the LLM.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';

import { useAuth } from '../contexts/AuthContext';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
const STORAGE_KEY = 'companion_state_v1';

// How often the bubble's whisper refreshes while the app is foregrounded.
const WHISPER_POLL_MS = 60 * 60 * 1000; // 1h

export interface CompanionState {
  companion: string | null;       // guide name (e.g. "Aqua"), null = none picked
  whisper: string | null;         // most recent whisper line
  whisper_at: string | null;      // ISO timestamp from server (or local refresh)
}

const EMPTY: CompanionState = { companion: null, whisper: null, whisper_at: null };

export function useCompanionGuide() {
  const { isAuthenticated, isPremium, authToken } = useAuth();
  const [state, setState] = useState<CompanionState>(EMPTY);
  const [loading, setLoading] = useState(true);
  const pollTimer = useRef<any>(null);

  const headers = useCallback(
    () => ({
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    }),
    [authToken],
  );

  // ---- Local persistence (so the bubble doesn't flash empty on cold start) -
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && parsed.companion) setState(parsed);
        }
      } catch {}
    })();
  }, []);

  const persist = useCallback(async (next: CompanionState) => {
    setState(next);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {}
  }, []);

  // ---- Server sync ---------------------------------------------------------
  const refresh = useCallback(async () => {
    if (!isAuthenticated || !authToken) {
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`${BACKEND_URL}/api/companion-guide`, {
        headers: headers(),
      });
      if (!res.ok) {
        await persist(EMPTY);
        return;
      }
      const data = await res.json();
      await persist({
        companion: data.companion || null,
        whisper: data.whisper || null,
        whisper_at: data.whisper_at || null,
      });
    } catch (e) {
      // Soft fail — keep local cache
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, authToken, headers, persist]);

  // Initial load + on auth change
  useEffect(() => {
    refresh();
  }, [refresh]);

  // ---- Whisper polling -----------------------------------------------------
  const fetchNewWhisper = useCallback(async () => {
    if (!isAuthenticated || !authToken || !state.companion) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/companion-guide/whisper`, {
        headers: headers(),
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data?.whisper) {
        await persist({
          ...state,
          whisper: data.whisper,
          whisper_at: new Date().toISOString(),
        });
      }
    } catch {}
  }, [isAuthenticated, authToken, state, headers, persist]);

  useEffect(() => {
    if (!state.companion || !isPremium) return;

    // Poll whisper every hour
    pollTimer.current = setInterval(fetchNewWhisper, WHISPER_POLL_MS);

    // Also refresh when app comes back to foreground after long pause
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') {
        const lastAt = state.whisper_at ? new Date(state.whisper_at).getTime() : 0;
        if (Date.now() - lastAt > WHISPER_POLL_MS) fetchNewWhisper();
      }
    });

    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current);
      sub.remove();
    };
  }, [state.companion, state.whisper_at, isPremium, fetchNewWhisper]);

  // ---- Mutations -----------------------------------------------------------
  const select = useCallback(
    async (guideName: string): Promise<{ ok: boolean; error?: string }> => {
      if (!authToken) return { ok: false, error: 'Not signed in' };
      try {
        const res = await fetch(`${BACKEND_URL}/api/companion-guide`, {
          method: 'PUT',
          headers: headers(),
          body: JSON.stringify({ guide_name: guideName }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          return { ok: false, error: data?.detail || 'Could not save Companion.' };
        }
        await persist({
          companion: data.companion,
          whisper: data.whisper,
          whisper_at: new Date().toISOString(),
        });
        return { ok: true };
      } catch (e: any) {
        return { ok: false, error: 'Network error.' };
      }
    },
    [authToken, headers, persist],
  );

  const clear = useCallback(async () => {
    if (!authToken) return;
    try {
      await fetch(`${BACKEND_URL}/api/companion-guide`, {
        method: 'DELETE',
        headers: headers(),
      });
    } catch {}
    await persist(EMPTY);
  }, [authToken, headers, persist]);

  // Sends the user an email FROM their Companion Guide (one-way).
  // Rate-limited to once every 30 minutes server-side.
  const emailMe = useCallback(async (): Promise<{
    ok: boolean;
    error?: string;
    sent_to?: string;
  }> => {
    if (!authToken) return { ok: false, error: 'Not signed in' };
    if (!state.companion) return { ok: false, error: 'No Companion selected' };
    try {
      const res = await fetch(`${BACKEND_URL}/api/companion-guide/email-me`, {
        method: 'POST',
        headers: headers(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { ok: false, error: data?.detail || 'Could not send email.' };
      }
      // Refresh local state so the newly-generated whisper shows in the bubble too
      if (data?.whisper) {
        await persist({
          ...state,
          whisper: data.whisper,
          whisper_at: new Date().toISOString(),
        });
      }
      return { ok: true, sent_to: data?.sent_to };
    } catch {
      return { ok: false, error: 'Network error.' };
    }
  }, [authToken, headers, state, persist]);

  return {
    state,
    loading,
    refresh,
    fetchNewWhisper,
    select,
    clear,
    emailMe,
  };
}

export default useCompanionGuide;
