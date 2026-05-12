/**
 * useDMSocket - Maintains a WebSocket connection for direct message live updates.
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

type DMEvent =
  | { type: 'hello'; user_id: string }
  | { type: 'message'; thread_id: string; message: any }
  | { type: 'message_sent'; thread_id: string; message: any }
  | { type: 'read'; thread_id: string; by: string }
  | { type: 'ping' }
  | { type: 'pong' };

export function useDMSocket(onEvent: (e: DMEvent) => void) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeout = useRef<any>(null);
  const [connected, setConnected] = useState(false);

  const connect = useCallback(async () => {
    const token = await AsyncStorage.getItem('session_token');
    if (!token) return;
    const backend = process.env.EXPO_PUBLIC_BACKEND_URL || '';
    const wsUrl = backend.replace(/^http/, 'ws') + `/api/messages/ws?token=${encodeURIComponent(token)}`;
    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      ws.onopen = () => setConnected(true);
      ws.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data);
          onEvent(data);
        } catch {}
      };
      ws.onclose = () => {
        setConnected(false);
        wsRef.current = null;
        // auto-reconnect after 3s
        if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
        reconnectTimeout.current = setTimeout(connect, 3000);
      };
      ws.onerror = () => {
        try { ws.close(); } catch {}
      };
    } catch (e) {
      console.warn('[DM WS] connect failed', e);
    }
  }, [onEvent]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
      if (wsRef.current) {
        wsRef.current.onclose = null; // prevent reconnect on cleanup
        try { wsRef.current.close(); } catch {}
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { connected };
}

export default useDMSocket;
