import { Linking, Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

const savesInFlight = new Map<string, Promise<string | null>>();

export async function cacheGeneratedAudio(id: string, audioUrl: string, mimeType = 'audio/mpeg') {
  if (Platform.OS === 'web' || !FileSystem.documentDirectory) return null;
  const key = id.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 100) || String(Date.now());
  const extension = mimeType === 'audio/mp4' ? 'm4a' : mimeType === 'audio/wav' || mimeType === 'audio/x-wav' ? 'wav' : mimeType === 'audio/aac' ? 'aac' : mimeType === 'audio/ogg' ? 'ogg' : mimeType === 'audio/flac' ? 'flac' : 'mp3';
  const fileUri = `${FileSystem.documentDirectory}samajved-audio-${key}.${extension}`;
  const existing = await FileSystem.getInfoAsync(fileUri).catch(() => null);
  if (existing?.exists && (existing.size ?? 0) > 0) return fileUri;
  const active = savesInFlight.get(key);
  if (active) return active;
  const saving = FileSystem.downloadAsync(audioUrl, fileUri)
    .then(async (result) => {
      if (result.status < 200 || result.status >= 300) throw new Error(`Audio download failed (HTTP ${result.status}).`);
      const downloaded = await FileSystem.getInfoAsync(result.uri);
      if (!downloaded.exists || !downloaded.size || downloaded.size > 40 * 1024 * 1024) throw new Error('The generated audio file is empty or too large to save.');
      return result.uri;
    })
    .catch(async (error) => {
      await FileSystem.deleteAsync(fileUri, { idempotent: true }).catch(() => undefined);
      throw error;
    })
    .finally(() => { savesInFlight.delete(key); });
  savesInFlight.set(key, saving);
  return saving;
}

export async function openGeneratedAudio(uri: string) {
  if (Platform.OS === 'android' && uri.startsWith('file://')) {
    const contentUri = await FileSystem.getContentUriAsync(uri).catch(() => uri);
    await Linking.openURL(contentUri);
    return;
  }
  await Linking.openURL(uri);
}
