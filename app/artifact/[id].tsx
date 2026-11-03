import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Linking, Modal, PanResponder, Pressable, ScrollView, Share, StyleSheet, Text, View, useWindowDimensions, type ScrollViewInstance } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ActionButton, AppScreen, Card, Eyebrow, SectionTitle, uiStyles } from '@/components/ui';
import { artifactKinds, artifactText } from '@/features/learning/artifacts';
import { extractStudyPoints } from '@/features/learning/content';
import { checkAudioJob, checkStudyVideo, generateStudySceneImage, planStudyScenes, requestAudio } from '@/services/api';
import { colors, radii } from '@/theme/colors';
import { useAppStore, type StudyArtifactNode, type StudyScene } from '@/state/app-store';
import { useAuth } from '@/state/auth';
import { persistGeneratedStudyImage } from '@/features/learning/generated-images';
import { StudySceneGallery } from '@/features/learning/scene-gallery';
import { cacheGeneratedAudio, openGeneratedAudio } from '@/features/audio/local-audio';

export default function ArtifactScreen() {
  const { id, artifactId } = useLocalSearchParams<{ id: string; artifactId: string }>();
  const { user } = useAuth();
  const song = useAppStore((state) => state.songs.find((item) => item.id === id && item.ownerId === user?.id));
  const artifact = song?.artifacts?.find((item) => item.id === artifactId);
  const updateArtifact = useAppStore((state) => state.updateArtifact);
  const deleteArtifact = useAppStore((state) => state.deleteArtifact);
  const [busy, setBusy] = useState(false);
  const [audioStatus, setAudioStatus] = useState('');
  const [videoMessage, setVideoMessage] = useState('');
  const [sceneBusyId, setSceneBusyId] = useState<string | null>(null);
  const [sceneMessage, setSceneMessage] = useState('');
  const [activeSource, setActiveSource] = useState<number | null>(null);
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const sourceNotes = extractStudyPoints(song?.sourceText ?? '');
  const meta = artifactKinds.find((item) => item.kind === artifact?.kind) ?? artifactKinds[0]!;

  useEffect(() => {
    if (!song || !artifact?.audioJobId || artifact.audioLocalUri) return;
    let active = true;
    let attempts = 0;
    let checking = false;
    const poll = async () => {
      if (checking) return;
      checking = true;
      attempts += 1;
      if (attempts > 48) {
        if (active) setAudioStatus('This audio job is taking longer than expected. Check back later.');
        clearInterval(timer);
        checking = false;
        return;
      }
      try {
        const result = await checkAudioJob(artifact.audioJobId as string);
        if (result.audioUrl) {
          updateArtifact(song.id, artifact.id, { audioUrl: result.audioUrl, audioMimeType: result.mimeType ?? artifact.audioMimeType });
          let localUri: string | null = null;
          try { localUri = await cacheGeneratedAudio(`${artifact.id}-${artifact.audioJobId}`, result.audioUrl, result.mimeType ?? artifact.audioMimeType); }
          catch { /* The temporary stream remains available when local storage is unavailable. */ }
          if (localUri) updateArtifact(song.id, artifact.id, { audioLocalUri: localUri, audioMimeType: result.mimeType ?? artifact.audioMimeType });
          if (active) setAudioStatus(localUri ? 'Your vocal track is saved on this device.' : 'Your vocal study track is ready.');
          clearInterval(timer);
        } else if (result.status === 'failed') {
          if (active) setAudioStatus(result.error || 'The music provider could not complete this track. Your script is saved.');
          clearInterval(timer);
        } else if (active) setAudioStatus('Vocal study track generation is in progress…');
      } catch (error) {
        if (active) setAudioStatus(error instanceof Error ? error.message : 'Could not check generation status.');
        clearInterval(timer);
      } finally { checking = false; }
    };
    const timer = setInterval(() => { void poll(); }, 5000);
    void poll();
    return () => { active = false; clearInterval(timer); };
  }, [artifact?.audioJobId, artifact?.audioLocalUri, artifact?.audioMimeType, artifact?.id, song?.id, updateArtifact]);

  useEffect(() => {
    const projectId = artifact?.videoProjectId;
    if (!song || !artifact || !projectId || ['done', 'error', 'timeout'].includes(artifact.videoStatus ?? '')) return;
    let active = true;
    let attempts = 0;
    const poll = async () => {
      attempts += 1;
      if (attempts > 120) {
        updateArtifact(song.id, artifact.id, { videoStatus: 'timeout', videoError: 'Rendering is taking longer than expected. You can try checking again later.' });
        if (active) setVideoMessage('This render is taking longer than expected.');
        clearInterval(timer);
        return;
      }
      try {
        const result = await checkStudyVideo(projectId);
        if (!active) return;
        if (result.status === 'done' && result.url) {
          updateArtifact(song.id, artifact.id, {
            videoStatus: 'done', videoUrl: result.url, videoThumbnail: result.thumbnail ?? undefined,
            videoDuration: result.duration ?? undefined, videoError: undefined,
          });
          setVideoMessage('Your study video is ready.');
          clearInterval(timer);
        } else if (result.status === 'done') {
          const message = 'JSON2Video finished this render but returned no playable MP4 link.';
          updateArtifact(song.id, artifact.id, { videoStatus: 'error', videoError: message });
          setVideoMessage(message);
          clearInterval(timer);
        } else if (result.status === 'error' || result.status === 'timeout') {
          const message = result.message || (result.status === 'timeout' ? 'JSON2Video timed out while rendering this video.' : 'JSON2Video could not finish this render.');
          updateArtifact(song.id, artifact.id, { videoStatus: result.status, videoError: message });
          setVideoMessage(message);
          clearInterval(timer);
        } else {
          updateArtifact(song.id, artifact.id, { videoStatus: result.status === 'running' ? 'running' : 'pending' });
          setVideoMessage(result.status === 'running' ? 'Rendering your study video…' : 'Your render is queued…');
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not check video rendering. Retrying…';
        if (active) setVideoMessage(message);
        if (active && /guest session expired|not found for this guest session|not configured|EXPO_PUBLIC_API_URL/i.test(message)) {
          updateArtifact(song.id, artifact.id, { videoStatus: 'error', videoError: message });
          clearInterval(timer);
        }
      }
    };
    const timer = setInterval(() => { void poll(); }, 5000);
    void poll();
    return () => { active = false; clearInterval(timer); };
  }, [artifact?.id, artifact?.videoProjectId, artifact?.videoStatus, song?.id, updateArtifact]);

  if (!song || !artifact) return <AppScreen>
    <Pressable onPress={() => router.back()} style={styles.back}><Ionicons name="arrow-back" size={20} color={colors.ink} /></Pressable>
    <Text style={uiStyles.heading}>Artifact not found</Text>
    <Text style={uiStyles.body}>It may have been removed from this device.</Text>
    <ActionButton title="Open Studio" onPress={() => router.replace('/(tabs)/explore')} />
  </AppScreen>;

  const shareArtifact = async () => {
    try { await Share.share({ message: artifactText(artifact.kind, artifact.title, artifact.content) }); }
    catch { Alert.alert('Could not share', 'Try sharing this artifact again.'); }
  };

  const createAudio = async () => {
    const script = artifact.content.sections.map((section) => `${section.heading}\n${section.body}`).join('\n\n');
    setBusy(true);
    setAudioStatus('');
    try {
      const job = await requestAudio(script, `${artifact.title} overview`, 'Acoustic', song.language ?? 'en');
      updateArtifact(song.id, artifact.id, { audioJobId: job.jobId, audioUrl: job.audioUrl, audioLocalUri: undefined, audioMimeType: job.mimeType });
      setAudioStatus(job.audioUrl ? 'Your vocal study track is ready.' : 'Vocal study track generation is in progress…');
    } catch (error) {
      Alert.alert('Audio is not ready', error instanceof Error ? error.message : 'Connect the study service and try again.');
    } finally { setBusy(false); }
  };

  const playAudio = async () => {
    if (!artifact.audioUrl && !artifact.audioLocalUri) return;
    try {
      if (artifact.audioLocalUri) {
        try { await openGeneratedAudio(artifact.audioLocalUri); return; }
        catch { if (!artifact.audioUrl) throw new Error('The saved vocal track is no longer available. Generate the track again.'); }
      }
      let audioUrl = artifact.audioUrl;
      if (artifact.audioJobId) {
        try {
          const refreshed = await checkAudioJob(artifact.audioJobId);
          if (refreshed.audioUrl) {
            audioUrl = refreshed.audioUrl;
            updateArtifact(song.id, artifact.id, { audioUrl, audioMimeType: refreshed.mimeType ?? artifact.audioMimeType });
            try {
              const localUri = await cacheGeneratedAudio(`${artifact.id}-${artifact.audioJobId}`, audioUrl, refreshed.mimeType ?? artifact.audioMimeType);
              if (localUri) {
                updateArtifact(song.id, artifact.id, { audioLocalUri: localUri, audioMimeType: refreshed.mimeType ?? artifact.audioMimeType });
                await openGeneratedAudio(localUri);
                return;
              }
            } catch { /* Try streaming the refreshed URL below. */ }
          }
        } catch { /* A previously saved stream URL may still work. */ }
      }
      if (!audioUrl) throw new Error('The song service has no playable audio for this job.');
      await openGeneratedAudio(audioUrl);
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'The audio player could not open this file.';
      setAudioStatus(reason);
      Alert.alert('Could not open audio', `${reason}\n\nIf the backend restarted before a local copy was saved, generate a new vocal track to create a fresh copy on this device.`);
    }
  };

  const openVideo = async () => {
    if (!artifact.videoUrl) return;
    try { await Linking.openURL(artifact.videoUrl); }
    catch { Alert.alert('Could not open video', 'Try again when you have an internet connection.'); }
  };

  const commitSceneGallery = (scenes: StudyScene[]) => updateArtifact(song.id, artifact.id, { sceneGallery: scenes });

  const generateScenes = async (initial: StudyScene[], sceneIds: string[], force = false) => {
    let current = [...initial];
    for (const sceneId of sceneIds) {
      const scene = current.find((item) => item.id === sceneId);
      if (!scene || (scene.status === 'ready' && !force)) continue;
      setSceneBusyId(sceneId);
      setSceneMessage(`Generating scene ${scene.number} of ${current.length}…`);
      current = current.map((item) => item.id === sceneId ? { ...item, status: 'generating', error: undefined } : item);
      commitSceneGallery(current);
      try {
        const result = await generateStudySceneImage(scene);
        const imageUri = await persistGeneratedStudyImage(scene.id, result.imageBase64, result.mimeType);
        current = current.map((item) => item.id === sceneId ? { ...item, status: 'ready', imageUri, imageMimeType: result.mimeType, error: undefined, updatedAt: new Date().toISOString() } : item);
        commitSceneGallery(current);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Gemini could not generate this image. Retry the scene.';
        current = current.map((item) => item.id === sceneId ? { ...item, status: 'error', error: message } : item);
        commitSceneGallery(current);
      }
    }
    setSceneBusyId(null);
    setSceneMessage(current.some((scene) => scene.status === 'ready') ? 'Generated images are saved with this notebook on this device.' : 'No image was generated. Check the message on each scene and retry.');
  };

  const createScenePlan = async () => {
    setSceneBusyId('planning');
    setSceneMessage('Analyzing your source notes…');
    try {
      const planned = await planStudyScenes(artifact.title, song.sourceText, artifact.content.sections.map(({ heading, body }) => ({ heading, body })), 3);
      const scenes: StudyScene[] = planned.map((scene, index) => ({ ...scene, number: index + 1, status: 'planned' }));
      commitSceneGallery(scenes);
      await generateScenes(scenes, scenes.map((scene) => scene.id));
    } catch (error) {
      setSceneBusyId(null);
      setSceneMessage(error instanceof Error ? error.message : 'Could not plan scenes from your study notes.');
    }
  };

  const confirmScenePlan = () => Alert.alert(
    'Generate lesson illustrations?',
    'Gemini will analyze your notes and generate up to 3 images. Google currently lists the selected 1K image model at about $0.034 per image (about $0.10 for 3), billed to the connected Google AI project. Image generation may require paid model access.',
    [{ text: 'Cancel', style: 'cancel' }, { text: 'Generate images', onPress: () => { void createScenePlan(); } }],
  );

  const retryScene = (sceneId: string) => {
    const scenes = artifact.sceneGallery ?? [];
    const scene = scenes.find((item) => item.id === sceneId);
    if (!scene) return;
    const run = () => { void generateScenes(scenes, [sceneId], true); };
    if (scene.status === 'ready') Alert.alert('Regenerate this image?', 'This makes another image request and may add Google AI usage charges.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Regenerate', onPress: run }]);
    else run();
  };

  const generateRemainingScenes = () => {
    const scenes = artifact.sceneGallery ?? [];
    void generateScenes(scenes, scenes.filter((scene) => scene.status === 'planned' || scene.status === 'error').map((scene) => scene.id));
  };

  const regenerateAllScenes = () => Alert.alert('Regenerate all illustrations?', 'Each image will be generated again and may add Google AI usage charges. Existing images remain saved if a request fails.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Regenerate all', onPress: () => { void generateScenes(artifact.sceneGallery ?? [], (artifact.sceneGallery ?? []).map((scene) => scene.id), true); } }]);

  const confirmDelete = () => Alert.alert('Delete this artifact?', 'The source notebook and its other study materials will stay saved.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: () => { deleteArtifact(song.id, artifact.id); router.replace('/(tabs)/explore'); } },
  ]);

  return <AppScreen>
    <View style={styles.top}>
      <Pressable onPress={() => router.back()} style={styles.back}><Ionicons name="arrow-back" size={20} color={colors.ink} /></Pressable>
      <View style={[styles.kindIcon, { backgroundColor: meta.tint }]}><Ionicons name={meta.icon as keyof typeof Ionicons.glyphMap} size={20} color={meta.color} /></View>
      <Eyebrow>{meta.title.toUpperCase()} · {artifact.generationMode === 'ai' ? 'AI ASSISTED' : 'ON-DEVICE DRAFT'}</Eyebrow>
      <Text style={uiStyles.heading}>{artifact.title}</Text>
      <Text style={uiStyles.body}>{song.subject} · based on your source notes</Text>
    </View>

    <Card style={[styles.summary, { backgroundColor: meta.tint, borderColor: meta.tint }]}>
      <Text style={styles.summaryLabel}>OVERVIEW</Text>
      <Text style={styles.summaryText}>{artifact.content.summary}</Text>
    </Card>

    {artifact.kind === 'slides' ? <SlideDeck title={artifact.title} sections={artifact.content.sections} width={Math.min(screenWidth - 40, 1060)} screenWidth={screenWidth} screenHeight={screenHeight} /> : null}

    {artifact.kind === 'mindmap' ? <>
      <SectionTitle>Connected ideas</SectionTitle>
      <MindMapDiagram title={artifact.title} sections={artifact.content.sections} width={Math.min(screenWidth - 40, 1060)} color={meta.color} onOpenSource={setActiveSource} />
      <View style={styles.mapActions}><Text style={styles.smallNote}>Use the arrows to open and close branches · drag to move · + and − to zoom</Text><ActionButton title="Open full source notebook" onPress={() => router.push(`/song/${song.id}`)} secondary icon={<Ionicons name="book-outline" size={16} color={colors.purple} />} /></View>
    </> : null}

    {artifact.kind === 'audio' ? <>
      <Card style={styles.audioPlayer}>
        <View style={[styles.audioBadge, { backgroundColor: meta.tint }]}><Ionicons name="headset" size={22} color={meta.color} /></View>
        <Text style={styles.audioTitle}>Audio overview script</Text>
        <Text style={styles.audioCopy}>Review the two-host script below. You can also send it to the connected music service for a vocal study track.</Text>
        {artifact.audioUrl || artifact.audioLocalUri ? <ActionButton title={artifact.audioLocalUri ? 'Play saved vocal track' : 'Open generated track'} onPress={() => void playAudio()} icon={<Ionicons name="play" size={16} color="#FFFFFF" />} /> : null}
        <ActionButton title={busy ? 'Sending to audio service…' : artifact.audioUrl ? 'Generate a new track' : 'Generate vocal study track'} onPress={() => void createAudio()} disabled={busy} secondary icon={<Ionicons name="musical-note" size={16} color={meta.color} />} />
        {audioStatus ? <Text style={styles.audioStatus}>{audioStatus}</Text> : <Text style={styles.smallNote}>The connected provider creates a vocal music track from this script.</Text>}
      </Card>
      <SectionTitle>Conversation script</SectionTitle>
      {artifact.content.sections.map((section, index) => <Card key={`${index}-${section.heading}`} style={styles.scriptCard}>
        <Text style={styles.scriptHeading}>{section.heading}</Text><Text style={styles.sectionBody}>{section.body}</Text><SourceTags points={section.sourcePoints} />
      </Card>)}
    </> : null}

    {artifact.kind === 'video' ? <>
      <StudySceneGallery scenes={artifact.sceneGallery ?? []} busyId={sceneBusyId} message={sceneMessage} onCreate={confirmScenePlan} onRetry={retryScene} onGenerateRemaining={generateRemainingScenes} onRegenerateAll={regenerateAllScenes} />
      {artifact.videoUrl ? <Card style={styles.legacyVideo}><View style={styles.legacyVideoIcon}><Ionicons name="videocam-outline" size={19} color={colors.purple} /></View><View style={{ flex: 1, gap: 3 }}><Text style={styles.audioTitle}>Previously generated video</Text><Text style={styles.smallNote}>This MP4 was saved before the studio changed to scene illustrations.</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Open previously generated video" onPress={() => void openVideo()} style={styles.legacyVideoOpen}><Ionicons name="play" size={18} color="#FFFFFF" /></Pressable></Card> : null}
      {artifact.videoStatus === 'pending' || artifact.videoStatus === 'running' ? <Text style={styles.smallNote}>{videoMessage || 'Checking the previously started video render…'}</Text> : null}
      <SectionTitle>{artifact.content.sections.length} planned concepts</SectionTitle>
      {artifact.content.sections.map((section, index) => <Card key={`${index}-${section.heading}`} style={styles.sceneCard}>
        <SceneArtwork section={section} index={index} />
        <Text style={styles.scriptHeading}>{section.heading}</Text><Text style={styles.sectionBody}>{section.body}</Text><SourceTags points={section.sourcePoints} />
      </Card>)}
    </> : null}

    <Card style={styles.sourceCard}><SectionTitle>Source notebook</SectionTitle><Text style={styles.sourceTitle}>{song.title}</Text><Text style={styles.sourceCopy}>{song.sourceText.trim() || 'Photo source attached. Add typed notes to create a source-cited artifact.'}</Text><Text style={styles.smallNote}>Check names, dates, formulas, and definitions against your original material.</Text></Card>

    <View style={styles.actions}><Pressable onPress={() => void shareArtifact()} style={styles.action}><Ionicons name="share-outline" size={17} color={colors.purple} /><Text style={styles.actionText}>Share text</Text></Pressable><Pressable onPress={confirmDelete} style={[styles.action, styles.delete]}><Ionicons name="trash-outline" size={16} color={colors.danger} /><Text style={[styles.actionText, { color: colors.danger }]}>Delete artifact</Text></Pressable></View>

    <Modal visible={activeSource !== null} transparent animationType="slide" onRequestClose={() => setActiveSource(null)}>
      <View style={styles.sourceModalOverlay}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close source preview" onPress={() => setActiveSource(null)} style={StyleSheet.absoluteFill} />
        <View style={styles.sourceModalCard}>
          <View style={styles.sourceModalTop}><View style={styles.sourceModalIcon}><Ionicons name="document-text" size={18} color={colors.purple} /></View><View style={{ flex: 1, gap: 3 }}><Text style={styles.sourceModalLabel}>SOURCE {activeSource ?? ''}</Text><Text style={styles.sourceModalTitle}>{song.title}</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Close source preview" onPress={() => setActiveSource(null)} style={styles.sourceModalClose}><Ionicons name="close" size={20} color={colors.muted} /></Pressable></View>
          <Text style={styles.sourceModalBody}>{activeSource ? sourceNotes[activeSource - 1] ?? (song.sourceText.trim() || 'This notebook has a photo source but no extracted text yet.') : song.sourceText.trim() || 'This notebook has a photo source but no extracted text yet.'}</Text>
          <ActionButton title="Open full source notebook" onPress={() => { setActiveSource(null); router.push(`/song/${song.id}`); }} icon={<Ionicons name="arrow-forward" size={16} color="#FFFFFF" />} />
        </View>
      </View>
    </Modal>

  </AppScreen>;
}

