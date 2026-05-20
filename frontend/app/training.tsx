import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Modal, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { Paywall } from '../components/Paywall';
import SubscriptionOnlyBanner from '../components/SubscriptionOnlyBanner';
import HeaderBanner from '../components/HeaderBanner';
import { AudioPlayerManager } from '../utils/audioPlayer';
import { CosmicBackdrop } from '../components/ui';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface Module {
  id: string;
  title: string;
  description: string;
  lessons: number;
  category: 'beginner' | 'intermediate' | 'advanced';
  free: boolean;
}

interface Lesson {
  id: number;
  title: string;
  content: string;
  meditation?: {
    title: string;
    duration: number;
    script: string;
  };
}

export default function Training() {
  const { isPremium } = useAuth();
  const { t, languageCode } = useLanguage();
  const { theme } = useTheme();
  const router = useRouter();
  const [modules, setModules] = useState<Module[]>([]);
  const [completedLessons, setCompletedLessons] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPaywall, setShowPaywall] = useState(false);
  const [selectedModule, setSelectedModule] = useState<Module | null>(null);
  
  // Lesson viewing state
  const [showLessons, setShowLessons] = useState(false);
  const [currentModule, setCurrentModule] = useState<Module | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [currentLesson, setCurrentLesson] = useState<Lesson | null>(null);
  const [loadingLessons, setLoadingLessons] = useState(false);

  // TTS Meditation state
  const [isPlayingMeditation, setIsPlayingMeditation] = useState(false);
  const [isGeneratingTTS, setIsGeneratingTTS] = useState(false);
  const [ttsProgress, setTtsProgress] = useState('');
  const audioPlayerRef = useRef<AudioPlayerManager | null>(null);
  const isPlayingRef = useRef(false);

  useEffect(() => {
    loadTrainingData();
    loadProgress();
    
    // Cleanup audio on unmount
    return () => {
      stopMeditation();
    };
  }, []);

  const loadTrainingData = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/training/modules`);
      const data = await response.json();
      setModules(data);
    } catch (error) {
      console.error('Error loading training modules:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadProgress = async () => {
    try {
      const progress = await AsyncStorage.getItem('completed_lessons');
      if (progress) {
        setCompletedLessons(JSON.parse(progress));
      }
    } catch (error) {
      console.error('Error loading progress:', error);
    }
  };

  const saveProgress = async (lessonKey: string) => {
    try {
      const updated = [...completedLessons, lessonKey];
      setCompletedLessons(updated);
      await AsyncStorage.setItem('completed_lessons', JSON.stringify(updated));
    } catch (error) {
      console.error('Error saving progress:', error);
    }
  };

  // TTS Meditation Functions
  const stopMeditation = async () => {
    isPlayingRef.current = false;
    try {
      if (audioPlayerRef.current) {
        await audioPlayerRef.current.unload();
        audioPlayerRef.current = null;
      }
    } catch (e) {
      console.log('Error stopping meditation:', e);
    }
    setIsPlayingMeditation(false);
    setIsGeneratingTTS(false);
    setTtsProgress('');
  };

  const playMeditation = async () => {
    if (!currentLesson?.meditation) return;

    // Stop any existing playback
    await stopMeditation();
    
    // Start immediately - set playing state first
    isPlayingRef.current = true;
    setIsPlayingMeditation(true);
    setTtsProgress('Starting...');

    try {
      const script = currentLesson.meditation.script;
      
      // Parse the script into segments (text and pauses)
      // Split by pause markers while capturing the pause duration
      const pauseRegex = /\[pause(?:\s+for\s+(\d+)\s*seconds?)?\]/gi;
      const segments: { type: 'text' | 'pause'; content: string; duration?: number }[] = [];
      
      let lastIndex = 0;
      let match;
      
      while ((match = pauseRegex.exec(script)) !== null) {
        // Add text before this pause
        if (match.index > lastIndex) {
          const text = script.slice(lastIndex, match.index).trim();
          if (text) {
            segments.push({ type: 'text', content: text });
          }
        }
        
        // Add the pause
        const pauseDuration = match[1] ? parseInt(match[1]) : 5; // default 5 seconds
        segments.push({ type: 'pause', content: '', duration: pauseDuration });
        
        lastIndex = match.index + match[0].length;
      }
      
      // Add any remaining text after the last pause
      if (lastIndex < script.length) {
        const text = script.slice(lastIndex).trim();
        if (text) {
          segments.push({ type: 'text', content: text });
        }
      }

      if (__DEV__) console.log(`Meditation has ${segments.length} segments`);

      // Process each segment
      for (let i = 0; i < segments.length; i++) {
        if (!isPlayingRef.current) {
          if (__DEV__) console.log('Meditation stopped by user');
          break;
        }

        const segment = segments[i];
        
        if (segment.type === 'pause') {
          // Handle pause
          setTtsProgress(`Pause... (${segment.duration}s)`);
          if (__DEV__) console.log(`Pausing for ${segment.duration} seconds`);
          
          // Wait for the pause duration
          await new Promise<void>((resolve) => {
            const timeout = setTimeout(resolve, (segment.duration || 5) * 1000);
            // Check periodically if stopped
            const checkInterval = setInterval(() => {
              if (!isPlayingRef.current) {
                clearTimeout(timeout);
                clearInterval(checkInterval);
                resolve();
              }
            }, 500);
          });
          
        } else {
          // Handle text - generate and play TTS
          const textSegments = segments.filter(s => s.type === 'text');
          const textIndex = textSegments.indexOf(segment) + 1;
          const totalText = textSegments.length;
          
          setTtsProgress(`Speaking ${textIndex}/${totalText}...`);
          if (__DEV__) console.log(`Generating TTS for segment ${i + 1}`);

          // Split long text into chunks if needed
          const maxChunkSize = 4000;
          const text = segment.content;
          const chunks: string[] = [];
          
          if (text.length <= maxChunkSize) {
            chunks.push(text);
          } else {
            const paragraphs = text.split('\n\n');
            let currentChunk = '';
            for (const para of paragraphs) {
              if ((currentChunk + '\n\n' + para).length > maxChunkSize) {
                if (currentChunk) chunks.push(currentChunk);
                currentChunk = para;
              } else {
                currentChunk = currentChunk ? currentChunk + '\n\n' + para : para;
              }
            }
            if (currentChunk) chunks.push(currentChunk);
          }

          // Play each chunk
          for (const chunk of chunks) {
            if (!isPlayingRef.current) break;

            const response = await fetch(`${BACKEND_URL}/api/tts/generate`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                text: chunk,
                voice: 'nova'
              })
            });

            if (!response.ok) {
              throw new Error('Failed to generate audio');
            }

            const data = await response.json();
            
            // Check if TTS returned an error (no speakable text, etc.)
            if (data.error || !data.audio_base64 || !data.success) {
              console.log('TTS returned no audio for chunk, skipping:', data.error || 'no audio');
              continue; // Skip this chunk but continue with next
            }
            
            if (data.audio_base64 && isPlayingRef.current) {
              const player = new AudioPlayerManager();
              const audioUri = `data:audio/mp3;base64,${data.audio_base64}`;
              await player.loadAndPlay(audioUri, { volume: 1.0 });
              audioPlayerRef.current = player;
              
              // Wait for audio to finish
              await player.waitForCompletion(180000);
              
              // Cleanup
              if (audioPlayerRef.current) {
                await audioPlayerRef.current.unload();
                audioPlayerRef.current = null;
              }
            }
          }
        }
      }

      // Check if we completed naturally (not stopped by user)
      if (isPlayingRef.current) {
        setTtsProgress('');
        setIsPlayingMeditation(false);
        isPlayingRef.current = false;
        Alert.alert('Meditation Complete', 'Take a moment to return to awareness.');
      }

    } catch (error) {
      console.error('Error playing meditation:', error);
      Alert.alert('Error', 'Failed to play meditation audio. Please try again.');
      isPlayingRef.current = false;
      setIsGeneratingTTS(false);
      setIsPlayingMeditation(false);
      setTtsProgress('');
    }
  };

  const handleModulePress = async (module: Module) => {
    if (!module.free && !isPremium) {
      setSelectedModule(module);
      setShowPaywall(true);
      return;
    }

    // Load lessons for this module
    setCurrentModule(module);
    setLoadingLessons(true);
    setShowLessons(true);

    try {
      const response = await fetch(`${BACKEND_URL}/api/training/modules/${module.id}/lessons`);
      const data = await response.json();
      setLessons(data.lessons || []);
    } catch (error) {
      console.error('Error loading lessons:', error);
      setLessons([]);
    } finally {
      setLoadingLessons(false);
    }
  };

  const handleLessonPress = (lesson: Lesson) => {
    setCurrentLesson(lesson);
  };

  const markLessonComplete = async () => {
    if (currentModule && currentLesson) {
      const lessonKey = `${currentModule.id}-${currentLesson.id}`;
      if (!completedLessons.includes(lessonKey)) {
        saveProgress(lessonKey);
        
        // Save completion to journal
        try {
          const sessionToken = await AsyncStorage.getItem('session_token');
          const completionDate = new Date();
          
          const journalEntry = {
            title: `Training Complete: ${currentLesson.title}`,
            content: `Module: ${currentModule.title}\nLesson: ${currentLesson.title}\n\nCompleted on ${completionDate.toLocaleDateString()} at ${completionDate.toLocaleTimeString()}`,
            category: 'psychic',
            entry_type: 'training_completion',
            date: completionDate.toISOString(),
            metadata: {
              module_id: currentModule.id,
              module_title: currentModule.title,
              lesson_id: currentLesson.id,
              lesson_title: currentLesson.title,
              category: currentModule.category,
              completed_at: completionDate.toISOString(),
            },
          };

          await fetch(`${BACKEND_URL}/api/journal/entries`, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': sessionToken ? `Bearer ${sessionToken}` : '',
            },
            body: JSON.stringify(journalEntry),
          });
        } catch (error) {
          console.error('Error saving training completion to journal:', error);
        }
      }
      
      // Go to next lesson if available
      const currentIndex = lessons.findIndex(l => l.id === currentLesson.id);
      if (currentIndex < lessons.length - 1) {
        setCurrentLesson(lessons[currentIndex + 1]);
      } else {
        setCurrentLesson(null);
      }
    }
  };

  const isLessonCompleted = (moduleId: string, lessonId: number) => {
    return completedLessons.includes(`${moduleId}-${lessonId}`);
  };

  const getModuleProgress = (module: Module) => {
    const completed = lessons.filter(l => isLessonCompleted(module.id, l.id)).length;
    return { completed, total: module.lessons };
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'beginner':
        return '#10b981';
      case 'intermediate':
        return '#f59e0b';
      case 'advanced':
        return '#ef4444';
      default:
        return '#8b5cf6';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'beginner':
        return 'leaf';
      case 'intermediate':
        return 'flame';
      case 'advanced':
        return 'star';
      default:
        return 'school';
    }
  };

  const renderModuleCard = (module: Module) => {
    const isLocked = !module.free && !isPremium;
    const categoryColor = getCategoryColor(module.category);

    return (
      <TouchableOpacity
        key={module.id}
        style={[styles.moduleCard, isLocked && styles.lockedCard]}
        onPress={() => handleModulePress(module)}
        activeOpacity={0.8}
      >
        <View style={[styles.categoryBadge, { backgroundColor: categoryColor }]}>
          <Ionicons name={getCategoryIcon(module.category) as any} size={14} color="#fff" />
          <Text style={styles.categoryText}>{module.category}</Text>
        </View>

        <Text style={styles.moduleTitle}>{module.title}</Text>
        <Text style={styles.moduleDescription}>{module.description}</Text>

        <View style={styles.moduleFooter}>
          <View style={styles.lessonCount}>
            <Ionicons name="book-outline" size={16} color="#9f7aea" />
            <Text style={styles.lessonCountText}>{module.lessons} lessons</Text>
          </View>

          {isLocked ? (
            <SubscriptionOnlyBanner variant="badge" />
          ) : (
            <View style={styles.freeBadge}>
              <Ionicons name="checkmark-circle" size={14} color="#10b981" />
              <Text style={styles.freeText}>{module.free ? 'Free' : 'Unlocked'}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  // Lesson List View
  const renderLessonList = () => (
    <Modal
      visible={showLessons && !currentLesson}
      animationType="slide"
      onRequestClose={() => setShowLessons(false)}
    >
      <View style={styles.container}>
        <CosmicBackdrop />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setShowLessons(false)} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#e9d5ff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {currentModule?.title || 'Lessons'}
          </Text>
          <View style={{ width: 24 }} />
        </View>

        {loadingLessons ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#a855f7" />
            <Text style={styles.loadingText}>Loading lessons...</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.lessonListContent}>
            <Text style={styles.moduleDescHeader}>{currentModule?.description}</Text>
            
            {lessons.map((lesson, index) => {
              const completed = currentModule ? isLessonCompleted(currentModule.id, lesson.id) : false;
              return (
                <TouchableOpacity
                  key={lesson.id}
                  style={[styles.lessonCard, completed && styles.lessonCompleted]}
                  onPress={() => handleLessonPress(lesson)}
                >
                  <View style={[styles.lessonNumber, completed && styles.lessonNumberCompleted]}>
                    {completed ? (
                      <Ionicons name="checkmark" size={18} color="#10b981" />
                    ) : (
                      <Text style={styles.lessonNumberText}>{index + 1}</Text>
                    )}
                  </View>
                  <View style={styles.lessonInfo}>
                    <Text style={styles.lessonTitle}>{lesson.title}</Text>
                    <Text style={styles.lessonStatus}>
                      {completed ? 'Completed' : 'Tap to start'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#9f7aea" />
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
      </View>
    </Modal>
  );

  // Lesson Content View
  const renderLessonContent = () => (
    <Modal
      visible={!!currentLesson}
      animationType="slide"
      onRequestClose={() => setCurrentLesson(null)}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setCurrentLesson(null)} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#e9d5ff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            Lesson {currentLesson?.id}
          </Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView contentContainerStyle={styles.lessonContentContainer}>
          <Text style={styles.lessonContentTitle}>{currentLesson?.title}</Text>
          
          <View style={styles.lessonContentBox}>
            <Text style={styles.lessonContentText}>
              {currentLesson?.content}
            </Text>
          </View>

          {/* Meditation Section */}
          {currentLesson?.meditation && (
            <View style={styles.meditationSection}>
              <View style={styles.meditationHeader}>
                <View style={styles.meditationIcon}>
                  <Ionicons name="flower-outline" size={24} color="#a855f7" />
                </View>
                <View style={styles.meditationInfo}>
                  <Text style={styles.meditationTitle}>{currentLesson.meditation.title}</Text>
                  <Text style={styles.meditationDuration}>
                    {currentLesson.meditation.duration} minutes
                  </Text>
                </View>
              </View>

              {/* TTS Play Button */}
              <View style={styles.meditationControls}>
                {isGeneratingTTS ? (
                  <View style={styles.generatingContainer}>
                    <ActivityIndicator size="small" color="#a855f7" />
                    <Text style={styles.generatingText}>{ttsProgress}</Text>
                  </View>
                ) : isPlayingMeditation ? (
                  <TouchableOpacity style={styles.stopMeditationButton} onPress={stopMeditation}>
                    <Ionicons name="stop-circle" size={24} color="#ef4444" />
                    <Text style={styles.stopMeditationText}>Stop Meditation</Text>
                    {ttsProgress ? <Text style={styles.progressText}>{ttsProgress}</Text> : null}
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity style={styles.playMeditationButton} onPress={playMeditation}>
                    <Ionicons name="play-circle" size={24} color="#0f0321" />
                    <Text style={styles.playMeditationText}>Play Guided Meditation</Text>
                  </TouchableOpacity>
                )}
              </View>
              
              <View style={styles.meditationScriptBox}>
                <Text style={styles.meditationScriptLabel}>Guided Meditation Script</Text>
                <Text style={styles.meditationScript}>
                  {currentLesson.meditation.script}
                </Text>
              </View>
              
              <View style={styles.meditationTip}>
                <Ionicons name="information-circle" size={18} color="#9f7aea" />
                <Text style={styles.meditationTipText}>
                  Read through the script slowly, pausing at each [pause] instruction. You can also record yourself reading it.
                </Text>
              </View>
            </View>
          )}
        </ScrollView>

        <View style={styles.lessonFooter}>
          <TouchableOpacity
            style={styles.completeButton}
            onPress={markLessonComplete}
          >
            <Ionicons name="checkmark-circle" size={20} color="#0f0321" />
            <Text style={styles.completeButtonText}>
              {lessons.findIndex(l => l.id === currentLesson?.id) < lessons.length - 1
                ? 'Complete & Next'
                : 'Complete Lesson'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#a855f7" />
        <Text style={styles.loadingText}>{t('loadingModules')}</Text>
      </View>
    );
  }

  const beginnerModules = modules.filter(m => m.category === 'beginner');
  const intermediateModules = modules.filter(m => m.category === 'intermediate');
  const advancedModules = modules.filter(m => m.category === 'advanced');

  return (
    <View style={styles.container}>
        <CosmicBackdrop />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Hero Image Section - mystical header */}
        <View style={styles.heroSection}>
          <Image
            source={require('../assets/backgrounds/training-bg.jpg')}
            style={styles.heroImage}
            contentFit="cover"
          />
          <LinearGradient
            colors={['rgba(13,0,21,0)', 'rgba(13,0,21,0.55)', 'rgba(13,0,21,0.95)']}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.heroOverlay}>
            <Text style={styles.heroEyebrow}>✦ Psychic Mastery ✦</Text>
            <Text style={styles.heroTitle}>{t('psychicTraining')}</Text>
            <View style={styles.heroGlyphRow}>
              <View style={styles.heroGlyphLine} />
              <Ionicons name="sparkles" size={11} color="#fbbf24" style={{ marginHorizontal: 8 }} />
              <View style={styles.heroGlyphLine} />
            </View>
            <Text style={styles.heroSubtitle}>{t('developAbilities')}</Text>
          </View>
        </View>

        <View style={styles.content}>
          {/* Beginner Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIcon, { backgroundColor: '#10b981' }]}>
                <Ionicons name="leaf" size={20} color="#fff" />
              </View>
              <Text style={styles.sectionTitle}>{t('beginner')}</Text>
            </View>
            {beginnerModules.map(renderModuleCard)}
          </View>

          {/* Intermediate Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIcon, { backgroundColor: '#f59e0b' }]}>
                <Ionicons name="flame" size={20} color="#fff" />
              </View>
              <Text style={styles.sectionTitle}>{t('intermediate')}</Text>
            </View>
            {intermediateModules.map(renderModuleCard)}
          </View>

          {/* Advanced Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIcon, { backgroundColor: '#ef4444' }]}>
                <Ionicons name="star" size={20} color="#fff" />
              </View>
              <Text style={styles.sectionTitle}>{t('advanced')}</Text>
            </View>
            {advancedModules.map(renderModuleCard)}
          </View>

          <View style={{ height: 40 }} />
        </View>
      </ScrollView>

      {renderLessonList()}
      {renderLessonContent()}

      <Paywall
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
        feature={selectedModule?.title || 'Premium Training'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0d0015',
  },
  scrollContent: {
    flexGrow: 1,
  },
  heroSection: {
    height: 180,
    position: 'relative',
    overflow: 'hidden',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingBottom: 14,
    alignItems: 'center',
  },
  heroEyebrow: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.4,
    color: '#fbbf24',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
    marginBottom: 4,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ffffff',
    textAlign: 'center',
    textShadowColor: 'rgba(168,85,247,0.7)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  heroGlyphRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6, marginBottom: 4 },
  heroGlyphLine: { width: 32, height: 1, backgroundColor: 'rgba(251,191,36,0.6)' },
  heroSubtitle: {
    fontSize: 12,
    color: '#c4b5fd',
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#1a0033',
    borderBottomWidth: 1,
    borderBottomColor: '#2d1b4e',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#e9d5ff',
    flex: 1,
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0d0015',
  },
  loadingText: {
    color: '#c4b5fd',
    marginTop: 16,
    fontSize: 16,
  },
  content: {
    padding: 16,
  },
  introSection: {
    marginBottom: 24,
  },
  introTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#e9d5ff',
    marginBottom: 8,
  },
  introText: {
    fontSize: 15,
    color: '#9f7aea',
    lineHeight: 22,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#e9d5ff',
  },
  moduleCard: {
    backgroundColor: '#1a0033',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2d1b4e',
  },
  lockedCard: {
    opacity: 0.7,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 10,
    gap: 4,
  },
  categoryText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  moduleTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#e9d5ff',
    marginBottom: 6,
  },
  moduleDescription: {
    fontSize: 14,
    color: '#9f7aea',
    lineHeight: 20,
    marginBottom: 12,
  },
  moduleFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lessonCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  lessonCountText: {
    color: '#9f7aea',
    fontSize: 13,
  },
  lockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(251, 191, 36, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  lockText: {
    color: '#fbbf24',
    fontSize: 12,
    fontWeight: '600',
  },
  freeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  freeText: {
    color: '#10b981',
    fontSize: 12,
    fontWeight: '600',
  },
  // Lesson List Styles
  lessonListContent: {
    padding: 16,
  },
  moduleDescHeader: {
    fontSize: 15,
    color: '#9f7aea',
    marginBottom: 20,
    lineHeight: 22,
  },
  lessonCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a0033',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#2d1b4e',
  },
  lessonCompleted: {
    borderColor: '#10b981',
    backgroundColor: 'rgba(16, 185, 129, 0.05)',
  },
  lessonNumber: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#2d1b4e',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  lessonNumberCompleted: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
  },
  lessonNumberText: {
    color: '#e9d5ff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  lessonInfo: {
    flex: 1,
  },
  lessonTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#e9d5ff',
    marginBottom: 2,
  },
  lessonStatus: {
    fontSize: 13,
    color: '#9f7aea',
  },
  // Lesson Content Styles
  lessonContentContainer: {
    padding: 16,
    paddingBottom: 100,
  },
  lessonContentTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#e9d5ff',
    marginBottom: 20,
  },
  lessonContentBox: {
    backgroundColor: '#1a0033',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#2d1b4e',
  },
  lessonContentText: {
    fontSize: 16,
    color: '#c4b5fd',
    lineHeight: 26,
  },
  lessonFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: '#0d0015',
    borderTopWidth: 1,
    borderTopColor: '#2d1b4e',
  },
  completeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10b981',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  completeButtonText: {
    color: '#0f0321',
    fontSize: 17,
    fontWeight: 'bold',
  },
  // Meditation Styles
  meditationSection: {
    marginTop: 24,
    backgroundColor: '#1a0033',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#a855f7',
  },
  meditationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  meditationIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(168, 85, 247, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  meditationInfo: {
    flex: 1,
  },
  meditationTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#e9d5ff',
  },
  meditationDuration: {
    fontSize: 14,
    color: '#9f7aea',
    marginTop: 2,
  },
  meditationScriptBox: {
    backgroundColor: '#0d0015',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  meditationScriptLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#a855f7',
    marginBottom: 12,
  },
  meditationScript: {
    fontSize: 15,
    color: '#c4b5fd',
    lineHeight: 24,
  },
  meditationTip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(168, 85, 247, 0.1)',
    borderRadius: 8,
    padding: 12,
    gap: 8,
  },
  meditationTipText: {
    flex: 1,
    fontSize: 13,
    color: '#9f7aea',
    lineHeight: 18,
  },
  // TTS Meditation Controls
  meditationControls: {
    marginBottom: 16,
  },
  playMeditationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#a855f7',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 10,
  },
  playMeditationText: {
    color: '#0f0321',
    fontSize: 16,
    fontWeight: 'bold',
  },
  stopMeditationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  stopMeditationText: {
    color: '#ef4444',
    fontSize: 16,
    fontWeight: '600',
  },
  progressText: {
    color: '#9f7aea',
    fontSize: 12,
    marginLeft: 8,
  },
  generatingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 10,
  },
  generatingText: {
    color: '#c4b5fd',
    fontSize: 14,
  },
});
