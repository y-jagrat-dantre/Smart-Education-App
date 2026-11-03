import { useState } from 'react';
import { ActivityIndicator, Alert, Image, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { ActionButton, AppScreen, Card, Chip, Eyebrow, SectionTitle, uiStyles } from '@/components/ui';
import { colors, radii } from '@/theme/colors';
import { makeLocalLyrics, titleFromNotes } from '@/features/learning/content';
import { decodedBase64ByteLength, pdfByteLength, MAX_PDF_BYTES } from '@/features/learning/base64';
import { extractImageNotes, extractPdfNotes, generateLyrics, hasBackend } from '@/services/api';
import { useAppStore, type StudyLanguage } from '@/state/app-store';
import { useAuth } from '@/state/auth';

const stylesList = ['Study rap', 'Pop', 'Acoustic', 'Mnemonic'];
const languages: { code: StudyLanguage; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिन्दी · Hindi' },
];
const sample = `Photosynthesis is the process by which green plants use sunlight to make food. Chlorophyll in the leaves absorbs light energy. Plants take in carbon dioxide from the air and water from the soil. Glucose is produced, and oxygen is released. The process happens mainly in the leaves.`;

export default function CreateScreen() {
  const [notes, setNotes] = useState('');
  const [subject, setSubject] = useState('');
  const [style, setStyle] = useState(stylesList[0]);
  const [language, setLanguage] = useState<StudyLanguage>('en');
  const [image, setImage] = useState<{ uri: string; base64: string; mimeType: string } | null>(null);
  const [pdfName, setPdfName] = useState<string | null>(null);
  const [pdfStatus, setPdfStatus] = useState('');
  const [extractingPdf, setExtractingPdf] = useState(false);
  const [photoStatus, setPhotoStatus] = useState('');
  const [extractingPhoto, setExtractingPhoto] = useState(false);
  const [loading, setLoading] = useState(false);
  const addSong = useAppStore((state) => state.addSong);
  const { user } = useAuth();
  const isHindi = language === 'hi';

  const chooseImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Photo access needed', 'Allow photo access to attach a page of notes.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, quality: 0.72, base64: true });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    if (!asset.base64) {
      Alert.alert('Could not read this image', 'Choose another photo or paste the notes as text.');
      return;
    }
    setImage({ uri: asset.uri, base64: asset.base64, mimeType: asset.mimeType ?? 'image/jpeg' });
    setPhotoStatus('');
  };

  const extractPhotoText = async () => {
    if (!image) return;
    if (!hasBackend) {
      Alert.alert('Connect the AI service', 'Photo text extraction needs the connected Gemini backend. Start the backend and configure GEMINI_API_KEY in backend/.env.');
      return;
    }
    setExtractingPhoto(true);
    setPhotoStatus('Sending the page to Gemini… this can take up to 2 minutes.');
    try {
      const extractedNotes = await extractImageNotes(image.base64, image.mimeType);
      const applyNotes = () => {
        setNotes(extractedNotes);
        setPdfName(null);
        setPdfStatus('');
        setSubject((current) => current.trim() || titleFromNotes(extractedNotes));
        setPhotoStatus('Text extracted. Review and edit it above.');
      };
      if (notes.trim()) {
        setPhotoStatus('Photo text extracted. Choose whether to replace your current notes.');
        Alert.alert('Replace current notes?', 'Text extracted from this photo will replace the notes in the editor.', [
          { text: 'Keep current notes', style: 'cancel', onPress: () => setPhotoStatus('Your current notes were kept.') },
          { text: 'Use photo text', onPress: applyNotes },
        ]);
      } else applyNotes();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not extract text from this photo. Try a sharper, well-lit page image.';
      setPhotoStatus(message);
      Alert.alert('Could not extract photo text', message);
    } finally {
      setExtractingPhoto(false);
    }
  };

  const runPdfExtraction = async (fileName: string, base64: string) => {
    setExtractingPdf(true);
    setPdfStatus(`Sending ${fileName} to Gemini… this can take up to 2 minutes.`);
    try {
      const extractedNotes = await extractPdfNotes(fileName, base64);
      setNotes(extractedNotes);
      setPdfName(fileName);
      setPdfStatus('Notes extracted. Review and edit them above before creating your notebook.');
      setSubject((current) => current.trim() || fileName.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ').slice(0, 80));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not read this PDF. Try a text-based file under 5 MB.';
      setPdfStatus(message);
      Alert.alert('Could not read PDF', message);
    } finally {
      setExtractingPdf(false);
    }
  };

  const choosePdf = async () => {
    if (!hasBackend) {
      Alert.alert('Connect the AI service', 'PDF and photo extraction need the connected backend. Local Expo development usually detects the backend URL automatically; for production or tunnel mode, set EXPO_PUBLIC_API_URL. Configure GEMINI_API_KEY on the backend, or paste your notes directly.');
      return;
    }
    try {
      let fileName: string;
      let mimeType: string | undefined;
      let encoded: string | undefined;
      let reportedSize: number | undefined;
      let selectedFile: File | null = null;
      if (Platform.OS === 'web') {
        const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', base64: true });
        if (result.canceled || !result.assets[0]) return;
        const asset = result.assets[0];
        fileName = asset.name;
        mimeType = asset.mimeType;
        encoded = asset.base64;
        reportedSize = asset.size;
      } else {
        const result = await File.pickFileAsync({ mimeTypes: ['application/pdf'] });
        if (result.canceled || !result.result) return;
        const file = result.result;
        fileName = file.name;
        mimeType = file.type;
        selectedFile = file;
        reportedSize = file.size;
      }
      const isPdf = mimeType === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf');
      if (!isPdf) {
        Alert.alert('Choose a PDF', 'This file does not appear to be a PDF.');
        return;
      }
      if (!encoded && selectedFile) encoded = await selectedFile.base64();
      const base64 = encoded?.replace(/^data:[^,]*;base64,/i, '').replace(/\s/g, '');
      if (!base64) throw new Error('Could not read this PDF. Choose another file and try again.');
      const actualBytes = decodedBase64ByteLength(base64);
      if (actualBytes === null) throw new Error('The selected file could not be read as valid PDF data. Choose it again and try once more.');
      const selectedBytes = pdfByteLength(reportedSize, base64);
      if (selectedBytes === null) throw new Error('The selected file size could not be verified. Choose it again and try once more.');
      if (selectedBytes > MAX_PDF_BYTES) throw new Error(`This PDF is ${(selectedBytes / (1024 * 1024)).toFixed(1)} MB. The limit is 5 MB.`);
      if (notes.trim()) {
        Alert.alert('Replace current notes?', `Notes extracted from “${fileName}” will replace the text in the editor.`, [
          { text: 'Keep current notes', style: 'cancel' },
          { text: 'Extract PDF notes', onPress: () => { void runPdfExtraction(fileName, base64); } },
        ]);
      } else {
        await runPdfExtraction(fileName, base64);
      }
    } catch (error) {
      const rawMessage = error instanceof Error ? error.message : 'The PDF could not be opened.';
      const message = /missing.*read permission|permission.*read/i.test(rawMessage)
        ? 'The selected PDF is in a protected location. Save a local copy in Files or Downloads, then choose it again.'
        : rawMessage;
      setPdfStatus(message);
      Alert.alert('Could not open PDF', message);
    }
  };

  const createDraft = async () => {
    const source = notes.trim();
    if (source.length < 25 && !image) {
      Alert.alert('Add your study material', 'Paste a few lines of notes, attach a photo, or import a PDF to extract editable notes.');
      return;
    }
    const title = subject.trim() || (source ? titleFromNotes(source) : 'Photo notes');
    setLoading(true);
    try {
      let lyrics: string | null = null;
      let generationMode: 'local' | 'ai' = 'local';
      try {
        lyrics = await generateLyrics(source, title, style, language, image ? { base64: image.base64, mimeType: image.mimeType } : undefined);
      } catch (error) {
        if (!source) {
          const reason = error instanceof Error ? error.message : 'Reconnect the AI lyric service and try again.';
          throw new Error(`Photo-only drafts need AI text extraction. Paste the note text to create a local draft. ${reason}`);
        }
      }
      if (lyrics) generationMode = 'ai';
      if (!lyrics) {
        if (!source) throw new Error('Photo text extraction needs the connected Gemini service. Paste the text from the page to make a local draft.');
        lyrics = makeLocalLyrics(title, source, language);
      }
      const id = `${Date.now()}`;
      addSong({ id, ownerId: user?.id, title, subject: subject.trim() || 'My notes', style, language, sourceText: source, sourceImageUri: image?.uri, lyrics, createdAt: new Date().toISOString(), saved: false, generationMode });
      router.push(`/song/${id}`);
    } catch (error) {
      Alert.alert('Could not make lyrics', error instanceof Error ? error.message : 'Try again or use the local draft.');
    } finally {
      setLoading(false);
    }
  };

  return <AppScreen>
    <View style={styles.top}><Eyebrow>YOUR STUDY STUDIO · STEP 1 OF 3</Eyebrow><Text style={uiStyles.heading}>{isHindi ? 'हिन्दी में गीत बनाएँ' : 'Make a study song'}</Text><Text style={uiStyles.body}>{isHindi ? 'अपने नोट्स से हिन्दी गीत के बोल बनाएँ। हर पंक्ति को सहेजने से पहले संपादित कर सकते हैं।' : 'Start with your own material. Your notes become the lyrics, so every important detail stays connected to its source.'}</Text></View>

    <View style={styles.steps}><View style={[styles.step, styles.stepActive]}><Text style={styles.stepNumberActive}>01</Text><Text style={styles.stepTextActive}>ADD NOTES</Text></View><View style={styles.stepLine} /><View style={styles.step}><Text style={styles.stepNumber}>02</Text><Text style={styles.stepText}>CHOOSE A SOUND</Text></View><View style={styles.stepLine} /><View style={styles.step}><Text style={styles.stepNumber}>03</Text><Text style={styles.stepText}>MAKE A SONG</Text></View></View>

    <Card style={styles.inputCard}>
      <SectionTitle>Start with the source</SectionTitle>
      <Text style={styles.fieldLabel}>Topic or chapter <Text style={styles.optional}>(optional)</Text></Text>
      <TextInput accessibilityLabel="Topic or chapter" value={subject} onChangeText={setSubject} placeholder="e.g. Photosynthesis" placeholderTextColor={colors.muted} style={styles.subjectInput} returnKeyType="next" />
      <Text style={styles.fieldLabel}>Your notes</Text>
      <TextInput accessibilityLabel="Your class notes" value={notes} onChangeText={(value) => { setNotes(value); if (pdfName) { setPdfName(null); setPdfStatus(''); } }} placeholder="Paste class notes, a textbook excerpt, or key facts…" placeholderTextColor={colors.muted} style={styles.notesInput} multiline textAlignVertical="top" maxLength={12000} />
      <View style={styles.inputMeta}><Text style={styles.counter}>{notes.length.toLocaleString()} / 12,000</Text><Pressable accessibilityRole="button" hitSlop={6} onPress={() => { setNotes(sample); setPdfName(null); setPdfStatus(''); }}><Text style={styles.sampleLink}>Try sample notes</Text></Pressable></View>
      {image ? <View style={styles.imagePreview}>
        <Image source={{ uri: image.uri }} style={styles.thumbnail} />
        <View style={styles.photoCopy}>
          <Text style={styles.photoTitle}>Page photo attached</Text>
          <Text style={[styles.photoMeta, photoStatus.startsWith('Text extracted') ? styles.pdfSuccess : photoStatus.startsWith('Sending') ? styles.pdfWorking : photoStatus ? styles.pdfError : null]}>{photoStatus || 'Extract the page text into editable notes.'}</Text>
          <Pressable accessibilityRole="button" accessibilityState={{ disabled: extractingPhoto || extractingPdf || loading, busy: extractingPhoto }} disabled={extractingPhoto || extractingPdf || loading} onPress={() => void extractPhotoText()} style={({ pressed }) => [styles.photoExtract, pressed && !extractingPhoto && styles.pdfPressed, (extractingPhoto || extractingPdf || loading) && styles.pdfDisabled]}>
            {extractingPhoto ? <ActivityIndicator size="small" color={colors.purple} /> : <Ionicons name="scan-outline" size={15} color={colors.purple} />}
            <Text style={styles.photoExtractText}>{extractingPhoto ? 'Extracting text…' : 'Extract text'}</Text>
          </Pressable>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Remove attached photo" hitSlop={10} onPress={() => { setImage(null); setPhotoStatus(''); }}><Ionicons name="close-circle" size={22} color={colors.muted} /></Pressable>
      </View> : <Pressable accessibilityRole="button" onPress={chooseImage} style={({ pressed }) => [styles.attach, pressed && styles.pdfPressed]}><Ionicons name="image-outline" size={18} color={colors.purple} /><Text style={styles.attachText}>Add a photo of your notes</Text><Ionicons name="add" size={18} color={colors.muted} /></Pressable>}
      <Pressable accessibilityRole="button" accessibilityState={{ disabled: extractingPdf || extractingPhoto || loading, busy: extractingPdf }} disabled={extractingPdf || extractingPhoto || loading} onPress={() => void choosePdf()} style={({ pressed }) => [styles.pdfAttach, pressed && !extractingPdf && !extractingPhoto && !loading && styles.pdfPressed, (extractingPdf || extractingPhoto || loading) && styles.pdfDisabled]}>
        {extractingPdf ? <ActivityIndicator size="small" color={colors.purple} /> : <Ionicons name="document-text-outline" size={18} color={colors.purple} />}
        <View style={styles.pdfCopy}><Text style={styles.attachText}>{pdfName ? 'Import another PDF' : 'Import a PDF to extract notes'}</Text><Text style={styles.pdfMeta}>{pdfName ?? 'PDFs up to 5 MB · connected AI service required'}</Text>{pdfStatus ? <Text style={[styles.pdfMeta, extractingPdf ? styles.pdfWorking : pdfStatus.startsWith('Notes extracted') ? styles.pdfSuccess : styles.pdfError]}>{pdfStatus}</Text> : null}</View>
        {!extractingPdf ? <Ionicons name="arrow-forward" size={17} color={colors.purple} /> : null}
      </Pressable>
      <Text style={styles.pdfPrivacy}>The PDF is sent to the connected AI service for extraction. Only the extracted text is saved in your notebook.</Text>
    </Card>

    <Card style={styles.styleCard}>
      <SectionTitle>2. Choose output language</SectionTitle>
      <Text style={styles.smallCopy}>{isHindi ? 'बोल देवनागरी हिन्दी में बनेंगे और आवाज़ भी हिन्दी में होगी।' : 'Lyrics and generated vocals will use English.'}</Text>
      <View style={styles.chips}>{languages.map((item) => <Chip key={item.code} selected={language === item.code} onPress={() => setLanguage(item.code)}>{item.label}</Chip>)}</View>
    </Card>

    <Card style={styles.styleCard}>
      <SectionTitle>3. Choose a sound</SectionTitle>
      <Text style={styles.smallCopy}>{isHindi ? 'अपने हिन्दी गीत की शैली चुनें।' : 'Select a style for your lyric draft.'}</Text>
      <View style={styles.chips}>{stylesList.map((item) => <Chip key={item} selected={style === item} onPress={() => setStyle(item)}>{item}</Chip>)}</View>
    </Card>

    <View style={styles.actionArea}>
      <ActionButton title={loading ? (isHindi ? 'गीत के बोल बना रहे हैं…' : 'Making your draft…') : (isHindi ? 'हिन्दी गीत के बोल बनाएँ' : 'Create lyric draft')} onPress={createDraft} disabled={loading || extractingPdf || extractingPhoto} icon={<Ionicons name="sparkles" size={17} color="#FFFFFF" />} />
      <Text style={styles.privacy}><Ionicons name="lock-closed-outline" size={12} color={colors.muted} /> Notes stay on this device unless you send them to the connected AI service.</Text>
    </View>
    <View style={styles.info}><Ionicons name="information-circle-outline" size={17} color={colors.purple} /><Text style={styles.infoText}>If the free lyric service is unavailable, typed notes still create a local draft. Hindi local drafts keep study facts in their original wording and add a Hindi refrain.</Text></View>
  </AppScreen>;
}