function SourceTags({ points }: { points: number[] }) {
  if (!points.length) return null;
  return <View style={styles.tags}>{points.map((point) => <View key={point} style={styles.sourceTag}><Ionicons name="link-outline" size={10} color={colors.success} /><Text style={styles.sourceTagText}>Note {point}</Text></View>)}</View>;
}

const artworkPalettes: [string, string][] = [
  ['#0F766E', '#15584F'],
  ['#3E7148', '#375D3E'],
  ['#A65331', '#78462B'],
  ['#376F88', '#2B576D'],
  ['#5F6948', '#4B5C3E'],
];

function artIcon(value: string): keyof typeof Ionicons.glyphMap {
  const text = value.toLowerCase();
  if (/plant|leaf|photosynth|forest|chlorophyll/.test(text)) return 'leaf-outline';
  if (/water|ocean|river|rain|cycle/.test(text)) return 'water-outline';
  if (/space|planet|star|orbit|solar/.test(text)) return 'planet-outline';
  if (/cell|biology|organ|body|species/.test(text)) return 'fitness-outline';
  if (/math|equation|formula|number|geometry/.test(text)) return 'calculator-outline';
  if (/energy|electric|force|motion|power/.test(text)) return 'flash-outline';
  if (/history|century|war|empire|date/.test(text)) return 'time-outline';
  if (/chem|atom|molecule|reaction|element/.test(text)) return 'flask-outline';
  return 'sparkles-outline';
}

