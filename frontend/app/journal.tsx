import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { Video, ResizeMode } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { format } from 'date-fns';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import HeaderBanner from '../components/HeaderBanner';

// Import modular journal components
import { 
  ReadingsTab, 
  TranscriptsTab, 
  ProgressTab,
  DreamsTab,
  EmptyState,
  JournalEntry as JournalEntryType,
  TrainingProgress as TrainingProgressType,
  JournalStatus as JournalStatusType,
} from '../components/journal';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
const JOURNAL_HERO_IMAGE = 'https://customer-assets.emergentagent.com/job_meditation-nexus/artifacts/zw3j6sl3_36734.jpg';
const JOURNAL_HERO_VIDEO = require('../assets/videos/journal-hero.mp4');

// Use imported types with local aliases for compatibility
type JournalEntry = JournalEntryType;
type TrainingProgress = TrainingProgressType;
type JournalStatus = JournalStatusType;

export default function Journal() {
  const { isAuthenticated, isPremium } = useAuth();
  const { t, languageCode } = useLanguage();
  const { theme } = useTheme();
  const router = useRouter();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [showNewEntry, setShowNewEntry] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('meditation');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [journalStatus, setJournalStatus] = useState<JournalStatus | null>(null);
  const [trainingProgress, setTrainingProgress] = useState<TrainingProgress | null>(null);
  const [trainingCompletions, setTrainingCompletions] = useState<JournalEntry[]>([]);
  const [activeTab, setActiveTab] = useState<'entries' | 'readings' | 'transcripts' | 'dreams' | 'progress'>('entries');
  const [readings, setReadings] = useState<JournalEntry[]>([]);
  const [transcripts, setTranscripts] = useState<JournalEntry[]>([]);
  const [dreams, setDreams] = useState<JournalEntry[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; type: 'entry' | 'reading' | 'transcript' | 'dream' } | null>(null);

  const categories = [
    { id: 'meditation', label: 'Meditation', icon: 'fitness', color: '#8b5cf6' },
    { id: 'psychic', label: 'Psychic Training', icon: 'school', color: '#3b82f6' },
    { id: 'divination', label: 'Oracle Reading', icon: 'sparkles', color: '#db2777' },
    { id: 'spirit_guide', label: 'Spirit Guide', icon: 'chatbubbles', color: '#ec4899' },
    { id: 'general', label: 'General', icon: 'book', color: '#10b981' },
  ];

  useEffect(() => {
    loadEntries();
    loadReadings();
    loadTranscripts();
    loadTrainingProgress();
    loadTrainingCompletions();
    loadDreams();
    if (isAuthenticated) {
      fetchJournalStatus();
    }
  }, [isAuthenticated]);

  const loadReadings = async () => {
    try {
      const sessionToken = await AsyncStorage.getItem('session_token');
      if (sessionToken) {
        const response = await fetch(`${BACKEND_URL}/api/journal/entries`, {
          headers: {
            'Authorization': `Bearer ${sessionToken}`
          }
        });
        const data = await response.json();
        if (Array.isArray(data)) {
          // Filter only oracle readings (not transcripts)
          const readingEntries = data.filter((e: any) => 
            e.entry_type === 'oracle' || 
            e.category === 'divination'
          ).map((e: any) => ({
            id: e._id || e.id,
            _id: e._id,
            title: e.title,
            content: e.content,
            category: e.category,
            date: e.created_at || e.date,
            entry_type: e.entry_type,
            metadata: e.metadata
          }));
          setReadings(readingEntries);
        }
      }
    } catch (error) {
      console.error('Error loading readings:', error);
    }
  };

  const loadTranscripts = async () => {
    try {
      const sessionToken = await AsyncStorage.getItem('session_token');
      if (sessionToken) {
        const response = await fetch(`${BACKEND_URL}/api/journal/entries`, {
          headers: {
            'Authorization': `Bearer ${sessionToken}`
          }
        });
        const data = await response.json();
        if (Array.isArray(data)) {
          // Filter only spirit guide transcripts
          const transcriptEntries = data.filter((e: any) => 
            e.entry_type === 'transcript' || 
            e.entry_type === 'spirit_guide' ||
            e.category === 'spirit_guide'
          ).map((e: any) => ({
            id: e._id || e.id,
            _id: e._id,
            title: e.title,
            content: e.content,
            category: e.category,
            date: e.created_at || e.date,
            entry_type: e.entry_type,
            metadata: e.metadata
          }));
          setTranscripts(transcriptEntries);
        }
      }
    } catch (error) {
      console.error('Error loading transcripts:', error);
    }
  };

  const loadTrainingCompletions = async () => {
    try {
      const sessionToken = await AsyncStorage.getItem('session_token');
      if (sessionToken) {
        const response = await fetch(`${BACKEND_URL}/api/journal/entries`, {
          headers: {
            'Authorization': `Bearer ${sessionToken}`
          }
        });
        const data = await response.json();
        if (Array.isArray(data)) {
          // Filter only training completion entries
          const completionEntries = data.filter((e: any) => 
            e.entry_type === 'training_completion'
          ).map((e: any) => ({
            id: e._id || e.id,
            _id: e._id,
            title: e.title,
            content: e.content,
            category: e.category,
            date: e.created_at || e.date,
            entry_type: e.entry_type,
            metadata: e.metadata
          }));
          setTrainingCompletions(completionEntries);
        }
      }
    } catch (error) {
      console.error('Error loading training completions:', error);
    }
  };

  const loadDreams = async () => {
    try {
      const sessionToken = await AsyncStorage.getItem('session_token');
      if (sessionToken) {
        const response = await fetch(`${BACKEND_URL}/api/journal/entries`, {
          headers: {
            'Authorization': `Bearer ${sessionToken}`
          }
        });
        const data = await response.json();
        if (Array.isArray(data)) {
          // Filter only dream entries
          const dreamEntries = data.filter((e: any) => 
            e.entry_type === 'dream' || e.category === 'dreams'
          ).map((e: any) => ({
            id: e._id || e.id,
            _id: e._id,
            title: e.title,
            content: e.content,
            category: e.category,
            date: e.created_at || e.date,
            entry_type: e.entry_type,
            metadata: e.metadata
          }));
          setDreams(dreamEntries);
        }
      }
    } catch (error) {
      console.error('Error loading dreams:', error);
    }
  };

  const loadTrainingProgress = async () => {
    try {
      // Use the correct AsyncStorage key that training.tsx uses
      const completedLessonsData = await AsyncStorage.getItem('completed_lessons');
      const completed = completedLessonsData ? JSON.parse(completedLessonsData) : [];
      
      // Fetch modules from backend
      const response = await fetch(`${BACKEND_URL}/api/training/modules`);
      if (response.ok) {
        const modules = await response.json();
        
        const moduleProgress = modules.map((module: any) => {
          // Count completed lessons for this module from the stored progress
          const moduleCompletedCount = completed.filter((key: string) => 
            key.startsWith(`${module.id}-`)
          ).length;
          
          return {
            name: module.title,
            category: module.category,
            total: module.lessons || 0,
            completed: moduleCompletedCount,
          };
        });

        const totalLessons = moduleProgress.reduce((sum: number, m: any) => sum + m.total, 0);
        const completedCount = moduleProgress.reduce((sum: number, m: any) => sum + m.completed, 0);

        setTrainingProgress({
          total_lessons: totalLessons,
          completed_lessons: completedCount,
          modules: moduleProgress,
        });
      } else {
        // Set empty progress if API fails
        setTrainingProgress({
          total_lessons: 0,
          completed_lessons: 0,
          modules: [],
        });
      }
    } catch (error) {
      console.error('Error loading training progress:', error);
      // Set empty progress on error
      setTrainingProgress({
        total_lessons: 0,
        completed_lessons: 0,
        modules: [],
      });
    }
  };

  const fetchJournalStatus = async () => {
    try {
      const sessionToken = await AsyncStorage.getItem('session_token');
      const response = await fetch(`${BACKEND_URL}/api/journal/status`, {
        headers: {
          'Authorization': `Bearer ${sessionToken}`
        }
      });
      const data = await response.json();
      setJournalStatus(data);
    } catch (error) {
      console.error('Error fetching journal status:', error);
    }
  };

  const deleteEntry = (entryId: string, entryType: 'entry' | 'reading' | 'transcript' | 'dream') => {
    console.log('Delete entry called:', { entryId, entryType });
    // Show confirmation modal
    setDeleteConfirm({ id: entryId, type: entryType });
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    
    const { id: entryId, type: entryType } = deleteConfirm;
    
    try {
      const sessionToken = await AsyncStorage.getItem('session_token');
      const response = await fetch(`${BACKEND_URL}/api/journal/entries/${entryId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': sessionToken ? `Bearer ${sessionToken}` : '',
        },
      });

      if (response.ok) {
        // Remove from appropriate state
        if (entryType === 'entry') {
          setEntries(prev => prev.filter(e => e.id !== entryId && e._id !== entryId));
        } else if (entryType === 'reading') {
          setReadings(prev => prev.filter(e => e.id !== entryId && e._id !== entryId));
        } else if (entryType === 'transcript') {
          setTranscripts(prev => prev.filter(e => e.id !== entryId && e._id !== entryId));
        } else if (entryType === 'dream') {
          setDreams(prev => prev.filter(e => e.id !== entryId && e._id !== entryId));
        }
        setDeleteConfirm(null);
      } else {
        Alert.alert('Error', 'Failed to delete entry. Please try again.');
        setDeleteConfirm(null);
      }
    } catch (error) {
      console.error('Error deleting entry:', error);
      Alert.alert('Error', 'Failed to delete entry. Please try again.');
      setDeleteConfirm(null);
    }
  };

  const loadEntries = async () => {
    setLoading(true);
    try {
      // Try to load from backend first
      const sessionToken = await AsyncStorage.getItem('session_token');
      if (sessionToken) {
        const response = await fetch(`${BACKEND_URL}/api/journal/entries`, {
          headers: {
            'Authorization': `Bearer ${sessionToken}`
          }
        });
        const data = await response.json();
        if (Array.isArray(data) && data.length > 0) {
          // Filter out readings, transcripts, and dreams - those go to their own tabs
          const userEntries = data.filter((e: any) => 
            e.entry_type !== 'oracle' && 
            e.entry_type !== 'reading' &&
            e.entry_type !== 'transcript' && 
            e.entry_type !== 'spirit_guide' &&
            e.entry_type !== 'dream' &&
            e.entry_type !== 'training_completion' &&
            e.category !== 'divination' &&
            e.category !== 'spirit_guide' &&
            e.category !== 'dreams'
          );
          const formattedEntries = userEntries.map((e: any) => ({
            id: e._id || e.id,
            _id: e._id,
            title: e.title,
            content: e.content,
            category: e.category,
            date: e.created_at || e.date,
            mood: e.mood
          }));
          setEntries(formattedEntries);
          setLoading(false);
          return;
        }
      }
      
      // Fallback to local storage
      const stored = await AsyncStorage.getItem('journal_entries');
      if (stored) {
        setEntries(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Error loading entries:', error);
      // Fallback to local storage
      const stored = await AsyncStorage.getItem('journal_entries');
      if (stored) {
        setEntries(JSON.parse(stored));
      }
    } finally {
      setLoading(false);
    }
  };

  const saveEntry = async () => {
    if (!newTitle.trim() || !newContent.trim()) return;

    // Check if user has reached limit
    if (journalStatus && !journalStatus.unlimited && journalStatus.entries_remaining !== null && journalStatus.entries_remaining <= 0) {
      Alert.alert(
        'Weekly Limit Reached',
        'Free users can only create 5 journal entries per week. Upgrade to Premium for unlimited entries!',
        [
          { text: 'OK', style: 'cancel' },
          { text: 'Upgrade', onPress: () => {} } // Could navigate to settings
        ]
      );
      return;
    }

    setSaving(true);
    const entry: JournalEntry = {
      id: Date.now().toString(),
      title: newTitle,
      content: newContent,
      category: selectedCategory,
      date: new Date().toISOString(),
    };

    try {
      // Try to save to backend
      const sessionToken = await AsyncStorage.getItem('session_token');
      if (sessionToken) {
        const response = await fetch(`${BACKEND_URL}/api/journal/save`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionToken}`
          },
          body: JSON.stringify(entry)
        });
        
        const data = await response.json();
        
        if (!response.ok) {
          if (response.status === 403) {
            Alert.alert(
              'Weekly Limit Reached',
              data.detail || 'Free users can only create 5 journal entries per week. Upgrade to Premium for unlimited entries!'
            );
            setSaving(false);
            return;
          }
          throw new Error(data.detail || 'Failed to save entry');
        }
        
        entry.id = data.id;
      }
      
      // Update local state and storage
      const updated = [entry, ...entries];
      setEntries(updated);
      await AsyncStorage.setItem('journal_entries', JSON.stringify(updated));

      // Refresh status
      await fetchJournalStatus();

      setNewTitle('');
      setNewContent('');
      setShowNewEntry(false);
    } catch (error: any) {
      console.error('Error saving entry:', error);
      Alert.alert('Error', error.message || 'Failed to save entry');
    } finally {
      setSaving(false);
    }
  };

  const getCategoryInfo = (categoryId: string) => {
    return categories.find((c) => c.id === categoryId) || categories[0];
  };

  // Get entry type icon
  const getEntryTypeIcon = (entry: JournalEntry) => {
    if (entry.entry_type === 'oracle') return 'sparkles';
    if (entry.entry_type === 'spirit_guide') return 'chatbubbles';
    if (entry.entry_type === 'training') return 'school';
    return 'book';
  };




  return (
    <View style={styles.container}>
      {/* Header Banner */}
      <HeaderBanner title="Journal" height={100} />
      
      {/* Hero Section with Video Background */}
      <View style={styles.heroSection}>
        <Video
          source={JOURNAL_HERO_VIDEO}
          style={styles.heroVideo}
          resizeMode={ResizeMode.CONTAIN}
          shouldPlay
          isLooping
          isMuted
        />
        <Image
          source={{ uri: JOURNAL_HERO_IMAGE }}
          style={styles.heroImageFallback}
          contentFit="cover"
        />
        <View style={styles.heroOverlay}>
          <View style={styles.heroContent}>
            <Ionicons name="book" size={40} color="#e9d5ff" />
            <Text style={styles.heroTitle}>My Journal</Text>
          </View>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => setShowNewEntry(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="add" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Tab Selector */}
      <View style={styles.tabContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabScrollContent}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'entries' && styles.activeTab]}
            onPress={() => setActiveTab('entries')}
          >
            <Ionicons name="book" size={16} color={activeTab === 'entries' ? '#a855f7' : '#9f7aea'} />
            <Text style={[styles.tabText, activeTab === 'entries' && styles.activeTabText]}>Entries</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'readings' && styles.activeTab]}
            onPress={() => setActiveTab('readings')}
          >
            <Ionicons name="sparkles" size={16} color={activeTab === 'readings' ? '#a855f7' : '#9f7aea'} />
            <Text style={[styles.tabText, activeTab === 'readings' && styles.activeTabText]}>Readings</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'transcripts' && styles.activeTab]}
            onPress={() => setActiveTab('transcripts')}
          >
            <Ionicons name="chatbubbles" size={16} color={activeTab === 'transcripts' ? '#a855f7' : '#9f7aea'} />
            <Text style={[styles.tabText, activeTab === 'transcripts' && styles.activeTabText]}>Transcripts</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'dreams' && styles.activeTab]}
            onPress={() => setActiveTab('dreams')}
          >
            <Ionicons name="moon" size={16} color={activeTab === 'dreams' ? '#a855f7' : '#9f7aea'} />
            <Text style={[styles.tabText, activeTab === 'dreams' && styles.activeTabText]}>Dreams</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'progress' && styles.activeTab]}
            onPress={() => setActiveTab('progress')}
          >
            <Ionicons name="trending-up" size={16} color={activeTab === 'progress' ? '#a855f7' : '#9f7aea'} />
            <Text style={[styles.tabText, activeTab === 'progress' && styles.activeTabText]}>Training</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {activeTab === 'progress' ? (
        <ProgressTab 
          trainingProgress={trainingProgress}
          trainingCompletions={trainingCompletions}
          loading={loading}
        />
      ) : activeTab === 'readings' ? (
        <ReadingsTab 
          readings={readings}
          onDelete={(id, type) => setDeleteConfirm({ id, type })}
        />
      ) : activeTab === 'transcripts' ? (
        <TranscriptsTab 
          transcripts={transcripts}
          onDelete={(id, type) => setDeleteConfirm({ id, type })}
        />
      ) : activeTab === 'dreams' ? (
        <DreamsTab 
          dreams={dreams}
          onDelete={(id, type) => setDeleteConfirm({ id, type })}
        />
      ) : (
        <ScrollView
          style={styles.entriesContainer}
          contentContainerStyle={styles.entriesContent}
        >
          {/* Entry Limit Status Banner */}
          {isAuthenticated && journalStatus && !journalStatus.unlimited && (
            <View style={styles.limitBanner}>
              <Ionicons name="information-circle" size={20} color="#f59e0b" />
              <Text style={styles.limitText}>
                {journalStatus.entries_remaining === 0 
                  ? "Weekly limit reached! Upgrade for unlimited entries."
                  : `${journalStatus.entries_remaining} of ${journalStatus.weekly_limit} entries remaining this week`
                }
              </Text>
              {journalStatus.entries_remaining === 0 && (
                <TouchableOpacity style={styles.upgradeBadge}>
                  <Text style={styles.upgradeBadgeText}>Upgrade</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#b794f6" />
              <Text style={styles.loadingText}>Loading entries...</Text>
            </View>
          ) : entries.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="book-outline" size={60} color="#9f7aea" />
              <Text style={styles.emptyText}>No entries yet</Text>
            </View>
          ) : (
            entries.map((entry) => {
              const categoryInfo = getCategoryInfo(entry.category);
              return (
                <View key={entry.id} style={styles.entryCard}>
                  <View style={styles.entryHeader}>
                    <View
                      style={[styles.categoryBadge, { backgroundColor: categoryInfo.color }]}
                    >
                      <Ionicons name={categoryInfo.icon as any} size={16} color="#fff" />
                      <Text style={styles.categoryText}>{categoryInfo.label}</Text>
                    </View>
                    <View style={styles.entryHeaderRight}>
                      <Text style={styles.entryDate}>
                        {format(new Date(entry.date), 'MMM d, yyyy')}
                      </Text>
                      <TouchableOpacity 
                        style={styles.deleteButton}
                        onPress={() => deleteEntry(entry._id || entry.id, 'entry')}
                      >
                        <Ionicons name="trash-outline" size={18} color="#ef4444" />
                      </TouchableOpacity>
                    </View>
                  </View>
                  <Text style={styles.entryTitle}>{entry.title}</Text>
                  <Text style={styles.entryContent} numberOfLines={3}>
                    {entry.content}
                  </Text>
                </View>
              );
            })
          )}
        </ScrollView>
      )}

      <Modal visible={showNewEntry} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Entry</Text>
              <TouchableOpacity onPress={() => setShowNewEntry(false)}>
                <Ionicons name="close" size={28} color="#e9d5ff" />
              </TouchableOpacity>
            </View>

            {/* Show limit warning in modal if at limit */}
            {journalStatus && !journalStatus.unlimited && journalStatus.entries_remaining === 0 && (
              <View style={styles.modalLimitWarning}>
                <Ionicons name="warning" size={20} color="#ef4444" />
                <Text style={styles.modalLimitText}>
                  You've reached your weekly limit of 5 entries. Upgrade to continue!
                </Text>
              </View>
            )}

            <Text style={styles.label}>Category</Text>
            <View style={styles.categoriesGrid}>
              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.categoryChipWithLabel,
                    selectedCategory === cat.id && {
                      backgroundColor: cat.color,
                      borderColor: cat.color,
                    },
                  ]}
                  onPress={() => setSelectedCategory(cat.id)}
                >
                  <Ionicons
                    name={cat.icon as any}
                    size={20}
                    color={selectedCategory === cat.id ? '#fff' : '#c4b5fd'}
                  />
                  <Text style={[
                    styles.categoryChipLabel,
                    selectedCategory === cat.id && styles.categoryChipLabelSelected
                  ]}>
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Title</Text>
            <TextInput
              style={styles.titleInput}
              value={newTitle}
              onChangeText={setNewTitle}
              placeholder="Entry title"
              placeholderTextColor="#9f7aea"
            />

            <Text style={styles.label}>Content</Text>
            <TextInput
              style={styles.contentInput}
              value={newContent}
              onChangeText={setNewContent}
              placeholder="Write your thoughts..."
              placeholderTextColor="#9f7aea"
              multiline
              textAlignVertical="top"
            />

            <TouchableOpacity 
              style={[
                styles.saveButton, 
                (saving || (journalStatus && !journalStatus.unlimited && journalStatus.entries_remaining === 0)) && styles.saveButtonDisabled
              ]} 
              onPress={saveEntry}
              disabled={saving || (journalStatus && !journalStatus.unlimited && journalStatus.entries_remaining === 0)}
            >
              {saving ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Ionicons name="save" size={20} color="#fff" />
              )}
              <Text style={styles.saveButtonText}>
                {saving ? 'Saving...' : 'Save Entry'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal visible={deleteConfirm !== null} animationType="fade" transparent>
        <View style={styles.deleteModalOverlay}>
          <View style={styles.deleteModalContent}>
            <View style={styles.deleteModalIcon}>
              <Ionicons name="trash" size={40} color="#ef4444" />
            </View>
            <Text style={styles.deleteModalTitle}>Delete Entry?</Text>
            <Text style={styles.deleteModalText}>
              Are you sure you want to delete this entry? This action cannot be undone.
            </Text>
            <View style={styles.deleteModalButtons}>
              <TouchableOpacity
                style={[styles.deleteModalButton, styles.deleteModalCancel]}
                onPress={() => setDeleteConfirm(null)}
              >
                <Text style={styles.deleteModalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.deleteModalButton, styles.deleteModalConfirm]}
                onPress={confirmDelete}
              >
                <Ionicons name="trash" size={18} color="#fff" />
                <Text style={styles.deleteModalConfirmText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0321',
  },
  heroSection: {
    height: 140,
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#1a0533',
  },
  heroVideo: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  heroImageFallback: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    zIndex: -1,
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 3, 33, 0.5)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  heroContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#e9d5ff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    paddingTop: 24,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#e9d5ff',
  },
  addButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#7c3aed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  entriesList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 80,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#c4b5fd',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 16,
    color: '#9f7aea',
    marginTop: 8,
  },
  entryCard: {
    backgroundColor: '#1a0033',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2d1b4e',
  },
  entryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  entryHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  deleteButton: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
  },
  readingHeaderRight: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 6,
  },
  categoryText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  entryDate: {
    fontSize: 12,
    color: '#9f7aea',
  },
  entryTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#e9d5ff',
    marginBottom: 8,
  },
  entryContent: {
    fontSize: 14,
    color: '#c4b5fd',
    lineHeight: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1a0033',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 16,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#e9d5ff',
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#c4b5fd',
    marginBottom: 8,
    marginTop: 16,
  },
  categoriesRow: {
    flexDirection: 'row',
    gap: 12,
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  categoryChip: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#2d1b4e',
    borderWidth: 2,
    borderColor: '#2d1b4e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryChipWithLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#2d1b4e',
    borderWidth: 2,
    borderColor: '#2d1b4e',
    gap: 8,
  },
  categoryChipLabel: {
    color: '#c4b5fd',
    fontSize: 13,
    fontWeight: '500',
  },
  categoryChipLabelSelected: {
    color: '#fff',
  },
  titleInput: {
    backgroundColor: '#2d1b4e',
    borderRadius: 12,
    padding: 16,
    color: '#e9d5ff',
    fontSize: 16,
  },
  contentInput: {
    backgroundColor: '#2d1b4e',
    borderRadius: 12,
    padding: 16,
    color: '#e9d5ff',
    fontSize: 16,
    minHeight: 150,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#7c3aed',
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 24,
    gap: 8,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButtonDisabled: {
    opacity: 0.6,
    backgroundColor: '#6b7280',
  },
  // New styles for limit status
  limitBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
    gap: 8,
  },
  limitText: {
    flex: 1,
    color: '#f59e0b',
    fontSize: 13,
  },
  upgradeBadge: {
    backgroundColor: '#f59e0b',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  upgradeBadgeText: {
    color: '#1a0033',
    fontSize: 12,
    fontWeight: '600',
  },
  premiumBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
    gap: 8,
  },
  premiumText: {
    color: '#10b981',
    fontSize: 14,
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    color: '#9f7aea',
    marginTop: 12,
    fontSize: 14,
  },
  modalLimitWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    gap: 8,
  },
  modalLimitText: {
    flex: 1,
    color: '#ef4444',
    fontSize: 13,
  },
  // Tab styles
  tabContainer: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: '#1a0a2e',
    borderRadius: 12,
    padding: 4,
  },
  tabScrollContent: {
    flexDirection: 'row',
    gap: 2,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    gap: 6,
  },
  activeTab: {
    backgroundColor: '#2d1b4e',
  },
  tabText: {
    color: '#9f7aea',
    fontSize: 12,
    fontWeight: '500',
  },
  activeTabText: {
    color: '#a855f7',
    fontWeight: '600',
  },
  // Dreams tab styles
  dreamMetaContainer: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  dreamMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 6,
  },
  dreamMetaLabel: {
    color: '#a855f7',
    fontSize: 12,
    fontWeight: '600',
    marginRight: 6,
  },
  dreamMetaValue: {
    color: '#c4b5fd',
    fontSize: 12,
    flex: 1,
  },
  // Progress styles
  progressContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  overallProgressCard: {
    backgroundColor: '#1a0a2e',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  progressTitle: {
    color: '#e9d5ff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  progressStats: {
    alignItems: 'center',
    marginBottom: 16,
  },
  progressPercent: {
    color: '#fbbf24',
    fontSize: 48,
    fontWeight: 'bold',
  },
  progressSubtext: {
    color: '#9f7aea',
    fontSize: 14,
    marginTop: 4,
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: '#2d1b4e',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#a855f7',
    borderRadius: 4,
  },
  modulesHeader: {
    color: '#e9d5ff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  moduleCard: {
    backgroundColor: '#1a0a2e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  moduleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  moduleCategoryBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  moduleCategoryText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  modulePercent: {
    color: '#c4b5fd',
    fontSize: 14,
    fontWeight: '600',
  },
  moduleName: {
    color: '#e9d5ff',
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 12,
  },
  moduleProgressContainer: {
    height: 6,
    backgroundColor: '#2d1b4e',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  moduleProgressBar: {
    height: '100%',
    borderRadius: 3,
  },
  moduleLessons: {
    color: '#9f7aea',
    fontSize: 12,
  },
  // Readings tab styles
  readingsContainer: {
    flex: 1,
  },
  readingsContent: {
    padding: 16,
    paddingBottom: 32,
  },
  readingCard: {
    backgroundColor: '#1a0a2e',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2d1b4e',
  },
  readingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  readingTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 5,
  },
  readingTypeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  readingDateContainer: {
    alignItems: 'flex-end',
  },
  readingDate: {
    color: '#c4b5fd',
    fontSize: 12,
  },
  readingTime: {
    color: '#9f7aea',
    fontSize: 11,
    marginTop: 2,
  },
  spreadTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  spreadTypeText: {
    color: '#a855f7',
    fontSize: 13,
    fontWeight: '500',
  },
  questionContainer: {
    backgroundColor: 'rgba(251, 191, 36, 0.1)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#fbbf24',
  },
  questionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  questionLabel: {
    color: '#fbbf24',
    fontSize: 12,
    fontWeight: '600',
  },
  questionText: {
    color: '#e9d5ff',
    fontSize: 14,
    lineHeight: 20,
    fontStyle: 'italic',
  },
  readingTitle: {
    color: '#e9d5ff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
  },
  cardsPreview: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  cardPreviewItem: {
    backgroundColor: '#2d1b4e',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  cardPosition: {
    color: '#a855f7',
    fontSize: 10,
    fontWeight: '600',
    marginBottom: 2,
  },
  cardName: {
    color: '#e9d5ff',
    fontSize: 12,
    fontWeight: '500',
  },
  moreCardsText: {
    color: '#9f7aea',
    fontSize: 12,
    alignSelf: 'center',
    marginLeft: 4,
  },
  readingContentPreview: {
    color: '#c4b5fd',
    fontSize: 13,
    lineHeight: 20,
  },
  // Transcript-specific styles
  guideInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  guideElementBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 6,
  },
  guideElementIcon: {
    fontSize: 14,
  },
  guideNameText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  messagesCountText: {
    color: '#9f7aea',
    fontSize: 12,
  },
  transcriptContentPreview: {
    color: '#c4b5fd',
    fontSize: 13,
    lineHeight: 20,
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    padding: 12,
    borderRadius: 10,
    fontStyle: 'italic',
  },
  transcriptScrollView: {
    maxHeight: 400,
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    borderRadius: 10,
    marginBottom: 8,
  },
  transcriptContentFull: {
    color: '#c4b5fd',
    fontSize: 13,
    lineHeight: 22,
    padding: 12,
  },
  expandButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: '#2d1b4e',
    marginTop: 8,
  },
  expandButtonText: {
    color: '#a855f7',
    fontSize: 14,
    fontWeight: '600',
  },
  // Training completion styles
  completionCard: {
    backgroundColor: '#1a0a2e',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2d1b4e',
  },
  completionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  completionBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  completionDateContainer: {
    alignItems: 'flex-end',
  },
  completionDate: {
    color: '#c4b5fd',
    fontSize: 12,
  },
  completionTime: {
    color: '#9f7aea',
    fontSize: 11,
    marginTop: 2,
  },
  completionModule: {
    color: '#a855f7',
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 4,
  },
  completionLesson: {
    color: '#e9d5ff',
    fontSize: 14,
    fontWeight: '600',
  },
  entriesContainer: {
    flex: 1,
  },
  entriesContent: {
    paddingBottom: 32,
  },
  // Delete confirmation modal styles
  deleteModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  deleteModalContent: {
    backgroundColor: '#1a0033',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2d1b4e',
  },
  deleteModalIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  deleteModalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#e9d5ff',
    marginBottom: 12,
  },
  deleteModalText: {
    fontSize: 15,
    color: '#c4b5fd',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  deleteModalButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  deleteModalButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  deleteModalCancel: {
    backgroundColor: '#2d1b4e',
    borderWidth: 1,
    borderColor: '#4a3b6e',
  },
  deleteModalCancelText: {
    color: '#c4b5fd',
    fontSize: 16,
    fontWeight: '600',
  },
  deleteModalConfirm: {
    backgroundColor: '#ef4444',
  },
  deleteModalConfirmText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
