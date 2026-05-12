/**
 * useDMUnread - Polls /api/messages/unread-count every 30s and exposes the badge value.
 * Also auto-refreshes when a WebSocket message event arrives.
 */
import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import useDMSocket from './useDMSocket';

export function useDMUnread(enabled: boolean = true) {
  const [unread, setUnread] = useState(0);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    try {
      const token = await AsyncStorage.getItem('session_token');
      if (!token) {
        setUnread(0);
        return;
      }
      const r = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/messages/unread-count`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) {
        const data = await r.json();
        setUnread(data.unread || 0);
      }
    } catch {
      // ignore
    }
  }, [enabled]);

  useEffect(() => {
    refresh();
    if (!enabled) return;
    const id = setInterval(refresh, 30000);
    return () => clearInterval(id);
  }, [enabled, refresh]);

  useDMSocket((evt) => {
    if (evt.type === 'message' || evt.type === 'read' || evt.type === 'message_sent') {
      refresh();
    }
  });

  return { unread, refresh };
}

export default useDMUnread;
