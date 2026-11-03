import { useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ActionButton, AppScreen, Chip, Eyebrow, uiStyles } from '@/components/ui';
import { CommunityImagePicker, type PickedCommunityImage } from '@/features/community/components';
import { colors } from '@/theme/colors';
import { createCommunityQuestion, uploadCommunityImage } from '@/services/api';

const subjects = ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'Computer Science', 'English', 'History', 'Geography', 'Economics', 'Law', 'General Knowledge', 'Other'];
const levels = ['Primary School', 'Middle School', 'Secondary School', 'Higher Secondary', 'Undergraduate', 'Postgraduate', 'Competitive Examinations', 'Other'];

export default function AskCommunityQuestionScreen() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [subject, setSubject] = useState('');
  const [academicLevel, setAcademicLevel] = useState('');
  const [tagDraft, setTagDraft] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [images, setImages] = useState<PickedCommunityImage[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const idempotencyKey = useRef('');
  const uploadedIds = useRef<Record<string, string>>({});
  const busyRef = useRef(false);

  const markEdited = () => { idempotencyKey.current = ''; setError(''); };
  const addTag = () => {
    const normalized = tagDraft.trim().replace(/^#/, '').slice(0, 28);
    if (!normalized || tags.some((tag) => tag.toLowerCase() === normalized.toLowerCase())) { setTagDraft(''); return; }
    markEdited(); setTags((current) => [...current, normalized].slice(0, 8)); setTagDraft('');
  };

  const publish = async () => {
    if (busyRef.current) return;
    if (title.trim().length < 6) { setError('Add a clear title with at least 6 characters.'); return; }
    if (!body.trim() && images.length === 0) { setError('Add a description or a question image.'); return; }
    if (!subject) { setError('Choose the subject that best fits your question.'); return; }
    busyRef.current = true; setBusy(true); setError('');
    if (!idempotencyKey.current) idempotencyKey.current = `${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
    try {
      const imageIds: string[] = [];
      for (let index = 0; index < images.length; index += 1) {
        const image = images[index];
        let imageId = uploadedIds.current[image.clientId];
        if (!imageId) {
          setStatus(`Uploading image ${index + 1} of ${images.length}…`);
          const result = await uploadCommunityImage({ base64: image.base64, mimeType: image.mimeType });
          imageId = result.image.id;
          uploadedIds.current[image.clientId] = imageId;
        }
        imageIds.push(imageId);
      }
      setStatus('Publishing your question…');
      const result = await createCommunityQuestion({
        idempotencyKey: idempotencyKey.current,
        title: title.trim(), body: body.trim(), subject, academicLevel, tags, imageIds,
      });
      setStatus('');
      router.replace({ pathname: '/community/[id]', params: { id: result.questionId } });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Could not publish your question. Try again.';
      setError(message); setStatus('');
      Alert.alert('Question not published', message);
    } finally { busyRef.current = false; setBusy(false); }
  };

  return <AppScreen>
    <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.back}><Ionicons name="arrow-back" size={18} color={colors.ink} /><Text style={styles.backText}>Community</Text></Pressable>
    <View style={styles.heading}><Eyebrow>ASK STUDENTS WORLDWIDE</Eyebrow><Text style={uiStyles.heading}>Ask a question</Text><Text style={uiStyles.body}>Share what you’re working on. A clear title and a photo of the problem are enough to get started.</Text></View>

    <View style={styles.field}>
      <View style={styles.labelRow}><Text style={styles.label}>Question title</Text><Text style={styles.counter}>{title.length}/180</Text></View>
      <TextInput accessibilityLabel="Question title" value={title} onChangeText={(value) => { markEdited(); setTitle(value); }} placeholder="What are you trying to understand?" placeholderTextColor="#83918B" maxLength={180} style={styles.titleInput} returnKeyType="next" />
    </View>

    <View style={styles.field}>
      <View style={styles.labelRow}><Text style={styles.label}>Description</Text><Text style={styles.optional}>Optional with a clear image</Text></View>
      <TextInput accessibilityLabel="Question description" value={body} onChangeText={(value) => { markEdited(); setBody(value); }} placeholder="Add context, what you have tried, or where you got stuck…" placeholderTextColor="#83918B" multiline maxLength={6000} textAlignVertical="top" style={[styles.textArea, styles.descriptionArea]} />
    </View>

    <View style={styles.field}>
      <Text style={styles.label}>Add question images</Text>
      <Text style={styles.fieldHint}>Attach textbook pages, handwritten work, diagrams, or worksheets.</Text>
      <CommunityImagePicker images={images} disabled={busy} onChange={(next) => { markEdited(); setImages(next); }} />
    </View>

    <View style={styles.field}>
      <Text style={styles.label}>Subject</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>{subjects.map((item) => <Chip key={item} selected={subject === item} onPress={() => { markEdited(); setSubject(item); }}>{item}</Chip>)}</ScrollView>
    </View>

    <View style={styles.field}>
      <View style={styles.labelRow}><Text style={styles.label}>Academic level</Text><Text style={styles.optional}>Optional</Text></View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>{levels.map((item) => <Chip key={item} selected={academicLevel === item} onPress={() => { markEdited(); setAcademicLevel(academicLevel === item ? '' : item); }}>{item}</Chip>)}</ScrollView>
    </View>

    <View style={styles.field}>
      <Text style={styles.label}>Topic tags</Text>
      <View style={styles.tagInputRow}><TextInput accessibilityLabel="Topic tag" value={tagDraft} onChangeText={setTagDraft} onSubmitEditing={addTag} placeholder="Add a topic, e.g. algebra" placeholderTextColor="#83918B" maxLength={28} style={styles.tagInput} returnKeyType="done" /><Pressable accessibilityRole="button" onPress={addTag} style={styles.addTagButton}><Ionicons name="add" size={20} color="#FFFFFF" /></Pressable></View>
      <View style={styles.tagList}>{tags.map((tag) => <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${tag} tag`} key={tag} onPress={() => { markEdited(); setTags((current) => current.filter((item) => item !== tag)); }} style={styles.tag}><Text style={styles.tagText}>#{tag}</Text><Ionicons name="close" size={13} color={colors.purpleDark} /></Pressable>)}</View>
    </View>

    {status ? <View style={styles.status}><ActivityIndicator size="small" color={colors.purple} /><Text style={styles.statusText}>{status}</Text></View> : null}
    {error ? <View style={styles.errorBox}><Ionicons name="alert-circle-outline" size={17} color={colors.danger} /><Text style={styles.errorText}>{error}</Text></View> : null}
    <ActionButton title={busy ? 'Posting question…' : 'Post question'} disabled={busy} onPress={() => void publish()} icon={<Ionicons name={busy ? 'hourglass-outline' : 'send-outline'} size={17} color="#FFFFFF" />} />
    <Text style={styles.footer}>Your post will be visible to signed-in students. Don’t include private information in images.</Text>
  </AppScreen>;
}

const styles = StyleSheet.create({
  back: { alignSelf: 'flex-start', minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 8 }, backText: { color: colors.ink, fontSize: 12, fontWeight: '800' },
  heading: { gap: 6 }, field: { gap: 9 }, labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { color: colors.ink, fontSize: 13, fontWeight: '800' }, optional: { color: colors.muted, fontSize: 10 }, counter: { color: colors.muted, fontSize: 10 },
  titleInput: { minHeight: 54, paddingHorizontal: 14, borderRadius: 15, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, color: colors.ink, fontSize: 13, fontWeight: '600' },
  textArea: { padding: 14, borderRadius: 15, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, color: colors.ink, fontSize: 12, lineHeight: 19 },
  descriptionArea: { minHeight: 126 }, fieldHint: { color: colors.muted, fontSize: 11, lineHeight: 16 }, chips: { gap: 8, paddingRight: 4 },
  tagInputRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8 }, tagInput: { flex: 1, height: 48, paddingHorizontal: 13, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, color: colors.ink, fontSize: 12 },
  addTagButton: { width: 43, height: 43, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: colors.purple }, tagList: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  tag: { minHeight: 30, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, borderRadius: 12, backgroundColor: colors.softMint }, tagText: { color: colors.purpleDark, fontSize: 10, fontWeight: '800' },
  status: { flexDirection: 'row', alignItems: 'center', gap: 8 }, statusText: { color: colors.muted, fontSize: 11 },
  errorBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 12, borderRadius: 14, backgroundColor: '#FFF4F1' }, errorText: { flex: 1, color: colors.danger, fontSize: 11, lineHeight: 16 },
  footer: { color: colors.muted, textAlign: 'center', fontSize: 10, lineHeight: 15, marginTop: -10 },
});
