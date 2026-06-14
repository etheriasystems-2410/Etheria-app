/**
 * Settings → admin-only entries.
 *  - Admin Panel link (when user.is_admin)
 *  - Owner Setup button (only for etheriasystems@gmail.com when NOT yet admin)
 */
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { commonStyles } from './commonStyles';

interface User {
  email?: string;
  is_admin?: boolean;
}

interface Props {
  user: User | null | undefined;
  onAdminPanel: () => void;
  onSetupOwner: () => void;
}

export default function AdminSection({ user, onAdminPanel, onSetupOwner }: Props) {
  return (
    <>
      {user?.is_admin && (
        <View style={commonStyles.section}>
          <Text style={commonStyles.sectionTitle}>Administration</Text>
          <TouchableOpacity
            style={commonStyles.settingItem}
            onPress={onAdminPanel}
          >
            <Ionicons name="shield" size={24} color="#f59e0b" />
            <Text style={commonStyles.settingText}>Admin Panel</Text>
            <Ionicons name="chevron-forward" size={20} color="#9f7aea" />
          </TouchableOpacity>
        </View>
      )}

      {user?.email === 'etheriasystems@gmail.com' && !user?.is_admin && (
        <View style={commonStyles.section}>
          <Text style={commonStyles.sectionTitle}>Owner Setup</Text>
          <TouchableOpacity
            style={[commonStyles.settingItem, { backgroundColor: 'rgba(245, 158, 11, 0.1)' }]}
            onPress={onSetupOwner}
          >
            <Ionicons name="key" size={24} color="#f59e0b" />
            <Text style={[commonStyles.settingText, { color: '#f59e0b' }]}>
              Activate Admin Access
            </Text>
            <Ionicons name="chevron-forward" size={20} color="#f59e0b" />
          </TouchableOpacity>
        </View>
      )}
    </>
  );
}
