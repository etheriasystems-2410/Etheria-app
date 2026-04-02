/**
 * Audio Player Utility for expo-audio SDK 55
 * Works on both web and native platforms
 */

import { Platform } from 'react-native';
import { createAudioPlayer } from 'expo-audio';

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
        
        // Set volume if provided
        if (options?.volume !== undefined) {
          try {
            this.nativePlayer.volume = options.volume;
          } catch (e) {
            console.log('Could not set volume:', e);
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

  private startStatusPolling(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }
    
    this.pollInterval = setInterval(() => {
      if (!this.nativePlayer) {
        this.stopStatusPolling();
        return;
      }
      
      try {
        const isPlaying = this.nativePlayer.playing;
        const currentTime = this.nativePlayer.currentTime;
        const duration = this.nativePlayer.duration;
        
        // Check if playback just finished
        if (this.lastPlayingState && !isPlaying && duration > 0 && currentTime >= duration - 0.5) {
          console.log('Audio playback finished');
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
          if (this.webAudioElement.ended || 
              (this.webAudioElement.paused && this.webAudioElement.currentTime >= this.webAudioElement.duration - 0.1)) {
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
            
            // Log status periodically for debugging
            if (elapsed % 3000 < 300) {
              console.log(`Audio status: playing=${isPlaying}, time=${currentTime.toFixed(1)}/${duration.toFixed(1)}`);
            }
            
            // Check if finished: not playing AND (near end of duration OR duration is 0 meaning loaded but finished)
            if (!isPlaying && duration > 0 && currentTime >= duration - 0.5) {
              console.log(`waitForCompletion: Native audio finished (${currentTime}/${duration})`);
              resolved = true;
              clearInterval(completionPoll);
              clearTimeout(safetyTimeout);
              resolve();
            } else if (!isPlaying && elapsed > 5000 && duration === 0) {
              // Wait longer (5 seconds) before giving up on duration
              console.log('waitForCompletion: Native audio not playing with no duration after 5s');
              resolved = true;
              clearInterval(completionPoll);
              clearTimeout(safetyTimeout);
              resolve();
            } else if (isPlaying && currentTime > 0) {
              // Audio is actively playing - good, keep waiting
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

  setVolume(volume: number): void {
    if (this.isWeb && this.webAudioElement) {
      this.webAudioElement.volume = volume;
    } else if (this.nativePlayer) {
      try {
        this.nativePlayer.volume = volume;
      } catch (e) {
        // Ignore
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
