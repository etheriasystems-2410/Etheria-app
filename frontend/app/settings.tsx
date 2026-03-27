import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

export default function Settings() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.name || '');
  const [saving, setSaving] = useState(false);

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await logout();
            router.replace('/auth/login');
          },
        },
      ]
    );
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Name cannot be empty');
      return;
    }

    setSaving(true);
    try {
      const sessionToken = await import('@react-native-async-storage/async-storage').then(
        (mod) => mod.default.getItem('session_token')
      );

      const response = await fetch(`${BACKEND_URL}/api/user/update-profile`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({ name: name.trim() }),
      });

      if (response.ok) {
        Alert.alert('Success', 'Profile updated successfully');
        setEditing(false);
      } else {
        throw new Error('Failed to update profile');
      }
    } catch (error) {
      Alert.alert('Error', 'Could not update profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.avatarContainer}>
          {user?.picture ? (
            <Image source={{ uri: user.picture }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Ionicons name="person" size={48} color="#e9d5ff" />
            </View>
          )}
        </View>
        <Text style={styles.email}>{user?.email}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Profile Information</Text>
        
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
                onPress={handleSave}
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

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>App Settings</Text>
        
        <TouchableOpacity style={styles.settingItem}>
          <Ionicons name="notifications" size={24} color="#b794f6" />
          <Text style={styles.settingText}>Notifications</Text>
          <Ionicons name="chevron-forward" size={20} color="#9f7aea" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.settingItem}>
          <Ionicons name="moon" size={24} color="#b794f6" />
          <Text style={styles.settingText}>Theme</Text>
          <Ionicons name="chevron-forward" size={20} color="#9f7aea" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.settingItem}>
          <Ionicons name="language" size={24} color="#b794f6" />
          <Text style={styles.settingText}>Language</Text>
          <Ionicons name="chevron-forward" size={20} color="#9f7aea" />
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Support</Text>
        
        <TouchableOpacity style={styles.settingItem}>
          <Ionicons name="help-circle" size={24} color="#b794f6" />
          <Text style={styles.settingText}>Help & Support</Text>
          <Ionicons name="chevron-forward" size={20} color="#9f7aea" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.settingItem}>
          <Ionicons name="shield-checkmark" size={24} color="#b794f6" />
          <Text style={styles.settingText}>Privacy Policy</Text>
          <Ionicons name="chevron-forward" size={20} color="#9f7aea" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.settingItem}>
          <Ionicons name="document-text" size={24} color="#b794f6" />
          <Text style={styles.settingText}>Terms of Service</Text>
          <Ionicons name="chevron-forward" size={20} color="#9f7aea" />
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Ionicons name="log-out" size={24} color="#ef4444" />
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>

      <Text style={styles.version}>Version 1.0.0</Text>
    </ScrollView>
  );}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0321',
  },
  header: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
  },
  avatarContainer: {
    marginBottom: 16,
  },
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
  email: {
    fontSize: 16,
    color: '#c4b5fd',
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#e9d5ff',
    marginBottom: 12,
  },
  infoCard: {
    backgroundColor: '#1a0033',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#2d1b4e',
  },
  infoRow: {
    marginBottom: 16,
  },
  infoLabel: {
    fontSize: 14,
    color: '#9f7aea',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    color: '#e9d5ff',
    fontWeight: '500',
  },
  input: {
    backgroundColor: '#2d1b4e',
    borderRadius: 8,
    padding: 12,
    color: '#e9d5ff',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#7c3aed',
  },
  editButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  editButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#2d1b4e',
  },
  saveButton: {
    backgroundColor: '#7c3aed',
  },
  editButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  editProfileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  editProfileText: {
    color: '#b794f6',
    fontSize: 16,
    fontWeight: '600',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a0033',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#2d1b4e',
  },
  settingText: {
    flex: 1,
    fontSize: 16,
    color: '#e9d5ff',
    marginLeft: 12,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a0033',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 20,
    marginTop: 8,
    marginBottom: 24,
    borderWidth: 2,
    borderColor: '#ef4444',
    gap: 12,
  },
  logoutText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ef4444',
  },
  version: {
    textAlign: 'center',
    color: '#9f7aea',
    fontSize: 14,
    paddingBottom: 32,
  },
});
