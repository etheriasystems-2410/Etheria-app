/**
 * Audio Player Utility for expo-audio SDK 55
 * Works on both web and native platforms
 */

import { Platform } from 'react-native';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';

// Global audio mode setup
export const setupAudioMode = async () => {
  try {
    await setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: 'doNotMix',
    });
  } catch (error) {
    console.log('Audio mode setup skipped:', error);
  }
};

// Audio player manager class for SDK 55
export class AudioPlayerManager {
  private nativePlayer: any = null;
  private webAudioElement: HTMLAudioElement | null = null;
  private isLoadedFlag: boolean = false;
  private statusCallback: ((status: { isPlaying: boolean; didJustFinish?: boolean }) => void) | null = null;
  private isWeb: boolean = Platform.OS === 'web';
  private statusSubscription: any = null;

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
          updateInterval: 500,
        });
        
        // Set volume if provided
        if (options?.volume !== undefined && this.nativePlayer.volume !== undefined) {
          this.nativePlayer.volume = options.volume;
        }
        
        // Set loop if provided
        if (options?.loop && this.nativePlayer.loop !== undefined) {
          this.nativePlayer.loop = true;
        }
        
        // Subscribe to status updates
        if (this.nativePlayer.addListener) {
          this.statusSubscription = this.nativePlayer.addListener('playbackStatusUpdate', (status: any) => {
            console.log('Playback status:', status);
            if (status.didJustFinish && this.statusCallback) {
              this.statusCallback({ isPlaying: false, didJustFinish: true });
            }
          });
        }
        
        // Play
        if (this.nativePlayer.play) {
          this.nativePlayer.play();
          console.log('Native audio player started');
        }
        
        this.isLoadedFlag = true;
      }
    } catch (error) {
      console.error('Error loading audio:', error);
      throw error;
    }
  }

  async play(): Promise<void> {
    if (this.isWeb && this.webAudioElement) {
      await this.webAudioElement.play();
    } else if (this.nativePlayer?.play) {
      this.nativePlayer.play();
    }
  }

  async pause(): Promise<void> {
    if (this.isWeb && this.webAudioElement) {
      this.webAudioElement.pause();
    } else if (this.nativePlayer?.pause) {
      this.nativePlayer.pause();
    }
  }

  async stop(): Promise<void> {
    if (this.isWeb && this.webAudioElement) {
      this.webAudioElement.pause();
      this.webAudioElement.currentTime = 0;
    } else if (this.nativePlayer) {
      if (this.nativePlayer.seekTo) {
        this.nativePlayer.seekTo(0);
      }
      if (this.nativePlayer.pause) {
        this.nativePlayer.pause();
      }
    }
  }

  async unload(): Promise<void> {
    try {
      if (this.statusSubscription?.remove) {
        this.statusSubscription.remove();
        this.statusSubscription = null;
      }
      
      if (this.webAudioElement) {
        this.webAudioElement.pause();
        this.webAudioElement.src = '';
        this.webAudioElement = null;
      }
      
      if (this.nativePlayer) {
        if (this.nativePlayer.remove) {
          this.nativePlayer.remove();
        } else if (this.nativePlayer.release) {
          this.nativePlayer.release();
        }
        this.nativePlayer = null;
      }
      
      this.isLoadedFlag = false;
    } catch (e) {
      console.log('Audio unload cleanup:', e);
    }
  }

  get isPlaying(): boolean {
    if (this.isWeb && this.webAudioElement) {
      return !this.webAudioElement.paused;
    }
    if (this.nativePlayer?.playing !== undefined) {
      return this.nativePlayer.playing;
    }
    return false;
  }

  get loaded(): boolean {
    return this.isLoadedFlag;
  }

  setVolume(volume: number): void {
    if (this.isWeb && this.webAudioElement) {
      this.webAudioElement.volume = volume;
    } else if (this.nativePlayer && this.nativePlayer.volume !== undefined) {
      this.nativePlayer.volume = volume;
    }
  }

  setLoop(loop: boolean): void {
    if (this.isWeb && this.webAudioElement) {
      this.webAudioElement.loop = loop;
    } else if (this.nativePlayer && this.nativePlayer.loop !== undefined) {
      this.nativePlayer.loop = loop;
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
