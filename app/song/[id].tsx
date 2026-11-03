import { useEffect, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ActionButton, AppScreen, Card, Eyebrow, SectionTitle, uiStyles } from '@/components/ui';
import { colors, radii } from '@/theme/colors';
import { extractStudyPoints } from '@/features/learning/content';
import { checkAudioJob, requestAudio } from '@/services/api';
import { useAppStore } from '@/state/app-store';
import { useAuth } from '@/state/auth';
import { cacheGeneratedAudio, openGeneratedAudio } from '@/features/audio/local-audio';

export default function SongScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const song = useAppStore((state) => state.songs.find((item) => item.id === id && item.ownerId === user?.id));
  const updateSong = useAppStore((state) => state.updateSong);
  const saveSong = useAppStore((state) => state.saveSong);
  const deleteSong = useAppStore((state) => state.deleteSong);
  const [busy, setBusy] = useState(false);
  const [openingAudio, setOpeningAudio] = useState(false);
  const [audioStatus, setAudioStatus] = useState('');

  useEffect(() => {
    if (!song?.audioJobId || song.audioLocalUri) return;
    let active = true;
    let attempts = 0;
    let checking = false;
    const poll = async () => {
      if (checking) return;
      checking = true;
      attempts += 1;
      if (attempts > 48) {
        clearInterval(timer);
        if (active) setAudioStatus('This job is taking longer than expected. Check back later.');
        checking = false;
        return;
      }
      try {
        const result = await checkAudioJob(song.audioJobId as string);
        if (result.audioUrl) {
          updateSong(song.id, { audioUrl: result.audioUrl, audioMimeType: result.mimeType ?? song.audioMimeType });
          let localUri: string | null = null;
          try { localUri = await cacheGeneratedAudio(`${song.id}-${song.audioJobId}`, result.audioUrl, result.mimeType ?? song.audioMimeType); }
          catch { /* The temporary stream remains available when local storage is unavailable. */ }
          if (localUri) updateSong(song.id, { audioLocalUri: localUri, audioMimeType: result.mimeType ?? song.audioMimeType });
          if (active) setAudioStatus(localUri ? 'Your audio is saved on this device.' : 'Your audio is ready.');
          clearInterval(timer);
        } else if (result.status === 'failed') {
          if (active) setAudioStatus(result.error || 'AceMusic could not complete this song. Your lyrics are saved.');
          clearInterval(timer);
        } else if (active) setAudioStatus('Song generation is in progress…');
      } catch (error) {
        if (active) setAudioStatus(error instanceof Error ? error.message : 'Could not check generation status.');
        clearInterval(timer);
      } finally { checking = false; }
    };
    const timer = setInterval(() => { void poll(); }, 5000);
    void poll();
    return () => { active = false; clearInterval(timer); };
  }, [song?.audioJobId, song?.audioLocalUri, song?.audioMimeType, song?.id, updateSong]);

  if (!song) return <AppScreen><View style={styles.top}><Pressable onPress={() => router.back()} style={styles.back}><Ionicons name="arrow-back" size={20} color={colors.ink} /></Pressable><Text style={uiStyles.heading}>Draft not found</Text><Text style={uiStyles.body}>It may have been removed from this device.</Text><ActionButton title="Go to library" onPress={() => router.replace('/(tabs)/library')} /></View></AppScreen>;

  const points = extractStudyPoints(song.sourceText);
  const hasQuiz = points.length >= 2;

  const startSongGeneration = async () => {
    setBusy(true);
    setAudioStatus('');
    try {
      const job = await requestAudio(song.lyrics, song.title, song.style, song.language ?? 'en');
      updateSong(song.id, { audioJobId: job.jobId, audioUrl: job.audioUrl, audioLocalUri: undefined, audioMimeType: job.mimeType });
      setAudioStatus(job.audioUrl ? 'Your audio is ready.' : 'Song generation is in progress…');
    } catch (error) {
      Alert.alert('Audio is not ready', error instanceof Error ? error.message : 'Check your provider setup and try again.');
    } finally {
      setBusy(false);
    }
  };

  const generateAudio = () => Alert.alert(
    'Generate a full song?',
    'This sends your lyrics to AceMusic to make a vocal song. Its hosted API is currently free; service limits may apply.',
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Generate song', onPress: () => { void startSongGeneration(); } },
    ],
  );

  const removeNotebook = () => Alert.alert(
    'Delete notebook?',
    `Deleting “${song.title}” removes its source notes, lyrics, photo attachment, saved study formats, and topic progress from this device. Completed timer sessions and quiz results remain in your history.`,
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete notebook', style: 'destructive', onPress: () => {
        deleteSong(song.id);
        router.replace('/(tabs)/explore');
      } },
    ],
  );

  const playAudio = async () => {
    if (!song.audioUrl && !song.audioLocalUri) return;
    setOpeningAudio(true);
    try {
      if (song.audioLocalUri) {
        try { await openGeneratedAudio(song.audioLocalUri); return; }
        catch { if (!song.audioUrl) throw new Error('The saved audio file is no longer available. Try generating the vocal song again.'); }
      }
      let audioUrl = song.audioUrl;
      if (song.audioJobId) {
        try {
          const refreshed = await checkAudioJob(song.audioJobId);
          if (refreshed.audioUrl) {
            audioUrl = refreshed.audioUrl;
            updateSong(song.id, { audioUrl, audioMimeType: refreshed.mimeType ?? song.audioMimeType });
            try {
              const localUri = await cacheGeneratedAudio(`${song.id}-${song.audioJobId}`, audioUrl, refreshed.mimeType ?? song.audioMimeType);
              if (localUri) {
                updateSong(song.id, { audioLocalUri: localUri, audioMimeType: refreshed.mimeType ?? song.audioMimeType });
                await openGeneratedAudio(localUri);
                setAudioStatus('Your audio is saved on this device.');
                return;
              }
            } catch { /* Try streaming the refreshed URL below. */ }
          }
        } catch { /* A previously saved stream may still work; try it before reporting an error. */ }
      }
      if (!audioUrl) throw new Error('The song service has no playable audio for this job.');
      await openGeneratedAudio(audioUrl);
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'The audio player could not open this file.';
      setAudioStatus(reason);
      Alert.alert('Could not open audio', `${reason}\n\nIf this song was generated before the backend restarted, its temporary audio may have expired. Generate a new vocal song to save a fresh copy on this device.`);
    } finally { setOpeningAudio(false); }
  };

  return <AppScreen>
    <View style={styles.top}>
      <View style={styles.topActions}>
        <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()} style={({ pressed }) => [styles.back, pressed && styles.pressed]}><Ionicons name="arrow-back" size={20} color={colors.ink} /></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={`Delete ${song.title} notebook`} onPress={removeNotebook} style={({ pressed }) => [styles.deleteNotebook, pressed && styles.pressed]}><Ionicons name="trash-outline" size={18} color={colors.danger} /><Text style={styles.deleteText}>Delete notebook</Text></Pressable>
      </View>
      <Eyebrow>{song.subject.toUpperCase()} · {(song.language ?? 'en') === 'hi' ? 'हिन्दी' : 'ENGLISH'} · {song.style.toUpperCase()}</Eyebrow>
      <Text style={uiStyles.heading}>{song.title}</Text>
      <View style={styles.status}><Ionicons name={song.generationMode !== 'local' ? 'sparkles' : 'create-outline'} size={13} color={song.generationMode !== 'local' ? colors.purple : colors.amber} /><Text style={styles.statusText}>{song.generationMode !== 'local' ? ((song.language ?? 'en') === 'hi' ? 'AI हिन्दी lyrics · Review against source' : 'AI-generated lyrics · Review against source') : ((song.language ?? 'en') === 'hi' ? 'Local हिन्दी draft · Review against source' : 'Local lyric draft · Review against source')}</Text></View>
    </View>

    <Card style={styles.lyricsCard}>
      <SectionTitle>{(song.language ?? 'en') === 'hi' ? 'हिन्दी lyrics · Review & edit' : 'Review & edit lyrics'}</SectionTitle>
      <Text style={styles.inputHint}>Change any line. Your edits save with this draft.</Text>
      <TextInput value={song.lyrics} onChangeText={(lyrics) => updateSong(song.id, { lyrics })} multiline textAlignVertical="top" style={styles.lyricsInput} accessibilityLabel="Editable song lyrics" />
    </Card>

    <Card style={styles.sourceCard}>
      <SectionTitle>Source notes</SectionTitle>
      {song.sourceImageUri ? <Image source={{ uri: song.sourceImageUri }} style={styles.sourceImage} resizeMode="contain" /> : null}
      {points.length ? points.map((point, index) => <View key={`${index}-${point}`} style={styles.sourcePoint}><View style={styles.pointDot}><Text style={styles.pointNumber}>{index + 1}</Text></View><Text style={styles.pointText}>{point}</Text></View>) : <Text style={styles.emptySource}>This song was made from the attached photo. Check the image above against your class material.</Text>}
      <Text style={styles.sourceCaveat}>Compare names, dates, formulas, and definitions with your class material.</Text>
    </Card>

    <Pressable onPress={() => router.push(`/(tabs)/explore?songId=${song.id}`)}>
      <Card style={styles.studioCard}><View style={styles.studioIcon}><Ionicons name="albums-outline" size={19} color={colors.purple} /></View><View style={{ flex: 1, gap: 3 }}><Text style={styles.audioTitle}>Create more from these notes</Text><Text style={styles.inputHint}>Make a slide deck, mind map, audio script, or illustrated scene gallery.</Text></View><Ionicons name="arrow-forward" size={17} color={colors.purple} /></Card>
    </Pressable>

    <Card style={styles.audioCard}>
      <View style={styles.audioHeading}><View style={styles.audioIcon}><Ionicons name="musical-notes" size={19} color={colors.purple} /></View><View style={{ flex: 1 }}><Text style={styles.audioTitle}>{(song.language ?? 'en') === 'hi' ? 'हिन्दी vocals' : 'Song with vocals'}</Text><Text style={styles.inputHint}>{song.audioUrl ? 'Generated audio is ready' : 'Sing these lyrics with an AI-composed arrangement'}</Text></View></View>
      {song.audioUrl || song.audioLocalUri ? <ActionButton title={openingAudio ? 'Opening audio…' : song.audioLocalUri ? 'Play saved audio' : 'Open current audio'} onPress={() => void playAudio()} disabled={openingAudio} icon={<Ionicons name="play" size={16} color="#FFFFFF" />} /> : null}
      <ActionButton title={busy ? 'Sending to AceMusic…' : song.audioUrl ? 'Generate new vocal song' : 'Generate full song'} onPress={generateAudio} disabled={busy} secondary icon={<Ionicons name="musical-note" size={16} color={colors.purple} />} />
      {audioStatus ? <Text style={styles.audioStatus}>{audioStatus}</Text> : <Text style={styles.sourceCaveat}>Uses ACE-Step through AceMusic's hosted API. Currently free; service limits may apply.</Text>}
    </Card>

    {hasQuiz ? <Card style={styles.quizCard}><View style={{ flex: 1, gap: 4 }}><Text style={styles.audioTitle}>Ready to check what stuck?</Text><Text style={styles.inputHint}>Try a short recall quiz made from these notes.</Text></View><Pressable accessibilityRole="button" onPress={() => router.push(`/quiz/${song.id}`)} style={styles.quizArrow}><Ionicons name="arrow-forward" size={19} color="#FFFFFF" /></Pressable></Card> : <Text style={styles.quizHint}>Add at least two complete note statements to make a source-based quiz.</Text>}

    <ActionButton title={song.saved ? 'Saved to your library' : 'Save lyrics to library'} onPress={() => saveSong(song.id)} icon={<Ionicons name={song.saved ? 'checkmark-circle' : 'bookmark-outline'} size={17} color="#FFFFFF" />} />
  </AppScreen>;
}

