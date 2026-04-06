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
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { format } from 'date-fns';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface JournalEntry {
  id: string;
  _id?: string;
  title: string;
  content: string;
  category: string;
  date: string;
  created_at?: string;
  mood?: string;
  entry_type?: 'manual' | 'oracle' | 'spirit_guide' | 'training';
  metadata?: {
    spread_type?: string;
    cards?: any[];
    guide_name?: string;
    messages_count?: number;
    lesson_id?: string;
    module_name?: string;
  };
}

interface TrainingProgress {
  total_lessons: number;
  completed_lessons: number;
  modules: {
    name: string;
    category: string;
    total: number;
    completed: number;
  }[];
}

interface JournalStatus {
  is_premium: boolean;
  weekly_limit: number | null;
  entries_this_week: number;
  entries_remaining: number | null;
  unlimited: boolean;
  week_resets?: string;
}

export default function Journal() {
  const { isAuthenticated, isPremium } = useAuth();
  const { t, languageCode } = useLanguage();
  const { theme } = useTheme();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [showNewEntry, setShowNewEntry] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('meditation');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [journalStatus, setJournalStatus] = useState<JournalStatus | null>(null);
  const [trainingProgress, setTrainingProgress] = useState<TrainingProgress | null>(null);
  const [activeTab, setActiveTab] = useState<'entries' | 'progress'>('entries');

  const categories = [
    { id: 'meditation', label: 'Meditation', icon: 'fitness', color: '#8b5cf6' },
    { id: 'psychic', label: 'Psychic Training', icon: 'school', color: '#3b82f6' },
    { id: 'divination', label: 'Oracle Reading', icon: 'sparkles', color: '#db2777' },
    { id: 'spirit_guide', label: 'Spirit Guide', icon: 'chatbubbles', color: '#ec4899' },
    { id: 'general', label: 'General', icon: 'book', color: '#10b981' },
  ];

  useEffect(() => {
    loadEntries();
    loadTrainingProgress();
    if (isAuthenticated) {
      fetchJournalStatus();
    }
  }, [isAuthenticated]);

  const loadTrainingProgress = async () => {
    try {
      const completedLessons = await AsyncStorage.getItem('completedLessons');
      const completed = completedLessons ? JSON.parse(completedLessons) : [];
      
      // Fetch modules from backend
      const response = await fetch(`${BACKEND_URL}/api/training/modules`);
      if (response.ok) {
        const modules = await response.json();
        
        const moduleProgress = modules.map((module: any) => ({
          name: module.title,
          category: module.category,
          total: module.lessons?.length || 0,
          completed: module.lessons?.filter((l: any) => 
            completed.includes(`${module.id}-${l.id}`)
          ).length || 0,
        }));

        const totalLessons = moduleProgress.reduce((sum: number, m: any) => sum + m.total, 0);
        const completedCount = moduleProgress.reduce((sum: number, m: any) => sum + m.completed, 0);

        setTrainingProgress({
          total_lessons: totalLessons,
          completed_lessons: completedCount,
          modules: moduleProgress,
        });
      }
    } catch (error) {
      console.error('Error loading training progress:', error);
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
          const formattedEntries = data.map((e: any) => ({
            id: e._id || e.id,
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

  // Render progress tab
  const renderProgressTab = () => {
    if (!trainingProgress) {
      return (
        <View style={styles.emptyState}>
          <ActivityIndicator size="large" color="#a855f7" />
          <Text style={styles.emptyText}>Loading progress...</Text>
        </View>
      );
    }

    const progressPercent = trainingProgress.total_lessons > 0 
      ? Math.round((trainingProgress.completed_lessons / trainingProgress.total_lessons) * 100)
      : 0;

    return (
      <ScrollView style={styles.progressContainer}>
        {/* Overall Progress Card */}
        <View style={styles.overallProgressCard}>
          <View style={styles.progressHeader}>
            <Ionicons name="trophy" size={32} color="#fbbf24" />
            <Text style={styles.progressTitle}>Training Progress</Text>
          </View>
          <View style={styles.progressStats}>
            <Text style={styles.progressPercent}>{progressPercent}%</Text>
            <Text style={styles.progressSubtext}>
              {trainingProgress.completed_lessons} of {trainingProgress.total_lessons} lessons completed
            </Text>
          </View>
          <View style={styles.progressBarContainer}>
            <View style={[styles.progressBar, { width: `${progressPercent}%` }]} />
          </View>
        </View>

        {/* Module Progress */}
        <Text style={styles.modulesHeader}>Module Progress</Text>
        {trainingProgress.modules.map((module, index) => {
          const modulePercent = module.total > 0 
            ? Math.round((module.completed / module.total) * 100)
            : 0;
          const categoryColor = module.category === 'beginner' ? '#10b981' 
            : module.category === 'intermediate' ? '#f59e0b' : '#ef4444';

          return (
            <View key={index} style={styles.moduleCard}>
              <View style={styles.moduleHeader}>
                <View style={[styles.moduleCategoryBadge, { backgroundColor: categoryColor }]}>
                  <Text style={styles.moduleCategoryText}>
                    {module.category.charAt(0).toUpperCase() + module.category.slice(1)}
                  </Text>
                </View>
                <Text style={styles.modulePercent}>{modulePercent}%</Text>
              </View>
              <Text style={styles.moduleName}>{module.name}</Text>
              <View style={styles.moduleProgressContainer}>
                <View style={[styles.moduleProgressBar, { width: `${modulePercent}%`, backgroundColor: categoryColor }]} />
              </View>
              <Text style={styles.moduleLessons}>
                {module.completed} / {module.total} lessons
              </Text>
            </View>
          );
        })}
      </ScrollView>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Journal</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setShowNewEntry(true)}
          activeOpacity={0.7}
        >
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Tab Selector */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'entries' && styles.activeTab]}
          onPress={() => setActiveTab('entries')}
        >
          <Ionicons name="book" size={20} color={activeTab === 'entries' ? '#a855f7' : '#9f7aea'} />
          <Text style={[styles.tabText, activeTab === 'entries' && styles.activeTabText]}>Entries</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'progress' && styles.activeTab]}
          onPress={() => setActiveTab('progress')}
        >
          <Ionicons name="trending-up" size={20} color={activeTab === 'progress' ? '#a855f7' : '#9f7aea'} />
          <Text style={[styles.tabText, activeTab === 'progress' && styles.activeTabText]}>Progress</Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'progress' ? (
        renderProgressTab()
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

          {isPremium && (
            <View style={styles.premiumBanner}>
              <Ionicons name="infinite" size={20} color="#10b981" />
              <Text style={styles.premiumText}>Unlimited journal entries</Text>
            </View>
          )}

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#b794f6" />
          <Text style={styles.loadingText}>Loading entries...</Text>
        </View>
      ) : (
        <ScrollView style={styles.entriesList}>
        {entries.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="book-outline" size={60} color="#9f7aea" />
            <Text style={styles.emptyText}>No entries yet</Text>
            <Text style={styles.emptySubtext}>Start journaling your spiritual journey</Text>
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
                  <Text style={styles.entryDate}>
                    {format(new Date(entry.date), 'MMM d, yyyy')}
                  </Text>
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
            <View style={styles.categoriesRow}>
              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.categoryChip,
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0321',
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
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: '#1a0a2e',
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 8,
  },
  activeTab: {
    backgroundColor: '#2d1b4e',
  },
  tabText: {
    color: '#9f7aea',
    fontSize: 14,
    fontWeight: '500',
  },
  activeTabText: {
    color: '#a855f7',
    fontWeight: '600',
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
});
