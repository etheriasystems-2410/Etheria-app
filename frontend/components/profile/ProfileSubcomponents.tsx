/**
 * Reusable subcomponents for the Profile screen.
 *
 * Extracted from `app/profile/[id].tsx` to keep the screen file focused on
 * orchestration rather than leaf-component definitions. None of these depend
 * on the screen's auth / form state — they're pure presentational widgets.
 */
import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/** Predefined chip suggestions for the Psychic Interests field. */
export const INTEREST_SUGGESTIONS = [
  'Tarot', 'Astrology', 'Mediumship', 'Dreams', 'Aura Reading',
  'Energy Healing', 'Crystals', 'Numerology', 'Astral Travel',
  'Past Lives', 'Chakras', 'Clairvoyance',
];

/** A single labeled profile field that toggles between read-only and editable. */
export function Field({
  label, icon, editing, value, placeholder, onChange, multiline, maxLength,
}: {
  label: string;
  icon: any;
  editing: boolean;
  value: string;
  placeholder?: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  maxLength?: number;
}) {
  return (
    <View style={styles.fieldBlock}>
      <View style={styles.fieldLabelRow}>
        <Ionicons name={icon} size={14} color="#9f7aea" />
        <Text style={styles.fieldLabel}>{label}</Text>
      </View>
      {editing ? (
        <TextInput
          value={value}
          onChangeText={onChange}
          style={[styles.fieldInput, multiline && styles.fieldInputMultiline]}
          placeholder={placeholder}
          placeholderTextColor="rgba(233,213,255,0.35)"
          multiline={multiline}
          maxLength={maxLength}
        />
      ) : (
        <Text style={styles.fieldValue}>
          {value && value.toString().trim() ? value : <Text style={styles.emptyHint}>{placeholder}</Text>}
        </Text>
      )}
    </View>
  );
}

/** A pill-shaped tag chip. Tappable in edit mode for add/remove. */
export function Chip({
  label, active, onPress,
}: { label: string; active?: boolean; onPress?: () => void }) {
  const Wrap = onPress ? TouchableOpacity : View;
  return (
    <Wrap onPress={onPress as any} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
      {active && onPress && <Ionicons name="close" size={11} color="#1a0033" />}
    </Wrap>
  );
}

/** Large coloured tile used for "Reach out" actions (Email, DM, IM, Circle). */
export function ActionTile({
  icon, label, sub, color, onPress, loading, disabled,
}: {
  icon: any; label: string; sub: string; color: string;
  onPress: () => void; loading?: boolean; disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.actionTile,
        { borderColor: color + '99' },
        pressed && { opacity: 0.7 },
        disabled && { opacity: 0.55 },
      ]}
    >
      <View style={[styles.actionIcon, { backgroundColor: color + '22' }]}>
        {loading
          ? <ActivityIndicator color={color} size="small" />
          : <Ionicons name={icon} size={20} color={color} />}
      </View>
      <Text style={styles.actionLabel}>{label}</Text>
      <Text style={styles.actionSub}>{sub}</Text>
    </Pressable>
  );
}

/** Compact stat cell used inside the Progress card. */
export function StatTile({
  icon, label, value,
}: { icon: any; label: string; value: number | string }) {
  return (
    <View style={styles.statTile}>
      <Ionicons name={icon} size={18} color="#fbbf24" />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fieldBlock: { marginBottom: 14 },
  fieldLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 5 },
  fieldLabel: { color: '#cbb6ff', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  fieldValue: { color: '#e9d5ff', fontSize: 14, lineHeight: 19 },
  emptyHint: { color: 'rgba(233,213,255,0.45)', fontStyle: 'italic' },
  fieldInput: {
    color: '#e9d5ff', fontSize: 14, borderRadius: 10,
    backgroundColor: 'rgba(124,58,237,0.10)', paddingHorizontal: 11, paddingVertical: 9,
    borderWidth: 1, borderColor: 'rgba(159,122,234,0.3)',
  },
  fieldInputMultiline: { minHeight: 70, textAlignVertical: 'top' },

  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12,
    backgroundColor: 'rgba(124,58,237,0.18)',
    borderWidth: 1, borderColor: 'rgba(159,122,234,0.35)',
  },
  chipActive: { backgroundColor: '#fbbf24', borderColor: '#fbbf24' },
  chipText: { color: '#cbb6ff', fontSize: 11, fontWeight: '600' },
  chipTextActive: { color: '#1a0033', fontWeight: '800' },

  actionTile: {
    flexGrow: 1, minWidth: '47%',
    padding: 12, borderRadius: 12, borderWidth: 1,
    backgroundColor: 'rgba(15,5,35,0.6)',
  },
  actionIcon: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center', marginBottom: 6,
  },
  actionLabel: { color: '#e9d5ff', fontSize: 13, fontWeight: '700' },
  actionSub: { color: 'rgba(203,182,255,0.7)', fontSize: 11, marginTop: 1 },

  statTile: {
    flexBasis: '31%', flexGrow: 1,
    padding: 10, borderRadius: 10, alignItems: 'center',
    backgroundColor: 'rgba(251,191,36,0.08)',
    borderWidth: 1, borderColor: 'rgba(251,191,36,0.25)',
  },
  statValue: { color: '#fbbf24', fontSize: 18, fontWeight: '800', marginTop: 4 },
  statLabel: { color: '#cbb6ff', fontSize: 10, marginTop: 2, textAlign: 'center', lineHeight: 13 },
});
