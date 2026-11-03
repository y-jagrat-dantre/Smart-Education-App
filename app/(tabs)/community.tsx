import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ActionButton, AppScreen, Chip, Eyebrow, uiStyles } from '@/components/ui';
import { CommunityAvatar, CommunityQuestionCard, CommunityReportModal } from '@/features/community/components';
import { colors } from '@/theme/colors';
import { getCommunityFeed, toggleCommunityBookmark, toggleCommunityVote, type CommunityQuestion } from '@/services/api';
import { useAuth } from '@/state/auth';

const filters = [
  { id: 'for_you', label: 'For You' }, { id: 'latest', label: 'Latest' }, { id: 'trending', label: 'Trending' }, { id: 'unanswered', label: 'Unanswered' },
  { id: 'upvoted', label: 'Most upvoted' }, { id: 'following', label: 'Following' },
];
const subjects = ['All subjects', 'Mathematics', 'Physics', 'Chemistry', 'Biology', 'Computer Science', 'English', 'History', 'Geography', 'Economics', 'Law', 'General Knowledge', 'Other'];
const levels = ['All levels', 'Primary School', 'Middle School', 'Secondary School', 'Higher Secondary', 'Undergraduate', 'Postgraduate', 'Competitive Examinations', 'Other'];

export default function CommunityScreen() {
  const { user } = useAuth();
  const [filter, setFilter] = useState('for_you');
  const [subject, setSubject] = useState('All subjects');
  const [academicLevel, setAcademicLevel] = useState('All levels');
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [questions, setQuestions] = useState<CommunityQuestion[]>([]);
  const [nextOffset, setNextOffset] = useState<number | null>(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [subjectOpen, setSubjectOpen] = useState(false);
  const [levelOpen, setLevelOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState<{ type: 'question'; id: string } | null>(null);

  const load = useCallback(async (reset = true, quiet = false) => {
    if (reset && !quiet) setLoading(true);
    if (reset) setError('');
    try {
      const response = await getCommunityFeed({ filter, query: appliedSearch, subject: subject === 'All subjects' ? undefined : subject, academicLevel: academicLevel === 'All levels' ? undefined : academicLevel, offset: reset ? 0 : (nextOffset ?? 0), limit: 15 });
      setQuestions((current) => reset ? response.questions : [...current, ...response.questions]);
      setNextOffset(response.nextOffset);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'The community could not be loaded.';
      setError(message);
    } finally {
      setLoading(false); setRefreshing(false); setLoadingMore(false);
    }
  }, [filter, appliedSearch, subject, academicLevel, nextOffset]);

  useFocusEffect(useCallback(() => {
    void load(true);
    const refresh = setInterval(() => { void load(true, true); }, 30_000);
    return () => clearInterval(refresh);
  }, [filter, appliedSearch, subject, academicLevel]));

  const visibleSubjects = useMemo(() => subjects, []);
  const refresh = () => { setRefreshing(true); void load(true, true); };
  const searchNow = () => { setAppliedSearch(search.trim()); };
  const vote = async (question: CommunityQuestion) => {
    try {
      const result = await toggleCommunityVote('question', question.id, !question.hasVoted);
      setQuestions((current) => current.map((item) => item.id === question.id ? { ...item, hasVoted: result.voted, voteCount: result.voteCount } : item));
    } catch (cause) { Alert.alert('Could not update vote', cause instanceof Error ? cause.message : 'Try again.'); }
  };
  const bookmark = async (question: CommunityQuestion) => {
    try {
      const result = await toggleCommunityBookmark(question.id, !question.bookmarked);
      setQuestions((current) => current.map((item) => item.id === question.id ? { ...item, bookmarked: result.saved } : item));
    } catch (cause) { Alert.alert('Could not save question', cause instanceof Error ? cause.message : 'Try again.'); }
  };
  const report = (question: CommunityQuestion) => setReportTarget({ type: 'question', id: question.id });
  const share = (question: CommunityQuestion) => { void Share.share({ message: `${question.title}\nSAMAJVED Community` }).catch(() => undefined); };

  return <AppScreen>
    <View style={styles.header}>
      <View style={styles.headerCopy}><Eyebrow>LEARN TOGETHER</Eyebrow><Text style={uiStyles.heading}>Community</Text><Text style={styles.intro}>Questions, explanations, and ideas from students everywhere.</Text></View>
      <View style={styles.headerActions}>
        <Pressable accessibilityRole="button" accessibilityLabel="Saved questions" onPress={() => router.push('/community/saved')} style={styles.headerIcon}><Ionicons name="bookmark-outline" size={20} color={colors.ink} /></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Notifications" onPress={() => router.push('/community/notifications')} style={styles.headerIcon}><Ionicons name="notifications-outline" size={20} color={colors.ink} /></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Your community profile" onPress={() => user && router.push({ pathname: '/community/profile/[id]', params: { id: user.id } })}><CommunityAvatar name={user?.name ?? 'Student'} size={40} /></Pressable>
      </View>
    </View>

    <View style={styles.searchRow}>
      <Ionicons name="search-outline" size={19} color={colors.muted} />
      <TextInput value={search} onChangeText={setSearch} onSubmitEditing={searchNow} returnKeyType="search" placeholder="Search questions, topics, answers…" placeholderTextColor="#83918B" style={styles.searchInput} accessibilityLabel="Search community" />
      {search ? <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => { setSearch(''); setAppliedSearch(''); }}><Ionicons name="close-circle" size={19} color={colors.muted} /></Pressable> : null}
      <Pressable accessibilityRole="button" onPress={searchNow} style={styles.searchButton}><Text style={styles.searchButtonText}>Search</Text></Pressable>
    </View>

    <ActionButton title="Ask a question" onPress={() => router.push('/community/ask')} icon={<Ionicons name="add-circle-outline" size={19} color="#FFFFFF" />} />

    <View style={styles.filterSection}>
      <Eyebrow>DISCOVER</Eyebrow>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {filters.map((item) => <Chip key={item.id} selected={filter === item.id} onPress={() => setFilter(item.id)}>{item.label}</Chip>)}
      </ScrollView>
        <Pressable accessibilityRole="button" accessibilityState={{ expanded: subjectOpen }} onPress={() => { setSubjectOpen((current) => !current); setLevelOpen(false); }} style={styles.subjectFilter}>
        <Ionicons name="options-outline" size={16} color={colors.purpleDark} /><Text style={styles.subjectFilterText}>{subject}</Text><Ionicons name={subjectOpen ? 'chevron-up' : 'chevron-down'} size={16} color={colors.purpleDark} />
      </Pressable>
      {subjectOpen ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>{visibleSubjects.map((item) => <Chip key={item} selected={subject === item} onPress={() => { setSubject(item); setSubjectOpen(false); }}>{item}</Chip>)}</ScrollView> : null}
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: levelOpen }} onPress={() => { setLevelOpen((current) => !current); setSubjectOpen(false); }} style={styles.subjectFilter}>
        <Ionicons name="school-outline" size={16} color={colors.purpleDark} /><Text style={styles.subjectFilterText}>{academicLevel}</Text><Ionicons name={levelOpen ? 'chevron-up' : 'chevron-down'} size={16} color={colors.purpleDark} />
      </Pressable>
      {levelOpen ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>{levels.map((item) => <Chip key={item} selected={academicLevel === item} onPress={() => { setAcademicLevel(item); setLevelOpen(false); }}>{item}</Chip>)}</ScrollView> : null}
    </View>

    <View style={styles.feedHeading}><Text style={styles.feedTitle}>{appliedSearch ? 'Search results' : filter === 'latest' ? 'Latest questions' : filters.find((item) => item.id === filter)?.label}</Text><View style={styles.feedTools}><Text style={styles.feedMeta}>{questions.length ? `${questions.length} shown` : ''}</Text><Pressable accessibilityRole="button" accessibilityLabel="Refresh community" onPress={refresh} style={styles.refreshButton}>{refreshing ? <ActivityIndicator size="small" color={colors.purple} /> : <Ionicons name="refresh" size={16} color={colors.purpleDark} />}</Pressable></View></View>
    {error ? <View style={styles.errorCard}><Ionicons name="cloud-offline-outline" size={19} color={colors.danger} /><View style={{ flex: 1, gap: 3 }}><Text style={styles.errorTitle}>Could not load the community</Text><Text style={styles.errorText}>{error}</Text></View><Pressable accessibilityRole="button" onPress={() => void load(true)}><Text style={styles.retry}>Retry</Text></Pressable></View> : null}
    {loading && !questions.length ? <View style={styles.state}><ActivityIndicator color={colors.purple} /><Text style={styles.stateText}>Loading community…</Text></View> : null}
    {!loading && !error && questions.length === 0 ? <View style={styles.empty}><View style={styles.emptyIcon}><Ionicons name="chatbubbles-outline" size={24} color={colors.purple} /></View><Text style={styles.emptyTitle}>Start the conversation</Text><Text style={styles.emptyText}>No questions match this view yet. Ask one, or choose a different filter.</Text><Pressable accessibilityRole="button" onPress={() => router.push('/community/ask')}><Text style={styles.emptyLink}>Ask the first question</Text></Pressable></View> : null}
    {questions.map((question) => <CommunityQuestionCard key={question.id} question={question} onOpen={() => router.push({ pathname: '/community/[id]', params: { id: question.id } })} onVote={() => void vote(question)} onBookmark={() => void bookmark(question)} onReport={() => report(question)} onShare={() => share(question)} />)}
    {nextOffset !== null && questions.length > 0 ? <Pressable accessibilityRole="button" disabled={loadingMore} onPress={() => { setLoadingMore(true); void load(false); }} style={styles.loadMore}>{loadingMore ? <ActivityIndicator color={colors.purple} /> : <Text style={styles.loadMoreText}>Load more questions</Text>}</Pressable> : null}
    <CommunityReportModal target={reportTarget} onClose={() => setReportTarget(null)} onSubmitted={() => { setReportTarget(null); Alert.alert('Report received', 'Thanks for helping keep the community useful.'); }} />
  </AppScreen>;
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  headerCopy: { flex: 1, gap: 5 },
  intro: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 2 },
  headerIcon: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  searchRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 13, borderRadius: 17, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  searchInput: { flex: 1, color: colors.ink, fontSize: 12, paddingVertical: 12 },
  searchButton: { paddingVertical: 8, paddingHorizontal: 10, borderRadius: 11, backgroundColor: colors.softMint },
  searchButtonText: { color: colors.purpleDark, fontSize: 10, fontWeight: '800' },
  filterSection: { gap: 11 }, chips: { gap: 8, paddingRight: 4 },
  subjectFilter: { alignSelf: 'flex-start', minHeight: 39, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, borderRadius: 13, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  subjectFilterText: { color: colors.purpleDark, fontSize: 11, fontWeight: '800' },
  feedHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: -10 },
  feedTitle: { color: colors.ink, fontSize: 17, fontWeight: '800' }, feedTools: { flexDirection: 'row', alignItems: 'center', gap: 9 }, feedMeta: { color: colors.muted, fontSize: 10 }, refreshButton: { minWidth: 31, height: 31, alignItems: 'center', justifyContent: 'center' },
  state: { minHeight: 150, alignItems: 'center', justifyContent: 'center', gap: 10 }, stateText: { color: colors.muted, fontSize: 12 },
  errorCard: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 13, borderRadius: 17, borderColor: '#EFD4CF', borderWidth: 1, backgroundColor: '#FFF8F5' },
  errorTitle: { color: colors.ink, fontSize: 12, fontWeight: '800' }, errorText: { color: colors.muted, fontSize: 10, lineHeight: 15 }, retry: { color: colors.purpleDark, fontWeight: '800', fontSize: 11 },
  empty: { minHeight: 210, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 25, gap: 9, borderRadius: 21, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  emptyIcon: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 17, backgroundColor: colors.softMint },
  emptyTitle: { color: colors.ink, fontSize: 16, fontWeight: '800' }, emptyText: { color: colors.muted, textAlign: 'center', fontSize: 12, lineHeight: 18 }, emptyLink: { color: colors.purpleDark, fontSize: 12, fontWeight: '800', padding: 6 },
  loadMore: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 15, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }, loadMoreText: { color: colors.purpleDark, fontSize: 12, fontWeight: '800' },
});
