/**
 * ComposeModal — slide-up sheet for sending an email or a Direct Mail letter
 * from someone else's profile. Used by app/profile/[id].tsx.
 *
 * Owns its own subject/body input state so the parent screen doesn't have to
 * thread three more pieces of state through props.
 */
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export type ComposeMode = 'email' | 'dm-letter';

interface Props {
  visible: boolean;
  mode: ComposeMode | null;
  recipientName: string;
  sending: boolean;
  onClose: () => void;
  /** Called with (subject, body); parent handles the network + success UX. */
  onSend: (subject: string, body: string) => Promise<void> | void;
}

export default function ComposeModal({
  visible, mode, recipientName, sending, onClose, onSend,
}: Props) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  // Reset fields when the modal closes
  useEffect(() => {
    if (!visible) {
      setSubject('');
      setBody('');
    }
  }, [visible]);

  const handleSend = async () => {
    await onSend(subject, body);
  };

  const title = mode === 'email'
    ? `Email ${recipientName}`
    : `Write to ${recipientName}`;

  const hint = mode === 'email'
    ? "Their email stays private. They'll be able to reply directly to you."
    : 'Your letter will appear in their in-app inbox.';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <KeyboardAvoidingView
          style={styles.sheet}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={22} color="#e9d5ff" />
            </TouchableOpacity>
          </View>
          <Text style={styles.hint}>{hint}</Text>

          <TextInput
            style={styles.input}
            placeholder="Subject"
            placeholderTextColor="rgba(233,213,255,0.4)"
            value={subject}
            onChangeText={setSubject}
            maxLength={140}
          />
          <TextInput
            style={[styles.input, styles.bodyInput]}
            placeholder="Write your message…"
            placeholderTextColor="rgba(233,213,255,0.4)"
            value={body}
            onChangeText={setBody}
            multiline
            maxLength={4000}
          />

          <TouchableOpacity
            style={[styles.sendBtn, sending && { opacity: 0.6 }]}
            onPress={handleSend}
            disabled={sending}
          >
            {sending ? (
              <ActivityIndicator color="#1a0033" />
            ) : (
              <>
                <Ionicons name="send" size={14} color="#1a0033" />
                <Text style={styles.sendText}>Send</Text>
              </>
            )}
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#0f0523',
    borderTopLeftRadius: 18, borderTopRightRadius: 18,
    padding: 16, paddingBottom: 30,
    borderTopWidth: 1, borderColor: 'rgba(251,191,36,0.3)',
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  title: { color: '#fbbf24', fontSize: 16, fontWeight: '800' },
  hint: { color: '#cbb6ff', fontSize: 12, marginBottom: 12 },
  input: {
    color: '#e9d5ff', backgroundColor: 'rgba(124,58,237,0.10)',
    paddingHorizontal: 11, paddingVertical: 10, borderRadius: 10, marginBottom: 8,
    borderWidth: 1, borderColor: 'rgba(159,122,234,0.3)',
    fontSize: 14,
  },
  bodyInput: { minHeight: 120, textAlignVertical: 'top' },
  sendBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#fbbf24', paddingVertical: 12, borderRadius: 12, marginTop: 6,
  },
  sendText: { color: '#1a0033', fontWeight: '800', fontSize: 14 },
});
