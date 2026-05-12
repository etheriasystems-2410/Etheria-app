/**
 * Conversation screen — single DM thread.
 */
import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CosmicBackdrop } from '../../components/ui';
import { palette } from '../../theme/tokens';
import useDMSocket from '../../hooks/useDMSocket';

interface Message {
  id: string;
  sender_id: string;
  content: string;
  sent_at: string;
  read: boolean;
  mine: boolean;
}

export default function ConversationScreen() {
  const { threadId } = useLocalSearchParams<{ threadId: string }>();
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [otherUser, setOtherUser] = useState<any>(null);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const listRef = useRef<FlatList>(null);

  const apiBase = process.env.EXPO_PUBLIC_BACKEND_URL || '';

  const auth = useCallback(async () => {
    const token = await AsyncStorage.getItem('session_token');
    return { Authorization: `Bearer ${token}` };
  }, []);

  const fetchMessages = useCallback(async () => {
    try {
      const headers = await auth();
      const r = await fetch(`${apiBase}/api/messages/threads/${threadId}`, { headers });
      const data = await r.json();
      if (r.ok) {
        setMessages(data.messages || []);
        setOtherUser(data.other_user);
        // Mark thread read
        await fetch(`${apiBase}/api/messages/threads/${threadId}/read`, {
          method: 'POST',
          headers,
        });
      }
    } catch (e) {
      console.warn('[DM] fetch messages failed', e);
    } finally {
      setLoading(false);
    }
  }, [apiBase, auth, threadId]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  useDMSocket((evt) => {
    if ((evt.type === 'message' || evt.type === 'message_sent') && evt.thread_id === threadId) {
      const m = evt.message;
      setMessages((prev) => {
        // dedupe by id
        if (prev.find((x) => x.id === m.id)) return prev;
        return [...prev, { ...m, mine: m.sender_id !== otherUser?.user_id, read: true }];
      });
      // auto mark-read if it's an incoming message and the screen is open
      if (evt.type === 'message') {
        auth().then((headers) =>
          fetch(`${apiBase}/api/messages/threads/${threadId}/read`, { method: 'POST', headers })
        );
      }
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  });

  const send = async () => {
    const content = text.trim();
    if (!content || sending) return;
    setSending(true);
    const headers = await auth();
    try {
      const r = await fetch(`${apiBase}/api/messages/threads/${threadId}/send`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      if (r.ok) {
        setText('');
      } else {
        const err = await r.json();
        Alert.alert('Send failed', err.detail || 'Could not send message');
      }
    } catch (e) {
      Alert.alert('Send failed', 'Network error');
    } finally {
      setSending(false);
    }
  };

  const block = async () => {
    if (!otherUser?.user_id) return;
    Alert.alert(
      'Block this user?',
      'You will no longer receive messages from them.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            const headers = await auth();
            await fetch(`${apiBase}/api/messages/block/${otherUser.user_id}`, {
              method: 'POST',
              headers,
            });
            Alert.alert('Blocked', 'You will no longer receive messages from this user.');
            router.back();
          },
        },
      ]
    );
    setMenuOpen(false);
  };

  const report = async () => {
    setMenuOpen(false);
    Alert.prompt?.('Report this conversation', 'Reason (e.g. harassment, spam)', async (reason) => {
      if (!reason) return;
      const headers = await auth();
      await fetch(`${apiBase}/api/messages/threads/${threadId}/report`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      Alert.alert('Reported', 'Our moderators will review this conversation.');
    });
    // Fallback for platforms without Alert.prompt (Android/Web)
    if (!Alert.prompt) {
      const headers = await auth();
      await fetch(`${apiBase}/api/messages/threads/${threadId}/report`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'inappropriate' }),
      });
      Alert.alert('Reported', 'Our moderators will review this conversation.');
    }
  };

  const renderMessage = ({ item }: { item: Message }) => (
    <View style={[styles.bubbleRow, item.mine ? styles.mineRow : styles.theirsRow]}>
      <View style={[styles.bubble, item.mine ? styles.mineBubble : styles.theirsBubble]}>
        <Text style={item.mine ? styles.mineText : styles.theirsText}>{item.content}</Text>
        <Text style={styles.timeText}>
          {new Date(item.sent_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
        </Text>
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <CosmicBackdrop />
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} hitSlop={10}>
          <Ionicons name="chevron-back" size={22} color={palette.iceLavender} />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.title} numberOfLines={1}>{otherUser?.name || 'Seeker'}</Text>
        </View>
        <TouchableOpacity onPress={() => setMenuOpen((v) => !v)} style={styles.iconBtn} hitSlop={10}>
          <Ionicons name="ellipsis-vertical" size={20} color={palette.iceLavender} />
        </TouchableOpacity>
      </View>

      {menuOpen && (
        <View style={styles.menu}>
          <TouchableOpacity onPress={report} style={styles.menuItem}>
            <Ionicons name="flag" size={16} color={palette.gold} />
            <Text style={styles.menuText}>Report</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={block} style={styles.menuItem}>
            <Ionicons name="ban" size={16} color="#ef4444" />
            <Text style={[styles.menuText, { color: '#ef4444' }]}>Block</Text>
          </TouchableOpacity>
        </View>
      )}

      {loading ? (
        <ActivityIndicator color={palette.lavender} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.list}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={
            <View style={styles.emptyConv}>
              <Ionicons name="sparkles" size={32} color={palette.gold} />
              <Text style={styles.emptyConvText}>Say hello ✨</Text>
            </View>
          }
        />
      )}

      <View style={styles.inputBar}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Send a message…"
          placeholderTextColor={palette.mist}
          multiline
          maxLength={4000}
        />
        <TouchableOpacity
          onPress={send}
          disabled={!text.trim() || sending}
          style={[styles.sendBtn, (!text.trim() || sending) && { opacity: 0.5 }]}
        >
          {sending ? (
            <ActivityIndicator color="#1a0033" />
          ) : (
            <Ionicons name="send" size={18} color="#1a0033" />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d0015' },
  topBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 10, paddingTop: 14, paddingBottom: 10,
    borderBottomWidth: 1, borderBottomColor: 'rgba(183,148,246,0.15)',
  },
  iconBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  title: { fontSize: 16, fontWeight: '700', color: palette.iceLavender },
  menu: {
    position: 'absolute',
    top: 56, right: 8, zIndex: 10,
    backgroundColor: 'rgba(26,0,51,0.95)',
    borderRadius: 10, borderWidth: 1, borderColor: 'rgba(183,148,246,0.3)',
    paddingVertical: 4, minWidth: 130,
  },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10 },
  menuText: { fontSize: 14, color: palette.iceLavender, fontWeight: '500' },
  list: { padding: 12, paddingBottom: 24 },
  bubbleRow: { marginVertical: 4, flexDirection: 'row' },
  mineRow: { justifyContent: 'flex-end' },
  theirsRow: { justifyContent: 'flex-start' },
  bubble: {
    maxWidth: '76%',
    paddingVertical: 8, paddingHorizontal: 12,
    borderRadius: 16,
  },
  mineBubble: { backgroundColor: '#7c3aed', borderTopRightRadius: 4 },
  theirsBubble: { backgroundColor: 'rgba(45,27,78,0.85)', borderTopLeftRadius: 4, borderWidth: 1, borderColor: 'rgba(183,148,246,0.2)' },
  mineText: { color: '#fff', fontSize: 14, lineHeight: 19 },
  theirsText: { color: palette.iceLavender, fontSize: 14, lineHeight: 19 },
  timeText: { color: 'rgba(255,255,255,0.5)', fontSize: 10, marginTop: 4, alignSelf: 'flex-end' },
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    paddingHorizontal: 10, paddingTop: 10, paddingBottom: 14,
    borderTopWidth: 1, borderTopColor: 'rgba(183,148,246,0.15)',
    backgroundColor: 'rgba(13,0,21,0.95)',
  },
  input: {
    flex: 1, color: palette.iceLavender, fontSize: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10,
    maxHeight: 100,
    borderWidth: 1, borderColor: 'rgba(183,148,246,0.25)',
  },
  sendBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: palette.gold, alignItems: 'center', justifyContent: 'center',
  },
  emptyConv: { alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 8 },
  emptyConvText: { fontSize: 14, color: palette.mist },
});
