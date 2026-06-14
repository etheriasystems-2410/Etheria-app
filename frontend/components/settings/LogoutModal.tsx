/**
 * Settings → "Are you sure you want to logout?" confirmation dialog.
 */
import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { commonStyles } from './commonStyles';
import { ThemeColors } from '../../contexts/ThemeContext';

interface Props {
  visible: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  theme: ThemeColors;
}

export default function LogoutModal({
  visible,
  onCancel,
  onConfirm,
  theme,
}: Props) {
  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onCancel}
    >
      <View style={[commonStyles.modalOverlay, styles.center]}>
        <View style={[styles.content, { backgroundColor: theme.cardBackground }]}>
          <Ionicons
            name="log-out-outline"
            size={50}
            color="#ef4444"
            style={{ marginBottom: 16 }}
          />
          <Text style={styles.title}>Logout</Text>
          <Text style={styles.text}>Are you sure you want to logout?</Text>
          <View style={styles.buttons}>
            <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.confirmButton} onPress={onConfirm}>
              <Text style={styles.confirmText}>Logout</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  center: { justifyContent: 'center', alignItems: 'center' },
  content: {
    width: '85%',
    maxWidth: 340,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  title: { fontSize: 22, fontWeight: 'bold', color: '#fff', marginBottom: 8 },
  text: {
    fontSize: 16,
    color: '#c4b5fd',
    textAlign: 'center',
    marginBottom: 24,
  },
  buttons: { flexDirection: 'row', gap: 12, width: '100%' },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#2d1b4e',
    alignItems: 'center',
  },
  cancelText: { fontSize: 16, fontWeight: '600', color: '#c4b5fd' },
  confirmButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#ef4444',
    alignItems: 'center',
  },
  confirmText: { fontSize: 16, fontWeight: '600', color: '#fff' },
});
