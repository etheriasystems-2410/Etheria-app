/**
 * Profile screen — `/profile/[id]`
 *
 * Used for BOTH "my profile" and other users' profiles. When viewing yourself,
 * an "Edit Profile" button toggles edit mode (a separate save button only
 * appears in edit mode). When viewing others, four action buttons appear:
 *   ✉️  Email (server forwards to their hidden signup email)
 *   📜  Direct Mail (in-app letter)
 *   💬  Instant Messaging (existing DM threads)
 *   ➕  Add to Circle (sends a circle invite; recipient must accept)
 *
 * Sticky pieces:
 * - Bio / Birthday / Location / Favorite Guide / Psychic Interests (tags)
 * - Member-since timestamp, premium badge, admin badge.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';

import { useAuth } from '../../contexts/AuthContext';
import { CosmicBackdrop } from '../../components/ui';
import {
  Chip,
  Field,
  INTEREST_SUGGESTIONS,
} from '../../components/profile/ProfileSubcomponents';
import ComposeModal, {
  ComposeMode,
} from '../../components/profile/ComposeModal';
import ProfileHeader from '../../components/profile/ProfileHeader';
import PathCard from '../../components/profile/PathCard';
import PsychicCard from '../../components/profile/PsychicCard';
import ProgressCard from '../../components/profile/ProgressCard';
import ActionsCard from '../../components/profile/ActionsCard';
import type { Profile } from '../../components/profile/types';

const API = process.env.EXPO_PUBLIC_BACKEND_URL;

export default function ProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { authToken, user: me, isPremium } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionBusy, setActionBusy] = useState<string | null>(null);

  // Form state (only used in edit mode)
  const [form, setForm] = useState<Profile | null>(null);

  // Compose-modal state
  const [composeMode, setComposeMode] = useState<ComposeMode | null>(null);
  const [composeSending, setComposeSending] = useState(false);

  const targetId = (id || '').toString();
  const myId = (me as any)?.user_id || (me as any)?.id;
  const isSelf = !!myId && targetId === myId;

  const auth = useMemo(
    () => ({ Authorization: authToken ? `Bearer ${authToken}` : '' }),
    [authToken],
  );

  const load = useCallback(async () => {
    if (!authToken || !targetId) return;
    try {
      const r = await fetch(
        isSelf ? `${API}/api/profile/me` : `${API}/api/profile/${targetId}`,
        { headers: auth },
      );
      if (!r.ok) {
        setProfile(null);
        return;
      }
      const data = await r.json();
      setProfile(data);
      setForm(data);
    } catch (e) {
      console.warn('[Profile] load failed', e);
    } finally {
      setLoading(false);
    }
  }, [authToken, targetId, isSelf, auth]);

  useEffect(() => { load(); }, [load]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  // -------- Save profile (self only) ---------------------------------------
  const handleSave = async () => {
    if (!form) return;
    setSaving(true);
    try {
      const body = {
        name: form.name,
        bio: form.bio || '',
        birthday: form.birthday || '',
        location: form.location || '',
        favorite_guide: form.favorite_guide || '',
        psychic_interests: form.psychic_interests || [],
      };
      const r = await fetch(`${API}/api/profile/me`, {
        method: 'PUT',
        headers: { ...auth, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.detail || 'Save failed');
      setEditing(false);
      await load();
    } catch (e: any) {
      Alert.alert('Could not save', e.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // -------- Avatar picker (self only) --------------------------------------
  const pickAvatar = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission needed',
          'Etheria needs access to your photos to set a profile picture.',
        );
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
        base64: true,
      });
      if (result.canceled || !result.assets?.[0]?.base64) return;

      const base64 = `data:image/jpeg;base64,${result.assets[0].base64}`;
      // Optimistically update form & profile
      setForm((f) => (f ? { ...f, picture: base64 } : f));
      setProfile((p) => (p ? { ...p, picture: base64 } : p));

      const r = await fetch(`${API}/api/profile/me`, {
        method: 'PUT',
        headers: { ...auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({ picture: base64 }),
      });
      if (!r.ok) throw new Error('Upload failed');
    } catch (e: any) {
      Alert.alert('Could not update photo', e?.message || 'Please try again.');
    }
  };

  // -------- Action buttons (other users) -----------------------------------
  const sendCompose = async (subject: string, body: string) => {
    if (!profile || !composeMode) return;
    if (!subject.trim() || !body.trim()) {
      Alert.alert('Missing fields', 'Subject and body are required.');
      return;
    }
    setComposeSending(true);
    try {
      const url =
        composeMode === 'email'
          ? `${API}/api/profile/${profile.user_id}/email`
          : `${API}/api/direct-mail`;
      const payload =
        composeMode === 'email'
          ? { subject, body }
          : { to_user_id: profile.user_id, subject, body };
      const r = await fetch(url, {
        method: 'POST',
        headers: { ...auth, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.detail || 'Send failed');
      setComposeMode(null);
      Alert.alert(
        '✨ Sent',
        composeMode === 'email'
          ? `Your email is on its way to ${profile.name}.`
          : `Your letter is now in ${profile.name}'s inbox.`,
      );
    } catch (e: any) {
      Alert.alert('Could not send', e.message || 'Please try again.');
    } finally {
      setComposeSending(false);
    }
  };

  const openDM = async () => {
    if (!profile) return;
    if (!isPremium) {
      Alert.alert(
        'Subscription Required',
        'Starting a new conversation requires an active subscription.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Upgrade', onPress: () => router.push('/settings') },
        ],
      );
      return;
    }
    setActionBusy('dm');
    try {
      const r = await fetch(`${API}/api/messages/threads`, {
        method: 'POST',
        headers: { ...auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient_id: profile.user_id }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.detail || 'Could not open chat');
      router.push(`/messages/${data.thread_id || data.id}` as any);
    } catch (e: any) {
      Alert.alert('Could not open chat', e.message || 'Please try again.');
    } finally {
      setActionBusy(null);
    }
  };

  const sendCircleInvite = async () => {
    if (!profile) return;
    setActionBusy('circle');
    try {
      const r = await fetch(`${API}/api/circle/invite/${profile.user_id}`, {
        method: 'POST',
        headers: auth,
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.detail || 'Could not send invite');
      const niceMessage =
        data.status === 'sent' ? `Invite sent to ${profile.name}. They'll be added once they accept.` :
        data.status === 'already_pending' ? 'An invite is already pending between you two.' :
        data.status === 'already_in_circle' ? `${profile.name} is already in your Circle.` :
        'Sent.';
      Alert.alert('Circle', niceMessage);
      load();
    } catch (e: any) {
      Alert.alert('Could not send invite', e.message || 'Please try again.');
    } finally {
      setActionBusy(null);
    }
  };

  const removeFromCircle = async () => {
    if (!profile) return;
    Alert.alert(
      'Remove from Circle?',
      `${profile.name} will be removed from your Circle. They will also no longer have you in theirs.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            await fetch(`${API}/api/circle/members/${profile.user_id}`, {
              method: 'DELETE',
              headers: auth,
            });
            load();
          },
        },
      ],
    );
  };

  // -------- Render ----------------------------------------------------------
  if (loading) {
    return (
      <CosmicBackdrop>
        <SafeAreaView style={styles.flex}>
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#fbbf24" />
          </View>
        </SafeAreaView>
      </CosmicBackdrop>
    );
  }
  if (!profile) {
    return (
      <CosmicBackdrop>
        <SafeAreaView style={styles.flex}>
          <View style={styles.center}>
            <Ionicons name="person-circle-outline" size={48} color="rgba(255,255,255,0.4)" />
            <Text style={styles.emptyText}>Profile not found.</Text>
            <TouchableOpacity onPress={() => router.back()} style={styles.retryBtn}>
              <Text style={styles.retryBtnText}>Go back</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </CosmicBackdrop>
    );
  }

  const memberSince = profile.created_at
    ? new Date(profile.created_at).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
    : null;

  // Use form values while editing so changes feel live
  const view = editing && form ? form : profile;

  return (
    <CosmicBackdrop>
      <SafeAreaView style={styles.flex} edges={['bottom']}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
          >
            {/* Top row: back + (Edit/Save) */}
            <View style={styles.topRow}>
              <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <Ionicons name="arrow-back" size={22} color="#e9d5ff" />
              </TouchableOpacity>
              {isSelf && !editing && (
                <TouchableOpacity onPress={() => setEditing(true)} style={styles.editBtn}>
                  <Ionicons name="create" size={14} color="#fbbf24" />
                  <Text style={styles.editBtnText}>Edit Profile</Text>
                </TouchableOpacity>
              )}
              {isSelf && editing && (
                <TouchableOpacity
                  onPress={handleSave}
                  disabled={saving}
                  style={[styles.editBtn, styles.saveBtn, saving && { opacity: 0.6 }]}
                >
                  {saving ? <ActivityIndicator size="small" color="#1a0033" /> : (
                    <>
                      <Ionicons name="checkmark" size={14} color="#1a0033" />
                      <Text style={[styles.editBtnText, { color: '#1a0033' }]}>Save Profile Changes</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>

            {/* Avatar + name + badges */}
            <ProfileHeader
              view={view}
              form={form}
              setForm={setForm}
              editing={editing}
              isSelf={isSelf}
              memberSince={memberSince}
              onPickAvatar={pickAvatar}
            />

            {/* About Me (was "Bio") */}
            <Field
              label="About Me"
              icon="book"
              editing={editing}
              value={view.bio || ''}
              placeholder={isSelf ? 'Tell others about your spiritual path…' : 'No description yet.'}
              multiline
              onChange={(v: string) => setForm({ ...form!, bio: v })}
              maxLength={400}
            />

            {/* Birthday + Location side by side */}
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Field
                  label="Birthday"
                  icon="gift"
                  editing={editing}
                  value={view.birthday || ''}
                  placeholder={isSelf ? 'YYYY-MM-DD' : '—'}
                  onChange={(v: string) => setForm({ ...form!, birthday: v })}
                  maxLength={10}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Field
                  label="Location"
                  icon="location"
                  editing={editing}
                  value={view.location || ''}
                  placeholder={isSelf ? 'City, country' : '—'}
                  onChange={(v: string) => setForm({ ...form!, location: v })}
                  maxLength={80}
                />
              </View>
            </View>

            {/* Hobbies */}
            <Field
              label="Hobbies"
              icon="color-palette"
              editing={editing}
              value={view.hobbies || ''}
              placeholder={isSelf ? 'What you love doing…' : '—'}
              multiline
              onChange={(v: string) => setForm({ ...form!, hobbies: v })}
              maxLength={400}
            />

            {/* Favorite Things */}
            <Field
              label="Favorite Things"
              icon="heart"
              editing={editing}
              value={view.favorite_things || ''}
              placeholder={isSelf ? 'Things that make your soul sing' : '—'}
              multiline
              onChange={(v: string) => setForm({ ...form!, favorite_things: v })}
              maxLength={400}
            />

            {/* Dislikes */}
            <Field
              label="Stuff I Dislike"
              icon="close-circle"
              editing={editing}
              value={view.dislikes || ''}
              placeholder={isSelf ? 'Things that drain you' : '—'}
              multiline
              onChange={(v: string) => setForm({ ...form!, dislikes: v })}
              maxLength={400}
            />

            {/* ───── The Path I Walk (religion grouping) ───── */}
            <PathCard
              view={view}
              form={form}
              setForm={setForm}
              editing={editing}
              isSelf={isSelf}
            />

            {/* ───── Psychic talent disclosures ───── */}
            <PsychicCard
              view={view}
              form={form}
              setForm={setForm}
              editing={editing}
              isSelf={isSelf}
            />

            {/* Why Etheria */}
            <Field
              label="Why I Chose Etheria"
              icon="star"
              editing={editing}
              value={view.why_etheria || ''}
              placeholder={isSelf ? 'What drew you to this app?' : '—'}
              multiline
              onChange={(v: string) => setForm({ ...form!, why_etheria: v })}
              maxLength={600}
            />

            {/* ───── Progress (always shown for self; for others only when show_progress=true) ───── */}
            <ProgressCard
              view={view}
              form={form}
              setForm={setForm}
              editing={editing}
              isSelf={isSelf}
            />

            {/* Favorite Guide */}
            <Field
              label="Favorite Guide"
              icon="sparkles"
              editing={editing}
              value={view.favorite_guide || ''}
              placeholder={isSelf ? 'Aqua, Ignis, Selene…' : '—'}
              onChange={(v: string) => setForm({ ...form!, favorite_guide: v })}
              maxLength={60}
            />

            {/* Psychic Interests (chip multi-select) */}
            <View style={styles.fieldBlock}>
              <View style={styles.fieldLabelRow}>
                <Ionicons name="flame" size={14} color="#9f7aea" />
                <Text style={styles.fieldLabel}>Psychic Interests</Text>
              </View>
              <View style={styles.chipsRow}>
                {(view.psychic_interests || []).map((tag) => (
                  <Chip
                    key={tag}
                    label={tag}
                    active
                    onPress={editing ? () => {
                      setForm({
                        ...form!,
                        psychic_interests: (form!.psychic_interests || []).filter((t) => t !== tag),
                      });
                    } : undefined}
                  />
                ))}
                {(view.psychic_interests || []).length === 0 && !editing && (
                  <Text style={styles.emptyHint}>—</Text>
                )}
              </View>
              {editing && (
                <>
                  <Text style={[styles.emptyHint, { marginTop: 6 }]}>Tap to add (max 12):</Text>
                  <View style={styles.chipsRow}>
                    {INTEREST_SUGGESTIONS.filter(
                      (s) => !(form!.psychic_interests || []).includes(s),
                    ).map((s) => (
                      <Chip
                        key={s}
                        label={s}
                        onPress={() => {
                          const next = [...(form!.psychic_interests || []), s].slice(0, 12);
                          setForm({ ...form!, psychic_interests: next });
                        }}
                      />
                    ))}
                  </View>
                </>
              )}
            </View>

            {/* Action buttons (only for other users) */}
            {!isSelf && (
              <ActionsCard
                view={view}
                actionBusy={actionBusy}
                onEmail={() => setComposeMode('email')}
                onLetter={() => setComposeMode('dm-letter')}
                onDM={openDM}
                onCircleInvite={sendCircleInvite}
                onCircleRemove={removeFromCircle}
                onPendingInTap={() => router.push('/my-circle' as any)}
              />
            )}
          </ScrollView>
        </KeyboardAvoidingView>

        {/* Compose Modal */}
        <ComposeModal
          visible={composeMode !== null}
          mode={composeMode}
          recipientName={profile.name}
          sending={composeSending}
          onClose={() => setComposeMode(null)}
          onSend={sendCompose}
        />
      </SafeAreaView>
    </CosmicBackdrop>
  );
}

// ---------- Styles ----------------------------------------------------------
const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  scroll: { padding: 16, paddingBottom: 32 },
  emptyText: { color: 'rgba(255,255,255,0.6)' },
  retryBtn: {
    marginTop: 10, paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: 10, backgroundColor: '#fbbf24',
  },
  retryBtnText: { color: '#1a0033', fontWeight: '700' },

  topRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 14,
  },
  editBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10,
    backgroundColor: 'rgba(251,191,36,0.16)',
    borderWidth: 1, borderColor: 'rgba(251,191,36,0.5)',
  },
  editBtnText: { color: '#fbbf24', fontWeight: '700', fontSize: 12 },
  saveBtn: { backgroundColor: '#fbbf24', borderColor: '#fbbf24' },

  // Used inline (for the bottom Psychic Interests chip group)
  fieldBlock: { marginBottom: 14 },
  fieldLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 5 },
  fieldLabel: {
    color: '#cbb6ff', fontSize: 11, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  emptyHint: { color: 'rgba(233,213,255,0.45)', fontStyle: 'italic' },
  row: { flexDirection: 'row', gap: 10 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
});
