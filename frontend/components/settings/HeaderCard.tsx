/**
 * Settings → top "header" block: avatar + camera overlay + email + Premium tag.
 * Extracted from `app/settings.tsx`.
 */
import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';

interface User {
  email?: string;
  picture?: string;
}

interface Props {
  user: User | null | undefined;
  profilePicture: string | null;
  uploadingPicture: boolean;
  isPremium: boolean;
  onOpenPicker: () => void;
}

export default function HeaderCard({
  user,
  profilePicture,
  uploadingPicture,
  isPremium,
  onOpenPicker,
}: Props) {
  return (
    <View style={styles.header}>
      <TouchableOpacity
        style={styles.avatarContainer}
        onPress={onOpenPicker}
        disabled={uploadingPicture}
      >
        {uploadingPicture ? (
          <View style={styles.avatarPlaceholder}>
            <ActivityIndicator size="large" color="#a855f7" />
          </View>
        ) : profilePicture || user?.picture ? (
          <Image
            source={{ uri: profilePicture || user?.picture }}
            style={styles.avatar}
          />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Ionicons name="person" size={48} color="#e9d5ff" />
          </View>
        )}
        <View style={styles.cameraOverlay}>
          <Ionicons name="camera" size={20} color="#fff" />
        </View>
        {isPremium && (
          <View style={styles.premiumBadge}>
            <Ionicons name="star" size={16} color="#ffd700" />
          </View>
        )}
      </TouchableOpacity>
      <Text style={styles.avatarHint}>Tap to change photo</Text>
      <Text style={styles.email}>{user?.email}</Text>
      {isPremium && (
        <View style={styles.premiumTag}>
          <Ionicons name="diamond" size={14} color="#ffd700" />
          <Text style={styles.premiumTagText}>Premium Member</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', paddingVertical: 32, paddingHorizontal: 12 },
  avatarContainer: { marginBottom: 16, position: 'relative' },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: '#7c3aed',
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#2d1b4e',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#7c3aed',
  },
  cameraOverlay: {
    position: 'absolute',
    bottom: 5,
    right: 5,
    backgroundColor: '#7c3aed',
    borderRadius: 16,
    padding: 8,
    borderWidth: 2,
    borderColor: '#0a0014',
  },
  avatarHint: { fontSize: 12, color: '#9f7aea', marginTop: 8, marginBottom: 4 },
  premiumBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#2d1b4e',
    borderRadius: 12,
    padding: 6,
    borderWidth: 2,
    borderColor: '#ffd700',
  },
  email: { fontSize: 16, color: '#c4b5fd' },
  premiumTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 8,
    gap: 6,
  },
  premiumTagText: { color: '#ffd700', fontSize: 12, fontWeight: '600' },
});
