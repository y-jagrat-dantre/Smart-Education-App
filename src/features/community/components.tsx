import { useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, radii } from '@/theme/colors';
import { reportCommunityContent, type CommunityImage, type CommunityQuestion } from '@/services/api';

export type PickedCommunityImage = { clientId: string; uri: string; base64: string; mimeType: string; size?: number };
export const COMMUNITY_IMAGE_LIMIT = 4;
export const COMMUNITY_IMAGE_BYTES = 2 * 1024 * 1024;

export function CommunityAvatar({ name, size = 40, imageUri }: { name: string; size?: number; imageUri?: string | null }) {
  const initials = name.trim().split(/\s+/).slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join('') || 'S';
  return <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>{imageUri ? <Image source={{ uri: imageUri }} style={styles.avatarImage} resizeMode="cover" /> : <Text style={[styles.avatarText, { fontSize: Math.max(12, size * 0.34) }]}>{initials}</Text>}</View>;
}

export function relativeCommunityTime(value: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60_000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days < 7 ? `${days}d ago` : new Date(value).toLocaleDateString();
}

export function CommunityImageGallery({ images, preview = false }: { images: CommunityImage[]; preview?: boolean }) {
  const [selected, setSelected] = useState<CommunityImage | null>(null);
  const [zoom, setZoom] = useState(1);
  if (!images.length) return null;
  return <>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.gallery}>
      {images.map((image) => <Pressable key={image.id} accessibilityRole="button" accessibilityLabel="Open image" onPress={() => { setSelected(image); setZoom(1); }} style={styles.galleryImageWrap}>
        <Image source={{ uri: image.url }} style={[styles.galleryImage, preview && styles.previewImage]} resizeMode="cover" />
      </Pressable>)}
    </ScrollView>
    <Modal visible={!!selected} transparent animationType="fade" onRequestClose={() => setSelected(null)}>
      <View style={styles.viewer}>
        <Pressable style={styles.viewerClose} accessibilityRole="button" accessibilityLabel="Close image" onPress={() => setSelected(null)}><Ionicons name="close" size={26} color="#FFFFFF" /></Pressable>
        {selected ? <ScrollView style={styles.viewerScroll} contentContainerStyle={styles.viewerContent} maximumZoomScale={4} minimumZoomScale={1} centerContent>
          <Image source={{ uri: selected.url }} resizeMode="contain" style={[styles.viewerImage, { transform: [{ scale: zoom }] }]} onError={() => Alert.alert('Image unavailable', 'This community image could not be loaded.')} />
        </ScrollView> : null}
        <View style={styles.zoomControls}>
          <Pressable accessibilityRole="button" accessibilityLabel="Zoom out" onPress={() => setZoom((value) => Math.max(1, value - 0.5))} style={styles.zoomButton}><Ionicons name="remove" size={21} color="#FFFFFF" /></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Zoom in" onPress={() => setZoom((value) => Math.min(3, value + 0.5))} style={styles.zoomButton}><Ionicons name="add" size={21} color="#FFFFFF" /></Pressable>
        </View>
      </View>
    </Modal>
  </>;
}

export function CommunityImagePicker({ images, onChange, disabled = false }: { images: PickedCommunityImage[]; onChange: (images: PickedCommunityImage[]) => void; disabled?: boolean }) {
  const [working, setWorking] = useState(false);
  const acceptAssets = (assets: ImagePicker.ImagePickerAsset[]) => {
    const room = Math.max(0, COMMUNITY_IMAGE_LIMIT - images.length);
    const chosen = assets.slice(0, room);
    const next: PickedCommunityImage[] = [];
    for (const asset of chosen) {
      const mimeType = asset.mimeType ?? 'image/jpeg';
      const size = asset.fileSize;
      if (!asset.base64) { Alert.alert('Could not read image', 'Choose a JPEG, PNG, or WebP image again.'); continue; }
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) { Alert.alert('Unsupported image type', 'Community images support JPEG, PNG, and WebP.'); continue; }
      if (asset.base64.length > Math.ceil(COMMUNITY_IMAGE_BYTES * 4 / 3) + 8) { Alert.alert('Image is too large', 'The compressed image is still over 2 MB. Try cropping it or choosing a smaller image.'); continue; }
      next.push({ clientId: `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`, uri: asset.uri, base64: asset.base64, mimeType, size });
    }
    if (assets.length > room) Alert.alert('Image limit', `You can attach up to ${COMMUNITY_IMAGE_LIMIT} images to one post.`);
    if (next.length) onChange([...images, ...next]);
  };

  const chooseGallery = async () => {
    if (disabled || images.length >= COMMUNITY_IMAGE_LIMIT) return;
    setWorking(true);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) { Alert.alert('Photo access needed', 'Allow photo access to attach question or solution images.'); return; }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: COMMUNITY_IMAGE_LIMIT - images.length, quality: 0.68, base64: true });
      if (!result.canceled) acceptAssets(result.assets);
    } finally { setWorking(false); }
  };

  const takePhoto = async () => {
    if (disabled || images.length >= COMMUNITY_IMAGE_LIMIT) return;
    setWorking(true);
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) { Alert.alert('Camera access needed', 'Allow camera access to photograph a question or handwritten solution.'); return; }
      const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.68, base64: true });
      if (!result.canceled) acceptAssets(result.assets);
    } finally { setWorking(false); }
  };

  return <View style={styles.picker}>
    <View style={styles.pickerActions}>
      <Pressable accessibilityRole="button" disabled={disabled || working || images.length >= COMMUNITY_IMAGE_LIMIT} onPress={() => void chooseGallery()} style={styles.pickerButton}>
        {working ? <ActivityIndicator size="small" color={colors.purple} /> : <Ionicons name="images-outline" size={18} color={colors.purple} />}<Text style={styles.pickerButtonText}>Gallery</Text>
      </Pressable>
      <Pressable accessibilityRole="button" disabled={disabled || working || images.length >= COMMUNITY_IMAGE_LIMIT} onPress={() => void takePhoto()} style={styles.pickerButton}>
        <Ionicons name="camera-outline" size={18} color={colors.purple} /><Text style={styles.pickerButtonText}>Camera</Text>
      </Pressable>
      <Text style={styles.pickerHint}>{images.length}/{COMMUNITY_IMAGE_LIMIT} · up to 2 MB each</Text>
    </View>
    {images.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pickedImages}>
      {images.map((image, index) => <View key={image.clientId} style={styles.pickedWrap}>
        <Image source={{ uri: image.uri }} style={styles.pickedImage} resizeMode="cover" />
        <Pressable accessibilityRole="button" accessibilityLabel="Remove image" disabled={disabled} onPress={() => onChange(images.filter((_, itemIndex) => itemIndex !== index))} style={styles.removeImage}><Ionicons name="close" size={15} color="#FFFFFF" /></Pressable>
      </View>)}
    </ScrollView> : null}
  </View>;
}

