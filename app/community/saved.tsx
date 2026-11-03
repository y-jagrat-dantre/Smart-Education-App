import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AppScreen, Eyebrow, uiStyles } from '@/components/ui';
import { CommunityQuestionCard, CommunityReportModal } from '@/features/community/components';
import { colors } from '@/theme/colors';
import { getSavedCommunityQuestions, toggleCommunityBookmark, toggleCommunityVote, type CommunityQuestion } from '@/services/api';

export default function SavedCommunityScreen() {
  const [questions, setQuestions] = useState<CommunityQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reportTarget, setReportTarget] = useState<{ type: 'question'; id: string } | null>(null);
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { const data = await getSavedCommunityQuestions(); setQuestions(data.questions); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not load saved questions.'); }
    finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const vote = async (question: CommunityQuestion) => {
    try { const result = await toggleCommunityVote('question', question.id, !question.hasVoted); setQuestions((current) => current.map((item) => item.id === question.id ? { ...item, hasVoted: result.voted, voteCount: result.voteCount } : item)); }
    catch (cause) { Alert.alert('Could not update vote', cause instanceof Error ? cause.message : 'Try again.'); }
  };
  const bookmark = async (question: CommunityQuestion) => {
    try { await toggleCommunityBookmark(question.id, false); setQuestions((current) => current.filter((item) => item.id !== question.id)); }
    catch (cause) { Alert.alert('Could not remove bookmark', cause instanceof Error ? cause.message : 'Try again.'); }
  };
  const report = (question: CommunityQuestion) => setReportTarget({ type: 'question', id: question.id });

  return <AppScreen>
    <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.back}><Ionicons name="arrow-back" size={18} color={colors.ink} /><Text style={styles.backText}>Community</Text></Pressable>
    <View style={styles.heading}><Eyebrow>YOUR LIBRARY</Eyebrow><Text style={uiStyles.heading}>Saved questions</Text><Text style={styles.body}>Questions you bookmark are private to your account.</Text></View>
    {loading ? <View style={styles.state}><ActivityIndicator color={colors.purple} /><Text style={styles.body}>Loading saved questions…</Text></View> : null}
    {error ? <View style={styles.empty}><Text style={styles.body}>{error}</Text><Pressable onPress={() => void load()}><Text style={styles.link}>Try again</Text></Pressable></View> : null}
    {!loading && !error && !questions.length ? <View style={styles.empty}><Ionicons name="bookmark-outline" size={26} color={colors.purple} /><Text style={styles.emptyTitle}>No saved questions yet</Text><Text style={styles.body}>Tap the bookmark on any community question to keep it here.</Text><Pressable onPress={() => router.replace('/(tabs)/community')}><Text style={styles.link}>Explore questions</Text></Pressable></View> : null}
    {questions.map((question) => <CommunityQuestionCard key={question.id} question={question} onOpen={() => router.push({ pathname: '/community/[id]', params: { id: question.id } })} onVote={() => void vote(question)} onBookmark={() => void bookmark(question)} onReport={() => report(question)} onShare={() => void Share.share({ message: `${question.title}\nSAMAJVED Community` }).catch(() => undefined)} />)}
    <CommunityReportModal target={reportTarget} onClose={() => setReportTarget(null)} onSubmitted={() => { setReportTarget(null); Alert.alert('Report received', 'Thanks for helping keep the community useful.'); }} />
  </AppScreen>;
}

const styles = StyleSheet.create({
  back: { alignSelf: 'flex-start', minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 8 }, backText: { color: colors.ink, fontSize: 12, fontWeight: '800' }, heading: { gap: 6 }, body: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  state: { minHeight: 170, alignItems: 'center', justifyContent: 'center', gap: 9 }, empty: { minHeight: 200, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 20, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }, emptyTitle: { color: colors.ink, fontSize: 16, fontWeight: '800' }, link: { paddingVertical: 6, color: colors.purpleDark, fontSize: 12, fontWeight: '800' },
});