const styles = StyleSheet.create({
  top: { gap: 9, marginBottom: 3 },
  topActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 },
  back: { width: 44, height: 44, marginBottom: 3, borderRadius: 16, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  deleteNotebook: { minHeight: 44, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 15, borderWidth: 1, borderColor: '#EBD5D0', backgroundColor: '#FFF7F4' },
  deleteText: { color: colors.danger, fontSize: 11, fontWeight: '800' },
  pressed: { opacity: 0.84 },
  status: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radii.pill, backgroundColor: colors.softYellow },
  statusText: { color: '#694A14', fontSize: 11, fontWeight: '800' },
  lyricsCard: { padding: 19, gap: 12 },
  inputHint: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  lyricsInput: { minHeight: 300, color: colors.ink, fontSize: 16, lineHeight: 27, padding: 18, borderRadius: 17, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.canvas },
  sourceCard: { padding: 19, gap: 14 },
  sourcePoint: { flexDirection: 'row', gap: 11, alignItems: 'flex-start' },
  pointDot: { width: 25, height: 25, borderRadius: 13, backgroundColor: colors.softMint, alignItems: 'center', justifyContent: 'center' },
  pointNumber: { color: colors.success, fontSize: 11, fontWeight: '900' },
  pointText: { flex: 1, color: colors.ink, fontSize: 13, lineHeight: 20 },
  sourceCaveat: { color: colors.muted, fontSize: 11, lineHeight: 17 },
  emptySource: { color: colors.muted, fontSize: 13, lineHeight: 20 },
  sourceImage: { width: '100%', height: 230, borderRadius: 16, backgroundColor: colors.canvas },
  studioCard: { flexDirection: 'row', alignItems: 'center', gap: 13, padding: 16, backgroundColor: colors.softPurple, borderColor: '#B9D9CD' },
  studioIcon: { width: 46, height: 46, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  audioCard: { padding: 19, gap: 14 },
  audioHeading: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  audioIcon: { width: 46, height: 46, borderRadius: 16, backgroundColor: colors.softPurple, alignItems: 'center', justifyContent: 'center' },
  audioTitle: { color: colors.ink, fontSize: 15, fontWeight: '800' },
  audioStatus: { color: colors.success, fontSize: 12, fontWeight: '700' },
  quizCard: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18, backgroundColor: colors.softMint, borderColor: '#CFE3CE' },
  quizArrow: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.success, alignItems: 'center', justifyContent: 'center' },
  quizHint: { color: colors.muted, fontSize: 12, textAlign: 'center' },
});
