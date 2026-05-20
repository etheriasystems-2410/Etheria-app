import React from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { styles } from './styles';

interface BirthdayPickerProps {
  birthMonth: string;
  birthDay: string;
  onChangeMonth: (v: string) => void;
  onChangeDay: (v: string) => void;
  onSubmit: () => void;
  onSkip: () => void;
}

export default function BirthdayPicker({
  birthMonth,
  birthDay,
  onChangeMonth,
  onChangeDay,
  onSubmit,
  onSkip,
}: BirthdayPickerProps) {
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.birthdayContainer}>
        <Ionicons name="star" size={80} color="#b794f6" />
        <Text style={styles.birthdayTitle}>Discover Your Spirit Guide</Text>
        <Text style={styles.birthdaySubtitle}>
          Enter your birthday to be paired with the spirit guide of your zodiac element
        </Text>

        <View style={styles.birthdayInputs}>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Month</Text>
            <TextInput
              style={styles.birthdayInput}
              value={birthMonth}
              onChangeText={onChangeMonth}
              keyboardType="number-pad"
              placeholder="MM"
              placeholderTextColor="#9f7aea"
              maxLength={2}
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Day</Text>
            <TextInput
              style={styles.birthdayInput}
              value={birthDay}
              onChangeText={onChangeDay}
              keyboardType="number-pad"
              placeholder="DD"
              placeholderTextColor="#9f7aea"
              maxLength={2}
            />
          </View>
        </View>

        <TouchableOpacity style={styles.submitButton} onPress={onSubmit}>
          <Ionicons name="checkmark-circle" size={24} color="#fff" />
          <Text style={styles.submitButtonText}>Find My Guide</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.skipButton} onPress={onSkip}>
          <Text style={styles.skipButtonText}>Skip</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
