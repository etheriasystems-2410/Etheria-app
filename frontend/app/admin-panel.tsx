import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface FlaggedUser {
  id: string;
  email: string;
  name: string;
  flag_count: number;
  suspension_count: number;
  account_status: string;
  suspension_end: string | null;
}

interface UserFlag {
  id: string;
  content_type: string;
  content: string;
  reason: string;
  status: string;
  created_at: string;
}

export default function AdminPanel() {
  const { user, authToken } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [flaggedUsers, setFlaggedUsers] = useState<FlaggedUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<FlaggedUser | null>(null);
  const [userFlags, setUserFlags] = useState<UserFlag[]>([]);
  const [showUserModal, setShowUserModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user?.is_admin) {
      fetchFlaggedUsers();
    }
  }, [user]);

  const fetchFlaggedUsers = async () => {
    try {
      const response = await fetch(
        `${BACKEND_URL}/api/community/admin/flagged-users?token=${authToken}`
      );
      const data = await response.json();
      
      if (response.ok) {
        setFlaggedUsers(data.users);
      }
    } catch (err) {
      console.error('Error fetching flagged users:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchUserFlags = async (userId: string) => {
    try {
      const response = await fetch(
        `${BACKEND_URL}/api/community/admin/user-flags/${userId}?token=${authToken}`
      );
      const data = await response.json();
      
      if (response.ok) {
        setUserFlags(data.flags);
      }
    } catch (err) {
      console.error('Error fetching user flags:', err);
    }
  };

  const handleUserAction = async (userId: string, action: string) => {
    setActionLoading(true);
    setError(null);
    
    try {
      const response = await fetch(
        `${BACKEND_URL}/api/community/admin/user/${userId}/action?token=${authToken}&action=${action}`,
        { method: 'POST' }
      );
      const data = await response.json();
      
      if (response.ok) {
        setShowUserModal(false);
        fetchFlaggedUsers();
      } else {
        setError(data.detail || 'Action failed');
      }
    } catch (err) {
      setError('Failed to perform action');
    } finally {
      setActionLoading(false);
    }
  };

  const openUserDetails = (flaggedUser: FlaggedUser) => {
    setSelectedUser(flaggedUser);
    fetchUserFlags(flaggedUser.id);
    setShowUserModal(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return '#10b981';
      case 'suspended': return '#f59e0b';
      case 'cancelled': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString();
  };

  // Check if user is admin
  if (!user?.is_admin) {
    return (
      <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.title}>Admin Panel</Text>
          <View style={{ width: 40 }} />
        </View>
        
        <View style={styles.errorContainer}>
          <Ionicons name="lock-closed" size={60} color="#ef4444" />
          <Text style={styles.errorTitle}>Access Denied</Text>
          <Text style={styles.errorText}>You don't have admin privileges.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Admin Panel</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Content */}
      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchFlaggedUsers();
            }}
            tintColor="#b794f6"
          />
        }
      >
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            <Ionicons name="flag" size={20} color="#f59e0b" /> Flagged Users
          </Text>
          
          {loading ? (
            <ActivityIndicator size="large" color="#b794f6" style={{ marginTop: 40 }} />
          ) : flaggedUsers.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="checkmark-circle" size={50} color="#10b981" />
              <Text style={styles.emptyText}>No flagged users</Text>
              <Text style={styles.emptySubtext}>All users are in good standing</Text>
            </View>
          ) : (
            flaggedUsers.map((flaggedUser) => (
              <TouchableOpacity
                key={flaggedUser.id}
                style={styles.userCard}
                onPress={() => openUserDetails(flaggedUser)}
              >
                <View style={styles.userInfo}>
                  <Text style={styles.userName}>{flaggedUser.name || 'Unknown'}</Text>
                  <Text style={styles.userEmail}>{flaggedUser.email}</Text>
                  <View style={styles.userStats}>
                    <View style={styles.statBadge}>
                      <Ionicons name="flag" size={14} color="#f59e0b" />
                      <Text style={styles.statText}>{flaggedUser.flag_count} flags</Text>
                    </View>
                    <View style={styles.statBadge}>
                      <Ionicons name="pause-circle" size={14} color="#9f7aea" />
                      <Text style={styles.statText}>{flaggedUser.suspension_count} suspensions</Text>
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
        
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* User Details Modal */}
      <Modal
        visible={showUserModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowUserModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>User Details</Text>
              <TouchableOpacity onPress={() => setShowUserModal(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            
            {selectedUser && (
              <ScrollView style={styles.modalBody}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Name</Text>
                  <Text style={styles.detailValue}>{selectedUser.name || 'Unknown'}</Text>
                </View>
                
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Email</Text>
                  <Text style={styles.detailValue}>{selectedUser.email}</Text>
                </View>
                
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Status</Text>
                  <Text style={[styles.detailValue, { color: getStatusColor(selectedUser.account_status) }]}>
                    {selectedUser.account_status}
                  </Text>
                </View>
                
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Flags</Text>
                  <Text style={styles.detailValue}>{selectedUser.flag_count}</Text>
                </View>
                
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Suspensions</Text>
                  <Text style={styles.detailValue}>{selectedUser.suspension_count}</Text>
                </View>
                
                {selectedUser.suspension_end && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Suspension Ends</Text>
                    <Text style={styles.detailValue}>{formatDate(selectedUser.suspension_end)}</Text>
                  </View>
                )}
                
                <Text style={styles.flagsTitle}>Flag History</Text>
                {userFlags.length === 0 ? (
                  <Text style={styles.noFlags}>No flags recorded</Text>
                ) : (
                  userFlags.map((flag) => (
                    <View key={flag.id} style={styles.flagCard}>
                      <View style={styles.flagHeader}>
                        <Text style={styles.flagType}>{flag.content_type}</Text>
                        <Text style={styles.flagDate}>{formatDate(flag.created_at)}</Text>
                      </View>
                      <Text style={styles.flagReason}>{flag.reason}</Text>
                      <Text style={styles.flagContent} numberOfLines={2}>"{flag.content}"</Text>
                    </View>
                  ))
                )}
                
                {error && (
                  <View style={styles.errorBanner}>
                    <Text style={styles.errorBannerText}>{error}</Text>
                  </View>
                )}
                
                {/* Action Buttons */}
                <View style={styles.actionButtons}>
                  {selectedUser.account_status === 'active' && (
                    <>
                      <TouchableOpacity
                        style={[styles.actionButton, styles.clearButton]}
                        onPress={() => handleUserAction(selectedUser.id, 'clear_flags')}
                        disabled={actionLoading}
                      >
                        <Ionicons name="refresh" size={18} color="#10b981" />
                        <Text style={styles.clearButtonText}>Clear Flags</Text>
                      </TouchableOpacity>
                      
                      <TouchableOpacity
                        style={[styles.actionButton, styles.cancelButton]}
                        onPress={() => handleUserAction(selectedUser.id, 'cancel')}
                        disabled={actionLoading}
                      >
                        <Ionicons name="ban" size={18} color="#ef4444" />
                        <Text style={styles.cancelButtonText}>Cancel Account</Text>
                      </TouchableOpacity>
                    </>
                  )}
                  
                  {(selectedUser.account_status === 'suspended' || selectedUser.account_status === 'cancelled') && (
                    <TouchableOpacity
                      style={[styles.actionButton, styles.reactivateButton]}
                      onPress={() => handleUserAction(selectedUser.id, 'reactivate')}
                      disabled={actionLoading}
                    >
                      {actionLoading ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <>
                          <Ionicons name="checkmark-circle" size={18} color="#fff" />
                          <Text style={styles.reactivateButtonText}>Reactivate Account</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  )}
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0014',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2d1b4e',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1a0033',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#fff',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a0033',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: '#9f7aea',
    marginBottom: 8,
  },
  userStats: {
    flexDirection: 'row',
    gap: 12,
  },
  statBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 12,
    color: '#c4b5fd',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ef4444',
    marginTop: 16,
  },
  errorText: {
    fontSize: 16,
    color: '#9f7aea',
    marginTop: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1a0033',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2d1b4e',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  modalBody: {
    padding: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2d1b4e',
  },
  detailLabel: {
    fontSize: 14,
    color: '#9f7aea',
  },
  detailValue: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '500',
  },
  flagsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginTop: 20,
    marginBottom: 12,
  },
  noFlags: {
    fontSize: 14,
    color: '#6b7280',
    fontStyle: 'italic',
  },
  flagCard: {
    backgroundColor: '#2d1b4e',
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
  },
  flagHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  flagType: {
    fontSize: 12,
    color: '#f59e0b',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  flagDate: {
    fontSize: 11,
    color: '#6b7280',
  },
  flagReason: {
    fontSize: 13,
    color: '#ef4444',
    marginBottom: 4,
  },
  flagContent: {
    fontSize: 12,
    color: '#c4b5fd',
    fontStyle: 'italic',
  },
  errorBanner: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  errorBannerText: {
    color: '#ef4444',
    fontSize: 14,
    textAlign: 'center',
  },
  actionButtons: {
    marginTop: 24,
    gap: 12,
    paddingBottom: 30,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 12,
    gap: 8,
  },
  clearButton: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderWidth: 1,
    borderColor: '#10b981',
  },
  clearButtonText: {
    color: '#10b981',
    fontSize: 15,
    fontWeight: '600',
  },
  cancelButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  cancelButtonText: {
    color: '#ef4444',
    fontSize: 15,
    fontWeight: '600',
  },
  reactivateButton: {
    backgroundColor: '#7c3aed',
  },
  reactivateButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});
