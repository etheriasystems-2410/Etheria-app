/**
 * ProfileHeader — avatar + (editable) display name + badges + email hint.
 *
 * Extracted from `app/profile/[id].tsx`. The avatar tap → `onPickAvatar` is
 * only wired when the user is viewing their own profile in edit mode.
 */
import React from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import type { Profile, ProfileSetter } from './types';

interface Props {
  view: Profile;
  form: Profile | null;
  setForm: ProfileSetter;
  editing: boolean;
  isSelf: boolean;
  memberSince: string | null;
  onPickAvatar: () => void;
}

export default function ProfileHeader({
  view,
  form,
  setForm,
  editing,
  isSelf,
  memberSince,
  onPickAvatar,
}: Props) {
  return (
    <View style={styles.headerCard}>
      <Pressable
        onPress={isSelf && editing ? onPickAvatar : undefined}
        disabled={!(isSelf && editing)}
      >
        {view.picture ? (
          <Image source={{ uri: view.picture }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Text style={styles.avatarInitial}>
              {(view.name || '?')[0]?.toUpperCase()}
            </Text>
          </View>
        )}
        {isSelf && editing && (
          <View style={styles.avatarEditBadge}>
            <Ionicons name="camera" size={14} color="#1a0033" />
          </View>
        )}
      </Pressable>
      {isSelf && editing && (
        <TouchableOpacity onPress={onPickAvatar} style={styles.changePhotoBtn}>
          <Text style={styles.changePhotoBtnText}>Change Photo</Text>
        </TouchableOpacity>
      )}
      {editing && form ? (
        <TextInput
          value={view.name}
          onChangeText={(t) => setForm({ ...form, name: t })}
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
            <Text style={[styles.badgeText, { color: '#cbb6ff' }]}>
              Member since {memberSince}
            </Text>
          </View>
        )}
      </View>

      {isSelf && view.email && (
        <Text style={styles.emailHint}>{view.email}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  headerCard: { alignItems: 'center', marginBottom: 18 },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 2,
    borderColor: 'rgba(251,191,36,0.6)',
  },
  avatarFallback: {
    backgroundColor: '#1a0033',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: { color: '#fbbf24', fontSize: 32, fontWeight: '800' },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#fbbf24',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#0f0523',
  },
  changePhotoBtn: {
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: 'rgba(251,191,36,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.4)',
  },
  changePhotoBtnText: { color: '#fbbf24', fontWeight: '700', fontSize: 11 },
  name: { color: '#e9d5ff', fontSize: 20, fontWeight: '800', marginTop: 10 },
  nameInput: {
    color: '#e9d5ff',
    fontSize: 20,
    fontWeight: '800',
    marginTop: 10,
    textAlign: 'center',
    borderBottomWidth: 1,
    borderColor: 'rgba(251,191,36,0.6)',
    minWidth: 180,
    paddingVertical: 2,
  },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
    justifyContent: 'center',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  badgeAdmin: { backgroundColor: '#7c3aed' },
  badgePremium: { backgroundColor: '#fbbf24' },
  badgeNeutral: { backgroundColor: 'rgba(124,58,237,0.16)' },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },
  emailHint: {
    color: 'rgba(233,213,255,0.55)',
    fontSize: 11,
    marginTop: 6,
    fontStyle: 'italic',
  },
});
