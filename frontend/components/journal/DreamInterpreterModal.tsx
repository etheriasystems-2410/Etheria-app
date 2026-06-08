/**
 * DreamInterpreterModal — text-in / interpretation-out flow.
 * Calls /api/dreams/interpret, then auto-saves the result as a journal entry
 * tagged entry_type='dream'. Picks up automatically in the Dreams tab.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface Props {
  visible: boolean;
  onClose: () => void;
  onSaved?: () => void; // parent can refresh dream list
}

export default function DreamInterpreterModal({ visible, onClose, onSaved }: Props) {
  const [dreamText, setDreamText] = useState('');
  const [interpreting, setInterpreting] = useState(false);
  const [interpretation, setInterpretation] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const reset = () => {
    setDreamText('');
    setInterpretation(null);
    setSaving(false);
    setSaved(false);
  };

  const close = () => {
    reset();
    onClose();
  };

  const handleInterpret = async () => {
    if (!dreamText.trim() || dreamText.trim().length < 10) {
      Alert.alert('Tell more', 'Please describe your dream in at least a sentence or two.');
      return;
    }
    setInterpreting(true);
    setInterpretation(null);
    try {
      const res = await fetch(`${BACKEND_URL}/api/dreams/interpret`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: dreamText.trim(), symbols: [], feelings: [] }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.detail || 'Interpretation failed');
      }
      setInterpretation(data.interpretation);
    } catch (e: any) {
      Alert.alert('Could not interpret', e.message || 'Please try again.');
    } finally {
      setInterpreting(false);
    }
  };

  const handleSave = async () => {
    if (!interpretation) return;
    setSaving(true);
    try {
      const token = await AsyncStorage.getItem('session_token');
      const entry = {
        title: `Dream — ${new Date().toLocaleDateString()}`,
        content: `Dream:\n${dreamText.trim()}\n\nInterpretation:\n${interpretation}`,
        category: 'dream',
        entry_type: 'dream',
        date: new Date().toISOString(),
        metadata: {
          dream_text: dreamText.trim(),
          interpretation,
          interpreted_at: new Date().toISOString(),
        },
      };
      const res = await fetch(`${BACKEND_URL}/api/journal/entries`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify(entry),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `Save failed (HTTP ${res.status})`);
      }
      setSaved(true);
      onSaved?.();
      setTimeout(close, 1200);
    } catch (e: any) {
      Alert.alert('Could not save', e.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={close}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={s.backdrop}
      >
        <View style={s.card}>
          <View style={s.header}>
            <View style={s.headerLeft}>
              <Ionicons name="moon" size={20} color="#a78bfa" />
              <Text style={s.title}>Interpret a Dream</Text>
            </View>
            <TouchableOpacity onPress={close}>
              <Ionicons name="close" size={24} color="#e9d5ff" />
            </TouchableOpacity>
          </View>

          <ScrollView style={s.body} keyboardShouldPersistTaps="handled">
            <Text style={s.label}>Describe your dream</Text>
            <TextInput
              style={s.input}
              placeholder="I dreamed of standing at the edge of a vast ocean…"
              placeholderTextColor="#7c6aa3"
              value={dreamText}
              onChangeText={setDreamText}
              multiline
              numberOfLines={6}
              maxLength={2000}
              editable={!interpretation}
            />
            <Text style={s.counter}>{dreamText.length}/2000</Text>

            {!interpretation ? (
              <TouchableOpacity
                style={[s.primaryBtn, interpreting && s.btnDisabled]}
                onPress={handleInterpret}
                disabled={interpreting}
              >
                {interpreting ? (
                  <ActivityIndicator color="#1a0033" />
                ) : (
                  <>
                    <Ionicons name="sparkles" size={18} color="#1a0033" />
                    <Text style={s.primaryBtnText}>Reveal Meaning</Text>
                  </>
                )}
              </TouchableOpacity>
            ) : (
              <>
                <View style={s.divider} />
                <Text style={s.label}>Interpretation</Text>
                <View style={s.interpretationBox}>
                  <Text style={s.interpretationText}>{interpretation}</Text>
                </View>

                {saved ? (
                  <View style={s.savedBadge}>
                    <Ionicons name="checkmark-circle" size={18} color="#10b981" />
                    <Text style={s.savedText}>Saved to your journal</Text>
                  </View>
                ) : (
                  <View style={s.actionRow}>
                    <TouchableOpacity
                      style={s.ghostBtn}
                      onPress={() => {
                        setInterpretation(null);
                      }}
                    >
                      <Text style={s.ghostBtnText}>Try Again</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[s.primaryBtn, { flex: 1 }, saving && s.btnDisabled]}
                      onPress={handleSave}
                      disabled={saving}
                    >
                      {saving ? (
                        <ActivityIndicator color="#1a0033" />
                      ) : (
                        <>
                          <Ionicons name="book" size={16} color="#1a0033" />
                          <Text style={s.primaryBtnText}>Save to Journal</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                )}
              </>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  card: {
    backgroundColor: '#1a0033',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { color: '#fff', fontSize: 18, fontWeight: '700' },
  body: { maxHeight: '85%' },
  label: { color: '#b794f6', fontSize: 12, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 8 },
  input: {
    backgroundColor: '#2d1b4e',
    color: '#fff',
    fontSize: 14,
    padding: 12,
    borderRadius: 10,
    minHeight: 110,
    textAlignVertical: 'top',
  },
  counter: { color: '#7c6aa3', fontSize: 11, textAlign: 'right', marginTop: 4, marginBottom: 16 },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#fbbf24',
    paddingVertical: 14,
    borderRadius: 12,
  },
  primaryBtnText: { color: '#1a0033', fontSize: 15, fontWeight: '700' },
  btnDisabled: { opacity: 0.6 },
  divider: { height: 1, backgroundColor: 'rgba(183,148,246,0.2)', marginVertical: 16 },
  interpretationBox: { backgroundColor: '#2d1b4e', padding: 14, borderRadius: 10, marginBottom: 16 },
  interpretationText: { color: '#e9d5ff', fontSize: 14, lineHeight: 22 },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
  ghostBtn: { paddingHorizontal: 16, paddingVertical: 14, borderRadius: 12, borderColor: '#7c6aa3', borderWidth: 1 },
  ghostBtnText: { color: '#b794f6', fontSize: 14, fontWeight: '600' },
  savedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(16,185,129,0.12)',
    padding: 14,
    borderRadius: 12,
    marginTop: 8,
  },
  savedText: { color: '#10b981', fontSize: 14, fontWeight: '600' },
});
