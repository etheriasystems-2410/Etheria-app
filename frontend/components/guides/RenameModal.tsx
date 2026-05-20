import React from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { styles } from './styles';

type Slot = 'male' | 'female';

interface RenameModalProps {
  visible: boolean;
  slot: Slot | null;
  input: string;
  onChangeInput: (v: string) => void;
  saving: boolean;
  onSave: () => void;
  onClose: () => void;
}

export default function RenameModal({
  visible,
  slot,
  input,
  onChangeInput,
  saving,
  onSave,
  onClose,
}: RenameModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.renameBackdrop}
      >
        <View style={styles.renameCard}>
          <Text style={styles.renameTitle}>
            Name your {slot === 'male' ? 'masculine' : 'feminine'} guide
          </Text>
          <Text style={styles.renameSub}>
            Give your personal spirit companion the name that resonates with you. Up to 32 characters.
          </Text>
          <TextInput
            value={input}
            onChangeText={onChangeInput}
            placeholder={slot === 'male' ? 'Male Guide' : 'Female Guide'}
            placeholderTextColor="#7c6aa3"
            style={styles.renameInput}
            maxLength={32}
            autoFocus
          />
          <View style={styles.renameButtons}>
            <TouchableOpacity
              style={[styles.renameBtn, styles.renameBtnGhost]}
              onPress={onClose}
              disabled={saving}
            >
              <Text style={styles.renameBtnGhostText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.renameBtn, styles.renameBtnPrimary]}
              onPress={onSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#1a0033" />
              ) : (
                <Text style={styles.renameBtnPrimaryText}>Save Name</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
