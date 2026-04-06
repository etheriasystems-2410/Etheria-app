import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import Constants from 'expo-constants';

const BACKEND_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8001';

// Common dream symbols for quick selection
const DREAM_SYMBOLS = [
  { id: 'water', label: 'Water', icon: 'water' },
  { id: 'flying', label: 'Flying', icon: 'airplane' },
  { id: 'falling', label: 'Falling', icon: 'arrow-down' },
  { id: 'death', label: 'Death', icon: 'skull' },
  { id: 'animals', label: 'Animals', icon: 'paw' },
  { id: 'chase', label: 'Being Chased', icon: 'footsteps' },
  { id: 'teeth', label: 'Teeth', icon: 'happy' },
  { id: 'house', label: 'House', icon: 'home' },
  { id: 'car', label: 'Vehicle', icon: 'car' },
  { id: 'snake', label: 'Snake', icon: 'warning' },
  { id: 'baby', label: 'Baby', icon: 'heart' },
  { id: 'fire', label: 'Fire', icon: 'flame' },
];

const DREAM_FEELINGS = [
  { id: 'fear', label: 'Fear', color: '#ef4444' },
  { id: 'joy', label: 'Joy', color: '#10b981' },
  { id: 'anxiety', label: 'Anxiety', color: '#f59e0b' },
  { id: 'peace', label: 'Peace', color: '#3b82f6' },
  { id: 'confusion', label: 'Confusion', color: '#8b5cf6' },
  { id: 'sadness', label: 'Sadness', color: '#6366f1' },
  { id: 'excitement', label: 'Excitement', color: '#ec4899' },
  { id: 'anger', label: 'Anger', color: '#dc2626' },
];