const styles = StyleSheet.create({
  top: { gap: 7, marginBottom: 2 },
  steps: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 2 },
  step: { minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 5 },
  stepActive: { paddingHorizontal: 9, borderRadius: 12, backgroundColor: colors.softPurple },
  stepNumber: { color: colors.muted, fontSize: 9, fontWeight: '800' },
  stepNumberActive: { color: colors.purpleDark, fontSize: 9, fontWeight: '900' },
  stepText: { color: colors.muted, fontSize: 8, fontWeight: '700', letterSpacing: 0.3 },
  stepTextActive: { color: colors.purpleDark, fontSize: 8, fontWeight: '900', letterSpacing: 0.35 },
  stepLine: { flex: 1, height: 1, backgroundColor: colors.border },
  inputCard: { padding: 18, gap: 12 },
  fieldLabel: { color: colors.ink, fontSize: 12, fontWeight: '800', marginBottom: -6 },
  optional: { color: colors.muted, fontWeight: '500' },
  subjectInput: { minHeight: 52, paddingHorizontal: 15, borderRadius: 15, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.canvas, color: colors.ink, fontSize: 14 },
  notesInput: { minHeight: 210, padding: 16, borderRadius: 17, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.canvas, color: colors.ink, fontSize: 14, lineHeight: 22 },
  inputMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 2 },
  counter: { fontSize: 11, color: colors.muted },
  sampleLink: { minHeight: 44, textAlignVertical: 'center', paddingHorizontal: 4, fontSize: 12, color: colors.purpleDark, fontWeight: '800' },
  attach: { minHeight: 54, paddingHorizontal: 15, borderRadius: 15, borderWidth: 1, borderStyle: 'dashed', borderColor: '#9FCAC0', backgroundColor: colors.softPurple, flexDirection: 'row', alignItems: 'center', gap: 10 },
  attachText: { flex: 1, color: colors.purpleDark, fontSize: 13, fontWeight: '800' },
  pdfAttach: { minHeight: 64, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', gap: 10 },
  pdfCopy: { flex: 1, gap: 3 },
  pdfMeta: { color: colors.muted, fontSize: 10, lineHeight: 14 },
  pdfWorking: { color: colors.purpleDark, fontWeight: '700' },
  pdfSuccess: { color: colors.success, fontWeight: '700' },
  pdfError: { color: colors.danger, fontWeight: '700' },
  pdfPrivacy: { color: colors.muted, fontSize: 10, lineHeight: 15, paddingHorizontal: 2 },
  pdfPressed: { opacity: 0.84, transform: [{ scale: 0.985 }] },
  pdfDisabled: { opacity: 0.68 },
  imagePreview: { flexDirection: 'row', gap: 12, alignItems: 'center', padding: 10, borderRadius: 16, backgroundColor: colors.softPurple },
  thumbnail: { width: 52, height: 52, borderRadius: 12 },
  photoCopy: { flex: 1, gap: 5 },
  photoTitle: { color: colors.ink, fontSize: 13, fontWeight: '800' },
  photoMeta: { marginTop: 4, color: colors.muted, fontSize: 11, lineHeight: 15 },
  photoExtract: { minHeight: 40, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, borderRadius: 10, backgroundColor: colors.surface },
  photoExtractText: { color: colors.purpleDark, fontSize: 11, fontWeight: '800' },
  styleCard: { padding: 19, gap: 11 },
  smallCopy: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  actionArea: { gap: 10 },
  privacy: { textAlign: 'center', color: colors.muted, fontSize: 10, lineHeight: 15, paddingHorizontal: 8 },
  info: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 16, backgroundColor: colors.softYellow, borderRadius: radii.md, borderWidth: 1, borderColor: '#E9D8AB' },
  infoText: { flex: 1, color: '#694A14', fontSize: 11, lineHeight: 17 },
});
