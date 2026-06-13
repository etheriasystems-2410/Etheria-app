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
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
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

const API = process.env.EXPO_PUBLIC_BACKEND_URL;

interface Profile {
  user_id: string;
  name: string;
  picture?: string;
  bio?: string;                                      // "About Me"
  birthday?: string;
  location?: string;
  favorite_guide?: string;
  psychic_interests?: string[];
  // Lifestyle
  hobbies?: string;
  favorite_things?: string;
  dislikes?: string;
  other_details?: string;
  // The Path I Walk
  path_walked?: string;
  in_coven?: boolean;
  coven_name?: string;
  deities_followed?: string;
  // Psychic disclosures
  family_has_psychic_talent?: boolean;
  family_psychic_details?: string;
  self_has_psychic_talent?: boolean;
  self_psychic_details?: string;
  // Story
  why_etheria?: string;
  // Progress visibility + stats
  show_progress?: boolean;
  stats?: {
    modules_completed: number;
    current_streak: number;
    longest_streak: number;
    total_cards_drawn: number;
    journal_entries: number;
    days_as_member: number;
  };
  created_at?: string;
  is_admin?: boolean;
  is_premium?: boolean;
  email?: string;
  circle_relationship?: 'none' | 'in_circle' | 'invite_pending_out' | 'invite_pending_in';
}

