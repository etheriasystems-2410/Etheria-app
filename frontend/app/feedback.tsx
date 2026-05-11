import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CosmicBackdrop } from '../components/ui';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

type FeedbackType = 'bug' | 'suggestion' | 'question' | 'other';

export default function Feedback() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const [feedbackType, setFeedbackType] = useState<FeedbackType>('suggestion');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState(user?.email || '');
  const [loading, setLoading] = useState(false);

  const feedbackTypes = [
    { id: 'bug', label: 'Bug Report', icon: 'bug', color: '#ef4444' },
    { id: 'suggestion', label: 'Suggestion', icon: 'bulb', color: '#f59e0b' },
    { id: 'question', label: 'Question', icon: 'help-circle', color: '#3b82f6' },
    { id: 'other', label: 'Other', icon: 'chatbubble', color: '#8b5cf6' },
  ];

  const handleSubmit = async () => {
    if (!subject.trim()) {
      Alert.alert('Error', 'Please enter a subject');
      return;
    }
    if (!message.trim()) {
      Alert.alert('Error', 'Please enter your message');
      return;
    }
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your email so we can respond');
      return;
    }

    setLoading(true);
    try {
      const sessionToken = await AsyncStorage.getItem('session_token');
      
      const response = await fetch(`${BACKEND_URL}/api/feedback/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(sessionToken && { 'Authorization': `Bearer ${sessionToken}` }),
        },
        body: JSON.stringify({
          type: feedbackType,
          subject: subject.trim(),
          message: message.trim(),
          user_email: email.trim(),
          user_name: user?.name || 'Anonymous',
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Failed to submit feedback');
      }

      Alert.alert(
        'Thank You!',
        'Your feedback has been submitted. We appreciate you helping us improve Etheria!',
        [{ text: 'OK', onPress: () => router.back() }]
      );

      // Clear form
      setSubject('');
      setMessage('');
    } catch (error: any) {
      console.error('Feedback submission error:', error);
      Alert.alert('Error', error.message || 'Failed to submit feedback. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#e9d5ff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Feedback & Support</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <View style={styles.introCard}>
          <Ionicons name="heart" size={32} color="#ec4899" />
          <Text style={styles.introTitle}>We Value Your Feedback</Text>
          <Text style={styles.introText}>
            Help us make Etheria better! Report bugs, share suggestions, or ask questions. 
            Our AI assistant will ensure your message reaches the team.
          </Text>
        </View>

        {/* Feedback Type Selection */}
        <Text style={styles.sectionLabel}>What type of feedback?</Text>
        <View style={styles.typeContainer}>
          {feedbackTypes.map((type) => (
            <TouchableOpacity
              key={type.id}
              style={[
                styles.typeButton,
                feedbackType === type.id && { 
                  backgroundColor: type.color + '30',
                  borderColor: type.color,
                },
              ]}
              onPress={() => setFeedbackType(type.id as FeedbackType)}
            >
              <Ionicons 
                name={type.icon as any} 
                size={24} 
                color={feedbackType === type.id ? type.color : '#9f7aea'} 
              />
              <Text style={[
                styles.typeLabel,
                feedbackType === type.id && { color: type.color },
              ]}>
                {type.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Email Input */}
        <Text style={styles.sectionLabel}>Your Email</Text>
        <TextInput
          style={styles.input}
          placeholder="your@email.com"
          placeholderTextColor="#6b7280"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        {/* Subject Input */}
        <Text style={styles.sectionLabel}>Subject</Text>
        <TextInput
          style={styles.input}
          placeholder="Brief description of your feedback"
          placeholderTextColor="#6b7280"
          value={subject}
          onChangeText={setSubject}
          maxLength={100}
        />

        {/* Message Input */}
        <Text style={styles.sectionLabel}>Your Message</Text>
        <TextInput
          style={[styles.input, styles.messageInput]}
          placeholder="Please provide as much detail as possible..."
          placeholderTextColor="#6b7280"
          value={message}
          onChangeText={setMessage}
          multiline
          numberOfLines={6}
          textAlignVertical="top"
          maxLength={2000}
        />
        <Text style={styles.charCount}>{message.length}/2000</Text>

        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.submitButton, loading && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#1a0033" />
          ) : (
            <>
              <Ionicons name="send" size={20} color="#1a0033" />
              <Text style={styles.submitButtonText}>Submit Feedback</Text>
            </>
          )}
        </TouchableOpacity>

        {/* AI Note */}
        <View style={styles.aiNote}>
          <Ionicons name="sparkles" size={16} color="#b794f6" />
          <Text style={styles.aiNoteText}>
            Our AI assistant will categorize and forward your feedback to the Etheria team.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0d0015',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: '#1a0533',
    borderBottomWidth: 1,
    borderBottomColor: '#2d1b4e',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#e9d5ff',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  introCard: {
    backgroundColor: 'rgba(236, 72, 153, 0.1)',
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(236, 72, 153, 0.3)',
  },
  introTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ec4899',
    marginTop: 12,
    marginBottom: 8,
  },
  introText: {
    fontSize: 14,
    color: '#c4b5fd',
    textAlign: 'center',
    lineHeight: 22,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#b794f6',
    marginBottom: 8,
    marginTop: 16,
  },
  typeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2d1b4e',
    backgroundColor: '#1a0533',
    gap: 8,
  },
  typeLabel: {
    fontSize: 14,
    color: '#9f7aea',
    fontWeight: '500',
  },
  input: {
    backgroundColor: '#1a0533',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#e9d5ff',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#2d1b4e',
  },
  messageInput: {
    height: 150,
    paddingTop: 14,
  },
  charCount: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'right',
    marginTop: 4,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#a855f7',
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 24,
    gap: 8,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: '#1a0033',
    fontSize: 18,
    fontWeight: 'bold',
  },
  aiNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    gap: 8,
  },
  aiNoteText: {
    fontSize: 12,
    color: '#9f7aea',
    flex: 1,
  },
});
