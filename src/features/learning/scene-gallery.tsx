import { useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ActionButton, Card, SectionTitle } from '@/components/ui';
import { colors } from '@/theme/colors';
import type { StudyScene } from '@/state/app-store';
import { downloadStudyImage } from '@/features/learning/generated-images';

type Props = {
  scenes: StudyScene[];
  busyId: string | null;
  message: string;
  onCreate: () => void;
  onRetry: (id: string) => void;
  onGenerateRemaining: () => void;
  onRegenerateAll: () => void;
};

export function StudySceneGallery({ scenes, busyId, message, onCreate, onRetry, onGenerateRemaining, onRegenerateAll }: Props) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = scenes.find((scene) => scene.id === activeId) ?? null;
  const ready = scenes.filter((scene) => scene.status === 'ready' && scene.imageUri);
  const shareImage = async (scene: StudyScene) => {
    if (!scene.imageUri) return;
    try {
      const saved = await downloadStudyImage(scene.imageUri, scene.imageMimeType ?? 'image/png', scene.title);
      if (!saved) Alert.alert('Image not saved', 'Choose a folder to save the downloaded image.');
    } catch { Alert.alert('Could not share image', 'The image is already saved with this study notebook.'); }
  };

  return <>
    <View style={styles.sectionHeader}><SectionTitle>Illustrated scenes</SectionTitle>{ready.length ? <Pressable accessibilityRole="button" disabled={busyId !== null} onPress={onRegenerateAll} style={styles.textAction}><Ionicons name="refresh" size={15} color={colors.purple} /><Text style={styles.textActionLabel}>Regenerate all</Text></Pressable> : null}</View>
    {!scenes.length ? <Card style={styles.empty}>
      <View style={styles.emptyIcon}><Ionicons name="images-outline" size={23} color={colors.purple} /></View>
      <Text style={styles.title}>Turn the lesson into pictures</Text>
      <Text style={styles.copy}>Gemini will make a short scene plan from your notes, then generate a separate educational illustration for each scene.</Text>
      <ActionButton title={busyId === 'planning' ? 'Planning lesson scenes…' : 'Plan and generate scenes'} disabled={busyId !== null} onPress={onCreate} icon={busyId === 'planning' ? <ActivityIndicator color="#FFFFFF" /> : <Ionicons name="sparkles" size={17} color="#FFFFFF" />} />
    </Card> : <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbnails}>
        {scenes.map((scene) => <Pressable key={scene.id} accessibilityRole="button" accessibilityLabel={`Scene ${scene.number}: ${scene.title}`} onPress={() => setActiveId(scene.id)} style={[styles.thumb, activeId === scene.id && styles.thumbSelected]}>
          {scene.imageUri ? <Image source={{ uri: scene.imageUri }} style={styles.thumbImage} resizeMode="cover" /> : <View style={styles.thumbPlaceholder}>{scene.status === 'generating' ? <ActivityIndicator size="small" color={colors.purple} /> : <Ionicons name={scene.status === 'error' ? 'alert-circle-outline' : 'image-outline'} size={21} color={scene.status === 'error' ? colors.danger : colors.muted} />}</View>}
          <Text numberOfLines={1} style={styles.thumbTitle}>{scene.number}. {scene.title}</Text>
        </Pressable>)}
      </ScrollView>
      {scenes.map((scene) => <Card key={scene.id} style={styles.sceneCard}>
        <View style={styles.sceneHeading}><View style={styles.numberBadge}><Text style={styles.numberText}>{scene.number}</Text></View><View style={{ flex: 1, gap: 3 }}><Text style={styles.sceneTitle}>{scene.title}</Text><Text style={styles.concept}>{scene.concept}</Text></View></View>
        {scene.imageUri ? <Pressable accessibilityRole="imagebutton" accessibilityLabel={`View ${scene.title} full screen`} onPress={() => setActiveId(scene.id)}><Image source={{ uri: scene.imageUri }} style={styles.sceneImage} resizeMode="cover" /></Pressable> : <View style={styles.imagePlaceholder}>{scene.status === 'generating' ? <><ActivityIndicator color={colors.purple} /><Text style={styles.copy}>Generating this illustration…</Text></> : <><Ionicons name={scene.status === 'error' ? 'alert-circle-outline' : 'image-outline'} size={25} color={scene.status === 'error' ? colors.danger : colors.muted} /><Text style={styles.copy}>{scene.error || 'Waiting for image generation.'}</Text></>}</View>}
        <Text style={styles.caption}>{scene.caption}</Text>
        <Text style={styles.description}>{scene.description}</Text>
        <View style={styles.sceneActions}>
          {scene.status === 'error' || scene.status === 'ready' ? <Pressable accessibilityRole="button" disabled={busyId !== null} onPress={() => onRetry(scene.id)} style={styles.outlineAction}><Ionicons name="refresh" size={15} color={colors.purple} /><Text style={styles.outlineLabel}>{scene.status === 'error' ? 'Retry image' : 'Regenerate'}</Text></Pressable> : null}
          {scene.status === 'ready' ? <><Pressable accessibilityRole="button" onPress={() => setActiveId(scene.id)} style={styles.outlineAction}><Ionicons name="expand-outline" size={16} color={colors.purple} /><Text style={styles.outlineLabel}>Full screen</Text></Pressable><Pressable accessibilityRole="button" onPress={() => void shareImage(scene)} style={styles.outlineAction}><Ionicons name="download-outline" size={16} color={colors.purple} /><Text style={styles.outlineLabel}>{Platform.OS === 'web' ? 'Download' : Platform.OS === 'android' ? 'Save image' : 'Share'}</Text></Pressable></> : null}
        </View>
      </Card>)}
      {message ? <Text style={styles.message}>{message}</Text> : null}
      {scenes.some((scene) => scene.status === 'planned' || scene.status === 'error') && busyId === null ? <ActionButton title="Generate remaining images" onPress={onGenerateRemaining} secondary icon={<Ionicons name="images-outline" size={17} color={colors.purple} />} /> : null}
    </>}
    <Modal visible={active !== null} animationType="fade" presentationStyle="fullScreen" onRequestClose={() => setActiveId(null)}>
      <View style={styles.fullscreen}>
        <View style={styles.fullscreenHeader}><Pressable accessibilityRole="button" accessibilityLabel="Close full-screen image" onPress={() => setActiveId(null)} style={styles.close}><Ionicons name="close" size={24} color="#FFFFFF" /></Pressable><View style={{ flex: 1 }}><Text numberOfLines={1} style={styles.fullscreenTitle}>{active?.number}. {active?.title}</Text><Text style={styles.fullscreenCaption}>{active?.caption}</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Download or share this scene" onPress={() => active && void shareImage(active)} style={styles.close}><Ionicons name="download-outline" size={21} color="#FFFFFF" /></Pressable></View>
        {active?.imageUri ? <Image source={{ uri: active.imageUri }} style={styles.fullscreenImage} resizeMode="contain" /> : null}
        <View style={styles.fullscreenFooter}><Pressable accessibilityRole="button" accessibilityLabel="Previous scene" disabled={!scenes.length || scenes.findIndex((scene) => scene.id === activeId) <= 0} onPress={() => { const index = scenes.findIndex((scene) => scene.id === activeId); if (index > 0) setActiveId(scenes[index - 1]!.id); }} style={styles.navButton}><Ionicons name="chevron-back" size={22} color="#FFFFFF" /></Pressable><Text style={styles.fullscreenCounter}>{Math.max(0, scenes.findIndex((scene) => scene.id === activeId) + 1)} / {scenes.length}</Text><Pressable accessibilityRole="button" accessibilityLabel="Next scene" disabled={scenes.findIndex((scene) => scene.id === activeId) < 0 || scenes.findIndex((scene) => scene.id === activeId) >= scenes.length - 1} onPress={() => { const index = scenes.findIndex((scene) => scene.id === activeId); if (index >= 0 && index < scenes.length - 1) setActiveId(scenes[index + 1]!.id); }} style={styles.navButton}><Ionicons name="chevron-forward" size={22} color="#FFFFFF" /></Pressable></View>
      </View>
    </Modal>
  </>;
}

