import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface Guide {
  name: string;
  element: 'Fire' | 'Water' | 'Earth' | 'Air';
  description: string;
  color: string;
  icon: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const guides: Guide[] = [
  {
    name: 'Ignis',
    element: 'Fire',
    description: 'Passionate and transformative, guides through action',
    color: '#ef4444',
    icon: 'flame',
  },
  {
    name: 'Aqua',
    element: 'Water',
    description: 'Intuitive and healing, guides through emotion',
    color: '#3b82f6',
    icon: 'water',
  },
  {
    name: 'Terra',
    element: 'Earth',
    description: 'Grounded and stable, guides through wisdom',
    color: '#10b981',
    icon: 'leaf',
  },
  {
    name: 'Aether',
    element: 'Air',
    description: 'Intellectual and free, guides through thought',
    color: '#a855f7',
    icon: 'cloudy',
  },
];

export default function SpiritGuides() {
  const [selectedGuide, setSelectedGuide] = useState<Guide | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);

  const selectGuide = (guide: Guide) => {
    setSelectedGuide(guide);
    setMessages([
      {
        role: 'assistant',
        content: `Greetings, seeker. I am ${guide.name}, guide of ${guide.element}. How may I illuminate your path?`,
      },
    ]);
  };

  const sendMessage = async () => {
    if (!inputText.trim() || !selectedGuide) return;

    const userMessage: Message = { role: 'user', content: inputText };
    setMessages((prev) => [...prev, userMessage]);
    setInputText('');
    setLoading(true);

    try {
      const response = await fetch(`${BACKEND_URL}/api/spirit-guides/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guide: selectedGuide.name,
          element: selectedGuide.element,
          message: inputText,
          history: messages,
        }),
      });
      const data = await response.json();
      setMessages((prev) => [...prev, { role: 'assistant', content: data.response }]);
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!selectedGuide) {
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.selectionContainer}>
          <View style={styles.header}>
            <Ionicons name="chatbubbles" size={60} color="#b794f6" />
            <Text style={styles.title}>Choose Your Spirit Guide</Text>
            <Text style={styles.subtitle}>Select an elemental guide to begin</Text>
          </View>

          <View style={styles.guidesGrid}>
            {guides.map((guide) => (
              <TouchableOpacity
                key={guide.name}
                style={styles.guideCard}
                onPress={() => selectGuide(guide)}
                activeOpacity={0.7}
              >
                <View style={[styles.guideIcon, { backgroundColor: guide.color }]}>
                  <Ionicons name={guide.icon as any} size={40} color="#fff" />
                </View>
                <Text style={styles.guideName}>{guide.name}</Text>
                <Text style={styles.guideElement}>{guide.element}</Text>
                <Text style={styles.guideDescription}>{guide.description}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={100}
    >
      <View style={styles.chatHeader}>
        <TouchableOpacity onPress={() => setSelectedGuide(null)} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#e9d5ff" />
        </TouchableOpacity>
        <View style={styles.chatHeaderInfo}>
          <Text style={styles.chatHeaderName}>{selectedGuide.name}</Text>
          <Text style={styles.chatHeaderElement}>Guide of {selectedGuide.element}</Text>
        </View>
        <View style={[styles.chatHeaderIcon, { backgroundColor: selectedGuide.color }]}>
          <Ionicons name={selectedGuide.icon as any} size={24} color="#fff" />
        </View>
      </View>

      <ScrollView style={styles.messagesContainer} contentContainerStyle={styles.messagesContent}>
        {messages.map((message, index) => (
          <View
            key={index}
            style={[
              styles.messageBubble,
              message.role === 'user' ? styles.userMessage : styles.assistantMessage,
            ]}
          >
            <Text
              style={[
                styles.messageText,
                message.role === 'user' ? styles.userMessageText : styles.assistantMessageText,
              ]}
            >
              {message.content}
            </Text>
          </View>
        ))}
        {loading && (
          <View style={[styles.messageBubble, styles.assistantMessage]}>
            <Text style={styles.assistantMessageText}>...</Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={inputText}
          onChangeText={setInputText}
          placeholder="Type your message..."
          placeholderTextColor="#9f7aea"
          multiline
          maxLength={500}
        />
        <TouchableOpacity
          style={[styles.sendButton, { backgroundColor: selectedGuide.color }]}
          onPress={sendMessage}
          disabled={!inputText.trim() || loading}
        >
          <Ionicons name="send" size={24} color="#fff" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0321',
  },
  selectionContainer: {
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
    marginTop: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#e9d5ff',
    marginTop: 16,
  },
  subtitle: {
    fontSize: 16,
    color: '#c4b5fd',
    marginTop: 8,
  },
  guidesGrid: {
    gap: 16,
  },
  guideCard: {
    backgroundColor: '#1a0033',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2d1b4e',
  },
  guideIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  guideName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#e9d5ff',
    marginBottom: 4,
  },
  guideElement: {
    fontSize: 16,
    color: '#b794f6',
    marginBottom: 12,
  },
  guideDescription: {
    fontSize: 14,
    color: '#c4b5fd',
    textAlign: 'center',
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#1a0033',
    borderBottomWidth: 1,
    borderBottomColor: '#2d1b4e',
  },
  backButton: {
    marginRight: 12,
  },
  chatHeaderInfo: {
    flex: 1,
  },
  chatHeaderName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#e9d5ff',
  },
  chatHeaderElement: {
    fontSize: 14,
    color: '#c4b5fd',
  },
  chatHeaderIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
    marginBottom: 12,
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#7c3aed',
  },
  assistantMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#2d1b4e',
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  userMessageText: {
    color: '#fff',
  },
  assistantMessageText: {
    color: '#e9d5ff',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#1a0033',
    borderTopWidth: 1,
    borderTopColor: '#2d1b4e',
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    backgroundColor: '#2d1b4e',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#e9d5ff',
    fontSize: 16,
    maxHeight: 100,
    marginRight: 12,
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
