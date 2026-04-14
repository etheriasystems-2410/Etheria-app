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
  TextInput,
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

interface ContestEntry {
  user_id: string;
  email: string;
  name: string;
  is_premium: boolean;
  is_lifetime: boolean;
  activity_score: number;
  journal_entries: number;
  meditation_sessions: number;
  oracle_readings: number;
  eligible: boolean;
}

interface PromoCode {
  code: string;
  type: string;
  is_used: boolean;
  used_by: string | null;
  used_at: string | null;
  created_at: string;
}

type TabType = 'users' | 'contest';

export default function AdminPanel() {
  const { user, authToken } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  const [activeTab, setActiveTab] = useState<TabType>('users');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // User moderation state
  const [flaggedUsers, setFlaggedUsers] = useState<FlaggedUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<FlaggedUser | null>(null);
  const [userFlags, setUserFlags] = useState<UserFlag[]>([]);
  const [showUserModal, setShowUserModal] = useState(false);
  
  // Contest state
  const [contestEntries, setContestEntries] = useState<ContestEntry[]>([]);
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [contestStatus, setContestStatus] = useState<any>(null);
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<ContestEntry | null>(null);
  
  // Form state
  const [newCodeType, setNewCodeType] = useState<'monthly' | 'lifetime'>('monthly');
  const [customCode, setCustomCode] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');
  const [emailRecipient, setEmailRecipient] = useState({ email: '', name: '', user_id: '' });
  
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (user?.is_admin) {
      loadData();
    }
  }, [user, activeTab]);

  const loadData = async () => {
    setLoading(true);
    if (activeTab === 'users') {
      await fetchFlaggedUsers();
    } else {
      await Promise.all([fetchContestStatus(), fetchContestEntries(), fetchPromoCodes()]);
    }
    setLoading(false);
  };

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
      console.error('Error:', err);
    }
  };

  const fetchContestStatus = async () => {
    try {
      const response = await fetch(
        `${BACKEND_URL}/api/admin/contest/status?token=${authToken}`
      );
      const data = await response.json();
      if (response.ok) {
        setContestStatus(data);
      }
    } catch (err) {
      console.error('Error:', err);
    }
  };

  const fetchContestEntries = async () => {
    try {
      const response = await fetch(
        `${BACKEND_URL}/api/admin/contest/entries?token=${authToken}`
      );
      const data = await response.json();
      if (response.ok) {
        setContestEntries(data.entries || []);
      }
    } catch (err) {
      console.error('Error:', err);
    }
  };

  const fetchPromoCodes = async () => {
    try {
      const response = await fetch(
        `${BACKEND_URL}/api/admin/contest/codes?token=${authToken}`
      );
      const data = await response.json();
      if (response.ok) {
        setPromoCodes(data.codes || []);
      }
    } catch (err) {
      console.error('Error:', err);
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
      console.error('Error:', err);
    }
  };

  const handleUserAction = async (userId: string, action: string) => {
    setActionLoading(true);
    try {
      const response = await fetch(
        `${BACKEND_URL}/api/community/admin/user/${userId}/action?token=${authToken}&action=${action}`,
        { method: 'POST' }
      );
      if (response.ok) {
        setShowUserModal(false);
        fetchFlaggedUsers();
      }
    } catch (err) {
      setError('Action failed');
    } finally {
      setActionLoading(false);
    }
  };

  const generateCode = async () => {
    setActionLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `${BACKEND_URL}/api/admin/contest/generate-code?token=${authToken}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code_type: newCodeType,
            custom_code: customCode || null
          })
        }
      );
      const data = await response.json();
      if (response.ok) {
        setGeneratedCode(data.code);
        setCustomCode('');
        fetchPromoCodes();
        setSuccess(`Code generated: ${data.code}`);
      } else {
        setError(data.detail || 'Failed to generate code');
      }
    } catch (err) {
      setError('Failed to generate code');
    } finally {
      setActionLoading(false);
    }
  };

  const sendWinnerEmail = async () => {
    if (!selectedEntry || !generatedCode) return;
    
    setActionLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `${BACKEND_URL}/api/admin/contest/send-winner-email?token=${authToken}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: selectedEntry.user_id,
            code: generatedCode
          })
        }
      );
      const data = await response.json();
      if (response.ok) {
        setSuccess(`Congratulations email sent to ${selectedEntry.email}`);
        setShowEmailModal(false);
        setGeneratedCode('');
      } else {
        setError(data.detail || 'Failed to send email');
      }
    } catch (err) {
      setError('Failed to send email');
    } finally {
      setActionLoading(false);
    }
  };

  const sendCodeEmail = async () => {
    if (!emailRecipient.email || !generatedCode) return;
    
    setActionLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `${BACKEND_URL}/api/admin/contest/send-code-email?token=${authToken}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_email: emailRecipient.email,
            user_name: emailRecipient.name || emailRecipient.email.split('@')[0],
            code: generatedCode,
            code_type: newCodeType
          })
        }
      );
      const data = await response.json();
      if (response.ok) {
        setSuccess(`Code email sent to ${emailRecipient.email}`);
        setShowEmailModal(false);
        setGeneratedCode('');
        setEmailRecipient({ email: '', name: '', user_id: '' });
      } else {
        setError(data.detail || 'Failed to send email');
      }
    } catch (err) {
      setError('Failed to send email');
    } finally {
      setActionLoading(false);
    }
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

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'users' && styles.tabActive]}
          onPress={() => setActiveTab('users')}
        >
          <Ionicons name="people" size={20} color={activeTab === 'users' ? '#fff' : '#9f7aea'} />
          <Text style={[styles.tabText, activeTab === 'users' && styles.tabTextActive]}>Users</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'contest' && styles.tabActive]}
          onPress={() => setActiveTab('contest')}
        >
          <Ionicons name="trophy" size={20} color={activeTab === 'contest' ? '#fff' : '#9f7aea'} />
          <Text style={[styles.tabText, activeTab === 'contest' && styles.tabTextActive]}>Contest</Text>
        </TouchableOpacity>
      </View>

      {/* Success/Error Messages */}
      {success && (
        <View style={styles.successBanner}>
          <Ionicons name="checkmark-circle" size={16} color="#10b981" />
          <Text style={styles.successText}>{success}</Text>
          <TouchableOpacity onPress={() => setSuccess(null)}>
            <Ionicons name="close" size={16} color="#10b981" />
          </TouchableOpacity>
        </View>
      )}
      {error && (
        <View style={styles.errorBanner}>
          <Ionicons name="warning" size={16} color="#ef4444" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => setError(null)}>
            <Ionicons name="close" size={16} color="#ef4444" />
          </TouchableOpacity>
        </View>
      )}

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadData().then(() => setRefreshing(false));
            }}
            tintColor="#b794f6"
          />
        }
      >
        {loading ? (
          <ActivityIndicator size="large" color="#b794f6" style={{ marginTop: 40 }} />
        ) : activeTab === 'users' ? (
          /* Users Tab */
          <View style={styles.section}>
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
                  onPress={() => {
                    setSelectedUser(flaggedUser);
                    fetchUserFlags(flaggedUser.id);
                    setShowUserModal(true);
                  }}
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
        ) : (
          /* Contest Tab */
          <View style={styles.section}>
            {/* Code Generation */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>
                <Ionicons name="gift" size={18} color="#ffd700" /> Generate Promo Code
              </Text>
              
              <View style={styles.codeTypeSelector}>
                <TouchableOpacity
                  style={[styles.codeTypeBtn, newCodeType === 'monthly' && styles.codeTypeBtnActive]}
                  onPress={() => setNewCodeType('monthly')}
                >
                  <Text style={[styles.codeTypeBtnText, newCodeType === 'monthly' && styles.codeTypeBtnTextActive]}>
                    Monthly
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.codeTypeBtn, newCodeType === 'lifetime' && styles.codeTypeBtnActive]}
                  onPress={() => setNewCodeType('lifetime')}
                >
                  <Text style={[styles.codeTypeBtnText, newCodeType === 'lifetime' && styles.codeTypeBtnTextActive]}>
                    Lifetime
                  </Text>
                </TouchableOpacity>
              </View>
              
              <TextInput
                style={styles.input}
                placeholder="Custom code (optional)"
                placeholderTextColor="#6b7280"
                value={customCode}
                onChangeText={setCustomCode}
                autoCapitalize="characters"
              />
              
              <TouchableOpacity
                style={styles.generateBtn}
                onPress={generateCode}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="sparkles" size={18} color="#fff" />
                    <Text style={styles.generateBtnText}>Generate Code</Text>
                  </>
                )}
              </TouchableOpacity>
              
              {generatedCode && (
                <View style={styles.generatedCodeBox}>
                  <Text style={styles.generatedCodeLabel}>Generated Code:</Text>
                  <Text style={styles.generatedCode}>{generatedCode}</Text>
                  <TouchableOpacity
                    style={styles.sendEmailBtn}
                    onPress={() => setShowEmailModal(true)}
                  >
                    <Ionicons name="mail" size={16} color="#fff" />
                    <Text style={styles.sendEmailBtnText}>Send to User</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Contest Entries */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>
                <Ionicons name="people" size={18} color="#b794f6" /> Contest Entries ({contestEntries.filter(e => e.eligible).length} eligible)
              </Text>
              
              {contestEntries.length === 0 ? (
                <Text style={styles.noEntries}>No entries yet</Text>
              ) : (
                contestEntries.slice(0, 10).map((entry) => (
                  <View key={entry.user_id} style={[styles.entryCard, !entry.eligible && styles.entryCardIneligible]}>
                    <View style={styles.entryInfo}>
                      <Text style={styles.entryName}>{entry.name || entry.email}</Text>
                      <Text style={styles.entryEmail}>{entry.email}</Text>
                      <View style={styles.entryStats}>
                        <Text style={styles.entryStat}>📔 {entry.journal_entries}</Text>
                        <Text style={styles.entryStat}>🧘 {entry.meditation_sessions}</Text>
                        <Text style={styles.entryStat}>🔮 {entry.oracle_readings}</Text>
                      </View>
                    </View>
                    <View style={styles.entryRight}>
                      <Text style={[styles.eligibleBadge, entry.eligible ? styles.eligible : styles.ineligible]}>
                        {entry.eligible ? '✓ Eligible' : '✗ Not Eligible'}
                      </Text>
                      {entry.eligible && generatedCode && (
                        <TouchableOpacity
                          style={styles.selectWinnerBtn}
                          onPress={() => {
                            setSelectedEntry(entry);
                            setEmailRecipient({ email: entry.email, name: entry.name || '', user_id: entry.user_id });
                            setShowEmailModal(true);
                          }}
                        >
                          <Ionicons name="trophy" size={14} color="#ffd700" />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                ))
              )}
            </View>

            {/* Recent Codes */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>
                <Ionicons name="key" size={18} color="#10b981" /> Recent Codes
              </Text>
              
              {promoCodes.slice(0, 5).map((code) => (
                <View key={code.code} style={styles.codeRow}>
                  <Text style={[styles.codeText, code.is_used && styles.codeUsed]}>{code.code}</Text>
                  <View style={styles.codeInfo}>
                    <Text style={styles.codeType}>{code.type}</Text>
                    <Text style={[styles.codeStatus, code.is_used ? styles.used : styles.unused]}>
                      {code.is_used ? 'Used' : 'Available'}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}
        
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* User Modal */}
      <Modal visible={showUserModal} animationType="slide" transparent>
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
                <Text style={styles.detailLabel}>Email: <Text style={styles.detailValue}>{selectedUser.email}</Text></Text>
                <Text style={styles.detailLabel}>Status: <Text style={[styles.detailValue, { color: getStatusColor(selectedUser.account_status) }]}>{selectedUser.account_status}</Text></Text>
                <Text style={styles.detailLabel}>Flags: <Text style={styles.detailValue}>{selectedUser.flag_count}</Text></Text>
                
                <View style={styles.actionButtons}>
                  <TouchableOpacity
                    style={styles.clearBtn}
                    onPress={() => handleUserAction(selectedUser.id, 'clear_flags')}
                  >
                    <Text style={styles.clearBtnText}>Clear Flags</Text>
                  </TouchableOpacity>
                  {selectedUser.account_status !== 'active' && (
                    <TouchableOpacity
                      style={styles.reactivateBtn}
                      onPress={() => handleUserAction(selectedUser.id, 'reactivate')}
                    >
                      <Text style={styles.reactivateBtnText}>Reactivate</Text>
                    </TouchableOpacity>
                  )}
                  {selectedUser.account_status === 'active' && (
                    <TouchableOpacity
                      style={styles.cancelBtn}
                      onPress={() => handleUserAction(selectedUser.id, 'cancel')}
                    >
                      <Text style={styles.cancelBtnText}>Cancel Account</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Email Modal */}
      <Modal visible={showEmailModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Send Code Email</Text>
              <TouchableOpacity onPress={() => setShowEmailModal(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <Text style={styles.emailLabel}>Code to send:</Text>
              <Text style={styles.emailCode}>{generatedCode}</Text>
              
              <Text style={styles.emailLabel}>Recipient Email:</Text>
              <TextInput
                style={styles.input}
                placeholder="user@example.com"
                placeholderTextColor="#6b7280"
                value={emailRecipient.email}
                onChangeText={(text) => setEmailRecipient(prev => ({ ...prev, email: text }))}
                keyboardType="email-address"
              />
              
              <Text style={styles.emailLabel}>Recipient Name:</Text>
              <TextInput
                style={styles.input}
                placeholder="User Name"
                placeholderTextColor="#6b7280"
                value={emailRecipient.name}
                onChangeText={(text) => setEmailRecipient(prev => ({ ...prev, name: text }))}
              />
              
              <View style={styles.emailButtons}>
                <TouchableOpacity
                  style={styles.sendWinnerBtn}
                  onPress={selectedEntry ? sendWinnerEmail : sendCodeEmail}
                  disabled={actionLoading}
                >
                  {actionLoading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name={selectedEntry ? "trophy" : "mail"} size={18} color="#fff" />
                      <Text style={styles.sendWinnerBtnText}>
                        {selectedEntry ? 'Send Winner Email' : 'Send Code Email'}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0014' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#2d1b4e' },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#1a0033', justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 18, fontWeight: '600', color: '#fff' },
  tabs: { flexDirection: 'row', padding: 12, gap: 10 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 10, backgroundColor: '#1a0033', gap: 6 },
  tabActive: { backgroundColor: '#7c3aed' },
  tabText: { fontSize: 14, color: '#9f7aea', fontWeight: '500' },
  tabTextActive: { color: '#fff' },
  content: { flex: 1, padding: 16 },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#fff', marginBottom: 12 },
  card: { backgroundColor: '#1a0033', borderRadius: 12, padding: 16, marginBottom: 16 },
  cardTitle: { fontSize: 15, fontWeight: '600', color: '#fff', marginBottom: 16 },
  successBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(16,185,129,0.1)', padding: 12, marginHorizontal: 16, borderRadius: 8, gap: 8 },
  successText: { flex: 1, color: '#10b981', fontSize: 14 },
  errorBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(239,68,68,0.1)', padding: 12, marginHorizontal: 16, borderRadius: 8, gap: 8 },
  errorText: { flex: 1, color: '#ef4444', fontSize: 14 },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorTitle: { fontSize: 24, fontWeight: 'bold', color: '#ef4444', marginTop: 16 },
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontSize: 16, color: '#9f7aea', marginTop: 12 },
  userCard: { flexDirection: 'row', backgroundColor: '#2d1b4e', padding: 14, borderRadius: 10, marginBottom: 10 },
  userInfo: { flex: 1 },
  userName: { fontSize: 15, fontWeight: '600', color: '#fff' },
  userEmail: { fontSize: 13, color: '#9f7aea', marginTop: 2 },
  userStats: { flexDirection: 'row', marginTop: 6, gap: 10 },
  statBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statText: { fontSize: 11, color: '#c4b5fd' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  statusText: { fontSize: 11, fontWeight: '600', textTransform: 'capitalize' },
  codeTypeSelector: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  codeTypeBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: '#2d1b4e', alignItems: 'center' },
  codeTypeBtnActive: { backgroundColor: '#7c3aed' },
  codeTypeBtnText: { color: '#9f7aea', fontWeight: '500' },
  codeTypeBtnTextActive: { color: '#fff' },
  input: { backgroundColor: '#2d1b4e', borderRadius: 8, padding: 12, color: '#fff', fontSize: 15, marginBottom: 12 },
  generateBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#7c3aed', padding: 14, borderRadius: 10, gap: 8 },
  generateBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  generatedCodeBox: { backgroundColor: '#2d1b4e', padding: 16, borderRadius: 10, marginTop: 16, alignItems: 'center' },
  generatedCodeLabel: { color: '#9f7aea', fontSize: 12, marginBottom: 4 },
  generatedCode: { color: '#10b981', fontSize: 22, fontWeight: 'bold', letterSpacing: 2 },
  sendEmailBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#7c3aed', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 6, marginTop: 12, gap: 6 },
  sendEmailBtnText: { color: '#fff', fontSize: 13, fontWeight: '500' },
  noEntries: { color: '#6b7280', fontStyle: 'italic', textAlign: 'center', paddingVertical: 20 },
  entryCard: { flexDirection: 'row', backgroundColor: '#2d1b4e', padding: 12, borderRadius: 8, marginBottom: 8 },
  entryCardIneligible: { opacity: 0.6 },
  entryInfo: { flex: 1 },
  entryName: { fontSize: 14, fontWeight: '500', color: '#fff' },
  entryEmail: { fontSize: 12, color: '#9f7aea', marginTop: 2 },
  entryStats: { flexDirection: 'row', marginTop: 6, gap: 10 },
  entryStat: { fontSize: 11, color: '#c4b5fd' },
  entryRight: { alignItems: 'flex-end', justifyContent: 'center' },
  eligibleBadge: { fontSize: 11, fontWeight: '600', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  eligible: { backgroundColor: 'rgba(16,185,129,0.2)', color: '#10b981' },
  ineligible: { backgroundColor: 'rgba(107,114,128,0.2)', color: '#6b7280' },
  selectWinnerBtn: { marginTop: 6, padding: 6, backgroundColor: 'rgba(255,215,0,0.2)', borderRadius: 6 },
  codeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#2d1b4e' },
  codeText: { fontSize: 14, color: '#10b981', fontWeight: '600', fontFamily: 'monospace' },
  codeUsed: { color: '#6b7280', textDecorationLine: 'line-through' },
  codeInfo: { flexDirection: 'row', gap: 10 },
  codeType: { fontSize: 11, color: '#9f7aea', textTransform: 'capitalize' },
  codeStatus: { fontSize: 11, fontWeight: '500' },
  used: { color: '#6b7280' },
  unused: { color: '#10b981' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#1a0033', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#2d1b4e' },
  modalTitle: { fontSize: 18, fontWeight: '600', color: '#fff' },
  modalBody: { padding: 16 },
  detailLabel: { fontSize: 14, color: '#9f7aea', marginBottom: 8 },
  detailValue: { color: '#fff', fontWeight: '500' },
  actionButtons: { marginTop: 20, gap: 10 },
  clearBtn: { backgroundColor: 'rgba(16,185,129,0.2)', padding: 14, borderRadius: 10, alignItems: 'center' },
  clearBtnText: { color: '#10b981', fontWeight: '600' },
  reactivateBtn: { backgroundColor: '#7c3aed', padding: 14, borderRadius: 10, alignItems: 'center' },
  reactivateBtnText: { color: '#fff', fontWeight: '600' },
  cancelBtn: { backgroundColor: 'rgba(239,68,68,0.2)', padding: 14, borderRadius: 10, alignItems: 'center' },
  cancelBtnText: { color: '#ef4444', fontWeight: '600' },
  emailLabel: { fontSize: 14, color: '#9f7aea', marginBottom: 6, marginTop: 12 },
  emailCode: { fontSize: 20, fontWeight: 'bold', color: '#10b981', textAlign: 'center', marginBottom: 16 },
  emailButtons: { marginTop: 20 },
  sendWinnerBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffd700', padding: 14, borderRadius: 10, gap: 8 },
  sendWinnerBtnText: { color: '#1a0033', fontSize: 15, fontWeight: '600' },
});
