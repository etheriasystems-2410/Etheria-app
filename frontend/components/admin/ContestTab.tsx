import React from 'react';
import { View, Text, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { adminStyles as styles } from './styles';
import { ContestEntry, PromoCode } from './types';

interface Props {
  aiModerationEnabled: boolean;
  togglingModeration: boolean;
  toggleAiModeration: () => void;
  newCodeType: 'monthly' | 'lifetime';
  setNewCodeType: (t: 'monthly' | 'lifetime') => void;
  customCode: string;
  setCustomCode: (c: string) => void;
  generatedCode: string;
  generateCode: () => void;
  actionLoading: boolean;
  onShowEmailModal: () => void;
  contestEntries: ContestEntry[];
  onSelectWinner: (e: ContestEntry) => void;
  promoCodes: PromoCode[];
}

export default function ContestTab({
  aiModerationEnabled,
  togglingModeration,
  toggleAiModeration,
  newCodeType,
  setNewCodeType,
  customCode,
  setCustomCode,
  generatedCode,
  generateCode,
  actionLoading,
  onShowEmailModal,
  contestEntries,
  onSelectWinner,
  promoCodes,
}: Props) {
  return (
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
              aiModerationEnabled ? styles.moderationToggleBtnActive : styles.moderationToggleBtnInactive,
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
                  aiModerationEnabled ? styles.toggleKnobActive : styles.toggleKnobInactive,
                ]} />
              </View>
            )}
          </TouchableOpacity>
        </View>
        <View style={styles.moderationStatusBadge}>
          <View style={[styles.statusDot, { backgroundColor: aiModerationEnabled ? '#10b981' : '#ef4444' }]} />
          <Text style={[styles.statusText, { color: aiModerationEnabled ? '#10b981' : '#ef4444' }]}>
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
            <Text style={[styles.codeTypeBtnText, newCodeType === 'monthly' && styles.codeTypeBtnTextActive]}>Monthly</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.codeTypeBtn, newCodeType === 'lifetime' && styles.codeTypeBtnActive]}
            onPress={() => setNewCodeType('lifetime')}
          >
            <Text style={[styles.codeTypeBtnText, newCodeType === 'lifetime' && styles.codeTypeBtnTextActive]}>Lifetime</Text>
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
        {generatedCode ? (
          <View style={styles.generatedCodeBox}>
            <Text style={styles.generatedCodeLabel}>Generated Code:</Text>
            <Text style={styles.generatedCode}>{generatedCode}</Text>
            <TouchableOpacity style={styles.sendEmailBtn} onPress={onShowEmailModal}>
              <Ionicons name="mail" size={16} color="#fff" />
              <Text style={styles.sendEmailBtnText}>Send to User</Text>
            </TouchableOpacity>
          </View>
        ) : null}
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
                    onPress={() => onSelectWinner(entry)}
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
  );
}
