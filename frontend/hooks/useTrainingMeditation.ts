/**
 * useTrainingMeditation — guided-meditation TTS playback for the Training
 * screen.
 *
 * Splits the meditation script on `[pause for N seconds]` markers, generates
 * audio for each text segment via `/api/tts/generate`, plays sequentially,
 * and respects a stop request at any chunk boundary. Long text is sub-chunked
 * to keep request bodies under ~4000 chars.
 */
import { useRef, useState } from 'react';
import { Alert } from 'react-native';

import { AudioPlayerManager } from '../utils/audioPlayer';
import type { Lesson } from '../components/training/types';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface Segment {
  type: 'text' | 'pause';
  content: string;
  duration?: number;
}

export function useTrainingMeditation() {
  const [isPlayingMeditation, setIsPlayingMeditation] = useState(false);
  const [isGeneratingTTS, setIsGeneratingTTS] = useState(false);
  const [ttsProgress, setTtsProgress] = useState('');

  const audioPlayerRef = useRef<AudioPlayerManager | null>(null);
  const isPlayingRef = useRef(false);

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

  const parseScript = (script: string): Segment[] => {
    const pauseRegex = /\[pause(?:\s+for\s+(\d+)\s*seconds?)?\]/gi;
    const segments: Segment[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = pauseRegex.exec(script)) !== null) {
      if (match.index > lastIndex) {
        const text = script.slice(lastIndex, match.index).trim();
        if (text) segments.push({ type: 'text', content: text });
      }
      const pauseDuration = match[1] ? parseInt(match[1], 10) : 5;
      segments.push({ type: 'pause', content: '', duration: pauseDuration });
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < script.length) {
      const text = script.slice(lastIndex).trim();
      if (text) segments.push({ type: 'text', content: text });
    }
    return segments;
  };

  const chunkText = (text: string, maxChunkSize = 4000): string[] => {
    if (text.length <= maxChunkSize) return [text];
    const paragraphs = text.split('\n\n');
    const chunks: string[] = [];
    let current = '';
    for (const p of paragraphs) {
      if ((current + '\n\n' + p).length > maxChunkSize) {
        if (current) chunks.push(current);
        current = p;
      } else {
        current = current ? current + '\n\n' + p : p;
      }
    }
    if (current) chunks.push(current);
    return chunks;
  };

  const playMeditation = async (lesson: Lesson | null) => {
    if (!lesson?.meditation) return;

    await stopMeditation();

    isPlayingRef.current = true;
    setIsPlayingMeditation(true);
    setTtsProgress('Starting...');

    try {
      const segments = parseScript(lesson.meditation.script);
      if (__DEV__) console.log(`Meditation has ${segments.length} segments`);

      const textSegments = segments.filter((s) => s.type === 'text');
      const totalText = textSegments.length;

      for (let i = 0; i < segments.length; i++) {
        if (!isPlayingRef.current) break;
        const segment = segments[i];

        if (segment.type === 'pause') {
          setTtsProgress(`Pause... (${segment.duration}s)`);
          await new Promise<void>((resolve) => {
            const timeout = setTimeout(resolve, (segment.duration || 5) * 1000);
            const checkInterval = setInterval(() => {
              if (!isPlayingRef.current) {
                clearTimeout(timeout);
                clearInterval(checkInterval);
                resolve();
              }
            }, 500);
          });
        } else {
          const textIndex = textSegments.indexOf(segment) + 1;
          setTtsProgress(`Speaking ${textIndex}/${totalText}...`);
          const chunks = chunkText(segment.content);

          for (const chunk of chunks) {
            if (!isPlayingRef.current) break;
            const r = await fetch(`${BACKEND_URL}/api/tts/generate`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ text: chunk, voice: 'nova' }),
            });
            if (!r.ok) throw new Error('Failed to generate audio');

            const data = await r.json();
            if (data.error || !data.audio_base64 || !data.success) {
              console.log(
                'TTS returned no audio for chunk, skipping:',
                data.error || 'no audio',
              );
              continue;
            }
            if (data.audio_base64 && isPlayingRef.current) {
              const player = new AudioPlayerManager();
              const audioUri = `data:audio/mp3;base64,${data.audio_base64}`;
              await player.loadAndPlay(audioUri, { volume: 1.0 });
              audioPlayerRef.current = player;
              await player.waitForCompletion(180000);
              if (audioPlayerRef.current) {
                await audioPlayerRef.current.unload();
                audioPlayerRef.current = null;
              }
            }
          }
        }
      }

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

  return {
    isPlayingMeditation,
    isGeneratingTTS,
    ttsProgress,
    playMeditation,
    stopMeditation,
  };
}
