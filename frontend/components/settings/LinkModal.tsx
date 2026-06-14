/**
 * Settings → fallback modal shown when a Linking.openURL call fails. The user
 * can copy the URL manually or retry opening it.
 */
import React from 'react';
import { Linking, Modal, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { commonStyles } from './commonStyles';
import { ThemeColors } from '../../contexts/ThemeContext';

interface Props {
  visible: boolean;
  onClose: () => void;
  theme: ThemeColors;
  title: string;
  url: string;
}

export default function LinkModal({
  visible,
  onClose,
  theme,
  title,
  url,
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
            <Text style={commonStyles.modalTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#e9d5ff" />
            </TouchableOpacity>
          </View>
          <View style={commonStyles.emailModalContent}>
            <Ionicons name="link" size={48} color="#a855f7" />
            <Text style={commonStyles.emailModalTitle}>Visit Link</Text>
            <Text style={commonStyles.emailModalAddress}>{url}</Text>
            <Text style={commonStyles.emailModalHint}>
              Copy the URL above to open in your browser
            </Text>

            <TouchableOpacity
              style={commonStyles.emailOpenButton}
              onPress={async () => {
                try {
                  await Linking.openURL(url);
                  onClose();
                } catch (e) {
                  console.log('Could not open link');
                }
              }}
            >
              <Ionicons name="open-outline" size={20} color="#fff" />
              <Text style={commonStyles.emailOpenButtonText}>Open in Browser</Text>
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
