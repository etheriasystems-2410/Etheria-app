import React from 'react';
import { View, Text, TouchableOpacity, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { adminStyles as styles } from './styles';
import { AppUser, FlaggedUser, UserSubTab, getStatusColor } from './types';

interface Props {
  userSubTab: UserSubTab;
  setUserSubTab: (tab: UserSubTab) => void;
  userSearchQuery: string;
  setUserSearchQuery: (q: string) => void;
  handleUserSearch: () => void;
  allUsers: AppUser[];
  flaggedUsers: FlaggedUser[];
  onAppUserPress: (u: AppUser) => void;
  onFlaggedUserPress: (u: FlaggedUser) => void;
}

export default function UsersTab({
  userSubTab,
  setUserSubTab,
  userSearchQuery,
  setUserSearchQuery,
  handleUserSearch,
  allUsers,
  flaggedUsers,
  onAppUserPress,
  onFlaggedUserPress,
}: Props) {
  return (
    <View style={styles.section}>
      {/* Sub-tabs */}
      <View style={styles.subTabs}>
        <TouchableOpacity
          style={[styles.subTab, userSubTab === 'all' && styles.subTabActive]}
          onPress={() => setUserSubTab('all')}
        >
          <Text style={[styles.subTabText, userSubTab === 'all' && styles.subTabTextActive]}>All Users</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.subTab, userSubTab === 'flagged' && styles.subTabActive]}
          onPress={() => setUserSubTab('flagged')}
        >
          <Text style={[styles.subTabText, userSubTab === 'flagged' && styles.subTabTextActive]}>Flagged</Text>
        </TouchableOpacity>
      </View>

      {userSubTab === 'all' ? (
        <View>
          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search by email or name..."
              placeholderTextColor="#6b7280"
              value={userSearchQuery}
              onChangeText={setUserSearchQuery}
              onSubmitEditing={handleUserSearch}
              returnKeyType="search"
            />
            <TouchableOpacity style={styles.searchButton} onPress={handleUserSearch}>
              <Ionicons name="search" size={20} color="#fff" />
            </TouchableOpacity>
          </View>

          <Text style={styles.sectionTitle}>
            <Ionicons name="people" size={18} color="#b794f6" /> All Users ({allUsers.length})
          </Text>

          {allUsers.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="person-outline" size={50} color="#6b7280" />
              <Text style={styles.emptyText}>No users found</Text>
            </View>
          ) : (
            allUsers.map((appUser) => (
              <TouchableOpacity
                key={appUser.id}
                style={[styles.userCard, appUser.is_admin && styles.adminUserCard]}
                onPress={() => onAppUserPress(appUser)}
              >
                <View style={styles.userInfo}>
                  <View style={styles.userNameRow}>
                    <Text style={styles.userName}>{appUser.name || 'Anonymous'}</Text>
                    {appUser.is_admin && (
                      <View style={styles.adminIndicator}>
                        <Ionicons name="shield-checkmark" size={14} color="#ffd700" />
                        <Text style={styles.adminIndicatorText}>Admin</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.userEmail}>{appUser.email}</Text>
                  <View style={styles.userStats}>
                    {appUser.is_premium && (
                      <View style={[styles.statBadge, { backgroundColor: 'rgba(16, 185, 129, 0.2)' }]}>
                        <Ionicons name="diamond" size={12} color="#10b981" />
                        <Text style={[styles.statText, { color: '#10b981' }]}>
                          {appUser.is_lifetime ? 'Lifetime' : 'Premium'}
                        </Text>
                      </View>
                    )}
                    {appUser.flag_count > 0 && (
                      <View style={styles.statBadge}>
                        <Ionicons name="flag" size={12} color="#f59e0b" />
                        <Text style={styles.statText}>{appUser.flag_count} flags</Text>
                      </View>
                    )}
                  </View>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(appUser.account_status) + '20' }]}>
                  <Text style={[styles.statusText, { color: getStatusColor(appUser.account_status) }]}>
                    {appUser.account_status}
                  </Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
      ) : (
        <View>
          <Text style={styles.sectionTitle}>
            <Ionicons name="flag" size={18} color="#f59e0b" /> Flagged Users
          </Text>
          {flaggedUsers.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="checkmark-circle" size={50} color="#10b981" />
              <Text style={styles.emptyText}>No flagged users</Text>
            </View>
          ) : (
            flaggedUsers.map((flaggedUser) => (
              <TouchableOpacity
                key={flaggedUser.id}
                style={styles.userCard}
                onPress={() => onFlaggedUserPress(flaggedUser)}
              >
                <View style={styles.userInfo}>
                  <Text style={styles.userName}>{flaggedUser.name || 'Unknown'}</Text>
                  <Text style={styles.userEmail}>{flaggedUser.email}</Text>
                  <View style={styles.userStats}>
                    <View style={styles.statBadge}>
                      <Ionicons name="flag" size={12} color="#f59e0b" />
                      <Text style={styles.statText}>{flaggedUser.flag_count} flags</Text>
                    </View>
                  </View>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(flaggedUser.account_status) + '20' }]}>
                  <Text style={[styles.statusText, { color: getStatusColor(flaggedUser.account_status) }]}>
                    {flaggedUser.account_status}
                  </Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
      )}
    </View>
  );
}