const INTEREST_SUGGESTIONS = [
  'Tarot', 'Astrology', 'Mediumship', 'Dreams', 'Aura Reading',
  'Energy Healing', 'Crystals', 'Numerology', 'Astral Travel',
  'Past Lives', 'Chakras', 'Clairvoyance',
];

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
  const [composeMode, setComposeMode] = useState<null | 'email' | 'dm-letter'>(null);
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
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

  // -------- Action buttons (other users) -----------------------------------
  const sendCompose = async () => {
    if (!profile || !composeMode) return;
    if (!composeSubject.trim() || !composeBody.trim()) {
      Alert.alert('Missing fields', 'Subject and body are required.');
      return;
    }
    setComposeSending(true);
    try {
      const url =
        composeMode === 'email'
          ? `${API}/api/profile/${profile.user_id}/email`
          : `${API}/api/direct-mail`;
      const body =
        composeMode === 'email'
          ? { subject: composeSubject, body: composeBody }
          : { to_user_id: profile.user_id, subject: composeSubject, body: composeBody };
      const r = await fetch(url, {
        method: 'POST',
        headers: { ...auth, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.detail || 'Send failed');
      setComposeMode(null);
      setComposeSubject('');
      setComposeBody('');
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
            <View style={styles.headerCard}>
              <Pressable
                onPress={isSelf && editing ? pickAvatar : undefined}
                disabled={!(isSelf && editing)}
              >
                {view.picture ? (
                  <Image source={{ uri: view.picture }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, styles.avatarFallback]}>
                    <Text style={styles.avatarInitial}>{(view.name || '?')[0]?.toUpperCase()}</Text>
                  </View>
                )}
                {isSelf && editing && (
                  <View style={styles.avatarEditBadge}>
                    <Ionicons name="camera" size={14} color="#1a0033" />
                  </View>
                )}
              </Pressable>
              {isSelf && editing && (
                <TouchableOpacity onPress={pickAvatar} style={styles.changePhotoBtn}>
                  <Text style={styles.changePhotoBtnText}>Change Photo</Text>
                </TouchableOpacity>
              )}
              {editing ? (
                <TextInput
                  value={view.name}
                  onChangeText={(t) => setForm({ ...form!, name: t })}
                  style={styles.nameInput}
                  placeholder="Display name"
                  placeholderTextColor="rgba(233,213,255,0.4)"
                  maxLength={60}
                />
              ) : (
                <Text style={styles.name}>{view.name}</Text>
              )}
              <View style={styles.badgesRow}>
                {view.is_admin && (
                  <View style={[styles.badge, styles.badgeAdmin]}>
                    <Ionicons name="shield" size={11} color="#fff" />
                    <Text style={styles.badgeText}>Admin</Text>
                  </View>
                )}
                {view.is_premium && (
                  <View style={[styles.badge, styles.badgePremium]}>
                    <Ionicons name="diamond" size={11} color="#1a0033" />
                    <Text style={[styles.badgeText, { color: '#1a0033' }]}>Premium</Text>
                  </View>
                )}
                {memberSince && (
                  <View style={[styles.badge, styles.badgeNeutral]}>
                    <Ionicons name="calendar" size={11} color="#cbb6ff" />
                    <Text style={[styles.badgeText, { color: '#cbb6ff' }]}>Member since {memberSince}</Text>
                  </View>
                )}
              </View>

              {/* Email (only visible on own profile) */}
              {isSelf && view.email && (
                <Text style={styles.emailHint}>{view.email}</Text>
              )}
            </View>

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
            <View style={styles.groupCard}>
              <View style={styles.groupHeader}>
                <Ionicons name="leaf" size={16} color="#fbbf24" />
                <Text style={styles.groupTitle}>The Path I Walk</Text>
              </View>

              <Field
                label="My Path"
                icon="compass"
                editing={editing}
                value={view.path_walked || ''}
                placeholder={isSelf ? 'Briefly describe your faith, walk, or religion' : '—'}
                multiline
                onChange={(v: string) => setForm({ ...form!, path_walked: v })}
                maxLength={400}
              />

              {/* In a coven / religious group? */}
              <View style={styles.boolRow}>
                <View style={styles.fieldLabelRow}>
                  <Ionicons name="people" size={14} color="#9f7aea" />
                  <Text style={styles.fieldLabel}>Am I in a coven or religious group?</Text>
                </View>
                {editing ? (
                  <Switch
                    value={!!view.in_coven}
                    onValueChange={(v) => setForm({ ...form!, in_coven: v })}
                    trackColor={{ false: '#3b1f5e', true: '#fbbf24' }}
                    thumbColor="#fff"
                  />
                ) : (
                  <Text style={styles.boolValue}>{view.in_coven ? 'Yes' : 'No'}</Text>
                )}
              </View>
              {(editing || view.in_coven) && (
                <Field
                  label="Group / Coven Name"
                  icon="bookmark"
                  editing={editing}
                  value={view.coven_name || ''}
                  placeholder={isSelf ? "Optional — the name of your group" : '—'}
                  onChange={(v: string) => setForm({ ...form!, coven_name: v })}
                  maxLength={120}
                />
              )}

              <Field
                label="Deities I Follow"
                icon="moon"
                editing={editing}
                value={view.deities_followed || ''}
                placeholder={isSelf ? 'Names of deities, spirits, or guides you honor' : '—'}
                multiline
                onChange={(v: string) => setForm({ ...form!, deities_followed: v })}
                maxLength={400}
              />
            </View>

            {/* ───── Psychic talent disclosures ───── */}
            <View style={styles.groupCard}>
              <View style={styles.groupHeader}>
                <Ionicons name="flash" size={16} color="#fbbf24" />
                <Text style={styles.groupTitle}>Psychic Gifts</Text>
              </View>

              <View style={styles.boolRow}>
                <View style={styles.fieldLabelRow}>
                  <Ionicons name="people-circle" size={14} color="#9f7aea" />
                  <Text style={styles.fieldLabel}>Do I have psychic talent in my family?</Text>
                </View>
                {editing ? (
                  <Switch
                    value={!!view.family_has_psychic_talent}
                    onValueChange={(v) => setForm({ ...form!, family_has_psychic_talent: v })}
                    trackColor={{ false: '#3b1f5e', true: '#fbbf24' }}
                    thumbColor="#fff"
                  />
                ) : (
                  <Text style={styles.boolValue}>{view.family_has_psychic_talent ? 'Yes' : 'No'}</Text>
                )}
              </View>
              {(editing || view.family_has_psychic_talent) && (
                <Field
                  label="Who & What (optional)"
                  icon="document-text"
                  editing={editing}
                  value={view.family_psychic_details || ''}
                  placeholder={isSelf ? 'If you wish to share — who, and what gifts?' : '—'}
                  multiline
                  onChange={(v: string) => setForm({ ...form!, family_psychic_details: v })}
                  maxLength={600}
                />
              )}

              <View style={styles.boolRow}>
                <View style={styles.fieldLabelRow}>
                  <Ionicons name="sparkles" size={14} color="#9f7aea" />
                  <Text style={styles.fieldLabel}>Do I have psychic talent of my own?</Text>
                </View>
                {editing ? (
                  <Switch
                    value={!!view.self_has_psychic_talent}
                    onValueChange={(v) => setForm({ ...form!, self_has_psychic_talent: v })}
                    trackColor={{ false: '#3b1f5e', true: '#fbbf24' }}
                    thumbColor="#fff"
                  />
                ) : (
                  <Text style={styles.boolValue}>{view.self_has_psychic_talent ? 'Yes' : 'No'}</Text>
                )}
              </View>
              {(editing || view.self_has_psychic_talent) && (
                <Field
                  label="Your Gifts (optional)"
                  icon="document-text"
                  editing={editing}
                  value={view.self_psychic_details || ''}
                  placeholder={isSelf ? 'If you wish to share — what gifts do you have?' : '—'}
                  multiline
                  onChange={(v: string) => setForm({ ...form!, self_psychic_details: v })}
                  maxLength={600}
                />
              )}
            </View>

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
            {view.stats && (
              <View style={styles.groupCard}>
                <View style={styles.groupHeader}>
                  <Ionicons name="trophy" size={16} color="#fbbf24" />
                  <Text style={styles.groupTitle}>Progress</Text>
                </View>

                <View style={styles.statsGrid}>
                  <StatTile icon="school" label="Modules completed" value={view.stats.modules_completed} />
                  <StatTile icon="flame" label="Current streak" value={`${view.stats.current_streak}d`} />
                  <StatTile icon="ribbon" label="Longest streak" value={`${view.stats.longest_streak}d`} />
                  <StatTile icon="sparkles" label="Cards drawn" value={view.stats.total_cards_drawn} />
                  <StatTile icon="book" label="Journal entries" value={view.stats.journal_entries} />
                  <StatTile icon="calendar" label="Days a member" value={view.stats.days_as_member} />
                </View>

                {isSelf && (
                  <View style={[styles.boolRow, { marginTop: 6, paddingTop: 8, borderTopWidth: 1, borderColor: 'rgba(251,191,36,0.18)' }]}>
                    <View style={styles.fieldLabelRow}>
                      <Ionicons name="eye" size={14} color="#9f7aea" />
                      <Text style={styles.fieldLabel}>Show progress on my public profile</Text>
                    </View>
                    {editing ? (
                      <Switch
                        value={view.show_progress !== false}
                        onValueChange={(v) => setForm({ ...form!, show_progress: v })}
                        trackColor={{ false: '#3b1f5e', true: '#fbbf24' }}
                        thumbColor="#fff"
                      />
                    ) : (
                      <Text style={styles.boolValue}>{view.show_progress === false ? 'Hidden' : 'Visible'}</Text>
                    )}
                  </View>
                )}
              </View>
            )}

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
              <View style={styles.actionsCard}>
                <Text style={styles.actionsTitle}>Reach out</Text>
                <View style={styles.actionGrid}>
                  <ActionTile
                    icon="mail"
                    label="Email"
                    sub="Server forwards to their inbox"
                    color="#fbbf24"
                    onPress={() => setComposeMode('email')}
                  />
                  <ActionTile
                    icon="document-text"
                    label="Direct Mail"
                    sub="In-app letter"
                    color="#9f7aea"
                    onPress={() => setComposeMode('dm-letter')}
                  />
                  <ActionTile
                    icon="chatbubbles"
                    label="Instant Message"
                    sub="Real-time chat"
                    color="#10b981"
                    onPress={openDM}
                    loading={actionBusy === 'dm'}
                  />
                  {view.circle_relationship === 'in_circle' ? (
                    <ActionTile
                      icon="people-circle"
                      label="In your Circle ✓"
                      sub="Tap to remove"
                      color="#ef4444"
                      onPress={removeFromCircle}
                    />
                  ) : view.circle_relationship === 'invite_pending_out' ? (
                    <ActionTile
                      icon="time"
                      label="Invite Pending"
                      sub="Awaiting response"
                      color="#6b7280"
                      onPress={() => {}}
                      disabled
                    />
                  ) : view.circle_relationship === 'invite_pending_in' ? (
                    <ActionTile
                      icon="mail-unread"
                      label="Invited You"
                      sub="Check My Circle"
                      color="#06b6d4"
                      onPress={() => router.push('/my-circle' as any)}
                    />
                  ) : (
                    <ActionTile
                      icon="person-add"
                      label="Add to Circle"
                      sub="They must accept"
                      color="#fbbf24"
                      onPress={sendCircleInvite}
                      loading={actionBusy === 'circle'}
                    />
                  )}
                </View>
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>

        {/* Compose Modal */}
        <Modal
          visible={composeMode !== null}
          transparent
          animationType="slide"
          onRequestClose={() => setComposeMode(null)}
        >
          <View style={styles.modalOverlay}>
            <KeyboardAvoidingView
              style={styles.modalSheet}
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {composeMode === 'email' ? `Email ${profile.name}` : `Write to ${profile.name}`}
                </Text>
                <TouchableOpacity onPress={() => setComposeMode(null)}>
                  <Ionicons name="close" size={22} color="#e9d5ff" />
                </TouchableOpacity>
              </View>
              <Text style={styles.modalHint}>
                {composeMode === 'email'
                  ? "Their email stays private. They'll be able to reply directly to you."
                  : 'Your letter will appear in their in-app inbox.'}
              </Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Subject"
                placeholderTextColor="rgba(233,213,255,0.4)"
                value={composeSubject}
                onChangeText={setComposeSubject}
                maxLength={140}
              />
              <TextInput
                style={[styles.modalInput, styles.modalBody]}
                placeholder="Write your message…"
                placeholderTextColor="rgba(233,213,255,0.4)"
                value={composeBody}
                onChangeText={setComposeBody}
                multiline
                maxLength={4000}
              />
              <TouchableOpacity
                style={[styles.modalSendBtn, composeSending && { opacity: 0.6 }]}
                onPress={sendCompose}
                disabled={composeSending}
              >
                {composeSending ? (
                  <ActivityIndicator color="#1a0033" />
                ) : (
                  <>
                    <Ionicons name="send" size={14} color="#1a0033" />
                    <Text style={styles.modalSendText}>Send</Text>
                  </>
                )}
              </TouchableOpacity>
            </KeyboardAvoidingView>
          </View>
        </Modal>
      </SafeAreaView>
    </CosmicBackdrop>
  );
}

// ---------- Subcomponents ---------------------------------------------------
function Field({ label, icon, editing, value, placeholder, onChange, multiline, maxLength }: any) {
  return (
    <View style={styles.fieldBlock}>
      <View style={styles.fieldLabelRow}>
        <Ionicons name={icon} size={14} color="#9f7aea" />
        <Text style={styles.fieldLabel}>{label}</Text>
      </View>
      {editing ? (
        <TextInput
          value={value}
          onChangeText={onChange}
          style={[styles.fieldInput, multiline && styles.fieldInputMultiline]}
          placeholder={placeholder}
          placeholderTextColor="rgba(233,213,255,0.35)"
          multiline={multiline}
          maxLength={maxLength}
        />
      ) : (
        <Text style={styles.fieldValue}>
          {value && value.toString().trim() ? value : <Text style={styles.emptyHint}>{placeholder}</Text>}
        </Text>
      )}
    </View>
  );
}

function Chip({ label, active, onPress }: { label: string; active?: boolean; onPress?: () => void }) {
  const Wrap = onPress ? TouchableOpacity : View;
  return (
    <Wrap onPress={onPress as any} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
      {active && onPress && <Ionicons name="close" size={11} color="#1a0033" />}
    </Wrap>
  );
}

function ActionTile({ icon, label, sub, color, onPress, loading, disabled }: any) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.actionTile,
        { borderColor: color + '99' },
        pressed && { opacity: 0.7 },
        disabled && { opacity: 0.55 },
      ]}
    >
      <View style={[styles.actionIcon, { backgroundColor: color + '22' }]}>
        {loading ? <ActivityIndicator color={color} size="small" /> : <Ionicons name={icon} size={20} color={color} />}
      </View>
      <Text style={styles.actionLabel}>{label}</Text>
      <Text style={styles.actionSub}>{sub}</Text>
    </Pressable>
  );
}

