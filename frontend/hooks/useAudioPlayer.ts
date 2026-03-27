import { useEffect, useRef, useState } from 'react';
import { Audio } from 'expo-av';

export interface AudioPlayerState {
  isPlaying: boolean;
  isLoading: boolean;
  duration: number;
  position: number;
  error: string | null;
}

export const useAudioPlayer = () => {
  const soundRef = useRef<Audio.Sound | null>(null);
  const [state, setState] = useState<AudioPlayerState>({
    isPlaying: false,
    isLoading: false,
    duration: 0,
    position: 0,
    error: null,
  });

  useEffect(() => {
    // Configure audio mode for meditation/background playback
    const configureAudio = async () => {
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          staysActiveInBackground: true,
          playsInSilentModeIOS: true,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
        });
      } catch (error) {
        console.error('Error configuring audio:', error);
      }
    };

    configureAudio();

    return () => {
      // Cleanup
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
    };
  }, []);

  const loadAudio = async (uri: string) => {
    try {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      // Unload previous sound if exists
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
      }

      // Load new sound
      const { sound, status } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: false, isLooping: true },
        onPlaybackStatusUpdate
      );

      soundRef.current = sound;

      if (status.isLoaded) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          duration: status.durationMillis || 0,
        }));
      }
    } catch (error) {
      console.error('Error loading audio:', error);
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: 'Failed to load audio',
      }));
    }
  };

  const onPlaybackStatusUpdate = (status: any) => {
    if (status.isLoaded) {
      setState((prev) => ({
        ...prev,
        isPlaying: status.isPlaying,
        position: status.positionMillis || 0,
        duration: status.durationMillis || prev.duration,
      }));
    }
  };

  const play = async () => {
    try {
      if (soundRef.current) {
        await soundRef.current.playAsync();
        setState((prev) => ({ ...prev, isPlaying: true }));
      }
    } catch (error) {
      console.error('Error playing audio:', error);
      setState((prev) => ({ ...prev, error: 'Failed to play audio' }));
    }
  };

  const pause = async () => {
    try {
      if (soundRef.current) {
        await soundRef.current.pauseAsync();
        setState((prev) => ({ ...prev, isPlaying: false }));
      }
    } catch (error) {
      console.error('Error pausing audio:', error);
    }
  };

  const stop = async () => {
    try {
      if (soundRef.current) {
        await soundRef.current.stopAsync();
        await soundRef.current.setPositionAsync(0);
        setState((prev) => ({ ...prev, isPlaying: false, position: 0 }));
      }
    } catch (error) {
      console.error('Error stopping audio:', error);
    }
  };

  const setVolume = async (volume: number) => {
    try {
      if (soundRef.current) {
        await soundRef.current.setVolumeAsync(Math.max(0, Math.min(1, volume)));
      }
    } catch (error) {
      console.error('Error setting volume:', error);
    }
  };

  return {
    state,
    loadAudio,
    play,
    pause,
    stop,
    setVolume,
  };
};
