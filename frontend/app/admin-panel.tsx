import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Switch,
  Alert,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import HeaderBanner from '../components/HeaderBanner';
import { adminStyles as styles } from '../components/admin/styles';
import {
  AppUser,
  ContestEntry,
  FlaggedUser,
  ModerationStatus,
  PendingFlag,
  PromoCode,
  TabType,
  UserFlag,
  UserSubTab,
} from '../components/admin/types';
import UsersTab from '../components/admin/UsersTab';
import ModerationTab from '../components/admin/ModerationTab';
import ContestTab from '../components/admin/ContestTab';
import {
  EmailModal,
  FlagDetailModal,
  ManageUserModal,
  UserModal,
  WinnerEmailModal,
} from '../components/admin/modals';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

export default function AdminPanel() {
  const { user, authToken, previewAsFree, setPreviewAsFree, refreshAuth } = useAuth();
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
  const [, setContestStatus] = useState<any>(null);
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

  // AI Moderation Settings
  const [aiModerationEnabled, setAiModerationEnabled] = useState(true);
  const [togglingModeration, setTogglingModeration] = useState(false);

  // Reprogramming cache warmer
  const [warmingCache, setWarmingCache] = useState(false);
  const [cacheReport, setCacheReport] = useState<string | null>(null);

  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    // Need BOTH the admin user object AND the auth token before we can
    // hit the admin endpoints. Without authToken the fetch sends
    // `?token=null` → backend returns 403 → user list appears empty.
    if (user?.is_admin && authToken) {
      loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authToken, activeTab, userSubTab]);

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
      const response = await fetch(`${BACKEND_URL}/api/community/admin/flagged-users?token=${authToken}`);
      const data = await response.json();
      if (response.ok) setFlaggedUsers(data.users);
    } catch (err) { console.error('Error:', err); }
  };

  const fetchAllUsers = async (search?: string) => {
    try {
      const searchParam = search || userSearchQuery ? `&search=${encodeURIComponent(search || userSearchQuery)}` : '';
      const response = await fetch(`${BACKEND_URL}/api/community/admin/all-users?token=${authToken}&limit=100${searchParam}`);
      const data = await response.json();
      if (response.ok) setAllUsers(data.users);
    } catch (err) { console.error('Error:', err); }
  };

  const fetchContestStatus = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/admin/contest/status?token=${authToken}`);
      const data = await response.json();
      if (response.ok) setContestStatus(data);
    } catch (err) { console.error('Error:', err); }
  };

  const fetchContestEntries = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/admin/contest/entries?token=${authToken}`);
      const data = await response.json();
      if (response.ok) setContestEntries(data.entries || []);
    } catch (err) { console.error('Error:', err); }
  };

  const fetchPromoCodes = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/admin/contest/codes?token=${authToken}`);
      const data = await response.json();
      if (response.ok) setPromoCodes(data.codes || []);
    } catch (err) { console.error('Error:', err); }
  };

  const fetchModerationSettings = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/admin/moderation/settings?token=${authToken}`);
      const data = await response.json();
      if (response.ok) setAiModerationEnabled(data.ai_moderation_enabled);
    } catch (err) { console.error('Error fetching moderation settings:', err); }
  };

  const toggleAiModeration = async () => {
    setTogglingModeration(true);
    setError(null);
    try {
      const response = await fetch(`${BACKEND_URL}/api/admin/moderation/settings?token=${authToken}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ai_moderation_enabled: !aiModerationEnabled }),
      });
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
      const response = await fetch(`${BACKEND_URL}/api/community/admin/user-flags/${userId}?token=${authToken}`);
      const data = await response.json();
      if (response.ok) setUserFlags(data.flags);
    } catch (err) { console.error('Error:', err); }
  };

  const fetchModerationStatus = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/admin/moderation-status`, {
        headers: { 'Authorization': `Bearer ${authToken}` },
      });
      const data = await response.json();
      if (response.ok) setModerationStatus(data);
    } catch (err) { console.error('Error:', err); }

    try {
      const flagsResponse = await fetch(`${BACKEND_URL}/api/community/admin/pending-flags?token=${authToken}`);
      const flagsData = await flagsResponse.json();
      if (flagsResponse.ok) setPendingFlags(flagsData.flags || []);
    } catch (err) { console.error('Error fetching flags:', err); }

    await fetchTimeline();
  };

  const processEmailReplies = async () => {
    setProcessingEmails(true);
    setError(null);
    try {
      const response = await fetch(`${BACKEND_URL}/api/admin/process-moderation-emails`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}` },
      });
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

  const warmReprogrammingCache = async () => {
    // Warns the admin that this may take 1-3 minutes and cost ElevenLabs credits.
    const proceed = await new Promise<boolean>((resolve) => {
      Alert.alert(
        'Warm reprogramming cache?',
        'This will re-synthesise every hypnosis session via ElevenLabs and cache the audio on disk. It may take 1-3 minutes and will consume TTS credits. Continue?',
        [
          { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
          { text: 'Warm cache', style: 'destructive', onPress: () => resolve(true) },
        ],
        { cancelable: true, onDismiss: () => resolve(false) },
      );
    });
    if (!proceed) return;

    setWarmingCache(true);
    setCacheReport(null);
    setError(null);
    try {
      const response = await fetch(
        `${BACKEND_URL}/api/reprogramming/warm-cache`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${authToken}` },
        },
      );
      const data = await response.json();
      if (!response.ok) {
        setError(data?.detail || 'Failed to warm cache');
        return;
      }
      const entries = Object.entries(data.results || {}) as [string, any][];
      const okCount = entries.filter(([, r]) => r?.ok).length;
      const failCount = entries.length - okCount;
      setSuccess(`Reprogramming cache warmed: ${okCount}/${entries.length} sessions.`);
      const totalBytes = entries.reduce(
        (sum, [, r]) => sum + (r?.ok ? Number(r.bytes || 0) : 0),
        0,
      );
      const lines = [
        `${okCount} succeeded · ${failCount} failed`,
        `${(totalBytes / (1024 * 1024)).toFixed(1)} MB cached`,
      ];
      const fails = entries.filter(([, r]) => !r?.ok);
      if (fails.length) {
        lines.push('Failed: ' + fails.map(([id]) => id).join(', '));
      }
      setCacheReport(lines.join(' · '));
    } catch (err) {
      setError('Failed to warm cache');
    } finally {
      setWarmingCache(false);
    }
  };

  const fetchTimeline = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/admin/moderation/timeline`, {
        headers: { 'Authorization': `Bearer ${authToken}` },
      });
      const data = await response.json();
      if (response.ok) setTimeline(data);
      else setError(data.detail || 'Failed to load timeline');
    } catch (err) {
      setError('Failed to load timeline');
    }
  };

  const processTimeline = async () => {
    setProcessingTimeline(true);
    setError(null);
    try {
      const response = await fetch(`${BACKEND_URL}/api/admin/moderation/process-timeline`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}` },
      });
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
      const response = await fetch(`${BACKEND_URL}/api/admin/moderation/simulate-timeline`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ user_id: userId }),
      });
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
      const usersResponse = await fetch(`${BACKEND_URL}/api/community/admin/all-users?token=${authToken}&limit=10`);
      const usersData = await usersResponse.json();
      if (!usersResponse.ok || !usersData.users || usersData.users.length === 0) {
        setError('No users available to create test flag');
        return;
      }
      const testUser = usersData.users.find((u: AppUser) => !u.is_admin) || usersData.users[0];
      const response = await fetch(`${BACKEND_URL}/api/community/admin/create-test-flag?token=${authToken}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: testUser.id,
          content_type: 'test',
          content: 'This is a test flag content for testing the email moderation system',
          reason: 'Test flag for moderation system',
        }),
      });
      const data = await response.json();
      if (response.ok) {
        setSuccess('Test flag created! Check your email for moderation notification.');
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
      const response = await fetch(`${BACKEND_URL}/api/community/admin/flag/${flagId}/action?token=${authToken}&action=${action}`, {
        method: 'POST',
      });
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
      const response = await fetch(`${BACKEND_URL}/api/community/admin/user/${userId}/action?token=${authToken}&action=${action}`, {
        method: 'POST',
      });
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
      const response = await fetch(`${BACKEND_URL}/api/admin/contest/generate-code?token=${authToken}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code_type: newCodeType, custom_code: customCode || null }),
      });
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
      const response = await fetch(`${BACKEND_URL}/api/admin/contest/send-winner-email?token=${authToken}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: selectedEntry.user_id, code: generatedCode }),
      });
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
      const response = await fetch(`${BACKEND_URL}/api/admin/contest/send-code-email?token=${authToken}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_email: emailRecipient.email,
          user_name: emailRecipient.name || emailRecipient.email.split('@')[0],
          code: generatedCode,
          code_type: newCodeType,
        }),
      });
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
      const generateResponse = await fetch(`${BACKEND_URL}/api/admin/contest/generate-code?token=${authToken}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code_type: winnerCodeType, custom_code: '' }),
      });
      const generateData = await generateResponse.json();
      if (!generateResponse.ok) {
        setError(generateData.detail || 'Failed to generate code');
        return;
      }
      const newCode = generateData.code;

      const emailResponse = await fetch(`${BACKEND_URL}/api/admin/contest/send-winner-email?token=${authToken}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: selectedEntry.user_id, code: newCode }),
      });
      const emailData = await emailResponse.json();
      if (emailResponse.ok) {
        setSuccess(`Winner email with ${winnerCodeType} code "${newCode}" sent to ${selectedEntry.email}`);
        setShowWinnerEmailModal(false);
        setSelectedEntry(null);
        fetchPromoCodes();
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
      const response = await fetch(`${BACKEND_URL}/api/community/admin/user/${userId}/promote-admin?token=${authToken}`, {
        method: 'POST',
      });
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
      const response = await fetch(`${BACKEND_URL}/api/community/admin/user/${userId}/demote-admin?token=${authToken}`, {
        method: 'POST',
      });
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

  const handleUserSearch = () => { fetchAllUsers(userSearchQuery); };

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
        <TouchableOpacity style={[styles.tab, activeTab === 'users' && styles.tabActive]} onPress={() => setActiveTab('users')}>
          <Ionicons name="people" size={20} color={activeTab === 'users' ? '#fff' : '#9f7aea'} />
          <Text style={[styles.tabText, activeTab === 'users' && styles.tabTextActive]}>Users</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, activeTab === 'moderation' && styles.tabActive]} onPress={() => setActiveTab('moderation')}>
          <Ionicons name="shield" size={20} color={activeTab === 'moderation' ? '#fff' : '#9f7aea'} />
          <Text style={[styles.tabText, activeTab === 'moderation' && styles.tabTextActive]}>Moderation</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, activeTab === 'contest' && styles.tabActive]} onPress={() => setActiveTab('contest')}>
          <Ionicons name="trophy" size={20} color={activeTab === 'contest' ? '#fff' : '#9f7aea'} />
          <Text style={[styles.tabText, activeTab === 'contest' && styles.tabTextActive]}>Contest</Text>
        </TouchableOpacity>
      </View>

      {/* Success/Error */}
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

      {/* Dev Tools */}
      <View style={styles.devToolsBar}>
        <View style={styles.devToolsLeft}>
          <Ionicons name="construct" size={14} color="#fbbf24" />
          <Text style={styles.devToolsTitle}>Preview as Free User</Text>
        </View>
        <View style={styles.devToolsRight}>
          <Text style={styles.devToolsHint}>
            {previewAsFree ? 'ON — paywalls visible' : 'OFF — using your real plan'}
          </Text>
          <Switch
            value={previewAsFree}
            onValueChange={async (v) => {
              await setPreviewAsFree(v);
              await refreshAuth();
            }}
            trackColor={{ false: 'rgba(255,255,255,0.15)', true: 'rgba(251,191,36,0.55)' }}
            thumbColor={previewAsFree ? '#fbbf24' : '#9ca3af'}
          />
        </View>
      </View>

      {/* Reprogramming Cache Warmer */}
      <View style={reprogStyles.card}>
        <View style={reprogStyles.left}>
          <Ionicons name="cloud-download-outline" size={16} color="#a855f7" />
          <View style={{ marginLeft: 8, flex: 1 }}>
            <Text style={reprogStyles.title}>Reprogramming audio cache</Text>
            <Text style={reprogStyles.hint}>
              Re-synthesise all 12 hypnosis sessions via ElevenLabs. Run after
              editing scripts.
            </Text>
            {cacheReport ? (
              <Text style={reprogStyles.report}>{cacheReport}</Text>
            ) : null}
          </View>
        </View>
        <TouchableOpacity
          onPress={warmReprogrammingCache}
          disabled={warmingCache}
          style={[reprogStyles.button, warmingCache && { opacity: 0.6 }]}
          accessibilityLabel="Warm reprogramming cache"
        >
          {warmingCache ? (
            <ActivityIndicator color="#0f0321" size="small" />
          ) : (
            <>
              <Ionicons name="flame" size={14} color="#0f0321" />
              <Text style={reprogStyles.buttonText}>Warm cache</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

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
          <UsersTab
            userSubTab={userSubTab}
            setUserSubTab={setUserSubTab}
            userSearchQuery={userSearchQuery}
            setUserSearchQuery={setUserSearchQuery}
            handleUserSearch={handleUserSearch}
            allUsers={allUsers}
            flaggedUsers={flaggedUsers}
            onAppUserPress={(u) => {
              setSelectedAppUser(u);
              setShowManageUserModal(true);
            }}
            onFlaggedUserPress={(u) => {
              setSelectedUser(u);
              fetchUserFlags(u.id);
              setShowUserModal(true);
            }}
          />
        ) : activeTab === 'moderation' ? (
          <ModerationTab
            moderationStatus={moderationStatus}
            pendingFlags={pendingFlags}
            onFlagPress={(f) => { setSelectedFlag(f); setShowFlagModal(true); }}
            handleFlagAction={handleFlagAction}
            processEmailReplies={processEmailReplies}
            processingEmails={processingEmails}
            createTestFlag={createTestFlag}
            actionLoading={actionLoading}
            timeline={timeline}
            processingTimeline={processingTimeline}
            processTimeline={processTimeline}
            simulateExpire={simulateExpire}
          />
        ) : (
          <ContestTab
            aiModerationEnabled={aiModerationEnabled}
            togglingModeration={togglingModeration}
            toggleAiModeration={toggleAiModeration}
            newCodeType={newCodeType}
            setNewCodeType={setNewCodeType}
            customCode={customCode}
            setCustomCode={setCustomCode}
            generatedCode={generatedCode}
            generateCode={generateCode}
            actionLoading={actionLoading}
            onShowEmailModal={() => setShowEmailModal(true)}
            contestEntries={contestEntries}
            onSelectWinner={(entry) => {
              setSelectedEntry(entry);
              setEmailRecipient({ email: entry.email, name: entry.name || '', user_id: entry.user_id });
              setShowWinnerEmailModal(true);
            }}
            promoCodes={promoCodes}
          />
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Modals */}
      <UserModal
        visible={showUserModal}
        selectedUser={selectedUser}
        onClose={() => setShowUserModal(false)}
        onAction={handleUserAction}
      />

      <EmailModal
        visible={showEmailModal}
        onClose={() => setShowEmailModal(false)}
        generatedCode={generatedCode}
        emailRecipient={emailRecipient}
        setEmailRecipient={setEmailRecipient}
        hasSelectedEntry={!!selectedEntry}
        actionLoading={actionLoading}
        onSend={selectedEntry ? sendWinnerEmail : sendCodeEmail}
      />

      <WinnerEmailModal
        visible={showWinnerEmailModal}
        onClose={() => {
          setShowWinnerEmailModal(false);
          setSelectedEntry(null);
        }}
        selectedEntry={selectedEntry}
        winnerCodeType={winnerCodeType}
        setWinnerCodeType={setWinnerCodeType}
        actionLoading={actionLoading}
        onGenerateAndSend={generateAndSendWinnerEmail}
      />

      <ManageUserModal
        visible={showManageUserModal}
        onClose={() => setShowManageUserModal(false)}
        selectedAppUser={selectedAppUser}
        currentUserEmail={user?.email}
        actionLoading={actionLoading}
        onPromote={promoteToAdmin}
        onDemote={demoteFromAdmin}
      />

      <FlagDetailModal
        visible={showFlagModal}
        onClose={() => { setShowFlagModal(false); setSelectedFlag(null); }}
        selectedFlag={selectedFlag}
        processingAction={processingAction}
        onAction={handleFlagAction}
      />
    </SafeAreaView>
  );
}


// Standalone stylesheet for the Reprogramming warm-cache card (kept local to
// this file since it's only used inside AdminPanel).
const reprogStyles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 12,
    marginTop: 8,
    marginBottom: 4,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.35)',
    backgroundColor: 'rgba(30,10,60,0.55)',
  },
  left: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
    marginRight: 12,
  },
  title: {
    color: '#e9d5ff',
    fontSize: 13,
    fontWeight: '700',
  },
  hint: {
    color: '#c4b5fd',
    fontSize: 11,
    lineHeight: 15,
    marginTop: 2,
  },
  report: {
    color: '#22c55e',
    fontSize: 10,
    marginTop: 4,
    fontWeight: '600',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#fbbf24',
    minWidth: 110,
    justifyContent: 'center',
  },
  buttonText: {
    color: '#0f0321',
    fontWeight: '800',
    fontSize: 12,
  },
});