function StatTile({ icon, label, value }: { icon: any; label: string; value: number | string }) {
  return (
    <View style={styles.statTile}>
      <Ionicons name={icon} size={18} color="#fbbf24" />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// ---------- Styles ----------------------------------------------------------
const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  scroll: { padding: 16, paddingBottom: 32 },
  emptyText: { color: 'rgba(255,255,255,0.6)' },
  retryBtn: { marginTop: 10, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, backgroundColor: '#fbbf24' },
  retryBtnText: { color: '#1a0033', fontWeight: '700' },

  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  editBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10,
    backgroundColor: 'rgba(251,191,36,0.16)',
    borderWidth: 1, borderColor: 'rgba(251,191,36,0.5)',
  },
  editBtnText: { color: '#fbbf24', fontWeight: '700', fontSize: 12 },
  saveBtn: { backgroundColor: '#fbbf24', borderColor: '#fbbf24' },

  headerCard: { alignItems: 'center', marginBottom: 18 },
  avatar: { width: 96, height: 96, borderRadius: 48, borderWidth: 2, borderColor: 'rgba(251,191,36,0.6)' },
  avatarFallback: { backgroundColor: '#1a0033', alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { color: '#fbbf24', fontSize: 32, fontWeight: '800' },
  avatarEditBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#fbbf24',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#0f0523',
  },
  changePhotoBtn: {
    marginTop: 8, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8,
    backgroundColor: 'rgba(251,191,36,0.16)',
    borderWidth: 1, borderColor: 'rgba(251,191,36,0.4)',
  },
  changePhotoBtnText: { color: '#fbbf24', fontWeight: '700', fontSize: 11 },
  name: { color: '#e9d5ff', fontSize: 20, fontWeight: '800', marginTop: 10 },
  nameInput: {
    color: '#e9d5ff', fontSize: 20, fontWeight: '800', marginTop: 10, textAlign: 'center',
    borderBottomWidth: 1, borderColor: 'rgba(251,191,36,0.6)', minWidth: 180, paddingVertical: 2,
  },
  badgesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8, justifyContent: 'center' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  badgeAdmin: { backgroundColor: '#7c3aed' },
  badgePremium: { backgroundColor: '#fbbf24' },
  badgeNeutral: { backgroundColor: 'rgba(124,58,237,0.16)' },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },
  emailHint: { color: 'rgba(233,213,255,0.55)', fontSize: 11, marginTop: 6, fontStyle: 'italic' },

  fieldBlock: { marginBottom: 14 },
  fieldLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 5 },
  fieldLabel: { color: '#cbb6ff', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  fieldValue: { color: '#e9d5ff', fontSize: 14, lineHeight: 19 },
  emptyHint: { color: 'rgba(233,213,255,0.45)', fontStyle: 'italic' },
  fieldInput: {
    color: '#e9d5ff', fontSize: 14, borderRadius: 10,
    backgroundColor: 'rgba(124,58,237,0.10)', paddingHorizontal: 11, paddingVertical: 9,
    borderWidth: 1, borderColor: 'rgba(159,122,234,0.3)',
  },
  fieldInputMultiline: { minHeight: 70, textAlignVertical: 'top' },

  row: { flexDirection: 'row', gap: 10 },

  groupCard: {
    marginVertical: 8, padding: 12, borderRadius: 14,
    backgroundColor: 'rgba(15,5,35,0.55)',
    borderWidth: 1, borderColor: 'rgba(251,191,36,0.25)',
  },
  groupHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8,
    paddingBottom: 6, borderBottomWidth: 1, borderColor: 'rgba(251,191,36,0.18)',
  },
  groupTitle: { color: '#fbbf24', fontSize: 13, fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase' },
  boolRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 6, marginBottom: 4,
  },
  boolValue: { color: '#e9d5ff', fontSize: 13, fontWeight: '700' },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  statTile: {
    flexBasis: '31%', flexGrow: 1,
    padding: 10, borderRadius: 10, alignItems: 'center',
    backgroundColor: 'rgba(251,191,36,0.08)',
    borderWidth: 1, borderColor: 'rgba(251,191,36,0.25)',
  },
  statValue: { color: '#fbbf24', fontSize: 18, fontWeight: '800', marginTop: 4 },
  statLabel: { color: '#cbb6ff', fontSize: 10, marginTop: 2, textAlign: 'center', lineHeight: 13 },

  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12,
    backgroundColor: 'rgba(124,58,237,0.18)',
    borderWidth: 1, borderColor: 'rgba(159,122,234,0.35)',
  },
  chipActive: { backgroundColor: '#fbbf24', borderColor: '#fbbf24' },
  chipText: { color: '#cbb6ff', fontSize: 11, fontWeight: '600' },
  chipTextActive: { color: '#1a0033', fontWeight: '800' },

  actionsCard: {
    marginTop: 10, padding: 14, borderRadius: 14,
    backgroundColor: 'rgba(15,5,35,0.65)',
    borderWidth: 1, borderColor: 'rgba(251,191,36,0.25)',
  },
  actionsTitle: { color: '#fbbf24', fontSize: 13, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10 },
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  actionTile: {
    flexGrow: 1, minWidth: '47%',
    padding: 12, borderRadius: 12, borderWidth: 1,
    backgroundColor: 'rgba(15,5,35,0.6)',
  },
  actionIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  actionLabel: { color: '#e9d5ff', fontSize: 13, fontWeight: '700' },
  actionSub: { color: 'rgba(203,182,255,0.7)', fontSize: 11, marginTop: 1 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: '#0f0523',
    borderTopLeftRadius: 18, borderTopRightRadius: 18,
    padding: 16, paddingBottom: 30,
    borderTopWidth: 1, borderColor: 'rgba(251,191,36,0.3)',
  },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  modalTitle: { color: '#fbbf24', fontSize: 16, fontWeight: '800' },
  modalHint: { color: '#cbb6ff', fontSize: 12, marginBottom: 12 },
  modalInput: {
    color: '#e9d5ff', backgroundColor: 'rgba(124,58,237,0.10)',
    paddingHorizontal: 11, paddingVertical: 10, borderRadius: 10, marginBottom: 8,
    borderWidth: 1, borderColor: 'rgba(159,122,234,0.3)',
    fontSize: 14,
  },
  modalBody: { minHeight: 120, textAlignVertical: 'top' },
  modalSendBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#fbbf24', paddingVertical: 12, borderRadius: 12, marginTop: 6,
  },
  modalSendText: { color: '#1a0033', fontWeight: '800', fontSize: 14 },
});
orderWidth: 1, borderColor: 'rgba(251,191,36,0.25)',
  },
  actionsTitle: { color: '#fbbf24', fontSize: 13, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10 },
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  actionTile: {
    flexGrow: 1, minWidth: '47%',
    padding: 12, borderRadius: 12, borderWidth: 1,
    backgroundColor: 'rgba(15,5,35,0.6)',
  },
  actionIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  actionLabel: { color: '#e9d5ff', fontSize: 13, fontWeight: '700' },
  actionSub: { color: 'rgba(203,182,255,0.7)', fontSize: 11, marginTop: 1 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: '#0f0523',
    borderTopLeftRadius: 18, borderTopRightRadius: 18,
    padding: 16, paddingBottom: 30,
    borderTopWidth: 1, borderColor: 'rgba(251,191,36,0.3)',
  },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  modalTitle: { color: '#fbbf24', fontSize: 16, fontWeight: '800' },
  modalHint: { color: '#cbb6ff', fontSize: 12, marginBottom: 12 },
  modalInput: {
    color: '#e9d5ff', backgroundColor: 'rgba(124,58,237,0.10)',
    paddingHorizontal: 11, paddingVertical: 10, borderRadius: 10, marginBottom: 8,
    borderWidth: 1, borderColor: 'rgba(159,122,234,0.3)',
    fontSize: 14,
  },
  modalBody: { minHeight: 120, textAlignVertical: 'top' },
  modalSendBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#fbbf24', paddingVertical: 12, borderRadius: 12, marginTop: 6,
  },
  modalSendText: { color: '#1a0033', fontWeight: '800', fontSize: 14 },
});