const styles = StyleSheet.create({
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, textAction: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 7 }, textActionLabel: { color: colors.purple, fontSize: 11, fontWeight: '800' },
  empty: { alignItems: 'center', gap: 12, padding: 22 }, emptyIcon: { width: 52, height: 52, borderRadius: 18, backgroundColor: colors.softPurple, alignItems: 'center', justifyContent: 'center' }, title: { color: colors.ink, fontSize: 16, fontWeight: '900' }, copy: { color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  thumbnails: { gap: 9, paddingVertical: 3 }, thumb: { width: 116, padding: 6, borderRadius: 15, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, gap: 6 }, thumbSelected: { borderColor: colors.purple, borderWidth: 2 }, thumbImage: { width: '100%', height: 66, borderRadius: 9, backgroundColor: colors.softPurple }, thumbPlaceholder: { width: '100%', height: 66, borderRadius: 9, backgroundColor: colors.softPurple, alignItems: 'center', justifyContent: 'center' }, thumbTitle: { color: colors.ink, fontSize: 10, fontWeight: '800' },
  sceneCard: { gap: 12, padding: 15 }, sceneHeading: { flexDirection: 'row', alignItems: 'center', gap: 10 }, numberBadge: { width: 32, height: 32, borderRadius: 11, backgroundColor: colors.softPurple, alignItems: 'center', justifyContent: 'center' }, numberText: { color: colors.purple, fontWeight: '900', fontSize: 13 }, sceneTitle: { color: colors.ink, fontWeight: '900', fontSize: 15 }, concept: { color: colors.muted, fontSize: 11, lineHeight: 16 }, sceneImage: { width: '100%', height: 230, borderRadius: 16, backgroundColor: colors.softPurple }, imagePlaceholder: { minHeight: 170, gap: 9, alignItems: 'center', justifyContent: 'center', padding: 18, borderRadius: 16, backgroundColor: colors.softPurple }, caption: { color: colors.ink, fontSize: 13, lineHeight: 19, fontWeight: '700' }, description: { color: colors.muted, fontSize: 11, lineHeight: 17 }, sceneActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, outlineAction: { minHeight: 41, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 11, borderRadius: 12, borderWidth: 1, borderColor: colors.border }, outlineLabel: { color: colors.purple, fontSize: 10, fontWeight: '800' }, message: { color: colors.muted, fontSize: 11, textAlign: 'center', lineHeight: 16 },
  fullscreen: { flex: 1, backgroundColor: '#101615', paddingTop: 24, paddingBottom: 18 }, fullscreenHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 8 }, close: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' }, fullscreenTitle: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' }, fullscreenCaption: { color: '#CAD4D0', fontSize: 11, lineHeight: 15, marginTop: 3 }, fullscreenImage: { flex: 1, width: '100%', height: '100%' }, fullscreenFooter: { height: 55, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 28 }, navButton: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center' }, fullscreenCounter: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
});
