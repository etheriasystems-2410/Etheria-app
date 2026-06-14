/**
 * Settings → "Profile Information" section. Displays read-only fields or edit-mode
 * inputs for the user's display name. The user_id is always read-only.
 */
import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { commonStyles } from './commonStyles';

interface User {
  user_id?: string;
  name?: string;
}

interface Props {
  user: User | null | undefined;
  editing: boolean;
  setEditing: (v: boolean) => void;
  name: string;
  setName: (v: string) => void;
  saving: boolean;
  onSave: () => void;
}

export default function ProfileInfoSection({
  user,
  editing,
  setEditing,
  name,
  setName,
  saving,
  onSave,
}: Props) {
  return (
    <View style={commonStyles.section}>
      <Text style={commonStyles.sectionTitle}>Profile Information</Text>

      <View style={styles.infoCard}>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Name</Text>
          {editing ? (
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              placeholderTextColor="#9f7aea"
            />
          ) : (
            <Text style={styles.infoValue}>{user?.name}</Text>
          )}
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>User ID</Text>
          <Text style={styles.infoValue}>{user?.user_id}</Text>
        </View>

        {editing ? (
          <View style={styles.editButtons}>
            <TouchableOpacity
              style={[styles.editButton, styles.cancelButton]}
              onPress={() => {
                setName(user?.name || '');
                setEditing(false);
              }}
            >
              <Text style={styles.editButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.editButton, styles.saveButton]}
              onPress={onSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.editButtonText}>Save</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.editProfileButton}
            onPress={() => setEditing(true)}
          >
            <Ionicons name="create" size={20} color="#b794f6" />
            <Text style={styles.editProfileText}>Edit Profile</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  infoCard: {
    backgroundColor: '#1a0033',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#2d1b4e',
  },
  infoRow: { marginBottom: 16 },
  infoLabel: { fontSize: 14, color: '#9f7aea', marginBottom: 4 },
  infoValue: { fontSize: 16, color: '#e9d5ff', fontWeight: '500' },
  input: {
    backgroundColor: '#2d1b4e',
    borderRadius: 8,
    padding: 12,
    color: '#e9d5ff',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#7c3aed',
  },
  editButtons: { flexDirection: 'row', gap: 12, marginTop: 8 },
  editButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: { backgroundColor: '#2d1b4e' },
  saveButton: { backgroundColor: '#7c3aed' },
  editButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  editProfileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  editProfileText: { color: '#b794f6', fontSize: 16, fontWeight: '600' },
});
