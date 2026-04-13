/**
 * Audio Player Utility for expo-audio SDK 55
 * Works on both web and native platforms
 */

import { Platform } from 'react-native';
import { createAudioPlayer } from 'expo-audio';

// Setup audio mode - no-op for SDK 55 as it handles this automatically
export const setupAudioMode = async (): Promise<void> => {
  // expo-audio SDK 55 handles audio mode automatically
  // This function exists for backward compatibility
  console.log('Audio mode setup (SDK 55 handles automatically)');
};

// Audio player manager class for SDK 55
export class AudioPlayerManager {
  private nativePlayer: any = null;
  private webAudioElement: HTMLAudioElement | null = null;
  private isLoadedFlag: boolean = false;
  private statusCallback: ((status: { isPlaying: boolean; didJustFinish?: boolean }) => void) | null = null;
  private isWeb: boolean = Platform.OS === 'web';
  private pollInterval: ReturnType<typeof setInterval> | null = null;
  private lastPlayingState: boolean = false;

  async loadAndPlay(source: string | { uri: string }, options?: {
    loop?: boolean;
    volume?: number;
  }): Promise<void> {
    try {
      // Unload previous
      await this.unload();

      // Get URI
      let uri: string;
      if (typeof source === 'string') {
        uri = source;
      } else {
        uri = source.uri;
      }

      if (this.isWeb && typeof window !== 'undefined' && window.Audio) {
        // Web platform - use HTMLAudioElement
        this.webAudioElement = new window.Audio(uri);
        
        if (options?.volume !== undefined) {
          this.webAudioElement.volume = options.volume;
        }
        
        if (options?.loop) {
          this.webAudioElement.loop = true;
        }

        this.webAudioElement.onended = () => {
          if (this.statusCallback) {
            this.statusCallback({ isPlaying: false, didJustFinish: true });
          }
        };

        this.webAudioElement.onerror = (e) => {
          console.error('Web audio error:', e);
        };

        await this.webAudioElement.play();
        this.isLoadedFlag = true;
        console.log('Web audio started playing');
      } else {
        // Native platform - use expo-audio createAudioPlayer
        console.log('Creating native audio player for URI length:', uri.length);
        
        this.nativePlayer = createAudioPlayer({ uri }, {
          updateInterval: 250,
        });
        
        // Set volume if provided - use async setVolume for SDK 55
        if (options?.volume !== undefined) {
          try {
            if (typeof this.nativePlayer.setVolume === 'function') {
              await this.nativePlayer.setVolume(options.volume);
              console.log('Initial volume set via setVolume():', options.volume);
            } else {
              this.nativePlayer.volume = options.volume;
              console.log('Initial volume set via property:', options.volume);
            }
          } catch (e) {
            console.log('Could not set initial volume:', e);
          }
        }
        
        // Set loop if provided
        if (options?.loop) {
          try {
            this.nativePlayer.loop = true;
          } catch (e) {
            console.log('Could not set loop:', e);
          }
        }
        
        // Start polling for playback status changes
        this.startStatusPolling();
        
        // Play and wait a moment for player to initialize
        this.nativePlayer.play();
        this.lastPlayingState = true;
        
        // Give player time to start
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const initialStatus = {
          playing: this.nativePlayer.playing,
          duration: this.nativePlayer.duration,
          currentTime: this.nativePlayer.currentTime
        };
        console.log('Native audio player started, initial status:', JSON.stringify(initialStatus));
        
        this.isLoadedFlag = true;
      }
    } catch (error) {
      console.error('Error loading audio:', error);
      throw error;
    }
  }

  private hasEverPlayed: boolean = false;

  private startStatusPolling(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }
    
    // Reset tracking
    this.hasEverPlayed = false;
    
