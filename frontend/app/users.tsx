/**
 * Users — directory of all members. Tapping someone opens (or creates) a DM
 * thread with them. Reachable from the nav drawer; intentionally hidden from
 * the home grid.
 */
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Image,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import { CosmicBackdrop } from '../components/ui';

interface UserBrief {
  user_id: string;
  name: string;
  email?: string;
  picture?: string;
  is_admin?: boolean;
  is_premium?: boolean;
}

const API = process.env.EXPO_PUBLIC_BACKEND_URL;

export default function UsersScreen() {
  const router = useRouter();
  const { authToken, isPremium } = useAuth();
  const [users, setUsers] = useState<UserBrief[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [starting, setStarting] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    if (!authToken) {
      // Don't flash a misleading empty state if auth hasn't hydrated yet
      return;
    }
    setFetchError(null);
    try {
      const r = await fetch(`${API}/api/messages/users`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (!r.ok) {
        setFetchError(
          r.status === 401
            ? 'Your session expired. Please sign in again.'
            : `Couldn't load members (error ${r.status}).`,
        );
        return;
      }
      const data = await r.json();
      const list = Array.isArray(data.users) ? data.users : [];
      console.log(`[UsersScreen] Loaded ${list.length} members`);
      setUsers(list);
    } catch (err) {
      console.warn('Users fetch failed', err);
      setFetchError("Couldn't reach the server. Check your connection and pull down to retry.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [authToken]);

  // Initial / token-change fetch
  useEffect(() => {
    if (authToken) fetchUsers();
  }, [authToken, fetchUsers]);

  // Refetch every time the screen gains focus (e.g. user navigates here via
  // drawer after a prior visit). This prevents the "stale empty list" bug
  // where the screen was opened before authToken was hydrated and never
  // recovered until full app reload.
  useFocusEffect(
    useCallback(() => {
      if (authToken) fetchUsers();
    }, [authToken, fetchUsers]),
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchUsers();
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        (u.name || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q)
    );
  }, [users, query]);

  const openThread = async (recipient: UserBrief) => {
    if (starting) return;
    // Only premium users may initiate a new thread (matches backend rule)
    if (!isPremium) {
      Alert.alert(
        'Subscription Required',
        'Starting a new conversation requires an active subscription.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Upgrade', onPress: () => router.push('/settings') },
        ]
      );
      return;
    }
    setStarting(recipient.user_id);
    try {
      const r = await fetch(`${API}/api/messages/threads`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ recipient_id: recipient.user_id }),
      });
      if (r.ok) {
        const t = await r.json();
        const tid = t.thread_id || t.id || t._id;
        if (tid) {
          router.push(`/messages/${tid}`);
        } else {
          Alert.alert('Error', 'Could not open conversation.');
        }
      } else {
        const err = await r.json().catch(() => ({}));
        Alert.alert('Cannot Start', err.detail || 'Unable to open conversation.');
      }
    } catch (err) {
      Alert.alert('Network Error', 'Please try again in a moment.');
    } finally {
      setStarting(null);
    }
  };

  const initial = (name?: string) => (name?.trim()?.[0] || '?').toUpperCase();

  const renderRow = ({ item }: { item: UserBrief }) => (
    <TouchableOpacity
      style={styles.row}
      onPress={() => openThread(item)}
      activeOpacity={0.75}
      disabled={!!starting}
    >
      {item.picture ? (
        <Image source={{ uri: item.picture }} style={styles.avatar} />
      ) : (
        <View style={[styles.avatar, styles.avatarPlaceholder]}>
          <Text style={styles.avatarLetter}>{initial(item.name)}</Text>
        </View>
      )}
      <View style={styles.rowText}>
        <View style={styles.rowNameLine}>
          <Text style={styles.rowName} numberOfLines={1}>
            {item.name}
          </Text>
          {item.is_admin && (
            <View style={styles.adminTag}>
              <Text style={styles.adminTagText}>ADMIN</Text>
            </View>
          )}
        </View>
        {!!item.email && (
          <Text style={styles.rowEmail} numberOfLines={1}>
            {item.email}
          </Text>
        )}
      </View>
      {starting === item.user_id ? (
        <ActivityIndicator size="small" color="#fbbf24" />
      ) : (
        <Ionicons name="chatbubble-ellipses" size={20} color="#fbbf24" />
      )}
    </TouchableOpacity>
  );

  return (
    <CosmicBackdrop>
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <View style={styles.header}>
          <View style={styles.searchBox}>
            <Ionicons name="search" size={16} color="rgba(255,255,255,0.55)" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search members…"
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={query}
              onChangeText={setQuery}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {!!query && (
              <TouchableOpacity onPress={() => setQuery('')} hitSlop={8}>
                <Ionicons name="close-circle" size={16} color="rgba(255,255,255,0.55)" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#fbbf24" />
          </View>
        ) : fetchError ? (
          <View style={styles.center}>
            <Ionicons name="cloud-offline" size={48} color="rgba(255,255,255,0.45)" />
            <Text style={styles.emptyText}>{fetchError}</Text>
            <TouchableOpacity
              style={styles.retryBtn}
              onPress={() => {
                setLoading(true);
                fetchUsers();
              }}
            >
              <Ionicons name="refresh" size={16} color="#1a0033" />
              <Text style={styles.retryBtnText}>Try again</Text>
            </TouchableOpacity>
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.center}>
            <Ionicons name="people-outline" size={48} color="rgba(255,255,255,0.35)" />
            <Text style={styles.emptyText}>
              {query ? 'No members match your search.' : 'No other members yet.'}
            </Text>
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.user_id}
            renderItem={renderRow}
            ItemSeparatorComponent={() => <View style={styles.sep} />}
            contentContainerStyle={styles.list}
            ListHeaderComponent={
              <Text style={styles.countLabel}>
                {filtered.length} {filtered.length === 1 ? 'member' : 'members'}
                {query ? ` matching "${query}"` : ''}
              </Text>
            }
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor="#fbbf24"
              />
            }
          />
        )}
      </SafeAreaView>
    </CosmicBackdrop>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  countLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: 8,
    marginLeft: 4,
  },
  retryBtn: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#fbbf24',
  },
  retryBtnText: { color: '#1a0033', fontWeight: '700', fontSize: 13 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(251,191,36,0.3)',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 42,
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
    paddingVertical: 0,
  },
  list: { paddingHorizontal: 16, paddingBottom: 32 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(124,58,237,0.4)',
  },
  avatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.5)',
  },
  avatarLetter: { color: '#fbbf24', fontWeight: '800', fontSize: 18 },
  rowText: { flex: 1, minWidth: 0 },
  rowNameLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowName: { color: '#fff', fontSize: 15, fontWeight: '600', flexShrink: 1 },
  rowEmail: { color: 'rgba(255,255,255,0.55)', fontSize: 12, marginTop: 1 },
  adminTag: {
    backgroundColor: 'rgba(251,191,36,0.18)',
    borderColor: 'rgba(251,191,36,0.5)',
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  adminTagText: { color: '#fbbf24', fontSize: 9, fontWeight: '800', letterSpacing: 0.6 },
  sep: { height: 1, backgroundColor: 'rgba(255,255,255,0.06)' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 32 },
  emptyText: { color: 'rgba(255,255,255,0.6)', textAlign: 'center' },
});
