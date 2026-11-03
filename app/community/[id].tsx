import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ActionButton, AppScreen, Eyebrow, uiStyles } from '@/components/ui';
import { CommunityAvatar, CommunityImageGallery, CommunityImagePicker, CommunityReportModal, relativeCommunityTime, type PickedCommunityImage } from '@/features/community/components';
import { colors } from '@/theme/colors';
import { acceptCommunityAnswer, createCommunityAnswer, createCommunityComment, deleteCommunityAnswer, deleteCommunityComment, deleteCommunityQuestion, getCommunityQuestion, toggleCommunityBookmark, toggleCommunityVote, updateCommunityAnswer, updateCommunityQuestion, uploadCommunityImage, type CommunityAnswer, type CommunityQuestion } from '@/services/api';
import { useAuth } from '@/state/auth';

type ReplyTarget = { answerId: string; parentId?: string; name?: string };

export default function CommunityQuestionDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const questionId = Array.isArray(params.id) ? params.id[0] : params.id;
  const { user } = useAuth();
  const [question, setQuestion] = useState<CommunityQuestion | null>(null);
  const [answers, setAnswers] = useState<CommunityAnswer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [answerText, setAnswerText] = useState('');
  const [answerImages, setAnswerImages] = useState<PickedCommunityImage[]>([]);
  const [replyText, setReplyText] = useState('');
  const [replyTarget, setReplyTarget] = useState<ReplyTarget | null>(null);
  const [publishingAnswer, setPublishingAnswer] = useState(false);
  const [publishingReply, setPublishingReply] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [editingQuestion, setEditingQuestion] = useState(false);
  const [editQuestionTitle, setEditQuestionTitle] = useState('');
  const [editQuestionBody, setEditQuestionBody] = useState('');
  const [editingAnswerId, setEditingAnswerId] = useState<string | null>(null);
  const [editAnswerBody, setEditAnswerBody] = useState('');
  const [reportTarget, setReportTarget] = useState<{ type: 'question' | 'answer' | 'comment'; id: string } | null>(null);
  const uploadedIds = useRef<Record<string, string>>({});
  const answerBusy = useRef(false);
  const replyBusy = useRef(false);

  const load = useCallback(async () => {
    if (!questionId) return;
    setLoading(true); setError('');
    try {
      const data = await getCommunityQuestion(questionId);
      setQuestion(data.question); setAnswers(data.answers);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not load this question.'); }
    finally { setLoading(false); }
  }, [questionId]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const vote = async (type: 'question' | 'answer', targetId: string) => {
    try {
      const answer = type === 'answer' ? answers.find((item) => item.id === targetId) : null;
      const currentlyVoted = type === 'question' ? Boolean(question?.hasVoted) : Boolean(answer?.hasVoted);
      const result = await toggleCommunityVote(type, targetId, !currentlyVoted);
      if (type === 'question') setQuestion((current) => current ? { ...current, hasVoted: result.voted, voteCount: result.voteCount } : current);
      else setAnswers((current) => current.map((answer) => answer.id === targetId ? { ...answer, hasVoted: result.voted, voteCount: result.voteCount } : answer));
    } catch (cause) { Alert.alert('Could not update vote', cause instanceof Error ? cause.message : 'Try again.'); }
  };

  const bookmark = async () => {
    if (!question) return;
    try { const result = await toggleCommunityBookmark(question.id, !question.bookmarked); setQuestion((current) => current ? { ...current, bookmarked: result.saved } : current); }
    catch (cause) { Alert.alert('Could not save question', cause instanceof Error ? cause.message : 'Try again.'); }
  };

  const askReport = (targetType: 'question' | 'answer' | 'comment', targetId: string) => setReportTarget({ type: targetType, id: targetId });

  const postAnswer = async () => {
    if (answerBusy.current || !question) return;
    if (!answerText.trim() && !answerImages.length) { Alert.alert('Add an answer', 'Write an explanation or attach an image of your working.'); return; }
    answerBusy.current = true; setPublishingAnswer(true);
    const idempotencyKey = `${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
    try {
      const imageIds: string[] = [];
      for (let index = 0; index < answerImages.length; index += 1) {
        const image = answerImages[index];
        let imageId = uploadedIds.current[image.clientId];
        if (!imageId) {
          setUploadStatus(`Uploading answer image ${index + 1} of ${answerImages.length}…`);
          const result = await uploadCommunityImage({ base64: image.base64, mimeType: image.mimeType });
          imageId = result.image.id; uploadedIds.current[image.clientId] = imageId;
        }
        imageIds.push(imageId);
      }
      setUploadStatus('Posting your answer…');
      await createCommunityAnswer({ questionId: question.id, idempotencyKey, body: answerText.trim(), imageIds });
      setAnswerText(''); setAnswerImages([]); uploadedIds.current = {}; setUploadStatus('');
      await load();
    } catch (cause) { const message = cause instanceof Error ? cause.message : 'Could not post this answer.'; setUploadStatus(''); Alert.alert('Answer not posted', message); }
    finally { answerBusy.current = false; setPublishingAnswer(false); }
  };

  const postReply = async () => {
    if (!replyTarget || replyBusy.current) return;
    if (replyText.trim().length < 2) { Alert.alert('Write a reply', 'Add a short question or clarification before posting.'); return; }
    replyBusy.current = true; setPublishingReply(true);
    try {
      await createCommunityComment(questionId, replyTarget.answerId, replyText.trim(), replyTarget.parentId);
      setReplyText(''); setReplyTarget(null); await load();
    } catch (cause) { Alert.alert('Reply not posted', cause instanceof Error ? cause.message : 'Try again.'); }
    finally { replyBusy.current = false; setPublishingReply(false); }
  };

  const accept = async (answer: CommunityAnswer) => {
    try { await acceptCommunityAnswer(answer.id); await load(); }
    catch (cause) { Alert.alert('Could not accept answer', cause instanceof Error ? cause.message : 'Try again.'); }
  };

  const saveQuestion = async () => {
    if (!question) return;
    try {
      await updateCommunityQuestion(question.id, { title: editQuestionTitle.trim(), body: editQuestionBody.trim(), subject: question.subject, academicLevel: question.academicLevel, tags: question.tags });
      setEditingQuestion(false); await load();
    } catch (cause) { Alert.alert('Question not saved', cause instanceof Error ? cause.message : 'Try again.'); }
  };
  const removeQuestion = () => {
    if (!question) return;
    Alert.alert('Delete this question?', 'Its answers, replies, votes, and saved bookmarks will also be removed. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete question', style: 'destructive', onPress: () => void deleteCommunityQuestion(question.id).then(() => router.replace('/(tabs)/community')).catch((cause) => Alert.alert('Could not delete question', cause instanceof Error ? cause.message : 'Try again.')) },
    ]);
  };
  const saveAnswer = async (answerId: string) => {
    try { await updateCommunityAnswer(answerId, editAnswerBody.trim()); setEditingAnswerId(null); await load(); }
    catch (cause) { Alert.alert('Answer not saved', cause instanceof Error ? cause.message : 'Try again.'); }
  };
  const removeAnswer = (answer: CommunityAnswer) => Alert.alert('Delete this answer?', 'Its replies and votes will also be removed. This cannot be undone.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete answer', style: 'destructive', onPress: () => void deleteCommunityAnswer(answer.id).then(() => void load()).catch((cause) => Alert.alert('Could not delete answer', cause instanceof Error ? cause.message : 'Try again.')) },
  ]);
  const removeComment = (commentId: string) => Alert.alert('Delete this reply?', 'This reply will be removed from the discussion.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete reply', style: 'destructive', onPress: () => void deleteCommunityComment(commentId).then(() => void load()).catch((cause) => Alert.alert('Could not delete reply', cause instanceof Error ? cause.message : 'Try again.')) },
  ]);

  if (loading && !question) return <AppScreen><Pressable onPress={() => router.back()} style={styles.back}><Ionicons name="arrow-back" size={18} color={colors.ink} /><Text style={styles.backText}>Back to community</Text></Pressable><View style={styles.loading}><ActivityIndicator color={colors.purple} /><Text style={styles.muted}>Loading question…</Text></View></AppScreen>;
  if (error || !question) return <AppScreen><Pressable onPress={() => router.back()} style={styles.back}><Ionicons name="arrow-back" size={18} color={colors.ink} /><Text style={styles.backText}>Back to community</Text></Pressable><View style={styles.errorBox}><Text style={styles.errorTitle}>This question is unavailable</Text><Text style={styles.muted}>{error || 'It may have been removed.'}</Text><Pressable onPress={() => void load()}><Text style={styles.link}>Try again</Text></Pressable></View></AppScreen>;

  return <AppScreen>
    <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.back}><Ionicons name="arrow-back" size={18} color={colors.ink} /><Text style={styles.backText}>Community</Text></Pressable>
    <View style={styles.questionBox}>
      <View style={styles.authorRow}>
        <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/community/profile/[id]', params: { id: question.author.id } })}><CommunityAvatar name={question.author.name} size={42} imageUri={question.author.avatarUrl} /></Pressable>
        <Pressable style={styles.authorInfo} onPress={() => router.push({ pathname: '/community/profile/[id]', params: { id: question.author.id } })}><Text style={styles.authorName}>{question.author.name}</Text><Text style={styles.muted}>{question.author.country ? `${question.author.country} · ` : ''}{relativeCommunityTime(question.createdAt)} · {question.author.level}</Text></Pressable>
        <View style={styles.subjectPill}><Text style={styles.subjectText}>{question.subject}</Text></View>
      </View>
      {editingQuestion ? <View style={styles.editForm}>
        <TextInput accessibilityLabel="Edit question title" value={editQuestionTitle} onChangeText={setEditQuestionTitle} maxLength={180} style={styles.editInput} />
        <TextInput accessibilityLabel="Edit question description" value={editQuestionBody} onChangeText={setEditQuestionBody} multiline maxLength={6000} textAlignVertical="top" style={[styles.editInput, styles.editArea]} />
        <View style={styles.editActions}><Pressable accessibilityRole="button" onPress={() => setEditingQuestion(false)} style={styles.editButton}><Text style={styles.editButtonText}>Cancel</Text></Pressable><Pressable accessibilityRole="button" onPress={() => void saveQuestion()} style={[styles.editButton, styles.saveEdit]}><Text style={[styles.editButtonText, styles.saveEditText]}>Save changes</Text></Pressable></View>
      </View> : <>
        <Text style={uiStyles.heading}>{question.title}</Text>
        {question.body ? <Text style={styles.questionBody}>{question.body}</Text> : null}
        {question.images.length ? <CommunityImageGallery images={question.images} /> : null}
        {question.tags.length ? <View style={styles.tagRow}>{question.tags.map((tag) => <Text key={tag} style={styles.tag}>#{tag}</Text>)}</View> : null}
      </>}
      <View style={styles.questionActions}>
        <Pressable accessibilityRole="button" onPress={() => void vote('question', question.id)} style={styles.action}><Ionicons name={question.hasVoted ? 'arrow-up-circle' : 'arrow-up-circle-outline'} size={20} color={question.hasVoted ? colors.purple : colors.muted} /><Text style={styles.actionText}>{question.voteCount}</Text></Pressable>
        <Pressable accessibilityRole="button" onPress={() => void bookmark()} style={styles.action}><Ionicons name={question.bookmarked ? 'bookmark' : 'bookmark-outline'} size={18} color={question.bookmarked ? colors.purple : colors.muted} /><Text style={styles.actionText}>{question.bookmarked ? 'Saved' : 'Save'}</Text></Pressable>
        <Pressable accessibilityRole="button" onPress={() => void Share.share({ message: `${question.title}\nSAMAJVED Community` }).catch(() => undefined)} style={styles.action}><Ionicons name="share-social-outline" size={18} color={colors.muted} /><Text style={styles.actionText}>Share</Text></Pressable>
        <Pressable accessibilityRole="button" onPress={() => askReport('question', question.id)} style={styles.action}><Ionicons name="flag-outline" size={17} color={colors.muted} /><Text style={styles.actionText}>Report</Text></Pressable>
        {user?.id === question.author.id ? <><Pressable accessibilityRole="button" onPress={() => { setEditQuestionTitle(question.title); setEditQuestionBody(question.body); setEditingQuestion((current) => !current); }} style={styles.action}><Ionicons name="create-outline" size={17} color={colors.purpleDark} /><Text style={styles.actionText}>Edit</Text></Pressable><Pressable accessibilityRole="button" onPress={removeQuestion} style={styles.action}><Ionicons name="trash-outline" size={16} color={colors.danger} /><Text style={[styles.actionText, { color: colors.danger }]}>Delete</Text></Pressable></> : null}
      </View>
    </View>

    <View style={styles.answersHeading}><Text style={styles.sectionTitle}>{answers.length} {answers.length === 1 ? 'answer' : 'answers'}</Text>{question.accepted ? <View style={styles.acceptedPill}><Ionicons name="checkmark-circle" size={14} color={colors.success} /><Text style={styles.acceptedText}>Solved</Text></View> : null}</View>
    {!answers.length ? <View style={styles.noAnswers}><Ionicons name="chatbubble-ellipses-outline" size={21} color={colors.purple} /><View style={{ flex: 1, gap: 3 }}><Text style={styles.noAnswersTitle}>No answers yet</Text><Text style={styles.muted}>Be the first to help this student.</Text></View></View> : null}
    {answers.map((answer) => {
      const roots = answer.comments.filter((comment) => !comment.parentId);
      const children = answer.comments.filter((comment) => comment.parentId);
      return <View key={answer.id} style={[styles.answerCard, answer.accepted && styles.acceptedCard]}>
        <View style={styles.answerHeader}>
          <CommunityAvatar name={answer.author} size={36} imageUri={answer.avatarUrl} />
          <View style={{ flex: 1, gap: 4 }}><Text style={styles.authorName}>{answer.author} <Text style={styles.levelText}>· {answer.level}</Text></Text><Text style={styles.muted}>{relativeCommunityTime(answer.createdAt)}</Text></View>
          {answer.accepted ? <View style={styles.acceptedMark}><Ionicons name="checkmark-circle" size={18} color={colors.success} /><Text style={styles.acceptedText}>Accepted</Text></View> : null}
        </View>
        {editingAnswerId === answer.id ? <View style={styles.editForm}><TextInput accessibilityLabel="Edit answer" value={editAnswerBody} onChangeText={setEditAnswerBody} multiline maxLength={6000} textAlignVertical="top" style={[styles.editInput, styles.editArea]} /><View style={styles.editActions}><Pressable accessibilityRole="button" onPress={() => setEditingAnswerId(null)} style={styles.editButton}><Text style={styles.editButtonText}>Cancel</Text></Pressable><Pressable accessibilityRole="button" onPress={() => void saveAnswer(answer.id)} style={[styles.editButton, styles.saveEdit]}><Text style={[styles.editButtonText, styles.saveEditText]}>Save changes</Text></Pressable></View></View> : <>
          {answer.body ? <Text style={styles.answerBody}>{answer.body}</Text> : null}
          {answer.images.length ? <CommunityImageGallery images={answer.images} /> : null}
        </>}
        <View style={styles.answerActions}>
          <Pressable accessibilityRole="button" onPress={() => void vote('answer', answer.id)} style={styles.action}><Ionicons name={answer.hasVoted ? 'arrow-up-circle' : 'arrow-up-circle-outline'} size={19} color={answer.hasVoted ? colors.purple : colors.muted} /><Text style={styles.actionText}>{answer.voteCount}</Text></Pressable>
          <Pressable accessibilityRole="button" onPress={() => setReplyTarget({ answerId: answer.id, name: answer.author })} style={styles.action}><Ionicons name="chatbubble-ellipses-outline" size={17} color={colors.muted} /><Text style={styles.actionText}>Reply</Text></Pressable>
          {user?.id === question.author.id ? <Pressable accessibilityRole="button" onPress={() => void accept(answer)} style={styles.action}><Ionicons name={answer.accepted ? 'checkmark-circle' : 'checkmark-circle-outline'} size={18} color={answer.accepted ? colors.success : colors.muted} /><Text style={styles.actionText}>{answer.accepted ? 'Accepted' : 'Accept'}</Text></Pressable> : null}
          {user?.id === answer.authorId ? <><Pressable accessibilityRole="button" onPress={() => { setEditingAnswerId(answer.id); setEditAnswerBody(answer.body); }} style={styles.action}><Ionicons name="create-outline" size={16} color={colors.purpleDark} /><Text style={styles.actionText}>Edit</Text></Pressable><Pressable accessibilityRole="button" onPress={() => removeAnswer(answer)} style={styles.action}><Ionicons name="trash-outline" size={16} color={colors.danger} /></Pressable></> : null}
          <Pressable accessibilityRole="button" accessibilityLabel="Report answer" onPress={() => askReport('answer', answer.id)} style={styles.action}><Ionicons name="flag-outline" size={16} color={colors.muted} /></Pressable>
        </View>
        {roots.length ? <View style={styles.comments}>{roots.map((comment) => <View key={comment.id} style={styles.commentBlock}>
          <View style={styles.commentRow}><CommunityAvatar name={comment.author} size={26} /><View style={styles.commentCopy}><Text style={styles.commentAuthor}>{comment.author} <Text style={styles.muted}>· {relativeCommunityTime(comment.createdAt)}</Text></Text><Text style={styles.commentText}>{comment.body}</Text><View style={styles.commentActions}><Pressable onPress={() => setReplyTarget({ answerId: answer.id, parentId: comment.id, name: comment.author })}><Text style={styles.linkSmall}>Reply</Text></Pressable><Pressable accessibilityLabel="Report comment" onPress={() => askReport('comment', comment.id)}><Text style={styles.reportSmall}>Report</Text></Pressable>{user?.id === comment.authorId ? <Pressable accessibilityLabel="Delete reply" onPress={() => removeComment(comment.id)}><Text style={styles.reportSmall}>Delete</Text></Pressable> : null}</View></View></View>
          {children.filter((child) => child.parentId === comment.id).map((child) => <View key={child.id} style={styles.childComment}><View style={styles.childLine} /><View style={styles.commentCopy}><Text style={styles.commentAuthor}>{child.author} <Text style={styles.muted}>· {relativeCommunityTime(child.createdAt)}</Text></Text><Text style={styles.commentText}>{child.body}</Text><View style={styles.commentActions}><Pressable accessibilityLabel="Report comment" onPress={() => askReport('comment', child.id)}><Text style={styles.reportSmall}>Report</Text></Pressable>{user?.id === child.authorId ? <Pressable accessibilityLabel="Delete reply" onPress={() => removeComment(child.id)}><Text style={styles.reportSmall}>Delete</Text></Pressable> : null}</View></View></View>)}
        </View>)}</View> : null}
      </View>;
    })}

    {replyTarget ? <View style={styles.replyBox}>
      <View style={styles.replyHeading}><Text style={styles.label}>Replying to {replyTarget.name ?? 'this answer'}</Text><Pressable accessibilityLabel="Cancel reply" onPress={() => { setReplyTarget(null); setReplyText(''); }}><Ionicons name="close" size={19} color={colors.muted} /></Pressable></View>
      <TextInput accessibilityLabel="Reply text" value={replyText} onChangeText={setReplyText} placeholder="Ask for clarification or add to the discussion…" placeholderTextColor="#83918B" multiline maxLength={1200} style={styles.replyInput} />
      <Pressable accessibilityRole="button" disabled={publishingReply} onPress={() => void postReply()} style={styles.replySubmit}>{publishingReply ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Ionicons name="send" size={15} color="#FFFFFF" />}<Text style={styles.replySubmitText}>Post reply</Text></Pressable>
    </View> : null}

    <View style={styles.answerEditor}>
      <Eyebrow>SHARE WHAT YOU KNOW</Eyebrow><Text style={styles.sectionTitle}>Write an answer</Text>
      <TextInput accessibilityLabel="Your answer" value={answerText} onChangeText={setAnswerText} placeholder="Explain your steps so another student can follow along…" placeholderTextColor="#83918B" multiline maxLength={6000} textAlignVertical="top" style={styles.answerInput} />
      <CommunityImagePicker images={answerImages} disabled={publishingAnswer} onChange={(next) => setAnswerImages(next)} />
      {uploadStatus ? <View style={styles.uploadStatus}><ActivityIndicator size="small" color={colors.purple} /><Text style={styles.muted}>{uploadStatus}</Text></View> : null}
      <ActionButton title={publishingAnswer ? 'Posting answer…' : 'Post answer'} disabled={publishingAnswer} onPress={() => void postAnswer()} icon={<Ionicons name="send-outline" size={16} color="#FFFFFF" />} />
    </View>
    <Text style={styles.footer}>Keep explanations respectful and share your own work. Community reputation reflects participation, not verified qualifications.</Text>
    <CommunityReportModal target={reportTarget} onClose={() => setReportTarget(null)} onSubmitted={() => { setReportTarget(null); Alert.alert('Report received', 'Thanks for helping keep the community useful.'); }} />
  </AppScreen>;
}

const styles = StyleSheet.create({
  back: { alignSelf: 'flex-start', minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 8 }, backText: { color: colors.ink, fontSize: 12, fontWeight: '800' },
  loading: { minHeight: 200, alignItems: 'center', justifyContent: 'center', gap: 10 }, muted: { color: colors.muted, fontSize: 10, lineHeight: 16 },
  errorBox: { gap: 9, padding: 18, borderRadius: 18, backgroundColor: colors.surface }, errorTitle: { color: colors.ink, fontSize: 17, fontWeight: '800' }, link: { color: colors.purpleDark, fontSize: 12, fontWeight: '800', paddingVertical: 5 },
  questionBox: { gap: 14, padding: 17, borderWidth: 1, borderColor: colors.border, borderRadius: 23, backgroundColor: colors.surface },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 9 }, authorInfo: { flex: 1, gap: 4 }, authorName: { color: colors.ink, fontSize: 12, fontWeight: '800' },
  subjectPill: { maxWidth: 110, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 20, backgroundColor: colors.softMint }, subjectText: { color: colors.purpleDark, fontSize: 9, fontWeight: '800' },
  questionBody: { color: colors.ink, fontSize: 13, lineHeight: 21 }, tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 }, tag: { color: colors.purpleDark, fontSize: 10, fontWeight: '700' },
  questionActions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 13, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#ECF0ED' }, action: { minHeight: 34, flexDirection: 'row', alignItems: 'center', gap: 5 }, actionText: { color: colors.muted, fontSize: 10, fontWeight: '700' },
  editForm: { gap: 8 }, editInput: { minHeight: 45, padding: 11, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: '#FFFFFF', color: colors.ink, fontSize: 12 }, editArea: { minHeight: 96, textAlignVertical: 'top' }, editActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }, editButton: { minHeight: 36, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, borderRadius: 11, backgroundColor: colors.softMint }, editButtonText: { color: colors.purpleDark, fontSize: 10, fontWeight: '800' }, saveEdit: { backgroundColor: colors.purple }, saveEditText: { color: '#FFFFFF' },
  answersHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, sectionTitle: { color: colors.ink, fontSize: 17, fontWeight: '800' }, acceptedPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 12, backgroundColor: '#E8F3E7' }, acceptedText: { color: colors.success, fontSize: 10, fontWeight: '800' },
  noAnswers: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 14, borderWidth: 1, borderColor: colors.border, borderRadius: 17, backgroundColor: colors.surface }, noAnswersTitle: { color: colors.ink, fontSize: 12, fontWeight: '800' },
  answerCard: { gap: 12, padding: 15, borderWidth: 1, borderColor: colors.border, borderRadius: 20, backgroundColor: colors.surface }, acceptedCard: { borderColor: '#ACCEAA', backgroundColor: '#FBFDF9' }, answerHeader: { flexDirection: 'row', alignItems: 'center', gap: 9 }, levelText: { color: colors.muted, fontWeight: '600' }, acceptedMark: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  answerBody: { color: colors.ink, fontSize: 13, lineHeight: 21 }, answerActions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 14, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#ECF0ED' },
  comments: { gap: 13, paddingTop: 3 }, commentBlock: { gap: 10 }, commentRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 }, commentCopy: { flex: 1, gap: 4 }, commentAuthor: { color: colors.ink, fontSize: 10, fontWeight: '800' }, commentText: { color: colors.ink, fontSize: 11, lineHeight: 17 }, commentActions: { flexDirection: 'row', gap: 14 }, linkSmall: { color: colors.purpleDark, fontSize: 9, fontWeight: '800' }, reportSmall: { color: colors.muted, fontSize: 9, paddingVertical: 3 },
  childComment: { flexDirection: 'row', gap: 9, marginLeft: 32, paddingLeft: 10 }, childLine: { width: 2, borderRadius: 2, backgroundColor: colors.border },
  replyBox: { gap: 10, padding: 14, borderRadius: 18, borderColor: '#CFE1D7', borderWidth: 1, backgroundColor: '#F6FAF6' }, replyHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, label: { color: colors.ink, fontSize: 11, fontWeight: '800' }, replyInput: { minHeight: 76, padding: 11, borderRadius: 13, borderWidth: 1, borderColor: colors.border, backgroundColor: '#FFFFFF', color: colors.ink, fontSize: 11, lineHeight: 17 }, replySubmit: { alignSelf: 'flex-end', minHeight: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: 13, borderRadius: 12, backgroundColor: colors.purple }, replySubmitText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
  answerEditor: { gap: 11, padding: 16, borderWidth: 1, borderColor: colors.border, borderRadius: 21, backgroundColor: colors.surface }, answerInput: { minHeight: 130, padding: 13, borderRadius: 15, borderWidth: 1, borderColor: colors.border, color: colors.ink, fontSize: 12, lineHeight: 19 }, uploadStatus: { flexDirection: 'row', alignItems: 'center', gap: 8 }, footer: { color: colors.muted, fontSize: 10, lineHeight: 16, textAlign: 'center' },
});