    this.pollInterval = setInterval(() => {
      if (!this.nativePlayer) {
        this.stopStatusPolling();
        return;
      }
      
      try {
        const isPlaying = this.nativePlayer.playing;
        const currentTime = this.nativePlayer.currentTime;
        const duration = this.nativePlayer.duration;
        
        // Track if playback has ever started
        if (isPlaying || currentTime > 0.1) {
          this.hasEverPlayed = true;
        }
        
        // Only check for completion if playback has actually started
        // Check if playback just finished: was playing, now not playing, at end of duration
        if (this.hasEverPlayed && this.lastPlayingState && !isPlaying && duration > 0 && currentTime >= duration - 0.5) {
          console.log(`Audio playback finished: currentTime=${currentTime.toFixed(1)}, duration=${duration.toFixed(1)}`);
          this.stopStatusPolling();
          if (this.statusCallback) {
            this.statusCallback({ isPlaying: false, didJustFinish: true });
          }
        }
        
        this.lastPlayingState = isPlaying;
      } catch (e) {
        // Ignore polling errors
      }
    }, 250);
  }

  private stopStatusPolling(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  async play(): Promise<void> {
    if (this.isWeb && this.webAudioElement) {
      await this.webAudioElement.play();
    } else if (this.nativePlayer?.play) {
      this.nativePlayer.play();
      this.lastPlayingState = true;
      this.startStatusPolling();
    }
  }

  /**
   * Wait for the current audio to finish playing
   * Returns a Promise that resolves when playback completes
   * @param maxDuration Maximum time to wait in milliseconds (default 5 minutes)
   */
  waitForCompletion(maxDuration: number = 300000): Promise<void> {
    return new Promise((resolve) => {
      // If not loaded or not playing, resolve immediately
      if (!this.isLoadedFlag) {
        console.log('waitForCompletion: Not loaded, resolving immediately');
        resolve();
        return;
      }

      let resolved = false;
      let hasStartedPlaying = false; // Track if playback ever started
      const startTime = Date.now();

      // Safety timeout
      const safetyTimeout = setTimeout(() => {
        if (!resolved) {
          console.log('waitForCompletion: Safety timeout reached');
          resolved = true;
          resolve();
        }
      }, maxDuration);

      // Poll for completion
      const completionPoll = setInterval(() => {
        if (resolved) {
          clearInterval(completionPoll);
          clearTimeout(safetyTimeout);
          return;
        }

        const elapsed = Date.now() - startTime;
        
        if (this.isWeb && this.webAudioElement) {
          // Web: check if ended or paused at end
          if (this.webAudioElement.currentTime > 0) {
            hasStartedPlaying = true;
          }
          if (hasStartedPlaying && (this.webAudioElement.ended || 
              (this.webAudioElement.paused && this.webAudioElement.currentTime >= this.webAudioElement.duration - 0.1))) {
            console.log('waitForCompletion: Web audio ended');
            resolved = true;
            clearInterval(completionPoll);
            clearTimeout(safetyTimeout);
            resolve();
          }
        } else if (this.nativePlayer) {
          try {
            const isPlaying = this.nativePlayer.playing;
            const currentTime = this.nativePlayer.currentTime || 0;
            const duration = this.nativePlayer.duration || 0;
            
            // Track if playback has started
            if (isPlaying || currentTime > 0.1) {
              hasStartedPlaying = true;
            }
            
            // Log status periodically for debugging (production: remove or use __DEV__)
            if (__DEV__ && elapsed % 3000 < 300) {
              console.log(`Audio status: playing=${isPlaying}, time=${currentTime.toFixed(1)}/${duration.toFixed(1)}, started=${hasStartedPlaying}`);
            }
            
            // Only check for completion if playback has started
            if (hasStartedPlaying && !isPlaying && duration > 0 && currentTime >= duration - 0.5) {
              console.log(`waitForCompletion: Native audio finished (${currentTime.toFixed(1)}/${duration.toFixed(1)})`);
              resolved = true;
              clearInterval(completionPoll);
              clearTimeout(safetyTimeout);
              resolve();
            } else if (!hasStartedPlaying && elapsed > 10000) {
              // If playback hasn't started after 10 seconds, there's a problem
              console.log('waitForCompletion: Playback never started after 10s, resolving');
              resolved = true;
              clearInterval(completionPoll);
              clearTimeout(safetyTimeout);
              resolve();
            } else if (hasStartedPlaying && !isPlaying && elapsed > 5000 && duration === 0) {
              // Wait longer (5 seconds) before giving up on duration
              console.log('waitForCompletion: Native audio not playing with no duration after 5s');
              resolved = true;
              clearInterval(completionPoll);
              clearTimeout(safetyTimeout);
              resolve();
            }
          } catch (e) {
            console.log('waitForCompletion poll error:', e);
          }
        } else {
          // Player was unloaded
          console.log('waitForCompletion: Player unloaded');
          resolved = true;
          clearInterval(completionPoll);
          clearTimeout(safetyTimeout);
          resolve();
        }
      }, 300);
    });
  }

  async pause(): Promise<void> {
    if (this.isWeb && this.webAudioElement) {
      this.webAudioElement.pause();
    } else if (this.nativePlayer?.pause) {
      this.nativePlayer.pause();
      this.lastPlayingState = false;
    }
  }

  async stop(): Promise<void> {
    this.stopStatusPolling();
    if (this.isWeb && this.webAudioElement) {
      this.webAudioElement.pause();
      this.webAudioElement.currentTime = 0;
    } else if (this.nativePlayer) {
      try {
        this.nativePlayer.seekTo?.(0);
        this.nativePlayer.pause?.();
      } catch (e) {
        // Ignore
      }
    }
  }

  async unload(): Promise<void> {
    this.stopStatusPolling();
    try {
      if (this.webAudioElement) {
        this.webAudioElement.pause();
        this.webAudioElement.src = '';
        this.webAudioElement = null;
      }
      
      if (this.nativePlayer) {
        try {
          this.nativePlayer.pause?.();
          this.nativePlayer.remove?.();
        } catch (e) {
          // Ignore cleanup errors
        }
        this.nativePlayer = null;
      }
      
      this.isLoadedFlag = false;
      this.statusCallback = null;
    } catch (e) {
      console.log('Audio unload cleanup:', e);
    }
  }

  get isPlaying(): boolean {
    if (this.isWeb && this.webAudioElement) {
      return !this.webAudioElement.paused;
    }
    if (this.nativePlayer) {
      try {
        return this.nativePlayer.playing ?? false;
      } catch (e) {
        return false;
      }
    }
    return false;
  }

  get loaded(): boolean {
    return this.isLoadedFlag;
  }

  async setVolume(volume: number): Promise<void> {
    // Clamp volume between 0 and 1
    const clampedVolume = Math.max(0, Math.min(1, volume));
    
    if (this.isWeb && this.webAudioElement) {
      this.webAudioElement.volume = clampedVolume;
      console.log('Web audio volume set to:', clampedVolume);
    } else if (this.nativePlayer) {
      try {
        // SDK 55: Use setVolume() async method for AudioPlayer instances
        if (typeof this.nativePlayer.setVolume === 'function') {
          await this.nativePlayer.setVolume(clampedVolume);
          console.log('Native audio volume set via setVolume():', clampedVolume);
        } else {
          // Fallback to direct property if setVolume is not available
          this.nativePlayer.volume = clampedVolume;
          console.log('Native audio volume set via property:', clampedVolume);
        }
      } catch (e) {
        console.log('Error setting volume:', e);
        // Try direct property assignment as last resort
        try {
          this.nativePlayer.volume = clampedVolume;
        } catch (e2) {
          console.log('Fallback volume set also failed:', e2);
        }
      }
    }
  }

  setLoop(loop: boolean): void {
    if (this.isWeb && this.webAudioElement) {
      this.webAudioElement.loop = loop;
    } else if (this.nativePlayer) {
      try {
        this.nativePlayer.loop = loop;
      } catch (e) {
        // Ignore
      }
    }
  }

  onPlaybackStatusChange(callback: (status: { isPlaying: boolean; didJustFinish?: boolean }) => void): () => void {
    this.statusCallback = callback;
    return () => {
      this.statusCallback = null;
    };
  }
}

// Singleton instance
let defaultPlayer: AudioPlayerManager | null = null;

export const getDefaultAudioPlayer = (): AudioPlayerManager => {
  if (!defaultPlayer) {
    defaultPlayer = new AudioPlayerManager();
  }
  return defaultPlayer;
};

export const playAudioFromBase64 = async (
  base64Data: string,
  mimeType: string = 'audio/mp3',
  options?: { loop?: boolean; volume?: number }
): Promise<AudioPlayerManager> => {
  const player = new AudioPlayerManager();
  const uri = `data:${mimeType};base64,${base64Data}`;
  await player.loadAndPlay(uri, options);
  return player;
};
