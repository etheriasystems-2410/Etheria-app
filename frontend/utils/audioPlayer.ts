/**
 * Audio Player Utility for expo-audio SDK 55
 * Provides a simple interface for playing audio from base64 or URLs
 */

import { setAudioModeAsync } from 'expo-audio';

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
    // Non-fatal - continue without audio mode setup
  }
};

// Audio player manager class - simplified for SDK 55
export class AudioPlayerManager {
  private audioElement: HTMLAudioElement | null = null;
  private isLoaded: boolean = false;
  private statusCallback: ((status: { isPlaying: boolean; didJustFinish?: boolean }) => void) | null = null;

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

      // For React Native, we'll use a simpler approach
      // Create audio element for web compatibility
      if (typeof window !== 'undefined' && window.Audio) {
        this.audioElement = new Audio(uri);
        
        if (options?.volume !== undefined) {
          this.audioElement.volume = options.volume;
        }
        
        if (options?.loop) {
          this.audioElement.loop = true;
        }

        this.audioElement.onended = () => {
          if (this.statusCallback) {
            this.statusCallback({ isPlaying: false, didJustFinish: true });
          }
        };

        await this.audioElement.play();
        this.isLoaded = true;
      } else {
        // For native, just mark as loaded - actual playback handled by components
        this.isLoaded = true;
        console.log('Native audio playback - use expo-audio hooks in component');
      }
    } catch (error) {
      console.error('Error loading audio:', error);
      throw error;
    }
  }

  async play(): Promise<void> {
    if (this.audioElement) {
      await this.audioElement.play();
    }
  }

  async pause(): Promise<void> {
    if (this.audioElement) {
      this.audioElement.pause();
    }
  }

  async stop(): Promise<void> {
    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement.currentTime = 0;
    }
  }

  async unload(): Promise<void> {
    if (this.audioElement) {
      try {
        this.audioElement.pause();
        this.audioElement.src = '';
      } catch (e) {
        // Ignore cleanup errors
      }
      this.audioElement = null;
      this.isLoaded = false;
    }
  }

  get isPlaying(): boolean {
    return this.audioElement ? !this.audioElement.paused : false;
  }

  get loaded(): boolean {
    return this.isLoaded;
  }

  setVolume(volume: number): void {
    if (this.audioElement) {
      this.audioElement.volume = volume;
    }
  }

  setLoop(loop: boolean): void {
    if (this.audioElement) {
      this.audioElement.loop = loop;
    }
  }

  onPlaybackStatusChange(callback: (status: { isPlaying: boolean; didJustFinish?: boolean }) => void): () => void {
    this.statusCallback = callback;
    return () => {
      this.statusCallback = null;
    };
  }
}

// Singleton instance for simple usage
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
