/**
 * My Circle screen — `/my-circle`
 *
 * Shows two sections:
 *   1) PENDING INVITES — incoming circle invites awaiting my response
 *      (Accept / Decline buttons inline)
 *   2) MY CIRCLE — mutual members I've connected with. Each row links to
 *      their profile page.
 *
 * Reachable from the drawer (added in _layout.tsx right under "Users").
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';

import { useAuth } from '../contexts/AuthContext';
import { CosmicBackdrop } from '../components/ui';

const API = process.env.EXPO_PUBLIC_BACKEND_URL;

interface Invite {
  id: string;
  from: { user_id?: string; name?: string; display_name?: string; picture?: string };
  created_at: string;
}
interface Member {
  user_id: string;
  name: string;
  picture?: string;
  is_premium?: boolean;
  is_admin?: boolean;
  bio?: string;
}

export default function MyCircleScreen() {
  const router = useRouter();
  const { authToken } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionBusy, setActionBusy] = useState<string | null>(null);

  const auth = authToken ? { Authorization: `Bearer ${authToken}` } : {};

  const load = useCallback(async () => {
    if (!authToken) return;
    try {
      const [mRes, iRes] = await Promise.all([
        fetch(`${API}/api/circle/members`, { headers: auth }),
        fetch(`${API}/api/circle/invites`, { headers: auth }),
      ]);
      const mData = mRes.ok ? await mRes.json() : { members: [] };
      const iData = iRes.ok ? await iRes.json() : { invites: [] };
      setMembers(Array.isArray(mData.members) ? mData.members : []);
      setInvites(Array.isArray(iData.invites) ? iData.invites : []);
    } catch (e) {
      console.warn('[MyCircle] load failed', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [authToken]);

  useEffect(() => { load(); }, [load]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const respondTo = async (invite: Invite, action: 'accept' | 'decline') => {
    setActionBusy(invite.id);
    try {
      await fetch(`${API}/api/circle/invite/${invite.id}/${action}`, {
        method: 'POST',
        headers: auth,
      });
    } finally {
      setActionBusy(null);
      load();
    }
  };

  return (
    <CosmicBackdrop>
      <SafeAreaView style={styles.flex} edges={['bottom']}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fbbf24" />}
        >
          <Text style={styles.title}>My Circle</Text>
          <Text style={styles.subtitle}>Your curated companions on this path.</Text>

          {loading ? (
            <View style={styles.centerPad}>
              <ActivityIndicator size="large" color="#fbbf24" />
            </View>
          ) : (
            <>
              {/* Pending invites */}
              {invites.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>
                    Pending invites — {invites.length}
                  </Text>
                  {invites.map((inv) => {
                    const senderName =
                      inv.from.display_name || inv.from.name || 'A seeker';
                    return (
                      <View key={inv.id} style={styles.inviteCard}>
                        {inv.from.picture ? (
                          <Image source={{ uri: inv.from.picture }} style={styles.avatar} />
                        ) : (
                          <View style={[styles.avatar, styles.avatarFallback]}>
                            <Text style={styles.avatarInitial}>{senderName[0]?.toUpperCase()}</Text>
                          </View>
                        )}
                        <View style={{ flex: 1 }}>
                          <Text style={styles.inviteName}>{senderName}</Text>
                          <Text style={styles.inviteHint}>wants to add you to their Circle</Text>
                        </View>
                        {actionBusy === inv.id ? (
                          <ActivityIndicator color="#fbbf24" />
                        ) : (
                          <View style={styles.inviteBtns}>
                            <TouchableOpacity
                              onPress={() => respondTo(inv, 'accept')}
                              style={[styles.inviteBtn, styles.inviteAccept]}
                            >
                              <Ionicons name="checkmark" size={14} color="#1a0033" />
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => respondTo(inv, 'decline')}
                              style={[styles.inviteBtn, styles.inviteDecline]}
                            >
                              <Ionicons name="close" size={14} color="#fff" />
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              )}

              {/* Members */}
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>
                  {members.length} {members.length === 1 ? 'member' : 'members'}
                </Text>
                {members.length === 0 ? (
                  <View style={styles.empty}>
                    <Ionicons name="people-circle-outline" size={56} color="rgba(255,255,255,0.25)" />
                    <Text style={styles.emptyText}>Your Circle is empty.</Text>
                    <Text style={styles.emptyHint}>
                      Visit the Users directory, tap a profile, and send a Circle invite.
                    </Text>
                    <TouchableOpacity
                      onPress={() => router.push('/users' as any)}
                      style={styles.discoverBtn}
                    >
                      <Ionicons name="search" size={14} color="#1a0033" />
                      <Text style={styles.discoverBtnText}>Discover Members</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  members.map((m) => (
                    <TouchableOpacity
                      key={m.user_id}
                      style={styles.memberRow}
                      onPress={() => router.push(`/profile/${m.user_id}` as any)}
                      activeOpacity={0.7}
                    >
                      {m.picture ? (
                        <Image source={{ uri: m.picture }} style={styles.avatar} />
                      ) : (
                        <View style={[styles.avatar, styles.avatarFallback]}>
                          <Text style={styles.avatarInitial}>{m.name[0]?.toUpperCase()}</Text>
                        </View>
                      )}
                      <View style={{ flex: 1 }}>
                        <View style={styles.memberNameRow}>
                          <Text style={styles.memberName}>{m.name}</Text>
                          {m.is_premium && (
                            <Ionicons name="diamond" size={11} color="#fbbf24" />
                          )}
                          {m.is_admin && (
                            <Ionicons name="shield" size={11} color="#7c3aed" />
                          )}
                        </View>
                        {!!m.bio && (
                          <Text numberOfLines={2} style={styles.memberBio}>{m.bio}</Text>
                        )}
                      </View>
                      <Ionicons name="chevron-forward" size={18} color="rgba(159,122,234,0.7)" />
                    </TouchableOpacity>
                  ))
                )}
              </View>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </CosmicBackdrop>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { padding: 16, paddingBottom: 40 },
  title: { color: '#fbbf24', fontSize: 26, fontWeight: '800' },
  subtitle: { color: '#cbb6ff', fontSize: 13, marginTop: 4, marginBottom: 16 },
  centerPad: { paddingVertical: 40, alignItems: 'center' },

  section: { marginBottom: 22 },
  sectionLabel: {
    color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10,
  },

  inviteCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 12, borderRadius: 12, marginBottom: 8,
    backgroundColor: 'rgba(251,191,36,0.08)',
    borderWidth: 1, borderColor: 'rgba(251,191,36,0.35)',
  },
  inviteName: { color: '#e9d5ff', fontSize: 14, fontWeight: '700' },
  inviteHint: { color: '#cbb6ff', fontSize: 12, marginTop: 1 },
  inviteBtns: { flexDirection: 'row', gap: 6 },
  inviteBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  inviteAccept: { backgroundColor: '#fbbf24' },
  inviteDecline: { backgroundColor: 'rgba(239,68,68,0.7)' },

  memberRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 11, borderRadius: 12, marginBottom: 6,
    backgroundColor: 'rgba(15,5,35,0.6)',
    borderWidth: 1, borderColor: 'rgba(159,122,234,0.2)',
  },
  memberNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  memberName: { color: '#e9d5ff', fontSize: 14, fontWeight: '700' },
  memberBio: { color: 'rgba(203,182,255,0.7)', fontSize: 11, marginTop: 2 },

  avatar: { width: 42, height: 42, borderRadius: 21 },
  avatarFallback: { backgroundColor: '#1a0033', alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { color: '#fbbf24', fontSize: 16, fontWeight: '800' },

  empty: { alignItems: 'center', padding: 24, gap: 6 },
  emptyText: { color: 'rgba(255,255,255,0.7)', fontSize: 14, fontWeight: '600' },
  emptyHint: { color: 'rgba(255,255,255,0.45)', fontSize: 12, textAlign: 'center', marginBottom: 8 },
  discoverBtn: {
    marginTop: 4, flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10,
    backgroundColor: '#fbbf24',
  },
  discoverBtnText: { color: '#1a0033', fontWeight: '800', fontSize: 13 },
});
