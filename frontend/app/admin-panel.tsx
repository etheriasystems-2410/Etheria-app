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
import HeaderBanner from '../components/HeaderBanner';

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

interface AppUser {
  id: string;
  user_id: string;
  email: string;
  name: string;
  is_admin: boolean;
  admin_level: number;
  is_premium: boolean;
  is_lifetime: boolean;
  account_status: string;
  flag_count: number;
  created_at: string;
}

type TabType = 'users' | 'moderation' | 'contest';
type UserSubTab = 'flagged' | 'all';

interface ModerationStatus {
  pending_flags: number;
  suspended_users: number;
  cancelled_users: number;
  recent_actions: {
    flag_id: string;
    resolution: string;
    processed_at: string | null;
    processed_via: string;
  }[];
}

interface PendingFlag {
  id: string;
  user_id: string;
  user_email: string;
  user_name: string;
  user_flag_count: number;
  user_account_status: string;
  content_type: string;
  content_id: string;
  content: string;
  reason: string;
  status: string;
  is_test: boolean;
  created_at: string | null;
  flags_before_suspension: number;
}

export default function AdminPanel() {
  const { user, authToken } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  const [activeTab, setActiveTab] = useState<TabType>('users');
  const [userSubTab, setUserSubTab] = useState<UserSubTab>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // User moderation state
  const [flaggedUsers, setFlaggedUsers] = useState<FlaggedUser[]>([]);
  const [allUsers, setAllUsers] = useState<AppUser[]>([]);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<FlaggedUser | null>(null);
  const [selectedAppUser, setSelectedAppUser] = useState<AppUser | null>(null);
  const [userFlags, setUserFlags] = useState<UserFlag[]>([]);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showManageUserModal, setShowManageUserModal] = useState(false);
  
  // Contest state
  const [contestEntries, setContestEntries] = useState<ContestEntry[]>([]);
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [contestStatus, setContestStatus] = useState<any>(null);
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showWinnerEmailModal, setShowWinnerEmailModal] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<ContestEntry | null>(null);
  const [winnerCodeType, setWinnerCodeType] = useState<'monthly' | 'lifetime'>('lifetime');
  
  // Form state
  const [newCodeType, setNewCodeType] = useState<'monthly' | 'lifetime'>('monthly');
  const [customCode, setCustomCode] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');
  const [emailRecipient, setEmailRecipient] = useState({ email: '', name: '', user_id: '' });
  
  // Moderation state
  const [moderationStatus, setModerationStatus] = useState<ModerationStatus | null>(null);
  const [pendingFlags, setPendingFlags] = useState<PendingFlag[]>([]);
  const [processingEmails, setProcessingEmails] = useState(false);
  const [selectedFlag, setSelectedFlag] = useState<PendingFlag | null>(null);
  const [showFlagModal, setShowFlagModal] = useState(false);
  const [processingAction, setProcessingAction] = useState(false);

  // Moderation timeline state
  const [timeline, setTimeline] = useState<any | null>(null);
  const [processingTimeline, setProcessingTimeline] = useState(false);
  const [loadingTimeline, setLoadingTimeline] = useState(false);
  
  // AI Moderation Settings
  const [aiModerationEnabled, setAiModerationEnabled] = useState(true);
  const [togglingModeration, setTogglingModeration] = useState(false);
  
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (user?.is_admin) {
      loadData();
    }
  }, [user, activeTab, userSubTab]);

  const loadData = async () => {
    setLoading(true);
    if (activeTab === 'users') {
      if (userSubTab === 'flagged') {
        await fetchFlaggedUsers();
      } else {
        await fetchAllUsers();
      }
    } else if (activeTab === 'moderation') {
      await fetchModerationStatus();
    } else {
      await Promise.all([fetchContestStatus(), fetchContestEntries(), fetchPromoCodes(), fetchModerationSettings()]);
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

  const fetchAllUsers = async (search?: string) => {
    try {
      const searchParam = search || userSearchQuery ? `&search=${encodeURIComponent(search || userSearchQuery)}` : '';
      const response = await fetch(
        `${BACKEND_URL}/api/community/admin/all-users?token=${authToken}&limit=100${searchParam}`
      );
      const data = await response.json();
      if (response.ok) {
        setAllUsers(data.users);
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

  const fetchModerationSettings = async () => {
    try {
      const response = await fetch(
        `${BACKEND_URL}/api/admin/moderation/settings?token=${authToken}`
      );
      const data = await response.json();
      if (response.ok) {
        setAiModerationEnabled(data.ai_moderation_enabled);
      }
    } catch (err) {
      console.error('Error fetching moderation settings:', err);
    }
  };

  const toggleAiModeration = async () => {
    setTogglingModeration(true);
    setError(null);
    try {
      const response = await fetch(
        `${BACKEND_URL}/api/admin/moderation/settings?token=${authToken}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ai_moderation_enabled: !aiModerationEnabled
          })
        }
      );
      const data = await response.json();
      if (response.ok) {
        setAiModerationEnabled(data.ai_moderation_enabled);
        setSuccess(data.message);
      } else {
        setError(data.detail || 'Failed to update moderation settings');
      }
    } catch (err) {
      setError('Failed to toggle AI moderation');
    } finally {
      setTogglingModeration(false);
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

  const fetchModerationStatus = async () => {
    try {
      const response = await fetch(
        `${BACKEND_URL}/api/admin/moderation-status`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        }
      );
      const data = await response.json();
      if (response.ok) {
        setModerationStatus(data);
      }
    } catch (err) {
      console.error('Error:', err);
    }
    
    // Also fetch pending flags
    try {
      const flagsResponse = await fetch(
        `${BACKEND_URL}/api/community/admin/pending-flags?token=${authToken}`
      );
      const flagsData = await flagsResponse.json();
      if (flagsResponse.ok) {
        setPendingFlags(flagsData.flags || []);
      }
    } catch (err) {
      console.error('Error fetching flags:', err);
    }

    // Also fetch moderation timeline
    await fetchTimeline();
  };

  const processEmailReplies = async () => {
    setProcessingEmails(true);
    setError(null);
    try {
      const response = await fetch(
        `${BACKEND_URL}/api/admin/process-moderation-emails`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        }
      );
      const data = await response.json();
      if (response.ok) {
        if (data.details.processed > 0) {
          setSuccess(`Processed ${data.details.processed} email replies`);
        } else {
          setSuccess('No new email replies to process');
        }
        await fetchModerationStatus();
      } else {
        setError(data.detail || 'Failed to process emails');
      }
    } catch (err) {
      setError('Failed to process emails');
    } finally {
      setProcessingEmails(false);
    }
  };

  const fetchTimeline = async () => {
    setLoadingTimeline(true);
    try {
      const response = await fetch(
        `${BACKEND_URL}/api/admin/moderation/timeline`,
        { headers: { 'Authorization': `Bearer ${authToken}` } }
      );
      const data = await response.json();
      if (response.ok) {
        setTimeline(data);
      } else {
        setError(data.detail || 'Failed to load timeline');
      }
    } catch (err) {
      setError('Failed to load timeline');
    } finally {
      setLoadingTimeline(false);
    }
  };

  const processTimeline = async () => {
    setProcessingTimeline(true);
    setError(null);
    try {
      const response = await fetch(
        `${BACKEND_URL}/api/admin/moderation/process-timeline`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${authToken}` }
        }
      );
      const data = await response.json();
      if (response.ok) {
        const n = data.reactivated_count || 0;
        setSuccess(n > 0 ? `Auto-reactivated ${n} user(s)` : 'No expired suspensions to process');
        await fetchTimeline();
        await fetchModerationStatus();
      } else {
        setError(data.detail || 'Failed to process timeline');
      }
    } catch (err) {
      setError('Failed to process timeline');
    } finally {
      setProcessingTimeline(false);
    }
  };

  const simulateExpire = async (userId: string, email: string) => {
    try {
      const response = await fetch(
        `${BACKEND_URL}/api/admin/moderation/simulate-timeline`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ user_id: userId }),
        }
      );
      const data = await response.json();
      if (response.ok) {
        setSuccess(`Fast-forwarded suspension for ${email}. Click "Process Timeline" to trigger reactivation.`);
        await fetchTimeline();
      } else {
        setError(data.detail || 'Failed to fast-forward');
      }
    } catch (err) {
      setError('Failed to fast-forward');
    }
  };

  const createTestFlag = async () => {
    setActionLoading(true);
    setError(null);
    try {
      // First, we need to get a test user (not the admin)
      const usersResponse = await fetch(
        `${BACKEND_URL}/api/community/admin/all-users?token=${authToken}&limit=10`
      );
      const usersData = await usersResponse.json();
      
      if (!usersResponse.ok || !usersData.users || usersData.users.length === 0) {
        setError('No users available to create test flag');
        return;
      }
      
      // Find a non-admin user or use the first user
      const testUser = usersData.users.find((u: AppUser) => !u.is_admin) || usersData.users[0];
      
      // Create a flag via the admin endpoint
      const response = await fetch(
        `${BACKEND_URL}/api/community/admin/create-test-flag?token=${authToken}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: testUser.id,
            content_type: 'test',
            content: 'This is a test flag content for testing the email moderation system',
            reason: 'Test flag for moderation system'
          })
        }
      );
      
      const data = await response.json();
      if (response.ok) {
        setSuccess(`Test flag created! Check your email for moderation notification.`);
        await fetchModerationStatus();
      } else {
        setError(data.detail || 'Failed to create test flag');
      }
    } catch (err) {
      setError('Failed to create test flag');
    } finally {
      setActionLoading(false);
    }
  };

  const handleFlagAction = async (flagId: string, action: 'dismiss' | 'warn' | 'cancel') => {
    setProcessingAction(true);
    setError(null);
    try {
      const response = await fetch(
        `${BACKEND_URL}/api/community/admin/flag/${flagId}/action?token=${authToken}&action=${action}`,
        { method: 'POST' }
      );
      const data = await response.json();
      if (response.ok) {
        setSuccess(data.message || `Action "${action}" completed successfully`);
        setShowFlagModal(false);
        setSelectedFlag(null);
        await fetchModerationStatus();
      } else {
        setError(data.detail || `Failed to ${action} flag`);
      }
    } catch (err) {
      setError(`Failed to ${action} flag`);
    } finally {
      setProcessingAction(false);
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

  const generateAndSendWinnerEmail = async () => {
    if (!selectedEntry) return;
    
    setActionLoading(true);
    setError(null);
    try {
      // Step 1: Generate a new code
      const generateResponse = await fetch(
        `${BACKEND_URL}/api/admin/contest/generate-code?token=${authToken}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code_type: winnerCodeType,
            custom_code: ''
          })
        }
      );
      const generateData = await generateResponse.json();
      
      if (!generateResponse.ok) {
        setError(generateData.detail || 'Failed to generate code');
        return;
      }
      
      const newCode = generateData.code;
      
      // Step 2: Send the winner email with the generated code
      const emailResponse = await fetch(
        `${BACKEND_URL}/api/admin/contest/send-winner-email?token=${authToken}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: selectedEntry.user_id,
            code: newCode
          })
        }
      );
      const emailData = await emailResponse.json();
      
      if (emailResponse.ok) {
        setSuccess(`Winner email with ${winnerCodeType} code "${newCode}" sent to ${selectedEntry.email}`);
        setShowWinnerEmailModal(false);
        setSelectedEntry(null);
        fetchPromoCodes(); // Refresh the codes list
      } else {
        setError(emailData.detail || 'Failed to send winner email');
      }
    } catch (err) {
      setError('Failed to generate code and send email');
    } finally {
      setActionLoading(false);
    }
  };

  const promoteToAdmin = async (userId: string) => {
    setActionLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `${BACKEND_URL}/api/community/admin/user/${userId}/promote-admin?token=${authToken}`,
        { method: 'POST' }
      );
      const data = await response.json();
      if (response.ok) {
        setSuccess(data.message || 'User promoted to admin');
        setShowManageUserModal(false);
        fetchAllUsers();
      } else {
        setError(data.detail || 'Failed to promote user');
      }
    } catch (err) {
      setError('Failed to promote user');
    } finally {
      setActionLoading(false);
    }
  };

  const demoteFromAdmin = async (userId: string) => {
    setActionLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `${BACKEND_URL}/api/community/admin/user/${userId}/demote-admin?token=${authToken}`,
        { method: 'POST' }
      );
      const data = await response.json();
      if (response.ok) {
        setSuccess(data.message || 'Admin privileges removed');
        setShowManageUserModal(false);
        fetchAllUsers();
      } else {
        setError(data.detail || 'Failed to demote user');
      }
    } catch (err) {
      setError('Failed to demote user');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUserSearch = () => {
    fetchAllUsers(userSearchQuery);
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
      {/* Header Banner */}
      <HeaderBanner title="Admin Panel" height={100} />
      
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
          style={[styles.tab, activeTab === 'moderation' && styles.tabActive]}
          onPress={() => setActiveTab('moderation')}
        >
          <Ionicons name="shield" size={20} color={activeTab === 'moderation' ? '#fff' : '#9f7aea'} />
          <Text style={[styles.tabText, activeTab === 'moderation' && styles.tabTextActive]}>Moderation</Text>
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
              /* All Users Section */
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
                      onPress={() => {
                        setSelectedAppUser(appUser);
                        setShowManageUserModal(true);
                      }}
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
              /* Flagged Users Section */
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
            )}
          </View>
        ) : activeTab === 'moderation' ? (
          /* Moderation Tab */
          <View style={styles.section}>
            {/* Status Overview */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>
                <Ionicons name="shield-checkmark" size={18} color="#b794f6" /> Moderation Overview
              </Text>
              
              <View style={styles.statsGrid}>
                <View style={styles.statCard}>
                  <Text style={styles.statNumber}>{moderationStatus?.pending_flags || 0}</Text>
                  <Text style={styles.statLabel}>Pending Flags</Text>
                  <View style={[styles.statIcon, { backgroundColor: 'rgba(245, 158, 11, 0.2)' }]}>
                    <Ionicons name="flag" size={20} color="#f59e0b" />
                  </View>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statNumber}>{moderationStatus?.suspended_users || 0}</Text>
                  <Text style={styles.statLabel}>Suspended</Text>
                  <View style={[styles.statIcon, { backgroundColor: 'rgba(239, 68, 68, 0.2)' }]}>
                    <Ionicons name="pause-circle" size={20} color="#ef4444" />
                  </View>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statNumber}>{moderationStatus?.cancelled_users || 0}</Text>
                  <Text style={styles.statLabel}>Cancelled</Text>
                  <View style={[styles.statIcon, { backgroundColor: 'rgba(107, 114, 128, 0.2)' }]}>
                    <Ionicons name="close-circle" size={20} color="#6b7280" />
                  </View>
                </View>
              </View>
            </View>

            {/* Pending Flags - Flagged Content Review */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>
                <Ionicons name="flag" size={18} color="#f59e0b" /> Flagged Content ({pendingFlags.length})
              </Text>
              
              {pendingFlags.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="checkmark-circle-outline" size={40} color="#10b981" />
                  <Text style={styles.emptyText}>No pending flags to review</Text>
                </View>
              ) : (
                pendingFlags.map((flag) => (
                  <TouchableOpacity
                    key={flag.id}
                    style={styles.flagCard}
                    onPress={() => {
                      setSelectedFlag(flag);
                      setShowFlagModal(true);
                    }}
                  >
                    <View style={styles.flagHeader}>
                      <View style={styles.flagUserInfo}>
                        <Text style={styles.flagUserName}>{flag.user_name}</Text>
                        <Text style={styles.flagUserEmail}>{flag.user_email}</Text>
                      </View>
                      <View style={styles.flagMeta}>
                        <View style={[styles.flagTypeBadge, flag.is_test && { backgroundColor: 'rgba(245, 158, 11, 0.2)' }]}>
                          <Text style={[styles.flagTypeText, flag.is_test && { color: '#f59e0b' }]}>
                            {flag.is_test ? 'TEST' : flag.content_type}
                          </Text>
                        </View>
                        <Text style={styles.flagDate}>{flag.created_at ? formatDate(flag.created_at) : 'N/A'}</Text>
                      </View>
                    </View>
                    
                    <View style={styles.flagContentPreview}>
                      <Text style={styles.flagReason}>{flag.reason}</Text>
                      <Text style={styles.flagContentText} numberOfLines={2}>
                        "{flag.content}"
                      </Text>
                    </View>
                    
                    <View style={styles.flagFooter}>
                      <View style={styles.flagWarningCount}>
                        <Ionicons name="warning" size={14} color="#f59e0b" />
                        <Text style={styles.flagWarningText}>
                          {flag.user_flag_count}/{flag.flags_before_suspension} warnings
                        </Text>
                      </View>
                      <View style={styles.flagActions}>
                        <TouchableOpacity 
                          style={[styles.flagActionBtn, styles.dismissBtn]}
                          onPress={(e) => {
                            e.stopPropagation();
                            handleFlagAction(flag.id, 'dismiss');
                          }}
                        >
                          <Ionicons name="checkmark" size={16} color="#10b981" />
                        </TouchableOpacity>
                        <TouchableOpacity 
                          style={[styles.flagActionBtn, styles.warnBtn]}
                          onPress={(e) => {
                            e.stopPropagation();
                            handleFlagAction(flag.id, 'warn');
                          }}
                        >
                          <Ionicons name="warning" size={16} color="#f59e0b" />
                        </TouchableOpacity>
                        <TouchableOpacity 
                          style={[styles.flagActionBtn, styles.cancelAccountBtn]}
                          onPress={(e) => {
                            e.stopPropagation();
                            setSelectedFlag(flag);
                            setShowFlagModal(true);
                          }}
                        >
                          <Ionicons name="ban" size={16} color="#ef4444" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </View>

            {/* Email Processing */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>
                <Ionicons name="mail" size={18} color="#10b981" /> Email Reply Processing
              </Text>
              
              <Text style={styles.helpText}>
                Process email replies from admin inbox. Reply commands: good, okay, bad, cancel
              </Text>
              
              <TouchableOpacity
                style={[styles.processBtn, processingEmails && styles.processBtnDisabled]}
                onPress={processEmailReplies}
                disabled={processingEmails}
              >
                {processingEmails ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="refresh" size={18} color="#fff" />
                    <Text style={styles.processBtnText}>Check Inbox & Process Replies</Text>
                  </>
                )}
              </TouchableOpacity>
              
              <View style={styles.emailInfoBox}>
                <Ionicons name="information-circle" size={16} color="#9f7aea" />
                <Text style={styles.emailInfoText}>
                  Auto-checks every 5 minutes. Replies to "Flagged for Review" emails are processed automatically.
                </Text>
              </View>
            </View>

            {/* Test Flag */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>
                <Ionicons name="bug" size={18} color="#f59e0b" /> Test Email Flow
              </Text>
              
              <Text style={styles.helpText}>
                Create a test flag to verify the email notification and reply system works correctly.
              </Text>
              
              <TouchableOpacity
                style={styles.testFlagBtn}
                onPress={createTestFlag}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <ActivityIndicator size="small" color="#1a0033" />
                ) : (
                  <>
                    <Ionicons name="flask" size={18} color="#1a0033" />
                    <Text style={styles.testFlagBtnText}>Create Test Flag</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* Automated Moderation Timeline */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>
                <Ionicons name="hourglass" size={18} color="#7c3aed" /> Automated Timeline
              </Text>

              <Text style={styles.helpText}>
                Auto-reactivates suspended users when their suspension ends. Runs hourly in the background.
              </Text>

              {timeline && (
                <View style={styles.statsGrid}>
                  <View style={styles.statCard}>
                    <Text style={styles.statNumber}>{timeline.counts?.active_suspensions || 0}</Text>
                    <Text style={styles.statLabel}>Active Suspensions</Text>
                    <View style={[styles.statIcon, { backgroundColor: 'rgba(239, 68, 68, 0.2)' }]}>
                      <Ionicons name="pause-circle" size={20} color="#ef4444" />
                    </View>
                  </View>
                  <View style={styles.statCard}>
                    <Text style={styles.statNumber}>{timeline.counts?.expired_suspensions || 0}</Text>
                    <Text style={styles.statLabel}>Pending Reactivation</Text>
                    <View style={[styles.statIcon, { backgroundColor: 'rgba(16, 185, 129, 0.2)' }]}>
                      <Ionicons name="time" size={20} color="#10b981" />
                    </View>
                  </View>
                  <View style={styles.statCard}>
                    <Text style={styles.statNumber}>{timeline.counts?.users_with_warnings || 0}</Text>
                    <Text style={styles.statLabel}>Users w/ Warnings</Text>
                    <View style={[styles.statIcon, { backgroundColor: 'rgba(245, 158, 11, 0.2)' }]}>
                      <Ionicons name="warning" size={20} color="#f59e0b" />
                    </View>
                  </View>
                </View>
              )}

              <TouchableOpacity
                style={[styles.processBtn, processingTimeline && styles.processBtnDisabled]}
                onPress={processTimeline}
                disabled={processingTimeline}
              >
                {processingTimeline ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="refresh-circle" size={18} color="#fff" />
                    <Text style={styles.processBtnText}>Process Timeline Now</Text>
                  </>
                )}
              </TouchableOpacity>

              {timeline?.active_suspensions?.length > 0 && (
                <View style={{ marginTop: 12 }}>
                  <Text style={[styles.helpText, { fontWeight: '600', color: '#e9d5ff' }]}>
                    Active Suspensions
                  </Text>
                  {timeline.active_suspensions.map((u: any) => (
                    <View key={u.user_id} style={styles.timelineRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.timelineEmail}>{u.email}</Text>
                        <Text style={styles.timelineMeta}>
                          Suspension #{u.suspension_count} • {u.days_remaining}d remaining • ends {u.suspension_end ? new Date(u.suspension_end).toLocaleDateString() : 'N/A'}
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={styles.ffBtn}
                        onPress={() => simulateExpire(u.user_id, u.email)}
                      >
                        <Ionicons name="play-forward" size={14} color="#1a0033" />
                        <Text style={styles.ffBtnText}>Fast-Fwd</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}

              {timeline?.expired_suspensions?.length > 0 && (
                <View style={{ marginTop: 12 }}>
                  <Text style={[styles.helpText, { fontWeight: '600', color: '#10b981' }]}>
                    Pending Auto-Reactivation
                  </Text>
                  {timeline.expired_suspensions.map((u: any) => (
                    <View key={u.user_id} style={styles.timelineRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.timelineEmail}>{u.email}</Text>
                        <Text style={styles.timelineMeta}>
                          Expired {u.suspension_end ? new Date(u.suspension_end).toLocaleString() : 'N/A'}
                        </Text>
                      </View>
                      <Ionicons name="hourglass-outline" size={18} color="#10b981" />
                    </View>
                  ))}
                </View>
              )}

              {timeline?.cancelled_accounts?.length > 0 && (
                <View style={{ marginTop: 12 }}>
                  <Text style={[styles.helpText, { fontWeight: '600', color: '#ef4444' }]}>
                    Cancelled Accounts ({timeline.cancelled_accounts.length})
                  </Text>
                  {timeline.cancelled_accounts.slice(0, 5).map((u: any) => (
                    <View key={u.user_id} style={styles.timelineRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.timelineEmail}>{u.email}</Text>
                        <Text style={styles.timelineMeta}>
                          {u.cancellation_reason || 'repeated_violations'} • {u.cancelled_at ? new Date(u.cancelled_at).toLocaleDateString() : 'N/A'}
                        </Text>
                      </View>
                      <Ionicons name="ban" size={18} color="#ef4444" />
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* Moderation Rules */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>
                <Ionicons name="document-text" size={18} color="#c4b5fd" /> Moderation Rules
              </Text>
              
              <View style={styles.rulesList}>
                <View style={styles.ruleItem}>
                  <View style={[styles.ruleBadge, { backgroundColor: 'rgba(245, 158, 11, 0.2)' }]}>
                    <Text style={[styles.ruleBadgeText, { color: '#f59e0b' }]}>1-2</Text>
                  </View>
                  <Text style={styles.ruleText}>Flags: Warning email sent</Text>
                </View>
                <View style={styles.ruleItem}>
                  <View style={[styles.ruleBadge, { backgroundColor: 'rgba(239, 68, 68, 0.2)' }]}>
                    <Text style={[styles.ruleBadgeText, { color: '#ef4444' }]}>3</Text>
                  </View>
                  <Text style={styles.ruleText}>Flags: 14-day suspension</Text>
                </View>
                <View style={styles.ruleItem}>
                  <View style={[styles.ruleBadge, { backgroundColor: 'rgba(239, 68, 68, 0.2)' }]}>
                    <Text style={[styles.ruleBadgeText, { color: '#ef4444' }]}>6</Text>
                  </View>
                  <Text style={styles.ruleText}>Flags: 30-day suspension</Text>
                </View>
                <View style={styles.ruleItem}>
                  <View style={[styles.ruleBadge, { backgroundColor: 'rgba(107, 114, 128, 0.2)' }]}>
                    <Text style={[styles.ruleBadgeText, { color: '#6b7280' }]}>9+</Text>
                  </View>
                  <Text style={styles.ruleText}>Flags: Account cancelled</Text>
                </View>
              </View>
            </View>

            {/* Recent Actions */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>
                <Ionicons name="time" size={18} color="#9f7aea" /> Recent Actions
              </Text>
              
              {!moderationStatus?.recent_actions || moderationStatus.recent_actions.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="checkmark-circle-outline" size={40} color="#6b7280" />
                  <Text style={styles.emptyText}>No recent moderation actions</Text>
                </View>
              ) : (
                moderationStatus.recent_actions.map((action, index) => (
                  <View key={index} style={styles.actionItem}>
                    <View style={styles.actionIcon}>
                      <Ionicons 
                        name={
                          action.resolution === 'approved' ? 'checkmark-circle' :
                          action.resolution === 'warning_issued' ? 'warning' :
                          action.resolution === 'account_cancelled' ? 'close-circle' : 'help-circle'
                        } 
                        size={20} 
                        color={
                          action.resolution === 'approved' ? '#10b981' :
                          action.resolution === 'warning_issued' ? '#f59e0b' :
                          action.resolution === 'account_cancelled' ? '#ef4444' : '#9f7aea'
                        } 
                      />
                    </View>
                    <View style={styles.actionContent}>
                      <Text style={styles.actionResolution}>
                        {action.resolution?.replace(/_/g, ' ').replace(/^\w/, (c: string) => c.toUpperCase()) || 'Unknown'}
                      </Text>
                      <Text style={styles.actionMeta}>
                        Via {action.processed_via || 'admin_panel'} • {action.processed_at ? formatDate(action.processed_at) : 'N/A'}
                      </Text>
                    </View>
                  </View>
                ))
              )}
            </View>
          </View>
        ) : (
          /* Contest Tab */
          <View style={styles.section}>
            {/* AI Moderation Settings */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>
                <Ionicons name="shield-checkmark" size={18} color="#10b981" /> AI Content Moderation
              </Text>
              
              <View style={styles.moderationToggleRow}>
                <View style={styles.moderationToggleInfo}>
                  <Text style={styles.moderationToggleLabel}>
                    {aiModerationEnabled ? 'Active' : 'Disabled'}
                  </Text>
                  <Text style={styles.moderationToggleDescription}>
                    {aiModerationEnabled 
                      ? 'AI is automatically reviewing content for policy violations' 
                      : 'AI moderation is turned off - content is not being reviewed'}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[
                    styles.moderationToggleBtn,
                    aiModerationEnabled ? styles.moderationToggleBtnActive : styles.moderationToggleBtnInactive
                  ]}
                  onPress={toggleAiModeration}
                  disabled={togglingModeration}
                >
                  {togglingModeration ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <View style={styles.toggleSwitch}>
                      <View style={[
                        styles.toggleKnob,
                        aiModerationEnabled ? styles.toggleKnobActive : styles.toggleKnobInactive
                      ]} />
                    </View>
                  )}
                </TouchableOpacity>
              </View>
              
              <View style={styles.moderationStatusBadge}>
                <View style={[
                  styles.statusDot,
                  { backgroundColor: aiModerationEnabled ? '#10b981' : '#ef4444' }
                ]} />
                <Text style={[
                  styles.statusText,
                  { color: aiModerationEnabled ? '#10b981' : '#ef4444' }
                ]}>
                  {aiModerationEnabled ? 'Monitoring Active' : 'Monitoring Paused'}
                </Text>
              </View>
            </View>

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
                      {entry.eligible && (
                        <TouchableOpacity
                          style={styles.sendWinnerEmailBtn}
                          onPress={() => {
                            setSelectedEntry(entry);
                            setEmailRecipient({ email: entry.email, name: entry.name || '', user_id: entry.user_id });
                            setShowWinnerEmailModal(true);
                          }}
                        >
                          <Ionicons name="mail" size={14} color="#fff" />
                          <Text style={styles.sendWinnerEmailBtnText}>Send Code</Text>
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

      {/* Winner Email Modal */}
      <Modal visible={showWinnerEmailModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Send Winner Email</Text>
              <TouchableOpacity onPress={() => {
                setShowWinnerEmailModal(false);
                setSelectedEntry(null);
              }}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              {selectedEntry && (
                <>
                  <View style={styles.winnerInfoBox}>
                    <Ionicons name="trophy" size={40} color="#ffd700" />
                    <Text style={styles.winnerName}>{selectedEntry.name || selectedEntry.email}</Text>
                    <Text style={styles.winnerEmail}>{selectedEntry.email}</Text>
                  </View>
                  
                  <Text style={styles.emailLabel}>Select Code Type:</Text>
                  <View style={styles.codeTypeSelector}>
                    <TouchableOpacity
                      style={[styles.codeTypeBtn, winnerCodeType === 'monthly' && styles.codeTypeBtnActive]}
                      onPress={() => setWinnerCodeType('monthly')}
                    >
                      <Text style={[styles.codeTypeBtnText, winnerCodeType === 'monthly' && styles.codeTypeBtnTextActive]}>
                        Monthly
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.codeTypeBtn, winnerCodeType === 'lifetime' && styles.codeTypeBtnActive]}
                      onPress={() => setWinnerCodeType('lifetime')}
                    >
                      <Text style={[styles.codeTypeBtnText, winnerCodeType === 'lifetime' && styles.codeTypeBtnTextActive]}>
                        Lifetime
                      </Text>
                    </TouchableOpacity>
                  </View>
                  
                  <Text style={styles.winnerNote}>
                    A new {winnerCodeType} code will be generated and emailed to the winner with congratulations.
                  </Text>
                  
                  <TouchableOpacity
                    style={styles.sendWinnerBtn}
                    onPress={generateAndSendWinnerEmail}
                    disabled={actionLoading}
                  >
                    {actionLoading ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Ionicons name="send" size={18} color="#fff" />
                        <Text style={styles.sendWinnerBtnText}>Generate Code & Send Email</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* Manage User Modal */}
      <Modal visible={showManageUserModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Manage User</Text>
              <TouchableOpacity onPress={() => setShowManageUserModal(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            {selectedAppUser && (
              <ScrollView style={styles.modalBody}>
                <View style={styles.userDetailCard}>
                  <View style={styles.userDetailHeader}>
                    {selectedAppUser.is_admin && (
                      <View style={styles.adminBadgeLarge}>
                        <Ionicons name="shield-checkmark" size={16} color="#ffd700" />
                        <Text style={styles.adminBadgeLargeText}>Admin</Text>
                      </View>
                    )}
                    <Text style={styles.userDetailName}>{selectedAppUser.name || 'Anonymous'}</Text>
                    <Text style={styles.userDetailEmail}>{selectedAppUser.email}</Text>
                  </View>

                  <View style={styles.userDetailStats}>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Status:</Text>
                      <Text style={[styles.detailValue, { color: getStatusColor(selectedAppUser.account_status) }]}>
                        {selectedAppUser.account_status}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Subscription:</Text>
                      <Text style={[styles.detailValue, { color: selectedAppUser.is_premium ? '#10b981' : '#6b7280' }]}>
                        {selectedAppUser.is_lifetime ? 'Lifetime Premium' : selectedAppUser.is_premium ? 'Premium' : 'Free'}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Admin Level:</Text>
                      <Text style={styles.detailValue}>{selectedAppUser.admin_level || 0}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Flags:</Text>
                      <Text style={[styles.detailValue, selectedAppUser.flag_count > 0 && { color: '#f59e0b' }]}>
                        {selectedAppUser.flag_count}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Joined:</Text>
                      <Text style={styles.detailValue}>{formatDate(selectedAppUser.created_at)}</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.actionButtons}>
                  {!selectedAppUser.is_admin ? (
                    <TouchableOpacity
                      style={styles.promoteBtn}
                      onPress={() => promoteToAdmin(selectedAppUser.id)}
                      disabled={actionLoading}
                    >
                      {actionLoading ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <>
                          <Ionicons name="shield-checkmark" size={18} color="#fff" />
                          <Text style={styles.promoteBtnText}>Promote to Admin</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  ) : selectedAppUser.email !== user?.email && selectedAppUser.admin_level < 10 ? (
                    <TouchableOpacity
                      style={styles.demoteBtn}
                      onPress={() => demoteFromAdmin(selectedAppUser.id)}
                      disabled={actionLoading}
                    >
                      {actionLoading ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <>
                          <Ionicons name="shield-outline" size={18} color="#fff" />
                          <Text style={styles.demoteBtnText}>Remove Admin</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.selfNote}>
                      <Ionicons name="information-circle" size={16} color="#9f7aea" />
                      <Text style={styles.selfNoteText}>
                        {selectedAppUser.email === user?.email 
                          ? "You cannot modify your own admin status" 
                          : "Top-level admins cannot be demoted"}
                      </Text>
                    </View>
                  )}
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Flag Detail Modal */}
      <Modal visible={showFlagModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Flag Details</Text>
              <TouchableOpacity onPress={() => { setShowFlagModal(false); setSelectedFlag(null); }}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            {selectedFlag && (
              <ScrollView style={styles.modalBody}>
                {/* User Info */}
                <View style={styles.flagDetailSection}>
                  <Text style={styles.flagDetailLabel}>Flagged User</Text>
                  <View style={styles.flagDetailUserCard}>
                    <Text style={styles.flagDetailUserName}>{selectedFlag.user_name}</Text>
                    <Text style={styles.flagDetailUserEmail}>{selectedFlag.user_email}</Text>
                    <View style={styles.flagDetailUserStats}>
                      <View style={styles.flagDetailStat}>
                        <Ionicons name="warning" size={14} color="#f59e0b" />
                        <Text style={styles.flagDetailStatText}>
                          {selectedFlag.user_flag_count}/{selectedFlag.flags_before_suspension} warnings
                        </Text>
                      </View>
                      <View style={[styles.flagDetailStat, { backgroundColor: getStatusColor(selectedFlag.user_account_status) + '20' }]}>
                        <Text style={[styles.flagDetailStatText, { color: getStatusColor(selectedFlag.user_account_status) }]}>
                          {selectedFlag.user_account_status}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>

                {/* Flag Reason */}
                <View style={styles.flagDetailSection}>
                  <Text style={styles.flagDetailLabel}>Flag Reason</Text>
                  <View style={styles.flagReasonCard}>
                    <Ionicons name="flag" size={16} color="#ef4444" />
                    <Text style={styles.flagReasonText}>{selectedFlag.reason}</Text>
                  </View>
                </View>

                {/* Flagged Content */}
                <View style={styles.flagDetailSection}>
                  <Text style={styles.flagDetailLabel}>Flagged Content ({selectedFlag.content_type})</Text>
                  <View style={styles.flagContentCard}>
                    <Text style={styles.flagContentFullText}>"{selectedFlag.content}"</Text>
                  </View>
                </View>

                {/* Meta Info */}
                <View style={styles.flagDetailSection}>
                  <View style={styles.flagMetaRow}>
                    <Text style={styles.flagMetaLabel}>Created:</Text>
                    <Text style={styles.flagMetaValue}>{selectedFlag.created_at ? formatDate(selectedFlag.created_at) : 'N/A'}</Text>
                  </View>
                  {selectedFlag.is_test && (
                    <View style={styles.testFlagWarning}>
                      <Ionicons name="flask" size={16} color="#f59e0b" />
                      <Text style={styles.testFlagWarningText}>This is a test flag</Text>
                    </View>
                  )}
                </View>

                {/* Action Buttons */}
                <View style={styles.flagActionButtons}>
                  <Text style={styles.flagActionTitle}>Take Action</Text>
                  
                  <TouchableOpacity
                    style={[styles.flagFullActionBtn, styles.dismissFullBtn]}
                    onPress={() => handleFlagAction(selectedFlag.id, 'dismiss')}
                    disabled={processingAction}
                  >
                    {processingAction ? (
                      <ActivityIndicator size="small" color="#10b981" />
                    ) : (
                      <>
                        <Ionicons name="checkmark-circle" size={20} color="#10b981" />
                        <View style={styles.flagActionBtnContent}>
                          <Text style={styles.dismissFullBtnText}>Dismiss Flag</Text>
                          <Text style={styles.flagActionBtnHint}>Content is acceptable, no action needed</Text>
                        </View>
                      </>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.flagFullActionBtn, styles.warnFullBtn]}
                    onPress={() => handleFlagAction(selectedFlag.id, 'warn')}
                    disabled={processingAction}
                  >
                    {processingAction ? (
                      <ActivityIndicator size="small" color="#f59e0b" />
                    ) : (
                      <>
                        <Ionicons name="warning" size={20} color="#f59e0b" />
                        <View style={styles.flagActionBtnContent}>
                          <Text style={styles.warnFullBtnText}>Issue Warning</Text>
                          <Text style={styles.flagActionBtnHint}>
                            Send warning email ({selectedFlag.user_flag_count + 1}/{selectedFlag.flags_before_suspension})
                          </Text>
                        </View>
                      </>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.flagFullActionBtn, styles.cancelFullBtn]}
                    onPress={() => handleFlagAction(selectedFlag.id, 'cancel')}
                    disabled={processingAction}
                  >
                    {processingAction ? (
                      <ActivityIndicator size="small" color="#ef4444" />
                    ) : (
                      <>
                        <Ionicons name="ban" size={20} color="#ef4444" />
                        <View style={styles.flagActionBtnContent}>
                          <Text style={styles.cancelFullBtnText}>Cancel Account</Text>
                          <Text style={styles.flagActionBtnHint}>Permanently ban this user</Text>
                        </View>
                      </>
                    )}
                  </TouchableOpacity>
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
  // New styles for user management
  subTabs: { flexDirection: 'row', marginBottom: 16, gap: 8 },
  subTab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#2d1b4e' },
  subTabActive: { backgroundColor: '#7c3aed' },
  subTabText: { fontSize: 13, color: '#9f7aea', fontWeight: '500' },
  subTabTextActive: { color: '#fff' },
  searchContainer: { flexDirection: 'row', marginBottom: 16, gap: 10 },
  searchInput: { flex: 1, backgroundColor: '#2d1b4e', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, color: '#fff', fontSize: 14 },
  searchButton: { width: 44, height: 44, borderRadius: 10, backgroundColor: '#7c3aed', justifyContent: 'center', alignItems: 'center' },
  adminUserCard: { borderWidth: 1, borderColor: 'rgba(255, 215, 0, 0.3)' },
  userNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  adminIndicator: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255, 215, 0, 0.15)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, gap: 4 },
  adminIndicatorText: { fontSize: 10, fontWeight: '700', color: '#ffd700' },
  userDetailCard: { backgroundColor: '#2d1b4e', borderRadius: 12, padding: 16, marginBottom: 16 },
  userDetailHeader: { alignItems: 'center', marginBottom: 16 },
  adminBadgeLarge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255, 215, 0, 0.2)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, gap: 6, marginBottom: 10 },
  adminBadgeLargeText: { fontSize: 12, fontWeight: '700', color: '#ffd700' },
  userDetailName: { fontSize: 18, fontWeight: '600', color: '#fff', marginBottom: 4 },
  userDetailEmail: { fontSize: 14, color: '#9f7aea' },
  userDetailStats: { gap: 8 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#1a0033' },
  promoteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffd700', padding: 14, borderRadius: 10, gap: 8 },
  promoteBtnText: { color: '#1a0033', fontSize: 15, fontWeight: '600' },
  demoteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#ef4444', padding: 14, borderRadius: 10, gap: 8 },
  demoteBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  selfNote: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(159, 122, 234, 0.1)', padding: 14, borderRadius: 10, gap: 8 },
  selfNoteText: { flex: 1, color: '#9f7aea', fontSize: 13, fontStyle: 'italic' },
  // Moderation tab styles
  statsGrid: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  statCard: { flex: 1, backgroundColor: '#2d1b4e', borderRadius: 10, padding: 12, alignItems: 'center', position: 'relative' },
  statNumber: { fontSize: 28, fontWeight: 'bold', color: '#fff' },
  statLabel: { fontSize: 11, color: '#9f7aea', marginTop: 4 },
  statIcon: { position: 'absolute', top: 8, right: 8, width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  helpText: { fontSize: 13, color: '#c4b5fd', marginBottom: 16, lineHeight: 18 },
  processBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#10b981', padding: 14, borderRadius: 10, gap: 8 },
  processBtnDisabled: { opacity: 0.6 },
  processBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  emailInfoBox: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: 'rgba(159, 122, 234, 0.1)', padding: 12, borderRadius: 8, marginTop: 12, gap: 8 },
  emailInfoText: { flex: 1, fontSize: 12, color: '#9f7aea', lineHeight: 16 },
  testFlagBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f59e0b', padding: 14, borderRadius: 10, gap: 8 },
  testFlagBtnText: { color: '#1a0033', fontSize: 15, fontWeight: '600' },
  rulesList: { gap: 10 },
  ruleItem: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  ruleBadge: { width: 36, height: 36, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  ruleBadgeText: { fontSize: 14, fontWeight: 'bold' },
  ruleText: { flex: 1, fontSize: 14, color: '#e9d5ff' },
  actionItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#2d1b4e', gap: 12 },
  actionIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#2d1b4e', justifyContent: 'center', alignItems: 'center' },
  actionContent: { flex: 1 },
  actionResolution: { fontSize: 14, color: '#fff', fontWeight: '500', textTransform: 'capitalize' },
  actionMeta: { fontSize: 11, color: '#9f7aea', marginTop: 2 },
  // Flagged Content styles
  flagCard: { backgroundColor: '#2d1b4e', borderRadius: 10, padding: 14, marginBottom: 12, borderLeftWidth: 3, borderLeftColor: '#f59e0b' },
  flagHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  flagUserInfo: { flex: 1 },
  flagUserName: { fontSize: 15, fontWeight: '600', color: '#fff' },
  flagUserEmail: { fontSize: 12, color: '#9f7aea', marginTop: 2 },
  flagMeta: { alignItems: 'flex-end' },
  flagTypeBadge: { backgroundColor: 'rgba(124, 58, 237, 0.2)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  flagTypeText: { fontSize: 10, fontWeight: '600', color: '#7c3aed', textTransform: 'uppercase' },
  flagDate: { fontSize: 10, color: '#6b7280', marginTop: 4 },
  flagContentPreview: { marginBottom: 12 },
  flagReason: { fontSize: 12, color: '#ef4444', fontWeight: '500', marginBottom: 4 },
  flagContentText: { fontSize: 13, color: '#c4b5fd', fontStyle: 'italic' },
  flagFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  flagWarningCount: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  flagWarningText: { fontSize: 12, color: '#f59e0b' },
  flagActions: { flexDirection: 'row', gap: 8 },
  flagActionBtn: { width: 36, height: 36, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  dismissBtn: { backgroundColor: 'rgba(16, 185, 129, 0.2)' },
  warnBtn: { backgroundColor: 'rgba(245, 158, 11, 0.2)' },
  cancelAccountBtn: { backgroundColor: 'rgba(239, 68, 68, 0.2)' },
  // Flag Detail Modal styles
  flagDetailSection: { marginBottom: 20 },
  flagDetailLabel: { fontSize: 12, fontWeight: '600', color: '#9f7aea', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  flagDetailUserCard: { backgroundColor: '#2d1b4e', borderRadius: 10, padding: 14 },
  flagDetailUserName: { fontSize: 17, fontWeight: '600', color: '#fff' },
  flagDetailUserEmail: { fontSize: 13, color: '#9f7aea', marginTop: 2 },
  flagDetailUserStats: { flexDirection: 'row', gap: 10, marginTop: 10 },
  flagDetailStat: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(245, 158, 11, 0.15)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, gap: 6 },
  flagDetailStatText: { fontSize: 12, color: '#f59e0b', fontWeight: '500' },
  flagReasonCard: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: 'rgba(239, 68, 68, 0.1)', borderRadius: 10, padding: 14, gap: 10 },
  flagReasonText: { flex: 1, fontSize: 14, color: '#ef4444', fontWeight: '500' },
  flagContentCard: { backgroundColor: '#2d1b4e', borderRadius: 10, padding: 14 },
  flagContentFullText: { fontSize: 14, color: '#e9d5ff', lineHeight: 20, fontStyle: 'italic' },
  flagMetaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  flagMetaLabel: { fontSize: 13, color: '#9f7aea' },
  flagMetaValue: { fontSize: 13, color: '#fff' },
  testFlagWarning: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(245, 158, 11, 0.1)', padding: 10, borderRadius: 8, gap: 8, marginTop: 10 },
  testFlagWarningText: { fontSize: 13, color: '#f59e0b' },
  flagActionButtons: { marginTop: 10 },
  flagActionTitle: { fontSize: 14, fontWeight: '600', color: '#fff', marginBottom: 14 },
  flagFullActionBtn: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 12, marginBottom: 10, gap: 14 },
  dismissFullBtn: { backgroundColor: 'rgba(16, 185, 129, 0.1)', borderWidth: 1, borderColor: 'rgba(16, 185, 129, 0.3)' },
  warnFullBtn: { backgroundColor: 'rgba(245, 158, 11, 0.1)', borderWidth: 1, borderColor: 'rgba(245, 158, 11, 0.3)' },
  cancelFullBtn: { backgroundColor: 'rgba(239, 68, 68, 0.1)', borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.3)' },
  flagActionBtnContent: { flex: 1 },
  dismissFullBtnText: { fontSize: 15, fontWeight: '600', color: '#10b981' },
  warnFullBtnText: { fontSize: 15, fontWeight: '600', color: '#f59e0b' },
  cancelFullBtnText: { fontSize: 15, fontWeight: '600', color: '#ef4444' },
  flagActionBtnHint: { fontSize: 12, color: '#9f7aea', marginTop: 2 },
  // Winner email button and modal styles
  sendWinnerEmailBtn: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#10b981', 
    paddingHorizontal: 10, 
    paddingVertical: 6, 
    borderRadius: 6, 
    gap: 4,
    marginTop: 6 
  },
  sendWinnerEmailBtnText: { 
    fontSize: 11, 
    fontWeight: '600', 
    color: '#fff' 
  },
  winnerInfoBox: { 
    alignItems: 'center', 
    backgroundColor: 'rgba(255, 215, 0, 0.1)', 
    padding: 20, 
    borderRadius: 12, 
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.3)'
  },
  winnerName: { 
    fontSize: 18, 
    fontWeight: '700', 
    color: '#fff', 
    marginTop: 12 
  },
  winnerEmail: { 
    fontSize: 14, 
    color: '#9f7aea', 
    marginTop: 4 
  },
  winnerNote: { 
    fontSize: 13, 
    color: '#c4b5fd', 
    textAlign: 'center', 
    marginTop: 16, 
    marginBottom: 20,
    lineHeight: 18
  },
  // AI Moderation Toggle Styles
  moderationToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    marginBottom: 12,
  },
  moderationToggleInfo: {
    flex: 1,
    marginRight: 16,
  },
  moderationToggleLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  moderationToggleDescription: {
    fontSize: 12,
    color: '#9f7aea',
    lineHeight: 16,
  },
  moderationToggleBtn: {
    width: 60,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  moderationToggleBtnActive: {
    backgroundColor: '#10b981',
  },
  moderationToggleBtnInactive: {
    backgroundColor: '#4b5563',
  },
  toggleSwitch: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
  },
  toggleKnob: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fff',
  },
  toggleKnobActive: {
    alignSelf: 'flex-end',
  },
  toggleKnobInactive: {
    alignSelf: 'flex-start',
  },
  moderationStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '500',
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(124, 58, 237, 0.08)',
    borderRadius: 8,
    padding: 10,
    marginTop: 6,
    gap: 8,
  },
  timelineEmail: {
    fontSize: 13,
    color: '#e9d5ff',
    fontWeight: '600',
  },
  timelineMeta: {
    fontSize: 11,
    color: '#9f7aea',
    marginTop: 2,
  },
  ffBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fbbf24',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  ffBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1a0033',
  },
});
