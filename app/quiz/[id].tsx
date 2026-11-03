import { useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ActionButton, AppScreen, Card, Eyebrow, uiStyles } from '@/components/ui';
import { colors, radii } from '@/theme/colors';
import { makeSourceQuiz } from '@/features/learning/content';
import { useAppStore } from '@/state/app-store';
import { useAuth } from '@/state/auth';

export default function QuizScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const song = useAppStore((state) => state.songs.find((item) => item.id === id && item.ownerId === user?.id));
  const recordQuiz = useAppStore((state) => state.recordQuiz);
  const questions = useMemo(() => makeSourceQuiz(song?.sourceText ?? ''), [song?.sourceText]);
  const [index, setIndex] = useState(0);
  const [choice, setChoice] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [score, setScore] = useState(0);
  const [incorrectPoints, setIncorrectPoints] = useState<string[]>([]);
  const [complete, setComplete] = useState(false);
  const didRecord = useRef(false);

  if (!song || questions.length === 0) return <AppScreen><Text style={uiStyles.heading}>Quiz unavailable</Text><Text style={uiStyles.body}>This material needs at least two complete note statements.</Text><ActionButton title="Back to library" onPress={() => router.replace('/(tabs)/library')} /></AppScreen>;

  const current = questions[index];
  const check = () => {
    if (!choice || revealed) return;
    if (choice === current.answer) setScore((value) => value + 1);
    else setIncorrectPoints((points) => [...points, current.answer]);
    setRevealed(true);
  };
  const next = () => {
    if (index + 1 >= questions.length) {
      if (!didRecord.current && user) {
        didRecord.current = true;
        recordQuiz({
          id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
          userId: user.id,
          songId: song.id,
          subject: song.subject,
          topic: song.title,
          score,
          questionCount: questions.length,
          incorrectPoints,
          createdAt: Date.now(),
        });
      }
      setComplete(true);
    } else {
      setIndex((value) => value + 1);
      setChoice(null);
      setRevealed(false);
    }
  };

  if (complete) return <AppScreen>
    <View style={styles.result}><View style={styles.resultMark}><Ionicons name="checkmark-done" size={30} color={colors.success} /></View><Eyebrow>QUIZ COMPLETE</Eyebrow><Text style={uiStyles.heading}>{score} of {questions.length}</Text><Text style={uiStyles.body}>You checked these notes against the source material. Review any details you missed.</Text><Card style={styles.reviewCard}><Text style={styles.reviewLabel}>MATERIAL</Text><Text style={styles.reviewTitle}>{song.title}</Text><Text style={styles.reviewMeta}>{song.subject} · source-based recall</Text></Card><ActionButton title="Back to song" onPress={() => router.replace(`/song/${song.id}`)} /><ActionButton title="Go to library" secondary onPress={() => router.replace('/(tabs)/library')} /></View>
  </AppScreen>;

  return <AppScreen>
    <View style={styles.top}><Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()} style={styles.back}><Ionicons name="arrow-back" size={20} color={colors.ink} /></Pressable><Eyebrow>QUICK REVIEW · {song.subject.toUpperCase()}</Eyebrow><Text style={uiStyles.heading}>Recall it from memory</Text><Text style={uiStyles.body}>Every option is taken from the notes you added.</Text></View>
    <View style={styles.progress}><View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${((index + 1) / questions.length) * 100}%` }]} /></View><Text style={styles.progressLabel}>{index + 1} / {questions.length}</Text></View>
    <Card style={styles.questionCard}><Text style={styles.questionLabel}>QUESTION {index + 1}</Text><Text style={styles.question}>{current.prompt}</Text><View style={styles.choices}>{current.choices.map((item, itemIndex) => {
      const selected = choice === item;
      const correct = item === current.answer;
      const stateStyle = revealed && correct ? styles.correct : revealed && selected ? styles.incorrect : selected ? styles.selected : undefined;
      return <Pressable key={`${itemIndex}-${item}`} accessibilityRole="radio" accessibilityState={{ selected }} disabled={revealed} onPress={() => setChoice(item)} style={[styles.choice, stateStyle]}><View style={[styles.choiceBullet, selected && !revealed && styles.choiceBulletSelected, revealed && correct && styles.choiceBulletCorrect]}><Text style={[styles.choiceLetter, (selected || (revealed && correct)) && styles.choiceLetterActive]}>{String.fromCharCode(65 + itemIndex)}</Text></View><Text style={[styles.choiceText, revealed && correct && { color: colors.success }]}>{item}</Text>{revealed && correct ? <Ionicons name="checkmark-circle" size={19} color={colors.success} /> : null}</Pressable>;
    })}</View>
    {revealed ? <View style={[styles.feedback, choice === current.answer ? styles.feedbackGood : styles.feedbackTry]}><Ionicons name={choice === current.answer ? 'checkmark-circle' : 'information-circle'} size={17} color={choice === current.answer ? colors.success : colors.amber} /><Text style={styles.feedbackText}>{choice === current.answer ? 'That matches your notes.' : 'Review this point in your source notes.'}</Text></View> : null}
    </Card>
    {revealed ? <ActionButton title={index + 1 === questions.length ? 'See result' : 'Next question'} onPress={next} icon={<Ionicons name="arrow-forward" size={16} color="#FFFFFF" />} /> : <ActionButton title="Check answer" onPress={check} disabled={!choice} />}
    <Text style={styles.disclaimer}>This is a recall check built from your notes, not an independent fact check.</Text>
  </AppScreen>;
}

const styles = StyleSheet.create({
  top: { gap: 9, marginBottom: 2 },
  back: { width: 44, height: 44, marginBottom: 4, borderRadius: 16, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  progress: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  progressTrack: { flex: 1, height: 9, borderRadius: 5, backgroundColor: colors.border, overflow: 'hidden' },
  progressFill: { height: 9, borderRadius: 5, backgroundColor: colors.purple },
  progressLabel: { color: colors.ink, fontSize: 12, fontWeight: '800' },
  questionCard: { padding: 20, gap: 17 },
  questionLabel: { color: colors.purpleDark, fontSize: 11, letterSpacing: 1.15, fontWeight: '900' },
  question: { color: colors.ink, fontSize: 21, fontWeight: '800', lineHeight: 29, letterSpacing: -0.3 },
  choices: { gap: 10 },
  choice: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 17, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  selected: { borderColor: colors.purple, backgroundColor: colors.softPurple },
  correct: { borderColor: '#B8D8B7', backgroundColor: colors.softMint },
  incorrect: { borderColor: '#E9C1BB', backgroundColor: '#FFF4F1' },
  choiceBullet: { width: 31, height: 31, borderRadius: 16, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.canvas },
  choiceBulletSelected: { backgroundColor: colors.purple, borderColor: colors.purple },
  choiceBulletCorrect: { backgroundColor: '#D8EBD3', borderColor: '#B8D8B7' },
  choiceLetter: { color: colors.muted, fontSize: 11, fontWeight: '900' },
  choiceLetterActive: { color: colors.success },
  choiceText: { flex: 1, color: colors.ink, fontSize: 14, lineHeight: 20, fontWeight: '600' },
  feedback: { flexDirection: 'row', alignItems: 'center', gap: 9, padding: 13, borderRadius: 14 },
  feedbackGood: { backgroundColor: colors.softMint },
  feedbackTry: { backgroundColor: colors.softYellow },
  feedbackText: { color: colors.ink, fontSize: 12, lineHeight: 17, fontWeight: '700' },
  disclaimer: { textAlign: 'center', color: colors.muted, fontSize: 11, lineHeight: 17, paddingHorizontal: 10 },
  result: { flex: 1, justifyContent: 'center', alignItems: 'stretch', gap: 17, paddingTop: 32 },
  resultMark: { alignSelf: 'center', width: 82, height: 82, borderRadius: 28, backgroundColor: colors.softMint, alignItems: 'center', justifyContent: 'center' },
  reviewCard: { marginTop: 5, gap: 7, backgroundColor: colors.softPurple, borderColor: '#B9D9CD' },
  reviewLabel: { color: colors.purpleDark, fontSize: 10, letterSpacing: 1.2, fontWeight: '900' },
  reviewTitle: { color: colors.ink, fontSize: 16, fontWeight: '800' },
  reviewMeta: { color: colors.muted, fontSize: 11 },
});
