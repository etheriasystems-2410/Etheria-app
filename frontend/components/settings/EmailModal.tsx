/**
 * Settings → "Email Us" sheet. Tries to open the device email composer via
 * `onTryOpenEmail` (Linking.openURL mailto:). Shows the email address either
 * way so the user can copy it manually.
 */
import React from 'react';
import { Modal, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { commonStyles } from './commonStyles';
import { ThemeColors } from '../../contexts/ThemeContext';

interface Props {
  visible: boolean;
  onClose: () => void;
  theme: ThemeColors;
  onTryOpenEmail: () => void;
}

export default function EmailModal({
  visible,
  onClose,
  theme,
  onTryOpenEmail,
}: Props) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={commonStyles.modalOverlay}>
        <View style={[commonStyles.modalContent, { backgroundColor: theme.cardBackground }]}>
          <View style={commonStyles.modalHeader}>
            <Text style={commonStyles.modalTitle}>Contact Us</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#e9d5ff" />
            </TouchableOpacity>
          </View>
          <View style={commonStyles.emailModalContent}>
            <Ionicons name="mail" size={48} color="#a855f7" />
            <Text style={commonStyles.emailModalTitle}>Email Us</Text>
            <Text style={commonStyles.emailModalAddress}>etheriasystems@gmail.com</Text>
            <Text style={commonStyles.emailModalHint}>
              Copy the email address above to contact us
            </Text>

            <TouchableOpacity
              style={commonStyles.emailOpenButton}
              onPress={onTryOpenEmail}
            >
              <Ionicons name="open-outline" size={20} color="#fff" />
              <Text style={commonStyles.emailOpenButtonText}>Open Email App</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={commonStyles.cancelButton} onPress={onClose}>
            <Text style={commonStyles.cancelButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