export function CommunityReportModal({ target, onClose, onSubmitted }: {
  target: { type: 'question' | 'answer' | 'comment'; id: string } | null; onClose: () => void; onSubmitted: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const reasons = ['Spam', 'Harassment', 'Inappropriate content', 'Misleading academic answer', 'Copyright concern', 'Other'];
  const submit = async (reason: string) => {
    if (!target || busy) return;
    setBusy(true);
    try { await reportCommunityContent(target.type, target.id, reason); onSubmitted(); }
    catch (cause) { Alert.alert('Could not submit report', cause instanceof Error ? cause.message : 'Try again.'); }
    finally { setBusy(false); }
  };
  return <Modal visible={!!target} transparent animationType="slide" onRequestClose={onClose}>
    <View style={styles.reportShade}><View style={styles.reportCard}>
      <View style={styles.reportHeader}><View style={{ flex: 1, gap: 4 }}><Text style={styles.reportTitle}>Report this content</Text><Text style={styles.reportDescription}>Choose the reason that best describes the issue.</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Close report dialog" disabled={busy} onPress={onClose} style={styles.reportClose}><Ionicons name="close" size={19} color={colors.ink} /></Pressable></View>
      {reasons.map((reason) => <Pressable key={reason} accessibilityRole="button" disabled={busy} onPress={() => void submit(reason)} style={styles.reportOption}>{busy ? <ActivityIndicator size="small" color={colors.purple} /> : <Ionicons name="flag-outline" size={16} color={colors.purpleDark} />}<Text style={styles.reportOptionText}>{reason}</Text><Ionicons name="chevron-forward" size={15} color={colors.muted} /></Pressable>)}
      <Text style={styles.reportFootnote}>Reports are stored for review.</Text>
    </View></View>
  </Modal>;
}

export function CommunityQuestionCard({ question, onOpen, onVote, onBookmark, onShare, onReport }: {
  question: CommunityQuestion; onOpen: () => void; onVote: () => void; onBookmark: () => void; onShare: () => void; onReport: () => void;
}) {
  return <View style={styles.questionCard}>
    <Pressable accessibilityRole="button" onPress={onOpen} style={styles.questionMain}>
      <View style={styles.authorRow}>
        <CommunityAvatar name={question.author.name} size={38} imageUri={question.author.avatarUrl} />
        <View style={styles.authorCopy}><Text style={styles.authorName}>{question.author.name}</Text><Text style={styles.meta}>{question.author.country ? `${question.author.country} · ` : ''}{relativeCommunityTime(question.createdAt)} · {question.author.level}</Text></View>
        <View style={styles.subjectPill}><Text style={styles.subjectText}>{question.subject}</Text></View>
      </View>
      <Text style={styles.questionTitle}>{question.title}</Text>
      {question.body ? <Text style={styles.questionBody} numberOfLines={3}>{question.body}</Text> : null}
      {question.images.length ? <CommunityImageGallery images={question.images} preview /> : null}
      {question.tags.length ? <View style={styles.tags}>{question.tags.slice(0, 4).map((tag) => <Text key={tag} style={styles.tag}>#{tag}</Text>)}</View> : null}
    </Pressable>
    <View style={styles.cardFooter}>
      <Pressable accessibilityRole="button" accessibilityState={{ selected: question.hasVoted }} onPress={onVote} style={styles.cardAction}><Ionicons name={question.hasVoted ? 'arrow-up-circle' : 'arrow-up-circle-outline'} size={19} color={question.hasVoted ? colors.purple : colors.muted} /><Text style={[styles.actionText, question.hasVoted && styles.activeAction]}>{question.voteCount}</Text></Pressable>
      <Pressable accessibilityRole="button" onPress={onOpen} style={styles.cardAction}><Ionicons name="chatbubble-ellipses-outline" size={17} color={colors.muted} /><Text style={styles.actionText}>{question.answerCount} {question.answerCount === 1 ? 'answer' : 'answers'}</Text></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={question.bookmarked ? 'Remove bookmark' : 'Save question'} onPress={onBookmark} style={styles.iconAction}><Ionicons name={question.bookmarked ? 'bookmark' : 'bookmark-outline'} size={18} color={question.bookmarked ? colors.purple : colors.muted} /></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Share question" onPress={onShare} style={styles.iconAction}><Ionicons name="share-social-outline" size={18} color={colors.muted} /></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Report question" onPress={onReport} style={styles.iconAction}><Ionicons name="flag-outline" size={17} color={colors.muted} /></Pressable>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  avatar: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.softMint, borderWidth: 1, borderColor: '#CFE1D7' },
  avatarImage: { width: '100%', height: '100%' },
  avatarText: { color: colors.purpleDark, fontWeight: '900' },
  gallery: { gap: 8, paddingVertical: 2 },
  galleryImageWrap: { overflow: 'hidden', width: 160, height: 122, borderRadius: 15, backgroundColor: '#E9EFEB' },
  galleryImage: { width: '100%', height: '100%' },
  previewImage: { width: 132, height: 98 },
  viewer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(7,18,16,0.96)' },
  viewerClose: { position: 'absolute', zIndex: 2, top: 44, right: 22, width: 45, height: 45, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.13)' },
  viewerScroll: { flex: 1, width: '100%' },
  viewerContent: { flexGrow: 1, alignItems: 'center', justifyContent: 'center' },
  viewerImage: { width: '100%', height: '82%' },
  zoomControls: { position: 'absolute', bottom: 34, flexDirection: 'row', gap: 12 },
  zoomButton: { width: 48, height: 48, borderRadius: 16, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.14)' },
  picker: { gap: 11 },
  pickerActions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 9 },
  pickerButton: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 13, borderRadius: 13, borderWidth: 1, borderColor: colors.border, backgroundColor: '#FFFFFF' },
  pickerButtonText: { color: colors.ink, fontSize: 12, fontWeight: '800' },
  pickerHint: { color: colors.muted, fontSize: 10 },
  pickedImages: { gap: 10 },
  pickedWrap: { width: 84, height: 80, borderRadius: 14, overflow: 'hidden', backgroundColor: '#E9EFEB' },
  pickedImage: { width: '100%', height: '100%' },
  removeImage: { position: 'absolute', top: 5, right: 5, width: 23, height: 23, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(24,51,46,0.84)' },
  reportShade: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(12,30,26,0.38)' }, reportCard: { gap: 7, paddingHorizontal: 19, paddingTop: 20, paddingBottom: 34, borderTopLeftRadius: 26, borderTopRightRadius: 26, backgroundColor: colors.surface }, reportHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 7 }, reportTitle: { color: colors.ink, fontSize: 17, fontWeight: '800' }, reportDescription: { color: colors.muted, fontSize: 11, lineHeight: 16 }, reportClose: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.softMint }, reportOption: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: '#ECF0ED' }, reportOptionText: { flex: 1, color: colors.ink, fontSize: 12, fontWeight: '700' }, reportFootnote: { color: colors.muted, fontSize: 9, marginTop: 3 },
  questionCard: { overflow: 'hidden', padding: 15, gap: 13, borderRadius: 21, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  questionMain: { gap: 11 },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  authorCopy: { flex: 1, gap: 4 },
  authorName: { color: colors.ink, fontSize: 12, fontWeight: '800' },
  meta: { color: colors.muted, fontSize: 10 },
  subjectPill: { maxWidth: 100, paddingHorizontal: 9, paddingVertical: 6, borderRadius: radii.pill, backgroundColor: colors.softMint },
  subjectText: { color: colors.purpleDark, fontSize: 9, fontWeight: '800' },
  questionTitle: { color: colors.ink, fontSize: 17, lineHeight: 23, fontWeight: '800', letterSpacing: -0.25 },
  questionBody: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  tag: { color: colors.purpleDark, fontSize: 10, fontWeight: '700' },
  cardFooter: { minHeight: 35, flexDirection: 'row', alignItems: 'center', gap: 13, borderTopWidth: 1, borderTopColor: '#ECF0ED', paddingTop: 10 },
  cardAction: { minHeight: 32, flexDirection: 'row', alignItems: 'center', gap: 5 },
  actionText: { color: colors.muted, fontSize: 10, fontWeight: '700' },
  activeAction: { color: colors.purpleDark },
  iconAction: { minWidth: 30, height: 32, alignItems: 'center', justifyContent: 'center', marginLeft: 'auto' },
});
