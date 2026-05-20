import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { adminStyles as styles } from './styles';
import { ModerationStatus, PendingFlag, formatDate } from './types';

interface Props {
  moderationStatus: ModerationStatus | null;
  pendingFlags: PendingFlag[];
  onFlagPress: (flag: PendingFlag) => void;
  handleFlagAction: (flagId: string, action: 'dismiss' | 'warn' | 'cancel') => void;
  processEmailReplies: () => void;
  processingEmails: boolean;
  createTestFlag: () => void;
  actionLoading: boolean;
  timeline: any | null;
  processingTimeline: boolean;
  processTimeline: () => void;
  simulateExpire: (userId: string, email: string) => void;
}

export default function ModerationTab({
  moderationStatus,
  pendingFlags,
  onFlagPress,
  handleFlagAction,
  processEmailReplies,
  processingEmails,
  createTestFlag,
  actionLoading,
  timeline,
  processingTimeline,
  processTimeline,
  simulateExpire,
}: Props) {
  return (
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

      {/* Pending Flags */}
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
              onPress={() => onFlagPress(flag)}
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
                    onPress={(e) => { e.stopPropagation(); handleFlagAction(flag.id, 'dismiss'); }}
                  >
                    <Ionicons name="checkmark" size={16} color="#10b981" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.flagActionBtn, styles.warnBtn]}
                    onPress={(e) => { e.stopPropagation(); handleFlagAction(flag.id, 'warn'); }}
                  >
                    <Ionicons name="warning" size={16} color="#f59e0b" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.flagActionBtn, styles.cancelAccountBtn]}
                    onPress={(e) => { e.stopPropagation(); onFlagPress(flag); }}
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
            <Text style={[styles.helpText, { fontWeight: '600', color: '#e9d5ff' }]}>Active Suspensions</Text>
            {timeline.active_suspensions.map((u: any) => (
              <View key={u.user_id} style={styles.timelineRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.timelineEmail}>{u.email}</Text>
                  <Text style={styles.timelineMeta}>
                    Suspension #{u.suspension_count} • {u.days_remaining}d remaining • ends {u.suspension_end ? new Date(u.suspension_end).toLocaleDateString() : 'N/A'}
                  </Text>
                </View>
                <TouchableOpacity style={styles.ffBtn} onPress={() => simulateExpire(u.user_id, u.email)}>
                  <Ionicons name="play-forward" size={14} color="#1a0033" />
                  <Text style={styles.ffBtnText}>Fast-Fwd</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {timeline?.expired_suspensions?.length > 0 && (
          <View style={{ marginTop: 12 }}>
            <Text style={[styles.helpText, { fontWeight: '600', color: '#10b981' }]}>Pending Auto-Reactivation</Text>
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
  );
}