function SlideDeck({ title, sections, width, screenWidth, screenHeight }: {
  title: string;
  sections: StudyArtifactNode[];
  width: number;
  screenWidth: number;
  screenHeight: number;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [presenting, setPresenting] = useState(false);
  const inlineRef = useRef<ScrollViewInstance | null>(null);
  const presentationRef = useRef<ScrollViewInstance | null>(null);
  const presentationWidth = Math.max(280, screenWidth - 32);
  const carouselWidth = presenting ? presentationWidth : width;
  const slideHeight = presenting
    ? Math.max(220, Math.min(screenHeight - 250, Math.max(280, presentationWidth * 0.52)))
    : Math.min(460, Math.max(300, width * 0.52));
  const boundedIndex = Math.max(0, Math.min(activeIndex, sections.length - 1));

  useEffect(() => {
    if (!presenting) return;
    const frame = requestAnimationFrame(() => presentationRef.current?.scrollTo({ x: boundedIndex * presentationWidth, animated: false }));
    return () => cancelAnimationFrame(frame);
  }, [boundedIndex, presentationWidth, presenting]);

  const goToSlide = (nextIndex: number) => {
    const next = Math.max(0, Math.min(nextIndex, sections.length - 1));
    setActiveIndex(next);
    const ref = presenting ? presentationRef : inlineRef;
    ref.current?.scrollTo({ x: next * carouselWidth, animated: true });
  };

  const closePresentation = () => {
    setPresenting(false);
    requestAnimationFrame(() => inlineRef.current?.scrollTo({ x: boundedIndex * width, animated: false }));
  };

  const renderCarousel = (fullScreen: boolean) => {
    const currentWidth = fullScreen ? presentationWidth : width;
    const ref = fullScreen ? presentationRef : inlineRef;
    return <ScrollView
      ref={ref}
      style={fullScreen ? styles.presentationScroll : undefined}
      horizontal
      pagingEnabled
      bounces={false}
      showsHorizontalScrollIndicator={false}
      scrollEventThrottle={16}
      onMomentumScrollEnd={(event) => setActiveIndex(Math.round(event.nativeEvent.contentOffset.x / currentWidth))}
    >
      {sections.map((section, index) => <View key={`${index}-${section.heading}`} style={{ width: currentWidth, alignItems: 'center', gap: 9 }}>
        <SlideArtwork section={section} index={index} total={sections.length} topic={title} width={currentWidth} height={slideHeight} />
        <View style={styles.deckSlideSources}><SourceTags points={section.sourcePoints} /></View>
      </View>)}
    </ScrollView>;
  };

  return <View style={styles.deck}>
    <View style={styles.deckHeading}>
      <View style={{ gap: 4 }}><Eyebrow color={colors.purple}>PRESENTATION DECK</Eyebrow><Text style={styles.audioTitle}>{sections.length} designed slides</Text></View>
      <Pressable accessibilityRole="button" onPress={() => setPresenting(true)} style={styles.presentButton}><Ionicons name="expand-outline" size={15} color="#FFFFFF" /><Text style={styles.presentButtonText}>Present</Text></Pressable>
    </View>
    <View style={[styles.deckCarousel, { width }]}>{renderCarousel(false)}</View>
    <View style={styles.deckNavigation}>
      <Pressable accessibilityRole="button" accessibilityLabel="Previous slide" disabled={boundedIndex === 0} onPress={() => goToSlide(boundedIndex - 1)} style={[styles.deckNavButton, boundedIndex === 0 && styles.deckNavDisabled]}><Ionicons name="arrow-back" size={16} color={colors.purple} /><Text style={styles.deckNavText}>Previous</Text></Pressable>
      <Text style={styles.deckPage}>{String(boundedIndex + 1).padStart(2, '0')} / {String(sections.length).padStart(2, '0')}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Next slide" disabled={boundedIndex >= sections.length - 1} onPress={() => goToSlide(boundedIndex + 1)} style={[styles.deckNavButton, boundedIndex >= sections.length - 1 && styles.deckNavDisabled]}><Text style={styles.deckNavText}>Next</Text><Ionicons name="arrow-forward" size={16} color={colors.purple} /></Pressable>
    </View>
    <Text style={styles.smallNote}>Swipe between slides or use Previous and Next.</Text>

    <Modal visible={presenting} animationType="fade" onRequestClose={closePresentation}>
      <View style={styles.presentationStage}>
        <View style={styles.presentationHeader}><View style={{ flex: 1, gap: 3 }}><Text style={styles.presentationLabel}>SLIDE PRESENTATION</Text><Text numberOfLines={1} style={styles.presentationTitle}>{title}</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Close presentation" onPress={closePresentation} style={styles.presentationClose}><Ionicons name="close" size={22} color="#FFFFFF" /></Pressable></View>
        <View style={[styles.presentationCarousel, { height: slideHeight + 34 }]}>{renderCarousel(true)}</View>
        <View style={styles.presentationFooter}>
          <Text style={styles.presentationCount}>Slide {boundedIndex + 1} of {sections.length}</Text>
          <View style={styles.presentationControls}>
            <Pressable accessibilityRole="button" accessibilityLabel="Previous slide" disabled={boundedIndex === 0} onPress={() => goToSlide(boundedIndex - 1)} style={[styles.presentationControl, boundedIndex === 0 && styles.presentationControlDisabled]}><Ionicons name="arrow-back" size={18} color="#FFFFFF" /></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Next slide" disabled={boundedIndex >= sections.length - 1} onPress={() => goToSlide(boundedIndex + 1)} style={[styles.presentationControl, boundedIndex >= sections.length - 1 && styles.presentationControlDisabled]}><Ionicons name="arrow-forward" size={18} color="#FFFFFF" /></Pressable>
          </View>
        </View>
      </View>
    </Modal>
  </View>;
}

function SlideArtwork({ section, index, total, topic, width, height }: { section: { heading: string; body: string; sourcePoints: number[] }; index: number; total: number; topic: string; width: number; height: number }) {
  const [from, to] = artworkPalettes[index % artworkPalettes.length]!;
  const icon = artIcon(`${topic} ${section.heading} ${section.body}`);
  const facts = section.body.split(/\n+/).map((line) => line.trim()).filter(Boolean).slice(0, 3);
  return <LinearGradient colors={[from, to]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.slideArtwork, { width, height, minHeight: 0 }]}>
    <View pointerEvents="none" style={styles.slideOrbLarge} /><View pointerEvents="none" style={styles.slideOrbSmall} />
    <View style={styles.artworkHeader}><Text numberOfLines={1} style={styles.slideKicker}>{topic.toUpperCase()}</Text><View style={styles.slideIcon}><Ionicons name={icon} size={25} color="#FFFFFF" /></View></View>
    <View style={styles.slideContent}><Text style={styles.slideNumber}>SLIDE {String(index + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}</Text><Text style={styles.slideHeading}>{section.heading}</Text>
      {facts.map((fact, factIndex) => <View key={`${factIndex}-${fact}`} style={styles.slideFact}><View style={styles.slideFactDot}><Text style={styles.slideFactNumber}>{String(factIndex + 1).padStart(2, '0')}</Text></View><Text numberOfLines={3} style={styles.slideFactText}>{fact}</Text></View>)}
    </View>
    <View style={styles.slideFooter}><Text style={styles.slideFooterText}>STUDY NOTES · SOURCE GROUNDED</Text><Ionicons name="arrow-forward" size={15} color="#FFFFFF" /></View>
  </LinearGradient>;
}

function SceneArtwork({ section, index }: { section: { heading: string; body: string }; index: number }) {
  const [from, to] = artworkPalettes[(index + 2) % artworkPalettes.length]!;
  const icon = artIcon(`${section.heading} ${section.body}`);
  const cue = /On screen:\s*([^\n]+)/i.exec(section.body)?.[1] ?? 'A visual summary of the key idea';
  return <LinearGradient colors={[from, to]} start={{ x: 0.1, y: 1 }} end={{ x: 0.95, y: 0 }} style={styles.sceneArtwork}>
    <View pointerEvents="none" style={styles.sceneOrb} /><View style={styles.sceneArtworkTop}><Text style={styles.sceneArtworkLabel}>SCENE {String(index + 1).padStart(2, '0')}</Text><Ionicons name="sparkles" size={14} color="rgba(255,255,255,0.82)" /></View>
    <View style={styles.sceneIllustration}><View style={styles.sceneIconRing}><Ionicons name={icon} size={37} color="#FFFFFF" /></View><View style={styles.sceneAccentOne} /><View style={styles.sceneAccentTwo} /></View>
    <Text numberOfLines={2} style={styles.sceneCue}>{cue}</Text>
  </LinearGradient>;
}

function MindMapDiagram({ title, sections, width, color, onOpenSource }: {
  title: string;
  sections: StudyArtifactNode[];
  width: number;
  color: string;
  onOpenSource: (sourcePoint: number) => void;
}) {
  const [rootExpanded, setRootExpanded] = useState(true);
  const [collapsedBranches, setCollapsedBranches] = useState<Set<number>>(() => new Set());
  const viewportHeight = Math.min(620, Math.max(440, width * 1.35));
  const rootWidth = 190;
  const rootHeight = 62;
  const branchWidth = 224;
  const leafWidth = 278;
  const nodeHeight = 102;
  const rowStride = 122;
  const branchX = 260;
  const leafX = 560;
  const graphWidth = 870;
  const hasHierarchy = sections.some((section) => section.children?.length);
  const mapSections: StudyArtifactNode[] = hasHierarchy ? sections : [{
    heading: 'Key ideas',
    body: `${sections.length} connected ideas from the source notes.`,
    sourcePoints: [...new Set(sections.flatMap((section) => section.sourcePoints))],
    children: sections,
  }];
  const prepared = mapSections.map((section) => ({
    section,
    children: section.children?.length ? section.children : [],
  }));
  const visibleBranchCount = rootExpanded ? prepared.length : 0;
  const rowCount = rootExpanded ? prepared.reduce((total, item, index) => total + (collapsedBranches.has(index) ? 1 : Math.max(1, item.children.length)), 0) : 0;
  const graphHeight = Math.max(500, 72 + rowCount * rowStride + visibleBranchCount * 25);
  const initialScale = Math.min(0.9, Math.max(0.68, (width - 24) / graphWidth));
  const rootY = graphHeight / 2 - rootHeight / 2;
  let cursorY = 38;
  const branches: { node: StudyArtifactNode; x: number; y: number; width: number; color: string; id: string; branchIndex: number; expanded: boolean; hasChildren: boolean }[] = [];
  const leaves: { node: StudyArtifactNode; x: number; y: number; width: number; color: string; id: string }[] = [];
  const edges: { fromX: number; fromY: number; toX: number; toY: number; color: string; id: string }[] = [];

  if (rootExpanded) prepared.forEach(({ section, children }, branchIndex) => {
    const expanded = !collapsedBranches.has(branchIndex);
    const visibleChildren = expanded ? children : [];
    const slots = expanded ? Math.max(1, children.length) : 1;
    const blockHeight = slots * rowStride;
    const branchY = cursorY + blockHeight / 2 - nodeHeight / 2;
    const branchColor = artworkPalettes[branchIndex % artworkPalettes.length]![0];
    branches.push({ node: section, x: branchX, y: branchY, width: branchWidth, color: branchColor, id: `branch-${branchIndex}`, branchIndex, expanded, hasChildren: children.length > 0 });
    edges.push({ fromX: 28 + rootWidth, fromY: rootY + rootHeight / 2, toX: branchX, toY: branchY + nodeHeight / 2, color: `${color}A8`, id: `root-${branchIndex}` });
    visibleChildren.forEach((child, childIndex) => {
      const childY = cursorY + childIndex * rowStride + (rowStride - nodeHeight) / 2;
      leaves.push({ node: child, x: leafX, y: childY, width: leafWidth, color: '#365B48', id: `leaf-${branchIndex}-${childIndex}` });
      edges.push({ fromX: branchX + branchWidth, fromY: branchY + nodeHeight / 2, toX: leafX, toY: childY + nodeHeight / 2, color: '#6E9C88', id: `branch-${branchIndex}-${childIndex}` });
    });
    cursorY += blockHeight + 25;
  });

  const viewRef = useRef({
    x: Math.max(8, (width - graphWidth * initialScale) / 2),
    y: 12,
    scale: initialScale,
  });
  const dragStart = useRef({ x: viewRef.current.x, y: viewRef.current.y });
  const [view, setView] = useState(viewRef.current);
  const updateView = (next: typeof viewRef.current) => { viewRef.current = next; setView(next); };
  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 4 || Math.abs(gesture.dy) > 4,
    onMoveShouldSetPanResponderCapture: (_, gesture) => Math.abs(gesture.dx) > 4 || Math.abs(gesture.dy) > 4,
    onPanResponderGrant: () => { dragStart.current = { x: viewRef.current.x, y: viewRef.current.y }; },
    onPanResponderMove: (_, gesture) => updateView({ ...viewRef.current, x: dragStart.current.x + gesture.dx, y: dragStart.current.y + gesture.dy }),
    onPanResponderTerminationRequest: () => false,
    onPanResponderRelease: () => undefined,
  })).current;

  const changeZoom = (amount: number) => updateView({ ...viewRef.current, scale: Math.min(1.25, Math.max(0.28, viewRef.current.scale + amount)) });
  const resetView = () => updateView({
    x: Math.max(8, (width - graphWidth * initialScale) / 2),
    y: 12,
    scale: initialScale,
  });
  const fitView = () => {
    const scale = Math.min((width - 28) / graphWidth, (viewportHeight - 30) / graphHeight, 0.9);
    const fittedScale = Math.max(0.28, scale);
    updateView({ x: Math.max(8, (width - graphWidth * fittedScale) / 2), y: Math.max(8, (viewportHeight - graphHeight * fittedScale) / 2), scale: fittedScale });
  };

  const renderNode = (node: { node: StudyArtifactNode; x: number; y: number; width: number; color: string; id: string; branchIndex?: number; expanded?: boolean; hasChildren?: boolean }, level: 'branch' | 'leaf') => {
    const nodeColor = node.color;
    const points = node.node.sourcePoints.slice(0, level === 'branch' ? 1 : 2);
    return <View key={node.id} style={[styles.graphNode, { left: node.x * view.scale, top: node.y * view.scale, width: node.width * view.scale, minHeight: nodeHeight * view.scale, paddingHorizontal: 10 * view.scale, paddingVertical: 8 * view.scale, borderRadius: 12 * view.scale, borderWidth: view.scale, gap: 4 * view.scale, backgroundColor: nodeColor, borderColor: `${nodeColor}E0` }]}>
      <View style={[styles.graphNodeHeading, { gap: 7 * view.scale }]}><View style={[styles.graphNodeIcon, { width: 20 * view.scale, height: 20 * view.scale, borderRadius: 7 * view.scale }]}><Ionicons name={artIcon(`${node.node.heading} ${node.node.body}`)} size={13 * view.scale} color="#D7E8DF" /></View><Text numberOfLines={2} style={[styles.graphNodeTitle, { fontSize: 11 * view.scale, lineHeight: 14 * view.scale }]}>{node.node.heading}</Text>{level === 'branch' && node.hasChildren ? <Pressable accessibilityRole="button" accessibilityState={{ expanded: node.expanded }} accessibilityLabel={`${node.expanded ? 'Close' : 'Open'} ${node.node.heading} cards`} hitSlop={8} onPress={() => setCollapsedBranches((current) => { const next = new Set(current); const index = node.branchIndex ?? 0; if (node.expanded) next.add(index); else next.delete(index); return next; })} style={[styles.graphToggleButton, { width: 22 * view.scale, height: 22 * view.scale, borderRadius: 7 * view.scale }]}><Ionicons name={node.expanded ? 'chevron-down' : 'chevron-forward'} size={14 * view.scale} color="#D7E8DF" /></Pressable> : null}</View>
      {node.node.body ? <Text numberOfLines={2} style={[styles.graphNodeBody, { fontSize: 8 * view.scale, lineHeight: 11 * view.scale, paddingLeft: 27 * view.scale }]}>{node.node.body}</Text> : null}
      {points.length ? <View style={[styles.graphSourceButtons, { gap: 5 * view.scale, paddingLeft: 27 * view.scale, marginTop: 2 * view.scale }]}>{points.map((point) => <Pressable key={point} accessibilityRole="button" accessibilityLabel={`Open source note ${point}`} hitSlop={8} onPress={() => onOpenSource(point)} style={[styles.graphSourceButton, { gap: 3 * view.scale, paddingHorizontal: 6 * view.scale, paddingVertical: 4 * view.scale, borderRadius: 5 * view.scale }]}><Ionicons name="open-outline" size={10 * view.scale} color="#C3DED0" /><Text style={[styles.graphSourceText, { fontSize: 7 * view.scale }]}>{`Source ${point}`}</Text></Pressable>)}</View> : null}
    </View>;
  };

  return <View style={[styles.mapViewport, { width, height: viewportHeight }]} {...panResponder.panHandlers}>
    <View style={[styles.mapWorld, { left: view.x, top: view.y, width: graphWidth * view.scale, height: graphHeight * view.scale }]}>
      {edges.map((edge) => bezierSegments(edge.fromX, edge.fromY, edge.toX, edge.toY).map((segment, index) => <View key={`${edge.id}-${index}`} pointerEvents="none" style={[styles.mapCurve, { left: segment.left * view.scale, top: segment.top * view.scale, width: segment.width * view.scale, height: Math.max(1, 2 * view.scale), backgroundColor: edge.color, transform: [{ rotate: `${segment.angle}rad` }] }]} />))}
      <View style={[styles.graphNode, styles.graphRootNode, { left: 28 * view.scale, top: rootY * view.scale, width: rootWidth * view.scale, minHeight: rootHeight * view.scale, paddingHorizontal: 10 * view.scale, paddingVertical: 8 * view.scale, borderRadius: 13 * view.scale, borderWidth: view.scale, gap: 8 * view.scale, backgroundColor: colors.purpleDark }]}>
        <View style={[styles.graphNodeHeading, { gap: 7 * view.scale }]}><Ionicons name="book" size={16 * view.scale} color="#FFFFFF" /><Text numberOfLines={2} style={[styles.graphNodeTitle, { fontSize: 10 * view.scale, lineHeight: 13 * view.scale }]}>{title}</Text><Pressable accessibilityRole="button" accessibilityState={{ expanded: rootExpanded }} accessibilityLabel={rootExpanded ? 'Close all mind map branches' : 'Open all mind map branches'} hitSlop={8} onPress={() => { if (rootExpanded) setRootExpanded(false); else { setCollapsedBranches(new Set()); setRootExpanded(true); } }} style={[styles.graphToggleButton, { width: 22 * view.scale, height: 22 * view.scale, borderRadius: 6 * view.scale }]}><Ionicons name={rootExpanded ? 'chevron-down' : 'chevron-forward'} size={14 * view.scale} color="#D7E8DF" /></Pressable></View>
        <Pressable accessibilityRole="button" accessibilityLabel="Open source note 1" hitSlop={8} onPress={() => onOpenSource(1)} style={[styles.graphRootSource, { gap: 4 * view.scale, marginLeft: 27 * view.scale, paddingHorizontal: 7 * view.scale, paddingVertical: 4 * view.scale, borderRadius: 5 * view.scale }]}><Ionicons name="open-outline" size={10 * view.scale} color="#DDEBE4" /><Text style={[styles.graphSourceText, { fontSize: 7 * view.scale }]}>Open source</Text></Pressable>
      </View>
      {branches.map((node) => renderNode(node, 'branch'))}
      {leaves.map((node) => renderNode(node, 'leaf'))}
    </View>
    <View style={styles.mapZoomTools}>
      <Pressable accessibilityRole="button" accessibilityLabel="Fit whole mind map" onPress={fitView} style={styles.mapZoomButton}><Ionicons name="scan-outline" size={17} color="#E9EDF0" /></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Zoom in" onPress={() => changeZoom(0.1)} style={styles.mapZoomButton}><Ionicons name="add" size={20} color="#E9EDF0" /></Pressable>
      <Text style={styles.mapZoomValue}>{Math.round(view.scale * 100)}%</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Zoom out" onPress={() => changeZoom(-0.1)} style={styles.mapZoomButton}><Ionicons name="remove" size={20} color="#E9EDF0" /></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Reset mind map position" onPress={resetView} style={styles.mapZoomButton}><Ionicons name="locate-outline" size={16} color="#E9EDF0" /></Pressable>
    </View>
  </View>;
}

