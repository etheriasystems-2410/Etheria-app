/**
 * Settings → "Change Profile Picture" sheet: Take Photo / Choose from Library.
 */
import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { commonStyles } from './commonStyles';
import { ThemeColors } from '../../contexts/ThemeContext';

interface Props {
  visible: boolean;
  onClose: () => void;
  theme: ThemeColors;
  onTakePhoto: () => void;
  onPickLibrary: () => void;
}

export default function PictureModal({
  visible,
  onClose,
  theme,
  onTakePhoto,
  onPickLibrary,
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
            <Text style={commonStyles.modalTitle}>Change Profile Picture</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#e9d5ff" />
            </TouchableOpacity>
          </View>
          <View style={styles.pictureOptionsContainer}>
            <TouchableOpacity
              style={styles.pictureOption}
              onPress={() => {
                onClose();
                onTakePhoto();
              }}
            >
              <View style={styles.pictureOptionIcon}>
                <Ionicons name="camera" size={32} color="#a855f7" />
              </View>
              <Text style={styles.pictureOptionText}>Take Photo</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.pictureOption}
              onPress={() => {
                onClose();
                onPickLibrary();
              }}
            >
              <View style={styles.pictureOptionIcon}>
                <Ionicons name="images" size={32} color="#a855f7" />
              </View>
              <Text style={styles.pictureOptionText}>Choose from Library</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={commonStyles.cancelButton} onPress={onClose}>
            <Text style={commonStyles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  pictureOptionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 24,
    paddingHorizontal: 20,
  },
  pictureOption: { alignItems: 'center', padding: 16 },
  pictureOptionIcon: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(168, 85, 247, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  pictureOptionText: { fontSize: 14, color: '#e9d5ff', fontWeight: '500' },
});
