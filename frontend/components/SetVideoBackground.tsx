import React from 'react';
import { Platform, StyleSheet } from 'react-native';
import * as expoVideo from 'expo-video';

/**
 * SetVideoBackground — a looping, muted bundled video rendered as an
 * absolute-fill background layer.
 *
 * The caller keeps its static image UNDER this layer: on web the video is
 * skipped entirely (image only), and on native if the video fails to load
 * the view stays transparent so the static image still shows through.
 * The caller also keeps its dark overlay above the video so text stays
 * readable.
 *
 * The try/catch + platform guard around useVideoPlayer follows the
 * existing SplashVideo pattern in this codebase, so a codec or
 * native-module failure degrades to the static image instead of crashing.
 */
export default function SetVideoBackground({
  video,
  opacity = 0.55,
}: {
  video: number;
  opacity?: number;
}) {
  let player: any = null;
  try {
    if (Platform.OS !== 'web' && expoVideo.useVideoPlayer) {
      player = expoVideo.useVideoPlayer(video as any, (p: any) => {
        p.loop = true;
        p.muted = true;
        try {
          p.play();
        } catch {}
      });
    }
  } catch {
    player = null;
  }

  if (!player) return null;

  const { VideoView } = expoVideo as any;
  if (!VideoView) return null;

  return (
    <VideoView
      player={player}
      style={[StyleSheet.absoluteFill as any, { opacity }]}
      contentFit="cover"
      allowsFullscreen={false}
      nativeControls={false}
    />
  );
}