function bezierSegments(x1: number, y1: number, x2: number, y2: number) {
  const steps = 14;
  const dx = x2 - x1;
  const cx1 = x1 + dx * 0.52;
  const cx2 = x2 - dx * 0.52;
  const pointAt = (t: number) => {
    const inverse = 1 - t;
    return {
      x: inverse ** 3 * x1 + 3 * inverse ** 2 * t * cx1 + 3 * inverse * t ** 2 * cx2 + t ** 3 * x2,
      y: inverse ** 3 * y1 + 3 * inverse ** 2 * t * y1 + 3 * inverse * t ** 2 * y2 + t ** 3 * y2,
    };
  };
  const segments = [];
  let previous = pointAt(0);
  for (let index = 1; index <= steps; index += 1) {
    const next = pointAt(index / steps);
    const length = Math.hypot(next.x - previous.x, next.y - previous.y);
    segments.push({
      left: (previous.x + next.x) / 2 - length / 2,
      top: (previous.y + next.y) / 2 - 1,
      width: length,
      angle: Math.atan2(next.y - previous.y, next.x - previous.x),
    });
    previous = next;
  }
  return segments;
}

const styles = StyleSheet.create({
  top: { gap: 9 },
  back: { width: 44, height: 44, marginBottom: 2, borderRadius: 16, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  kindIcon: { width: 48, height: 48, borderRadius: 17, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  summary: { padding: 20, gap: 9, borderRadius: 22 },
  summaryLabel: { color: colors.purpleDark, fontSize: 10, letterSpacing: 1.3, fontWeight: '900' },
  summaryText: { color: colors.ink, fontSize: 15, lineHeight: 23, fontWeight: '600' },
  deck: { gap: 14 },
  deckHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  presentButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 16, borderRadius: 15, backgroundColor: colors.midnight },
  presentButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  deckCarousel: { alignSelf: 'center', overflow: 'hidden', borderRadius: 25, backgroundColor: colors.midnight },
  deckSlideSources: { minHeight: 28, alignSelf: 'flex-start', paddingHorizontal: 8 },
  deckNavigation: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  deckNavButton: { minHeight: 44, minWidth: 108, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 12, borderRadius: 15, backgroundColor: colors.softPurple },
  deckNavDisabled: { opacity: 0.38 },
  deckNavText: { color: colors.purpleDark, fontSize: 12, fontWeight: '800' },
  deckPage: { color: colors.ink, fontSize: 12, fontWeight: '900', letterSpacing: 1 },
  presentationStage: { flex: 1, justifyContent: 'space-between', paddingHorizontal: 18, paddingTop: 48, paddingBottom: 28, backgroundColor: colors.midnight },
  presentationHeader: { flexDirection: 'row', alignItems: 'center', gap: 13, minHeight: 58 },
  presentationLabel: { color: colors.lime, fontSize: 10, fontWeight: '900', letterSpacing: 1.4 },
  presentationTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: '800' },
  presentationClose: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.12)' },
  presentationCarousel: { justifyContent: 'center', overflow: 'hidden' },
  presentationScroll: { flex: 1 },
  presentationFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 54 },
  presentationCount: { color: '#C7CFD4', fontSize: 12, fontWeight: '700' },
  presentationControls: { flexDirection: 'row', gap: 10 },
  presentationControl: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 17, backgroundColor: colors.purple },
  presentationControlDisabled: { opacity: 0.35 },
  slide: { padding: 0, gap: 0, borderRadius: 25, overflow: 'hidden' },
  slideArtwork: { minHeight: 285, padding: 22, justifyContent: 'space-between', overflow: 'hidden' },
  slideOrbLarge: { position: 'absolute', width: 210, height: 210, borderRadius: 105, top: -86, right: -48, backgroundColor: 'rgba(255,255,255,0.11)' },
  slideOrbSmall: { position: 'absolute', width: 82, height: 82, borderRadius: 41, right: 92, bottom: 15, backgroundColor: 'rgba(255,255,255,0.08)' },
  artworkHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  slideKicker: { color: 'rgba(255,255,255,0.76)', fontSize: 9, letterSpacing: 1, fontWeight: '800', flex: 1 },
  slideIcon: { width: 45, height: 45, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.18)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)' },
  slideContent: { gap: 13, marginVertical: 22 },
  slideNumber: { color: 'rgba(255,255,255,0.76)', fontSize: 10, letterSpacing: 1.2, fontWeight: '900' },
  slideHeading: { color: '#FFFFFF', fontSize: 27, lineHeight: 33, fontWeight: '900', letterSpacing: -0.65 },
  slideFact: { flexDirection: 'row', alignItems: 'flex-start', gap: 11, padding: 13, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  slideFactDot: { width: 25, height: 25, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.2)' },
  slideFactNumber: { color: '#FFFFFF', fontSize: 9, fontWeight: '900' },
  slideFactText: { flex: 1, color: '#FFFFFF', fontSize: 13, lineHeight: 19, fontWeight: '600' },
  slideFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.24)' },
  slideFooterText: { color: 'rgba(255,255,255,0.8)', fontSize: 9, letterSpacing: 0.85, fontWeight: '900' },
  slideSources: { paddingHorizontal: 14, paddingVertical: 12 },
  sectionBody: { color: colors.ink, fontSize: 14, lineHeight: 22 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 3 },
  sourceTag: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 6, borderRadius: radii.pill, backgroundColor: colors.softMint },
  sourceTagText: { color: colors.success, fontSize: 10, fontWeight: '800' },
  mapViewport: { alignSelf: 'center', position: 'relative', backgroundColor: colors.midnight, borderRadius: 22, overflow: 'hidden', borderWidth: 1, borderColor: '#36564B' },
  mapWorld: { position: 'absolute', left: 0, top: 0 },
  mapCurve: { position: 'absolute', height: 2, borderRadius: 2 },
  graphNode: { position: 'absolute', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 5, borderWidth: 1, gap: 4, elevation: 2 },
  graphRootNode: { justifyContent: 'center', gap: 8, borderColor: '#9ACBB8' },
  graphNodeHeading: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  graphToggleButton: { alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.13)' },
  graphNodeIcon: { width: 20, height: 20, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  graphNodeTitle: { flex: 1, color: '#FFFFFF', fontSize: 10, lineHeight: 13, fontWeight: '700' },
  graphNodeBody: { color: '#E1ECE5', fontSize: 9, lineHeight: 12, paddingLeft: 27 },
  graphSourceButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, paddingLeft: 27, marginTop: 2 },
  graphSourceButton: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 4, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.1)' },
  graphSourceText: { color: '#E0EEE4', fontSize: 7, fontWeight: '700' },
  graphRootSource: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 27, paddingHorizontal: 7, paddingVertical: 4, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.12)' },
  mapZoomTools: { position: 'absolute', right: 11, bottom: 11, alignItems: 'center', gap: 6, padding: 6, borderRadius: 20, backgroundColor: 'rgba(17,43,37,0.97)', borderWidth: 1, borderColor: '#426255' },
  mapZoomButton: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#294C41' },
  mapZoomValue: { color: '#E4EEE7', fontSize: 10, fontWeight: '800' },
  mapActions: { gap: 11, alignItems: 'stretch' },
  sourceModalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(10,14,18,0.52)' },
  sourceModalCard: { gap: 16, padding: 22, paddingBottom: 30, borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: colors.surface },
  sourceModalTop: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  sourceModalIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.softPurple },
  sourceModalLabel: { color: colors.purple, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  sourceModalTitle: { color: colors.ink, fontSize: 15, fontWeight: '800' },
  sourceModalClose: { width: 40, height: 40, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.canvas },
  sourceModalBody: { color: colors.ink, fontSize: 15, lineHeight: 23, padding: 16, borderRadius: 17, backgroundColor: colors.canvas },
  audioPlayer: { alignItems: 'center', padding: 22, gap: 13 },
  audioBadge: { width: 64, height: 64, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  audioTitle: { color: colors.ink, fontSize: 16, fontWeight: '900' },
  audioCopy: { color: colors.muted, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  audioStatus: { color: colors.success, fontSize: 12, fontWeight: '700', textAlign: 'center' },
  smallNote: { color: colors.muted, fontSize: 11, lineHeight: 17, textAlign: 'center' },
  scriptCard: { gap: 11, padding: 18 },
  scriptHeading: { color: colors.ink, fontSize: 16, fontWeight: '900' },
  videoIntro: { flexDirection: 'row', gap: 13, alignItems: 'center', padding: 17 },
  videoPlayer: { alignItems: 'stretch', padding: 18, gap: 14 },
  videoThumbnail: { width: '100%', height: 190, borderRadius: 16, backgroundColor: colors.softPurple },
  videoStatus: { color: colors.success, fontSize: 12, fontWeight: '700', textAlign: 'center', flexShrink: 1 },
  videoError: { color: colors.danger, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  videoProgress: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, minHeight: 25 },
  videoBadge: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  legacyVideo: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  legacyVideoIcon: { width: 40, height: 40, borderRadius: 13, backgroundColor: colors.softPurple, alignItems: 'center', justifyContent: 'center' },
  legacyVideoOpen: { width: 40, height: 40, borderRadius: 13, backgroundColor: colors.purple, alignItems: 'center', justifyContent: 'center' },
  sceneCard: { padding: 16, gap: 12 },
  sceneArtwork: { minHeight: 210, borderRadius: 19, padding: 18, alignItems: 'center', justifyContent: 'space-between', overflow: 'hidden' },
  sceneOrb: { position: 'absolute', width: 165, height: 165, borderRadius: 83, top: -45, right: -40, backgroundColor: 'rgba(255,255,255,0.13)' },
  sceneArtworkTop: { width: '100%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sceneArtworkLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 8, letterSpacing: 1, fontWeight: '800' },
  sceneIllustration: { width: 84, height: 84, alignItems: 'center', justifyContent: 'center' },
  sceneIconRing: { width: 72, height: 72, borderRadius: 25, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.18)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.34)' },
  sceneAccentOne: { position: 'absolute', width: 18, height: 18, borderRadius: 9, right: 0, top: 3, backgroundColor: 'rgba(255,255,255,0.68)' },
  sceneAccentTwo: { position: 'absolute', width: 12, height: 12, borderRadius: 6, left: 2, bottom: 6, backgroundColor: 'rgba(255,255,255,0.48)' },
  sceneCue: { width: '100%', color: '#FFFFFF', fontSize: 12, lineHeight: 17, textAlign: 'center', fontWeight: '800' },
  sourceCard: { padding: 18, gap: 11 },
  sourceTitle: { color: colors.ink, fontSize: 15, fontWeight: '800' },
  sourceCopy: { color: colors.muted, fontSize: 13, lineHeight: 20 },
  actions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 3 },
  action: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 9, paddingHorizontal: 12, borderRadius: 14, backgroundColor: colors.softPurple },
  delete: { marginLeft: 'auto' },
  actionText: { color: colors.purple, fontSize: 11, fontWeight: '800' },
});
