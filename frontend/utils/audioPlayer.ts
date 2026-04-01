/**
 * Audio Player Utility for expo-audio SDK 55
 * Provides a simple interface for playing audio from base64 or URLs
 */

import { AudioPlayer, AudioMode, InterruptionMode, createAudioPlayer, setAudioMode } from 'expo-audio';

// Global audio mode setup
export const setupAudioMode = async () => {
  try {
    await setAudioMode({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: InterruptionMode.DoNotMix,
    });
  } catch (error) {
    console.error('Error setting up audio mode:', error);
  }
};

// Audio player manager class
export class AudioPlayerManager {
  private player: AudioPlayer | null = null;
  private isLoaded: boolean = false;

  async loadAndPlay(source: string | { uri: string }, options?: {
    loop?: boolean;
    volume?: number;
  }): Promise<void> {
    try {
      // Unload previous player
      await this.unload();

      // Handle base64 data URIs
      let audioSource: { uri: string };
      if (typeof source === 'string') {
        audioSource = { uri: source };
      } else {
        audioSource = source;
      }

      // Create new player
      this.player = createAudioPlayer(audioSource);
      
      if (this.player) {
        // Set volume if specified
        if (options?.volume !== undefined) {
          this.player.volume = options.volume;
        }
        
        // Set looping if specified
        if (options?.loop) {
          this.player.loop = true;
        }

        // Play the audio
        this.player.play();
        this.isLoaded = true;
      }
    } catch (error) {
      console.error('Error loading audio:', error);
      throw error;
    }
  }

  async play(): Promise<void> {
    if (this.player) {
      this.player.play();
    }
  }

  async pause(): Promise<void> {
    if (this.player) {
      this.player.pause();
    }
  }

  async stop(): Promise<void> {
    if (this.player) {
      this.player.pause();
      this.player.seekTo(0);
    }
  }

  async unload(): Promise<void> {
    if (this.player) {
      try {
        this.player.pause();
        this.player.release();
      } catch (e) {
        // Ignore cleanup errors
      }
      this.player = null;
      this.isLoaded = false;
    }
  }

  get isPlaying(): boolean {
    return this.player?.playing ?? false;
  }

  get loaded(): boolean {
    return this.isLoaded;
  }

  setVolume(volume: number): void {
    if (this.player) {
      this.player.volume = volume;
    }
  }

  setLoop(loop: boolean): void {
    if (this.player) {
      this.player.loop = loop;
    }
  }

  // Add playback status listener
  onPlaybackStatusChange(callback: (status: { isPlaying: boolean; didJustFinish?: boolean }) => void): () => void {
    if (!this.player) return () => {};
    
    const subscription = this.player.addListener('playingChange', (event) => {
      callback({ 
        isPlaying: event.isPlaying,
        didJustFinish: !event.isPlaying && this.player?.currentTime === this.player?.duration
      });
    });

    return () => subscription.remove();
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
