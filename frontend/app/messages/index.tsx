/**
 * Messages thread list screen.
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CosmicBackdrop, GlassCard } from '../../components/ui';
import { palette } from '../../theme/tokens';
import useDMSocket from '../../hooks/useDMSocket';

interface Thread {
  thread_id: string;
  other_user: { user_id: string; name: string; picture?: string };
  last_message_at: string;
  last_message_preview: string;
  unread_count: number;
}

export default function MessagesScreen() {
  const router = useRouter();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchThreads = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('session_token');
      const r = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/messages/threads`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await r.json();
      if (r.ok) setThreads(data.threads || []);
    } catch (e) {
      console.warn('[Messages] fetch threads failed', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchThreads();
    }, [fetchThreads])
  );

  useDMSocket((evt) => {
    if (evt.type === 'message' || evt.type === 'message_sent' || evt.type === 'read') {
      fetchThreads();
    }
  });

  const renderItem = ({ item }: { item: Thread }) => {
    const date = new Date(item.last_message_at);
    const dateStr = isNaN(date.getTime())
      ? ''
      : date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    return (
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => router.push(`/messages/${item.thread_id}` as any)}
        style={{ marginBottom: 10 }}
      >
        <GlassCard variant={item.unread_count > 0 ? 'gold' : 'default'}>
          <View style={styles.row}>
            <View style={styles.avatar}>
              <Ionicons name="person" size={20} color={palette.gold} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.nameRow}>
                <Text style={styles.name} numberOfLines={1}>
                  {item.other_user?.name || 'Seeker'}
                </Text>
                <Text style={styles.date}>{dateStr}</Text>
              </View>
              <Text
                style={[styles.preview, item.unread_count > 0 && styles.previewUnread]}
                numberOfLines={1}
              >
                {item.last_message_preview || 'Start the conversation…'}
              </Text>
            </View>
            {item.unread_count > 0 && (
              <View style={styles.unreadBubble}>
                <Text style={styles.unreadText}>{item.unread_count}</Text>
              </View>
            )}
          </View>
        </GlassCard>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <CosmicBackdrop />
      <View style={styles.header}>
        <Text style={styles.headerEyebrow}>✦ Direct Messages ✦</Text>
        <Text style={styles.headerTitle}>Messages</Text>
        <View style={styles.glyphRow}>
          <View style={styles.glyphLine} />
          <Ionicons name="sparkles" size={11} color={palette.gold} style={{ marginHorizontal: 8 }} />
          <View style={styles.glyphLine} />
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color={palette.lavender} style={{ marginTop: 40 }} />
      ) : threads.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="chatbubbles-outline" size={48} color={palette.lavender} />
          <Text style={styles.emptyText}>No messages yet</Text>
          <Text style={styles.emptySub}>
            Open a fellow seeker's profile in the Community to start a conversation.
          </Text>
        </View>
      ) : (
        <FlatList
          data={threads}
          keyExtractor={(t) => t.thread_id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                fetchThreads();
              }}
              tintColor={palette.lavender}
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d0015' },
  header: { paddingTop: 16, paddingBottom: 12, paddingHorizontal: 16, alignItems: 'center' },
  headerEyebrow: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.4,
    color: palette.gold,
    marginBottom: 4,
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#fff' },
  glyphRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  glyphLine: { width: 30, height: 1, backgroundColor: 'rgba(251,191,36,0.55)' },
  list: { padding: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(251,191,36,0.15)',
    borderWidth: 1, borderColor: 'rgba(251,191,36,0.4)',
    alignItems: 'center', justifyContent: 'center',
  },
  nameRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { fontSize: 15, fontWeight: '700', color: palette.iceLavender, flex: 1 },
  date: { fontSize: 11, color: palette.mist, marginLeft: 8 },
  preview: { fontSize: 13, color: palette.mist, marginTop: 2 },
  previewUnread: { color: palette.iceLavender, fontWeight: '600' },
  unreadBubble: {
    backgroundColor: palette.gold,
    minWidth: 22, height: 22, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 6,
  },
  unreadText: { color: '#1a0033', fontSize: 11, fontWeight: '800' },
  empty: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, marginTop: 80, gap: 10 },
  emptyText: { fontSize: 16, color: palette.iceLavender, fontWeight: '600', marginTop: 8 },
  emptySub: { fontSize: 13, color: palette.mist, textAlign: 'center' },
});
