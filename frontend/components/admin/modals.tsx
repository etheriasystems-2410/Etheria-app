import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, Modal, TextInput, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { adminStyles as styles } from './styles';
import { AppUser, ContestEntry, FlaggedUser, PendingFlag, getStatusColor, formatDate } from './types';

// ========== USER MODAL (Flagged user details) ==========
export function UserModal({
  visible,
  selectedUser,
  onClose,
  onAction,
}: {
  visible: boolean;
  selectedUser: FlaggedUser | null;
  onClose: () => void;
  onAction: (userId: string, action: string) => void;
}) {
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>User Details</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
          {selectedUser && (
            <ScrollView style={styles.modalBody}>
              <Text style={styles.detailLabel}>Email: <Text style={styles.detailValue}>{selectedUser.email}</Text></Text>
              <Text style={styles.detailLabel}>Status: <Text style={[styles.detailValue, { color: getStatusColor(selectedUser.account_status) }]}>{selectedUser.account_status}</Text></Text>
              <Text style={styles.detailLabel}>Flags: <Text style={styles.detailValue}>{selectedUser.flag_count}</Text></Text>

              <View style={styles.actionButtons}>
                <TouchableOpacity style={styles.clearBtn} onPress={() => onAction(selectedUser.id, 'clear_flags')}>
                  <Text style={styles.clearBtnText}>Clear Flags</Text>
                </TouchableOpacity>
                {selectedUser.account_status !== 'active' && (
                  <TouchableOpacity style={styles.reactivateBtn} onPress={() => onAction(selectedUser.id, 'reactivate')}>
                    <Text style={styles.reactivateBtnText}>Reactivate</Text>
                  </TouchableOpacity>
                )}
                {selectedUser.account_status === 'active' && (
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => onAction(selectedUser.id, 'cancel')}>
                    <Text style={styles.cancelBtnText}>Cancel Account</Text>
                  </TouchableOpacity>
                )}
              </View>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ========== EMAIL MODAL (Send promo code via email) ==========
export function EmailModal({
  visible,
  onClose,
  generatedCode,
  emailRecipient,
  setEmailRecipient,
  hasSelectedEntry,
  actionLoading,
  onSend,
}: {
  visible: boolean;
  onClose: () => void;
  generatedCode: string;
  emailRecipient: { email: string; name: string; user_id: string };
  setEmailRecipient: (r: { email: string; name: string; user_id: string }) => void;
  hasSelectedEntry: boolean;
  actionLoading: boolean;
  onSend: () => void;
}) {
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Send Code Email</Text>
            <TouchableOpacity onPress={onClose}>
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
              onChangeText={(text) => setEmailRecipient({ ...emailRecipient, email: text })}
              keyboardType="email-address"
            />

            <Text style={styles.emailLabel}>Recipient Name:</Text>
            <TextInput
              style={styles.input}
              placeholder="User Name"
              placeholderTextColor="#6b7280"
              value={emailRecipient.name}
              onChangeText={(text) => setEmailRecipient({ ...emailRecipient, name: text })}
            />

            <View style={styles.emailButtons}>
              <TouchableOpacity style={styles.sendWinnerBtn} onPress={onSend} disabled={actionLoading}>
                {actionLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name={hasSelectedEntry ? 'trophy' : 'mail'} size={18} color="#fff" />
                    <Text style={styles.sendWinnerBtnText}>
                      {hasSelectedEntry ? 'Send Winner Email' : 'Send Code Email'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ========== WINNER EMAIL MODAL (Generate + Send code to winner) ==========
export function WinnerEmailModal({
  visible,
  onClose,
  selectedEntry,
  winnerCodeType,
  setWinnerCodeType,
  actionLoading,
  onGenerateAndSend,
}: {
  visible: boolean;
  onClose: () => void;
  selectedEntry: ContestEntry | null;
  winnerCodeType: 'monthly' | 'lifetime';
  setWinnerCodeType: (t: 'monthly' | 'lifetime') => void;
  actionLoading: boolean;
  onGenerateAndSend: () => void;
}) {
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Send Winner Email</Text>
            <TouchableOpacity onPress={onClose}>
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
                    <Text style={[styles.codeTypeBtnText, winnerCodeType === 'monthly' && styles.codeTypeBtnTextActive]}>Monthly</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.codeTypeBtn, winnerCodeType === 'lifetime' && styles.codeTypeBtnActive]}
                    onPress={() => setWinnerCodeType('lifetime')}
                  >
                    <Text style={[styles.codeTypeBtnText, winnerCodeType === 'lifetime' && styles.codeTypeBtnTextActive]}>Lifetime</Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.winnerNote}>
                  A new {winnerCodeType} code will be generated and emailed to the winner with congratulations.
                </Text>

                <TouchableOpacity
                  style={styles.sendWinnerBtn}
                  onPress={onGenerateAndSend}
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
  );
}

// ========== MANAGE USER MODAL (Promote/Demote admin) ==========
export function ManageUserModal({
  visible,
  onClose,
  selectedAppUser,
  currentUserEmail,
  actionLoading,
  onPromote,
  onDemote,
}: {
  visible: boolean;
  onClose: () => void;
  selectedAppUser: AppUser | null;
  currentUserEmail: string | undefined;
  actionLoading: boolean;
  onPromote: (userId: string) => void;
  onDemote: (userId: string) => void;
}) {
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Manage User</Text>
            <TouchableOpacity onPress={onClose}>
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
                    onPress={() => onPromote(selectedAppUser.id)}
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
                ) : selectedAppUser.email !== currentUserEmail && selectedAppUser.admin_level < 10 ? (
                  <TouchableOpacity
                    style={styles.demoteBtn}
                    onPress={() => onDemote(selectedAppUser.id)}
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
                      {selectedAppUser.email === currentUserEmail
                        ? 'You cannot modify your own admin status'
                        : 'Top-level admins cannot be demoted'}
                    </Text>
                  </View>
                )}
              </View>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ========== FLAG DETAIL MODAL ==========
export function FlagDetailModal({
  visible,
  onClose,
  selectedFlag,
  processingAction,
  onAction,
}: {
  visible: boolean;
  onClose: () => void;
  selectedFlag: PendingFlag | null;
  processingAction: boolean;
  onAction: (flagId: string, action: 'dismiss' | 'warn' | 'cancel') => void;
}) {
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Flag Details</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
          {selectedFlag && (
            <ScrollView style={styles.modalBody}>
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

              <View style={styles.flagDetailSection}>
                <Text style={styles.flagDetailLabel}>Flag Reason</Text>
                <View style={styles.flagReasonCard}>
                  <Ionicons name="flag" size={16} color="#ef4444" />
                  <Text style={styles.flagReasonText}>{selectedFlag.reason}</Text>
                </View>
              </View>

              <View style={styles.flagDetailSection}>
                <Text style={styles.flagDetailLabel}>Flagged Content ({selectedFlag.content_type})</Text>
                <View style={styles.flagContentCard}>
                  <Text style={styles.flagContentFullText}>"{selectedFlag.content}"</Text>
                </View>
              </View>

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

              <View style={styles.flagActionButtons}>
                <Text style={styles.flagActionTitle}>Take Action</Text>

                <TouchableOpacity
                  style={[styles.flagFullActionBtn, styles.dismissFullBtn]}
                  onPress={() => onAction(selectedFlag.id, 'dismiss')}
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
                  onPress={() => onAction(selectedFlag.id, 'warn')}
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
                  onPress={() => onAction(selectedFlag.id, 'cancel')}
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
  );
}