export default function DreamsScreen() {
  const { isAuthenticated } = useAuth();
  const { t } = useLanguage();
  const scrollViewRef = useRef<ScrollView>(null);
  
  const [dreamDescription, setDreamDescription] = useState('');
  const [selectedSymbols, setSelectedSymbols] = useState<string[]>([]);
  const [selectedFeelings, setSelectedFeelings] = useState<string[]>([]);
  const [customSymbols, setCustomSymbols] = useState('');
  const [interpretation, setInterpretation] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [dreamTitle, setDreamTitle] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const toggleSymbol = (symbolId: string) => {
    setSelectedSymbols(prev => 
      prev.includes(symbolId) 
        ? prev.filter(s => s !== symbolId)
        : [...prev, symbolId]
    );
  };

  const toggleFeeling = (feelingId: string) => {
    setSelectedFeelings(prev => 
      prev.includes(feelingId) 
        ? prev.filter(f => f !== feelingId)
        : [...prev, feelingId]
    );
  };

  const interpretDream = async () => {
    if (!dreamDescription.trim() && selectedSymbols.length === 0) {
      Alert.alert('Missing Information', 'Please describe your dream or select some symbols.');
      return;
    }

    setIsLoading(true);
    setInterpretation(null);

    try {
      const sessionToken = await AsyncStorage.getItem('session_token');
      
      const symbolNames = selectedSymbols.map(id => 
        DREAM_SYMBOLS.find(s => s.id === id)?.label || id
      );
      const feelingNames = selectedFeelings.map(id => 
        DREAM_FEELINGS.find(f => f.id === id)?.label || id
      );

      const response = await fetch(`${BACKEND_URL}/api/dreams/interpret`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': sessionToken ? `Bearer ${sessionToken}` : '',
        },
        body: JSON.stringify({
          description: dreamDescription,
          symbols: [...symbolNames, ...customSymbols.split(',').map(s => s.trim()).filter(s => s)],
          feelings: feelingNames,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setInterpretation(data.interpretation);
        // Scroll to show interpretation
        setTimeout(() => {
          scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 100);
      } else {
        Alert.alert('Error', 'Failed to interpret dream. Please try again.');
      }
    } catch (error) {
      console.error('Error interpreting dream:', error);
      Alert.alert('Error', 'Failed to connect to server. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const openSaveModal = () => {
    if (!interpretation) {
      Alert.alert('No Interpretation', 'Please get a dream interpretation first.');
      return;
    }
    setDreamTitle(`Dream: ${new Date().toLocaleDateString()}`);
    setShowSaveModal(true);
  };

  const saveDreamToJournal = async () => {
    if (!dreamTitle.trim()) {
      Alert.alert('Missing Title', 'Please enter a title for your dream.');
      return;
    }

    setIsSaving(true);

    try {
      const sessionToken = await AsyncStorage.getItem('session_token');
      
      const symbolNames = selectedSymbols.map(id => 
        DREAM_SYMBOLS.find(s => s.id === id)?.label || id
      );
      const feelingNames = selectedFeelings.map(id => 
        DREAM_FEELINGS.find(f => f.id === id)?.label || id
      );
      const allSymbols = [...symbolNames, ...customSymbols.split(',').map(s => s.trim()).filter(s => s)];

      const journalEntry = {
        title: dreamTitle,
        content: `Dream Description:\n${dreamDescription}\n\nSymbols: ${allSymbols.join(', ') || 'None specified'}\nFeelings: ${feelingNames.join(', ') || 'None specified'}\n\n--- AI Interpretation ---\n\n${interpretation}`,
        category: 'dreams',
        entry_type: 'dream',
        date: new Date().toISOString(),
        metadata: {
          dream_description: dreamDescription,
          symbols: allSymbols,
          feelings: feelingNames,
          interpretation: interpretation,
          interpreted_at: new Date().toISOString(),
        },
      };

      const response = await fetch(`${BACKEND_URL}/api/journal/entries`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': sessionToken ? `Bearer ${sessionToken}` : '',
        },
        body: JSON.stringify(journalEntry),
      });

      if (response.ok) {
        Alert.alert('Saved!', 'Your dream has been saved to your journal.');
        setShowSaveModal(false);
        // Reset form
        setDreamDescription('');
        setSelectedSymbols([]);
        setSelectedFeelings([]);
        setCustomSymbols('');
        setInterpretation(null);
        setDreamTitle('');
      } else {
        Alert.alert('Error', 'Failed to save dream. Please try again.');
      }
    } catch (error) {
      console.error('Error saving dream:', error);
      Alert.alert('Error', 'Failed to save dream. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const clearForm = () => {
    Alert.alert(
      'Clear Form',
      'Are you sure you want to clear all entries?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            setDreamDescription('');
            setSelectedSymbols([]);
            setSelectedFeelings([]);
            setCustomSymbols('');
            setInterpretation(null);
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Ionicons name="moon" size={28} color="#a855f7" />
            <Text style={styles.headerTitle}>Dream Interpreter</Text>
          </View>
          {interpretation && (
            <TouchableOpacity style={styles.clearButton} onPress={clearForm}>
              <Ionicons name="refresh" size={20} color="#9f7aea" />
            </TouchableOpacity>
          )}
        </View>

        <ScrollView 
          ref={scrollViewRef}
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Dream Description */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              <Ionicons name="create" size={18} color="#a855f7" /> Describe Your Dream
            </Text>
            <TextInput
              style={styles.dreamInput}
              value={dreamDescription}
              onChangeText={setDreamDescription}
              placeholder="What happened in your dream? Describe the scene, events, people, and any notable details..."
              placeholderTextColor="#6b5b7a"
              multiline
              textAlignVertical="top"
            />
          </View>

          {/* Dream Symbols */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              <Ionicons name="shapes" size={18} color="#a855f7" /> Dream Symbols
            </Text>
            <Text style={styles.sectionSubtitle}>Select any symbols that appeared in your dream</Text>
            <View style={styles.symbolsGrid}>
              {DREAM_SYMBOLS.map((symbol) => (
                <TouchableOpacity
                  key={symbol.id}
                  style={[
                    styles.symbolChip,
                    selectedSymbols.includes(symbol.id) && styles.symbolChipSelected,
                  ]}
                  onPress={() => toggleSymbol(symbol.id)}
                >
                  <Ionicons 
                    name={symbol.icon as any} 
                    size={18} 
                    color={selectedSymbols.includes(symbol.id) ? '#fff' : '#c4b5fd'} 
                  />
                  <Text style={[
                    styles.symbolText,
                    selectedSymbols.includes(symbol.id) && styles.symbolTextSelected,
                  ]}>
                    {symbol.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            
            <TextInput
              style={styles.customSymbolsInput}
              value={customSymbols}
              onChangeText={setCustomSymbols}
              placeholder="Other symbols (comma separated): e.g., mirror, clock, bridge..."
              placeholderTextColor="#6b5b7a"
            />
          </View>

          {/* Dream Feelings */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              <Ionicons name="heart" size={18} color="#a855f7" /> Feelings During Dream
            </Text>
            <Text style={styles.sectionSubtitle}>What emotions did you experience?</Text>
            <View style={styles.feelingsGrid}>
              {DREAM_FEELINGS.map((feeling) => (
                <TouchableOpacity
                  key={feeling.id}
                  style={[
                    styles.feelingChip,
                    selectedFeelings.includes(feeling.id) && { 
                      backgroundColor: feeling.color,
                      borderColor: feeling.color,
                    },
                  ]}
                  onPress={() => toggleFeeling(feeling.id)}
                >
                  <Text style={[
                    styles.feelingText,
                    selectedFeelings.includes(feeling.id) && styles.feelingTextSelected,
                  ]}>
                    {feeling.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Interpret Button */}
          <TouchableOpacity 
            style={[styles.interpretButton, isLoading && styles.interpretButtonDisabled]}
            onPress={interpretDream}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <ActivityIndicator color="#fff" size="small" />
                <Text style={styles.interpretButtonText}>Interpreting Dream...</Text>
              </>
            ) : (
              <>
                <Ionicons name="sparkles" size={22} color="#fff" />
                <Text style={styles.interpretButtonText}>Interpret My Dream</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Interpretation Result */}
          {interpretation && (
            <View style={styles.interpretationSection}>
              <View style={styles.interpretationHeader}>
                <Ionicons name="bulb" size={24} color="#fbbf24" />
                <Text style={styles.interpretationTitle}>Dream Interpretation</Text>
              </View>
              <View style={styles.interpretationCard}>
                <Text style={styles.interpretationText}>{interpretation}</Text>
              </View>
              
              {/* Save to Journal Button */}
              <TouchableOpacity 
                style={styles.saveButton}
                onPress={openSaveModal}
              >
                <Ionicons name="book" size={20} color="#fff" />
                <Text style={styles.saveButtonText}>Save to Journal</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.bottomPadding} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Save Modal */}
      <Modal visible={showSaveModal} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Ionicons name="moon" size={28} color="#a855f7" />
              <Text style={styles.modalTitle}>Save Dream to Journal</Text>
            </View>
            
            <Text style={styles.modalLabel}>Dream Title</Text>
            <TextInput
              style={styles.modalInput}
              value={dreamTitle}
              onChangeText={setDreamTitle}
              placeholder="Enter a title for this dream..."
              placeholderTextColor="#6b5b7a"
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancelButton]}
                onPress={() => setShowSaveModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalSaveButton]}
                onPress={saveDreamToJournal}
                disabled={isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Ionicons name="save" size={18} color="#fff" />
                    <Text style={styles.modalSaveText}>Save Dream</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0014',
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1a0a2e',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#e9d5ff',
  },
  clearButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#1a0a2e',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#e9d5ff',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#9f7aea',
    marginBottom: 12,
  },
  dreamInput: {
    backgroundColor: '#1a0a2e',
    borderRadius: 16,
    padding: 16,
    color: '#e9d5ff',
    fontSize: 15,
    minHeight: 120,
    borderWidth: 1,
    borderColor: '#2d1b4e',
    lineHeight: 22,
  },
  symbolsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 12,
  },
  symbolChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#1a0a2e',
    borderWidth: 1,
    borderColor: '#2d1b4e',
    gap: 6,
  },
  symbolChipSelected: {
    backgroundColor: '#7c3aed',
    borderColor: '#7c3aed',
  },
  symbolText: {
    color: '#c4b5fd',
    fontSize: 13,
    fontWeight: '500',
  },
  symbolTextSelected: {
    color: '#fff',
  },
  customSymbolsInput: {
    backgroundColor: '#1a0a2e',
    borderRadius: 12,
    padding: 14,
    color: '#e9d5ff',
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#2d1b4e',
  },
  feelingsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  feelingChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#1a0a2e',
    borderWidth: 1,
    borderColor: '#2d1b4e',
  },
  feelingText: {
    color: '#c4b5fd',
    fontSize: 14,
    fontWeight: '500',
  },
  feelingTextSelected: {
    color: '#fff',
  },
  interpretButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#7c3aed',
    paddingVertical: 16,
    borderRadius: 16,
    gap: 10,
    marginTop: 8,
  },
  interpretButtonDisabled: {
    backgroundColor: '#4c1d95',
    opacity: 0.7,
  },
  interpretButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
  interpretationSection: {
    marginTop: 24,
  },
  interpretationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  interpretationTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fbbf24',
  },
  interpretationCard: {
    backgroundColor: '#1a0a2e',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#2d1b4e',
    borderLeftWidth: 4,
    borderLeftColor: '#fbbf24',
  },
  interpretationText: {
    color: '#e9d5ff',
    fontSize: 15,
    lineHeight: 24,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10b981',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
    marginTop: 16,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  bottomPadding: {
    height: 40,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#1a0033',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: '#2d1b4e',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#e9d5ff',
  },
  modalLabel: {
    fontSize: 14,
    color: '#c4b5fd',
    marginBottom: 8,
  },
  modalInput: {
    backgroundColor: '#2d1b4e',
    borderRadius: 12,
    padding: 14,
    color: '#e9d5ff',
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#4a3b6e',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  modalButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  modalCancelButton: {
    backgroundColor: '#2d1b4e',
    borderWidth: 1,
    borderColor: '#4a3b6e',
  },
  modalCancelText: {
    color: '#c4b5fd',
    fontSize: 15,
    fontWeight: '600',
  },
  modalSaveButton: {
    backgroundColor: '#10b981',
  },
  modalSaveText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});
