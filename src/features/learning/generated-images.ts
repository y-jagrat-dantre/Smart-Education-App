import { Alert, Platform, Share } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

export async function persistGeneratedStudyImage(id: string, base64: string, mimeType: string) {
  if (Platform.OS === 'web' || !FileSystem.documentDirectory) return `data:${mimeType};base64,${base64}`;
  const extension = mimeType === 'image/jpeg' ? 'jpg' : mimeType === 'image/webp' ? 'webp' : 'png';
  const safeId = id.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80) || String(Date.now());
  const uri = `${FileSystem.documentDirectory}study-scene-${safeId}.${extension}`;
  await FileSystem.writeAsStringAsync(uri, base64, { encoding: FileSystem.EncodingType.Base64 });
  return uri;
}

export async function downloadStudyImage(uri: string, mimeType: string, title: string) {
  const extension = mimeType === 'image/jpeg' ? 'jpg' : mimeType === 'image/webp' ? 'webp' : 'png';
  const fileName = `${title.replace(/[^a-z0-9_-]+/gi, '-').slice(0, 60) || 'study-scene'}.${extension}`;
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    const anchor = document.createElement('a');
    anchor.href = uri;
    anchor.download = fileName;
    anchor.click();
    return true;
  }
  if (Platform.OS === 'android') {
    const permission = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
    if (!permission.granted) return false;
    const target = await FileSystem.StorageAccessFramework.createFileAsync(permission.directoryUri, fileName, mimeType);
    const base64 = uri.startsWith('data:') ? uri.slice(uri.indexOf(',') + 1) : await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
    await FileSystem.StorageAccessFramework.writeAsStringAsync(target, base64, { encoding: FileSystem.EncodingType.Base64 });
    return true;
  }
  if (Platform.OS === 'ios') {
    await Share.share({ title, message: title, url: uri });
    return true;
  }
  Alert.alert('Image saved', 'This illustration is saved with the study notebook on this device.');
  return true;
}
