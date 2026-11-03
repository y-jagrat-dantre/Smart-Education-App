import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AppScreen, Card, Eyebrow, SectionTitle, uiStyles } from '@/components/ui';
import { artifactKinds, makeLocalArtifact } from '@/features/learning/artifacts';
import { generateStudyArtifact, hasBackend } from '@/services/api';
import { colors, radii } from '@/theme/colors';
import { useAppStore, type StudyArtifactKind } from '@/state/app-store';
import { useAuth } from '@/state/auth';

export default function StudioScreen() {
  const { songId } = useLocalSearchParams<{ songId?: string }>();
  const allSongs = useAppStore((state) => state.songs);
  const { user } = useAuth();
  const songs = allSongs.filter((song) => song.ownerId === user?.id);
  const addArtifact = useAppStore((state) => state.addArtifact);
  const deleteSong = useAppStore((state) => state.deleteSong);
  const [selectedId, setSelectedId] = useState(songId ?? songs[0]?.id ?? '');
  const [creating, setCreating] = useState<StudyArtifactKind | null>(null);
  const selected = songs.find((song) => song.id === selectedId);
  const readyToGenerate = Boolean(selected?.sourceText.trim() && selected.sourceText.trim().length >= 25);

  useEffect(() => {
    if (songId && songs.some((song) => song.id === songId)) setSelectedId(songId);
    else if (!songs.some((song) => song.id === selectedId) && songs[0]) setSelectedId(songs[0].id);
  }, [songId, selectedId, songs]);

  const openArtifact = (song: typeof songs[number], artifactId: string) => {
    router.push(`/artifact/${song.id}?artifactId=${artifactId}`);
  };

  const removeNotebook = (songId: string, title: string) => Alert.alert(
    'Delete notebook?',
    `Deleting “${title}” removes its source notes, lyrics, photo attachment, saved study formats, and topic progress from this device. Completed timer sessions and quiz results remain in your history.`,
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete notebook', style: 'destructive', onPress: () => {
        deleteSong(songId);
        if (selectedId === songId) setSelectedId(songs.find((song) => song.id !== songId)?.id ?? '');
      } },
    ],
  );

  const createArtifact = async (kind: StudyArtifactKind) => {
    if (!selected) return;
    if (!readyToGenerate) {
      Alert.alert('Add source notes first', 'This notebook only has a photo attached. Paste a few readable note statements on the Create screen to make an artifact.');
      return;
    }
    setCreating(kind);
    try {
      const localContent = makeLocalArtifact(kind, selected.title, selected.subject, selected.sourceText);
      let content = localContent;
      let generationMode: 'local' | 'ai' = 'local';
      if (hasBackend) {
        try {
          const aiContent = await generateStudyArtifact(kind, selected.title, selected.subject, selected.sourceText);
          if (aiContent) { content = aiContent; generationMode = 'ai'; }
        } catch { /* A local source-grounded draft is still available. */ }
      }
      const artifact = {
        id: `${Date.now()}-${Math.floor(Math.random() * 10000)}`,
        kind,
        title: selected.title,
        createdAt: new Date().toISOString(),
        content,
        generationMode,
      };
      addArtifact(selected.id, artifact);
      openArtifact(selected, artifact.id);
    } catch (error) {
      Alert.alert('Could not create this artifact', error instanceof Error ? error.message : 'Add more source notes and try again.');
    } finally {
      setCreating(null);
    }
  };

  return <AppScreen>
    <View style={styles.top}><Eyebrow>STUDIO</Eyebrow><Text style={uiStyles.heading}>Understand your sources</Text><Text style={uiStyles.body}>Shape your notes into visual, audio, and review material grounded in the text you added.</Text></View>

    <LinearGradient colors={[colors.midnight, '#176B5E']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
      <View style={styles.heroIcon}><Ionicons name="layers-outline" size={22} color={colors.lime} /></View>
      <Text style={styles.heroOverline}>NOTEBOOK STUDIO</Text>
      <Text style={styles.heroTitle}>One source. Many ways to learn.</Text>
      <Text style={styles.heroBody}>Build study material from your own notes, then return to the source whenever you need to check a detail.</Text>
      <View style={styles.heroKinds}>{artifactKinds.map((item) => <View key={item.kind} style={styles.heroKind}><Ionicons name={item.icon as keyof typeof Ionicons.glyphMap} size={14} color="#FFFFFF" /><Text style={styles.heroKindText}>{item.title}</Text></View>)}</View>
    </LinearGradient>

    <SectionTitle accessory={songs.length ? <Text style={styles.count}>{songs.length} {songs.length === 1 ? 'source' : 'sources'}</Text> : undefined}>Choose a notebook</SectionTitle>
    {songs.length ? <View style={styles.sources}>{songs.map((song) => {
      const active = song.id === selectedId;
      const sourceLength = song.sourceText.trim().length;
      return <Card key={song.id} style={[styles.sourceCard, active && styles.sourceCardActive]}>
        <Pressable accessibilityRole="radio" accessibilityState={{ selected: active }} onPress={() => setSelectedId(song.id)} style={({ pressed }) => [styles.sourceSelect, pressed && styles.rowPressed]}>
          <View style={[styles.sourceIcon, active && styles.sourceIconActive]}><Ionicons name={active ? 'book' : 'book-outline'} size={19} color={active ? '#FFFFFF' : colors.purple} /></View>
          <View style={styles.sourceCopy}><Text numberOfLines={1} style={styles.sourceTitle}>{song.title}</Text><Text style={styles.sourceMeta}>{song.subject} · {sourceLength ? `${sourceLength.toLocaleString()} characters` : 'Photo source'}{song.artifacts?.length ? ` · ${song.artifacts.length} saved` : ''}</Text></View>
          <View style={[styles.radio, active && styles.radioActive]}>{active ? <View style={styles.radioDot} /> : null}</View>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Delete ${song.title} notebook`}
          disabled={creating !== null}
          onPress={() => removeNotebook(song.id, song.title)}
          style={({ pressed }) => [styles.deleteNotebook, creating !== null && styles.deleteDisabled, pressed && creating === null && styles.rowPressed]}
        ><Ionicons name="trash-outline" size={17} color={colors.danger} /></Pressable>
      </Card>;
    })}</View> : <Card style={styles.emptyCard}><View style={styles.emptyIcon}><Ionicons name="document-text-outline" size={23} color={colors.purple} /></View><Text style={styles.emptyTitle}>Start with a source</Text><Text style={styles.emptyBody}>Create a notebook from your notes, a topic, or a photo of a study page.</Text><Pressable style={styles.addSource} onPress={() => router.push('/(tabs)/create')}><Ionicons name="add-circle-outline" size={17} color={colors.purple} /><Text style={styles.addSourceText}>Add study notes</Text></Pressable></Card>}

    {selected ? <>
      <SectionTitle>Create a study format</SectionTitle>
      <View style={styles.formats}>{artifactKinds.map((item) => {
        const active = creating === item.kind;
        return <Pressable key={item.kind} accessibilityRole="button" accessibilityState={{ disabled: !readyToGenerate || creating !== null }} disabled={!readyToGenerate || creating !== null} onPress={() => void createArtifact(item.kind)} style={({ pressed }) => [styles.formatCard, { borderColor: item.tint }, pressed && styles.pressed, (!readyToGenerate || (creating !== null && !active)) && styles.disabled]}>
          <View style={[styles.formatIcon, { backgroundColor: item.tint }]}><Ionicons name={active ? 'hourglass-outline' : item.icon as keyof typeof Ionicons.glyphMap} size={20} color={item.color} /></View>
          <Text style={styles.formatTitle}>{active ? 'Creating…' : item.title}</Text>
          <Text style={styles.formatDescription}>{item.description}</Text>
          <View style={styles.makeLink}><Text style={[styles.makeText, { color: item.color }]}>{active ? 'Working' : 'Create'}</Text><Ionicons name="arrow-forward" size={14} color={item.color} /></View>
        </Pressable>;
      })}</View>
      {!readyToGenerate ? <Text style={styles.sourceHint}>This notebook needs typed source notes before it can create these formats.</Text> : <Text style={styles.sourceHint}>{hasBackend ? 'AI can expand the structure from your source. If it is offline, a local draft is still saved.' : 'Drafts are created on this device from the source notes.'}</Text>}

      <SectionTitle accessory={selected.artifacts?.length ? <Text style={styles.count}>{selected.artifacts.length} saved</Text> : undefined}>Your studio</SectionTitle>
      {selected.artifacts?.length ? <View style={styles.savedList}>{selected.artifacts.map((artifact) => {
        const item = artifactKinds.find((kind) => kind.kind === artifact.kind) ?? artifactKinds[0];
        return <Pressable key={artifact.id} onPress={() => openArtifact(selected, artifact.id)} style={({ pressed }) => pressed ? styles.rowPressed : undefined}><Card style={styles.savedCard}>
          <View style={[styles.savedIcon, { backgroundColor: item.tint }]}><Ionicons name={item.icon as keyof typeof Ionicons.glyphMap} size={19} color={item.color} /></View>
          <View style={{ flex: 1, gap: 4 }}><Text style={styles.savedTitle}>{item.title} · {artifact.title}</Text><Text style={styles.savedMeta}>{artifact.content.sections.length} sections · {artifact.generationMode === 'ai' ? 'AI assisted' : 'On-device draft'} · {new Date(artifact.createdAt).toLocaleDateString()}</Text></View>
          <Ionicons name="chevron-forward" size={18} color={colors.muted} />
        </Card></Pressable>;
      })}</View> : <Card style={styles.noArtifacts}><Ionicons name="sparkles-outline" size={19} color={colors.purple} /><Text style={styles.noArtifactsText}>Your first artifact will appear here after you create it.</Text></Card>}
    </> : null}

    <View style={styles.privacy}><Ionicons name="lock-closed-outline" size={13} color={colors.muted} /><Text style={styles.privacyText}>Notes stay on this device unless you ask the connected AI service to create a format.</Text></View>
  </AppScreen>;
}

const styles = StyleSheet.create({
  top: { gap: 7 },
  hero: { minHeight: 245, borderRadius: 27, padding: 20, gap: 9, overflow: 'hidden', shadowColor: colors.midnight, shadowOpacity: 0.12, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 3 },
  heroIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  heroOverline: { color: '#D4E9DA', fontSize: 9, fontWeight: '800', letterSpacing: 1.2 },
  heroTitle: { maxWidth: 270, color: '#FFFFFF', fontSize: 25, lineHeight: 30, fontWeight: '800', letterSpacing: -0.6 },
  heroBody: { maxWidth: 310, color: '#E1EEE7', fontSize: 12, lineHeight: 18 },
  heroKinds: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 2 },
  heroKind: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 7, borderRadius: radii.pill, backgroundColor: 'rgba(255,255,255,0.14)' },
  heroKindText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' },
  count: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  sources: { gap: 10 },
  sourceCard: { flexDirection: 'row', alignItems: 'center', gap: 9, padding: 11, borderColor: colors.border, borderRadius: 21 },
  sourceCardActive: { borderColor: '#A8CFC2', backgroundColor: '#F1F8F3', shadowColor: colors.purple, shadowOpacity: 0.06, shadowRadius: 12 },
  sourceSelect: { flex: 1, minHeight: 55, flexDirection: 'row', alignItems: 'center', gap: 11 },
  rowPressed: { opacity: 0.84 },
  sourceIcon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 15, backgroundColor: colors.softPurple },
  sourceIconActive: { backgroundColor: colors.purple },
  sourceCopy: { flex: 1, gap: 5 },
  sourceTitle: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  sourceMeta: { color: colors.muted, fontSize: 11 },
  radio: { width: 21, height: 21, borderRadius: 11, borderWidth: 1.5, borderColor: '#A8B5AF', alignItems: 'center', justifyContent: 'center' },
  radioActive: { borderColor: colors.purple },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.purple },
  deleteNotebook: { width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#EBD5D0', backgroundColor: '#FFF7F4' },
  deleteDisabled: { opacity: 0.42 },
  formats: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  formatCard: { width: '48%', minHeight: 178, borderRadius: 22, borderWidth: 1, backgroundColor: colors.surface, padding: 15, gap: 10, shadowColor: colors.shadow, shadowOpacity: 0.035, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 1 },
  formatIcon: { width: 42, height: 42, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  formatTitle: { color: colors.ink, fontSize: 14, fontWeight: '900' },
  formatDescription: { flex: 1, color: colors.muted, fontSize: 11, lineHeight: 17 },
  makeLink: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingTop: 4 },
  makeText: { fontSize: 11, fontWeight: '900' },
  pressed: { opacity: 0.84 },
  disabled: { opacity: 0.55 },
  sourceHint: { color: colors.muted, fontSize: 11, lineHeight: 17, marginTop: -5 },
  savedList: { gap: 10 },
  savedCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 15, borderRadius: 20 },
  savedIcon: { width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  savedTitle: { color: colors.ink, fontSize: 13, fontWeight: '800' },
  savedMeta: { color: colors.muted, fontSize: 10, lineHeight: 15 },
  noArtifacts: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 16, backgroundColor: colors.surface },
  noArtifactsText: { flex: 1, color: colors.muted, fontSize: 12, lineHeight: 18 },
  emptyCard: { alignItems: 'center', padding: 25, gap: 13 },
  emptyIcon: { width: 58, height: 58, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.softPurple },
  emptyTitle: { color: colors.ink, fontSize: 18, fontWeight: '900' },
  emptyBody: { color: colors.muted, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  addSource: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 9 },
  addSourceText: { color: colors.purple, fontSize: 13, fontWeight: '900' },
  privacy: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 2, paddingHorizontal: 8 },
  privacyText: { flex: 1, color: colors.muted, fontSize: 10, lineHeight: 15, textAlign: 'center' },
});
