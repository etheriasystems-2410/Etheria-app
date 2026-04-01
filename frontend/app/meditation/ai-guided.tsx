import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { Paywall } from '../../components/Paywall';
import { AudioPlayerManager, setupAudioMode } from '../../utils/audioPlayer';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface MeditationFocus {
  id: string;
  name: string;
  description: string;
  icon: string;
}

const focuses: MeditationFocus[] = [
  {
    id: 'stress-relief',
    name: 'Stress Relief',
    description: 'Release tension and find calm',
    icon: 'heart',
  },
  {
    id: 'sleep',
    name: 'Better Sleep',
    description: 'Prepare your mind for rest',
    icon: 'moon',
  },
  {
    id: 'focus',
    name: 'Focus & Clarity',
    description: 'Sharpen your mental clarity',
    icon: 'eye',
  },
  {
    id: 'spiritual',
    name: 'Spiritual Growth',
    description: 'Deepen your spiritual practice',
    icon: 'sparkles',
  },
];

export default function AIGuidedMeditation() {
  const router = useRouter();
  const { isPremium } = useAuth();
  const [selectedFocus, setSelectedFocus] = useState<string>('stress-relief');
  const [duration, setDuration] = useState(10);
  const [script, setScript] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  
  // TTS state
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [generatingAudio, setGeneratingAudio] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [loadingStage, setLoadingStage] = useState<'idle' | 'generating-intro' | 'playing-intro' | 'loading-continuation' | 'playing-full'>('idle');
  const [loadingProgress, setLoadingProgress] = useState(0);
  const audioPlayerRef = useRef<AudioPlayerManager | null>(null);
  const isMutedRef = useRef(isMuted);
  
  // Keep mute ref synced
  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  // Check premium access on mount
  React.useEffect(() => {
    if (!isPremium) {
      setShowPaywall(true);
    }
  }, [isPremium]);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.unload();
      }
    };
  }, []);

  // Setup audio mode
  useEffect(() => {
    setupAudioMode();
  }, []);

  // NOTE: Auto-start is now handled directly in generateMeditation via startQuickTTS
  // This useEffect is disabled to prevent double playback
  // useEffect(() => {
  //   if (script && !isMuted) {
  //     beginSession();
  //   }
  // }, [script]);

  const generateMeditation = async () => {
    setLoading(true);
    setAudioError(null);
    setGeneratingAudio(true);
    setLoadingStage('generating-intro');
    setLoadingProgress(10);
    
    try {
      setLoadingProgress(20);
      const response = await fetch(
        `${BACKEND_URL}/api/meditation/generate-guided?duration_minutes=${duration}&focus=${selectedFocus}`,
        { method: 'POST' }
      );
      const data = await response.json();
      setLoadingProgress(40);
      setScript(data.script);
      
      // Don't wait for useEffect - start TTS immediately with intro
      if (!isMutedRef.current && data.script) {
        startQuickTTS(data.script);
      } else {
        setGeneratingAudio(false);
        setLoadingStage('idle');
      }
    } catch (error) {
      console.error('Error generating meditation:', error);
      Alert.alert('Error', 'Failed to generate meditation. Please try again.');
      setGeneratingAudio(false);
      setLoadingStage('idle');
      setLoadingProgress(0);
    } finally {
      setLoading(false);
    }
  };

  // Parse script for pause markers and split into segments
  const parseScriptWithPauses = (script: string): Array<{type: 'text' | 'pause', content: string, duration?: number}> => {
    const segments: Array<{type: 'text' | 'pause', content: string, duration?: number}> = [];
    
    // Regex to match various pause patterns:
    // [pause for X seconds], (pause X seconds), ...pause..., [X second pause], etc.
    const pauseRegex = /\[pause(?:\s+for)?\s+(\d+)\s*(?:seconds?|secs?)?\]|\(pause(?:\s+for)?\s+(\d+)\s*(?:seconds?|secs?)?\)|\.{3,}\s*(?:pause|breathe|relax)(?:\s+for)?\s*(\d+)?\s*(?:seconds?|secs?)?\.{0,3}|\[(\d+)\s*(?:second|sec)s?\s+pause\]|\((\d+)\s*(?:second|sec)s?\s+pause\)|(?:pause|take a moment|breathe deeply|allow yourself)(?:\s+for)?\s+(\d+)\s*(?:seconds?|secs?)/gi;
    
    let lastIndex = 0;
    let match;
    
    while ((match = pauseRegex.exec(script)) !== null) {
      // Add text before the pause
      if (match.index > lastIndex) {
        const textBefore = script.slice(lastIndex, match.index).trim();
        if (textBefore) {
          segments.push({ type: 'text', content: textBefore });
        }
      }
      
      // Extract pause duration (check all capture groups)
      const duration = parseInt(match[1] || match[2] || match[3] || match[4] || match[5] || match[6] || '5', 10);
      segments.push({ type: 'pause', content: match[0], duration: Math.min(duration, 30) }); // Cap at 30 seconds
      
      lastIndex = match.index + match[0].length;
    }
    
    // Add remaining text
    if (lastIndex < script.length) {
      const remainingText = script.slice(lastIndex).trim();
      if (remainingText) {
        segments.push({ type: 'text', content: remainingText });
      }
    }
    
    // If no pauses found, return the whole script as one segment
    if (segments.length === 0) {
      segments.push({ type: 'text', content: script });
    }
    
    return segments;
  };

  // Play segments with pauses
  const playSegmentsWithPauses = async (segments: Array<{type: 'text' | 'pause', content: string, duration?: number}>, startIndex: number = 0) => {
    for (let i = startIndex; i < segments.length; i++) {
      if (isMutedRef.current) {
        setIsPlaying(false);
        setLoadingStage('idle');
        return;
      }
      
      const segment = segments[i];
      
      if (segment.type === 'pause') {
        // Actual pause - wait for the specified duration
        console.log(`Pausing for ${segment.duration} seconds`);
        setLoadingStage('playing-full'); // Keep showing as playing during pause
        await new Promise(resolve => setTimeout(resolve, (segment.duration || 5) * 1000));
      } else if (segment.type === 'text' && segment.content.trim()) {
        // Generate and play TTS for this text segment
        try {
          setLoadingStage('loading-continuation');
          
          const response = await fetch(`${BACKEND_URL}/api/tts/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: segment.content,
              voice: 'nova',
            }),
          });
          
          if (!response.ok) {
            console.error('TTS segment error:', response.status);
            continue; // Skip this segment on error
          }
          
          const responseText = await response.text();
          let data;
          try {
            data = JSON.parse(responseText);
          } catch (e) {
            console.error('Failed to parse segment TTS response');
            continue;
          }
          
          if (!data.audio_base64 || isMutedRef.current) {
            continue;
          }
          
          // Unload previous player
          if (audioPlayerRef.current) {
            await audioPlayerRef.current.unload();
          }
          
          // Play this segment and wait for it to finish
          await new Promise<void>((resolve) => {
            const player = new AudioPlayerManager();
            const audioUri = `data:audio/mp3;base64,${data.audio_base64}`;
            
            player.onPlaybackStatusChange((status) => {
              if (status.didJustFinish) {
                resolve();
              }
            });
            
            player.loadAndPlay(audioUri, { volume: 1.0 }).then(() => {
              audioPlayerRef.current = player;
              setLoadingStage('playing-full');
            }).catch((err) => {
              console.error('Error playing segment:', err);
              resolve(); // Continue even on error
            });
          });
          
        } catch (error) {
          console.error('Error in segment playback:', error);
        }
      }
    }
    
    // All segments complete
    setIsPlaying(false);
    setLoadingStage('idle');
    setLoadingProgress(100);
    Alert.alert('Session Complete', 'Your meditation session has ended. Take a moment to return to awareness.');
  };

  // Quick TTS - splits script and plays intro first, then continues with pauses
  const startQuickTTS = async (fullScript: string) => {
    try {
      // Parse script into segments with pauses
      const segments = parseScriptWithPauses(fullScript);
      console.log('Parsed segments:', segments.length);
      
      // Get the first text segment for quick intro
      const firstTextSegment = segments.find(s => s.type === 'text');
      if (!firstTextSegment) {
        setGeneratingAudio(false);
        setLoadingStage('idle');
        return;
      }
      
      // Split first segment into intro (first 2 sentences) for quick start
      const introSentences = firstTextSegment.content.match(/[^.!?]+[.!?]+/g) || [firstTextSegment.content];
      const introText = introSentences.slice(0, 2).join(' ').trim();
      
      setLoadingProgress(50);
      setLoadingStage('generating-intro');
      
      // Generate just the intro first (faster)
      const introResponse = await fetch(`${BACKEND_URL}/api/tts/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: introText,
          voice: 'nova',
        }),
      });
      
      // Check response status
      if (!introResponse.ok) {
        const errorText = await introResponse.text();
        console.error('TTS intro error:', introResponse.status, errorText);
        setAudioError('Voice service temporarily unavailable');
        setGeneratingAudio(false);
        setLoadingStage('idle');
        setLoadingProgress(0);
        return;
      }
      
      const introResponseText = await introResponse.text();
      let introData;
      try {
        introData = JSON.parse(introResponseText);
      } catch (e) {
        console.error('Failed to parse intro TTS response:', introResponseText.substring(0, 100));
        setAudioError('Invalid response from voice service');
        setGeneratingAudio(false);
        setLoadingStage('idle');
        setLoadingProgress(0);
        return;
      }
      
      setLoadingProgress(70);
      
      if (!introData.audio_base64) {
        setAudioError(introData.error || 'Voice generation unavailable');
        setGeneratingAudio(false);
        setLoadingStage('idle');
        setLoadingProgress(0);
        return;
      }
      
      // Play intro immediately
      if (audioPlayerRef.current) {
        await audioPlayerRef.current.unload();
      }
      
      const player = new AudioPlayerManager();
      const audioUri = `data:audio/mp3;base64,${introData.audio_base64}`;
      await player.loadAndPlay(audioUri, { volume: 1.0 });
      
      audioPlayerRef.current = player;
      setIsPlaying(true);
      setGeneratingAudio(false);
      setLoadingStage('playing-intro');
      setLoadingProgress(80);
      
      // Update first text segment to remove the intro we already played
      const remainingFirstText = introSentences.slice(2).join(' ').trim();
      const updatedSegments = [...segments];
      const firstTextIndex = updatedSegments.findIndex(s => s.type === 'text');
      if (firstTextIndex !== -1) {
        if (remainingFirstText) {
          updatedSegments[firstTextIndex] = { type: 'text', content: remainingFirstText };
        } else {
          updatedSegments.splice(firstTextIndex, 1);
        }
      }
      
      // When intro finishes, continue with remaining segments (with pauses)
      player.onPlaybackStatusChange(async (status) => {
        if (status.didJustFinish) {
          if (updatedSegments.length > 0 && !isMutedRef.current) {
            setLoadingStage('loading-continuation');
            await playSegmentsWithPauses(updatedSegments, 0);
          } else {
            setIsPlaying(false);
            setLoadingStage('idle');
            setLoadingProgress(100);
            Alert.alert('Session Complete', 'Your meditation session has ended.');
          }
        }
      });
      
    } catch (error) {
      console.error('Error in quick TTS:', error);
      setGeneratingAudio(false);
      setAudioError('Failed to generate voice');
      setLoadingStage('idle');
      setLoadingProgress(0);
    }
  };
      
    } catch (error) {
      console.error('Error in quick TTS:', error);
      setGeneratingAudio(false);
      setAudioError('Failed to generate voice');
      setLoadingStage('idle');
      setLoadingProgress(0);
    }
  };

  const playRestOfScript = async (restText: string) => {
    try {
      setLoadingProgress(85);
      
      const response = await fetch(`${BACKEND_URL}/api/tts/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: restText,
          voice: 'nova',
        }),
      });
      
      // Check response status
      if (!response.ok) {
        const errorText = await response.text();
        console.error('TTS continuation error:', response.status, errorText);
        setIsPlaying(false);
        setLoadingStage('idle');
        setLoadingProgress(0);
        setAudioError('Voice continuation unavailable');
        return;
      }
      
      const responseText = await response.text();
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        console.error('Failed to parse continuation TTS response:', responseText.substring(0, 100));
        setIsPlaying(false);
        setLoadingStage('idle');
        setLoadingProgress(0);
        return;
      }
      
      setLoadingProgress(95);
      
      if (!data.audio_base64 || isMutedRef.current) {
        setIsPlaying(false);
        setLoadingStage('idle');
        setLoadingProgress(100);
        return;
      }
      
      if (audioPlayerRef.current) {
        await audioPlayerRef.current.unload();
      }
      
      const player = new AudioPlayerManager();
      const audioUri = `data:audio/mp3;base64,${data.audio_base64}`;
      await player.loadAndPlay(audioUri, { volume: 1.0 });
      
      audioPlayerRef.current = player;
      setLoadingStage('playing-full');
      setLoadingProgress(100);
      
      player.onPlaybackStatusChange((status) => {
        if (status.didJustFinish) {
          setIsPlaying(false);
          setLoadingStage('idle');
          Alert.alert('Session Complete', 'Your meditation session has ended. Take a moment to return to awareness.');
        }
      });
    } catch (error) {
      console.error('Error playing rest of script:', error);
      setIsPlaying(false);
      setLoadingStage('idle');
      setLoadingProgress(0);
    }
  };

  const beginSession = async () => {
    if (!script || isMuted) return;
    
    setGeneratingAudio(true);
    setAudioError(null);
    
    try {
      // Generate TTS audio for the meditation script
      const response = await fetch(`${BACKEND_URL}/api/tts/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: script,
          voice: 'nova', // Calm, soothing voice for meditation
        }),
      });
      
      // Check if response is ok before parsing
      if (!response.ok) {
        const errorText = await response.text();
        console.error('TTS API error:', response.status, errorText);
        setAudioError('Voice generation service unavailable');
        return;
      }
      
      const responseText = await response.text();
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('Failed to parse TTS response:', responseText.substring(0, 100));
        setAudioError('Invalid response from voice service');
        return;
      }
      
      if (!data.audio_base64) {
        setAudioError(data.error || 'Voice generation unavailable');
        return;
      }
      
      // Stop any existing playback
      if (audioPlayerRef.current) {
        await audioPlayerRef.current.unload();
      }
      
      // Create new audio player and play
      const player = new AudioPlayerManager();
      const audioUri = `data:audio/mp3;base64,${data.audio_base64}`;
      await player.loadAndPlay(audioUri, { volume: 1.0 });
      
      audioPlayerRef.current = player;
      setIsPlaying(true);
      
      // Monitor playback status
      player.onPlaybackStatusChange((status) => {
        if (status.didJustFinish) {
          setIsPlaying(false);
          Alert.alert('Session Complete', 'Your meditation session has ended. Take a moment to return to awareness.');
        }
      });
      
    } catch (error) {
      console.error('Error generating audio:', error);
      setAudioError('Failed to generate voice guidance');
    } finally {
      setGeneratingAudio(false);
    }
  };

  const stopSession = async () => {
    if (audioPlayerRef.current) {
      await audioPlayerRef.current.stop();
      await audioPlayerRef.current.unload();
      audioPlayerRef.current = null;
    }
    setIsPlaying(false);
  };

  const toggleMute = async () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    
    if (newMuted && audioPlayerRef.current) {
      // Stop audio when muting
      await audioPlayerRef.current.stop();
      setIsPlaying(false);
    } else if (!newMuted && script && !isPlaying) {
      // Resume/start audio when unmuting
      await beginSession();
    }
  };

  const togglePlayback = async () => {
    if (isPlaying) {
      await stopSession();
    } else {
      setIsMuted(false); // Unmute when manually starting
      await beginSession();
    }
  };

  if (script) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity 
            onPress={() => {
              stopSession();
              setScript(null);
            }} 
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color="#e9d5ff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Your Meditation</Text>
          {/* Mute Button in Header */}
          <TouchableOpacity onPress={toggleMute} style={styles.muteButton}>
            <Ionicons 
              name={isMuted ? "volume-mute" : "volume-high"} 
              size={24} 
              color={isMuted ? "#ef4444" : "#10b981"} 
            />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scriptContainer} contentContainerStyle={styles.scriptContent}>
          {/* Enhanced Loading Progress Indicator */}
          {(generatingAudio || loadingStage === 'loading-continuation') && (
            <View style={styles.loadingContainer}>
              <View style={styles.loadingHeader}>
                <ActivityIndicator color="#a855f7" size="small" />
                <Text style={styles.loadingTitle}>
                  {loadingStage === 'generating-intro' && 'Preparing voice guidance...'}
                  {loadingStage === 'loading-continuation' && 'Loading next section...'}
                </Text>
              </View>
              <View style={styles.progressBarContainer}>
                <View style={[styles.progressBar, { width: `${loadingProgress}%` }]} />
              </View>
              <Text style={styles.loadingSubtext}>
                {loadingStage === 'generating-intro' && 'Audio will begin shortly'}
                {loadingStage === 'loading-continuation' && 'Buffering continuation...'}
              </Text>
            </View>
          )}
          
          {/* Playing Status Indicators */}
          {isPlaying && !isMuted && loadingStage === 'playing-intro' && (
            <View style={[styles.audioBanner, styles.playingBanner]}>
              <Ionicons name="volume-high" size={20} color="#10b981" />
              <Text style={[styles.audioBannerText, { color: '#10b981' }]}>
                Playing introduction... (continuation loading)
              </Text>
            </View>
          )}
          
          {isPlaying && !isMuted && loadingStage === 'playing-full' && (
            <View style={[styles.audioBanner, styles.playingBanner]}>
              <Ionicons name="volume-high" size={20} color="#10b981" />
              <Text style={[styles.audioBannerText, { color: '#10b981' }]}>Voice guidance playing...</Text>
            </View>
          )}
          
          {isMuted && (
            <View style={[styles.audioBanner, styles.mutedBanner]}>
              <Ionicons name="volume-mute" size={20} color="#ef4444" />
              <Text style={[styles.audioBannerText, { color: '#ef4444' }]}>Voice muted - tap speaker icon to unmute</Text>
            </View>
          )}
          
          {audioError && (
            <View style={styles.errorBanner}>
              <Ionicons name="warning" size={20} color="#f59e0b" />
              <Text style={styles.errorText}>{audioError}</Text>
            </View>
          )}
          
          <Text style={styles.scriptText}>{script}</Text>
        </ScrollView>

        <View style={styles.scriptControls}>
          <View style={styles.controlsRow}>
            {/* Large Mute/Unmute Button */}
            <TouchableOpacity 
              style={[styles.controlButton, isMuted && styles.mutedControlButton]} 
              onPress={toggleMute}
            >
              <Ionicons 
                name={isMuted ? "volume-mute" : "volume-high"} 
                size={28} 
                color="#fff" 
              />
              <Text style={styles.controlButtonText}>
                {isMuted ? "Unmute" : "Mute"}
              </Text>
            </TouchableOpacity>

            {/* Play/Stop Button */}
            <TouchableOpacity 
              style={[styles.playButton, isPlaying && styles.stopButton]} 
              onPress={togglePlayback}
              disabled={generatingAudio}
            >
              <Ionicons name={isPlaying ? "stop" : "play"} size={32} color="#fff" />
              <Text style={styles.playButtonText}>
                {isPlaying ? "Stop" : "Play"}
              </Text>
            </TouchableOpacity>
          </View>
          
          {isPlaying && (
            <View style={styles.playingIndicator}>
              <Ionicons name="musical-notes" size={20} color="#10b981" />
              <Text style={styles.playingText}>Session in progress...</Text>
            </View>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#e9d5ff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>AI Guided Meditation</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Focus Area</Text>
          <View style={styles.focusGrid}>
            {focuses.map((focus) => (
              <TouchableOpacity
                key={focus.id}
                style={[
                  styles.focusCard,
                  selectedFocus === focus.id && styles.focusCardActive,
                ]}
                onPress={() => setSelectedFocus(focus.id)}
              >
                <Ionicons
                  name={focus.icon as any}
                  size={32}
                  color={selectedFocus === focus.id ? '#fff' : '#c4b5fd'}
                />
                <Text
                  style={[
                    styles.focusName,
                    selectedFocus === focus.id && styles.focusNameActive,
                  ]}
                >
                  {focus.name}
                </Text>
                <Text
                  style={[
                    styles.focusDescription,
                    selectedFocus === focus.id && styles.focusDescriptionActive,
                  ]}
                >
                  {focus.description}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Duration: {duration} minutes</Text>
          <View style={styles.durationSlider}>
            {[5, 10, 15, 20].map((min) => (
              <TouchableOpacity
                key={min}
                style={[
                  styles.durationButton,
                  duration === min && styles.durationButtonActive,
                ]}
                onPress={() => setDuration(min)}
              >
                <Text
                  style={[
                    styles.durationText,
                    duration === min && styles.durationTextActive,
                  ]}
                >
                  {min}m
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <TouchableOpacity
          style={[styles.generateButton, loading && styles.generateButtonDisabled]}
          onPress={generateMeditation}
          disabled={loading}
        >
          {loading ? (
            <>
              <ActivityIndicator color="#fff" />
              <Text style={styles.generateButtonText}>Generating...</Text>
            </>
          ) : (
            <>
              <Ionicons name="create" size={24} color="#fff" />
              <Text style={styles.generateButtonText}>Generate Meditation</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>

      <Paywall
        visible={showPaywall}
        onClose={() => {
          setShowPaywall(false);
          if (!isPremium) {
            router.back();
          }
        }}
        feature="AI Guided Meditation"
      />
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
    fontSize: 20,
    fontWeight: '600',
    color: '#e9d5ff',
  },
  content: {
    padding: 20,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#e9d5ff',
    marginBottom: 16,
  },
  focusGrid: {
    gap: 12,
  },
  focusCard: {
    backgroundColor: '#2d1b4e',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#2d1b4e',
  },
  focusCardActive: {
    backgroundColor: '#7c3aed',
    borderColor: '#7c3aed',
  },
  focusName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#c4b5fd',
    marginTop: 12,
  },
  focusNameActive: {
    color: '#fff',
  },
  focusDescription: {
    fontSize: 14,
    color: '#9f7aea',
    marginTop: 4,
    textAlign: 'center',
  },
  focusDescriptionActive: {
    color: '#e9d5ff',
  },
  durationSlider: {
    flexDirection: 'row',
    gap: 12,
  },
  durationButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#2d1b4e',
    borderWidth: 2,
    borderColor: '#2d1b4e',
    alignItems: 'center',
  },
  durationButtonActive: {
    backgroundColor: '#7c3aed',
    borderColor: '#7c3aed',
  },
  durationText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#c4b5fd',
  },
  durationTextActive: {
    color: '#fff',
  },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#7c3aed',
    paddingVertical: 18,
    borderRadius: 25,
    gap: 12,
  },
  generateButtonDisabled: {
    opacity: 0.6,
  },
  generateButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  scriptContainer: {
    flex: 1,
  },
  scriptContent: {
    padding: 20,
  },
  scriptText: {
    fontSize: 16,
    lineHeight: 28,
    color: '#e9d5ff',
  },
  scriptControls: {
    padding: 20,
    backgroundColor: '#1a0033',
    borderTopWidth: 1,
    borderTopColor: '#2d1b4e',
  },
  playButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#7c3aed',
    paddingVertical: 18,
    borderRadius: 25,
    gap: 12,
  },
  stopButton: {
    backgroundColor: '#ef4444',
  },
  loadingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6b7280',
    paddingVertical: 18,
    borderRadius: 25,
    gap: 12,
  },
  playButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    gap: 8,
  },
  errorText: {
    color: '#f59e0b',
    fontSize: 14,
    flex: 1,
  },
  playingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    gap: 8,
  },
  playingText: {
    color: '#10b981',
    fontSize: 14,
    fontWeight: '500',
  },
  muteButton: {
    padding: 8,
  },
  audioBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(168, 85, 247, 0.2)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    gap: 8,
  },
  playingBanner: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
  },
  mutedBanner: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
  },
  audioBannerText: {
    color: '#a855f7',
    fontSize: 14,
    flex: 1,
  },
  controlsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  controlButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10b981',
    paddingVertical: 18,
    borderRadius: 25,
    gap: 8,
  },
  mutedControlButton: {
    backgroundColor: '#ef4444',
  },
  controlButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  loadingContainer: {
    backgroundColor: 'rgba(168, 85, 247, 0.15)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.3)',
  },
  loadingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  loadingTitle: {
    color: '#e9d5ff',
    fontSize: 16,
    fontWeight: '600',
  },
  progressBarContainer: {
    height: 6,
    backgroundColor: 'rgba(168, 85, 247, 0.2)',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#a855f7',
    borderRadius: 3,
  },
  loadingSubtext: {
    color: '#9f7aea',
    fontSize: 13,
    textAlign: 'center',
  },
});
