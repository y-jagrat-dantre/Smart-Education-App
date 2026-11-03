export type QuizQuestion = { prompt: string; answer: string; choices: string[] };

export function extractStudyPoints(sourceText: string) {
  const points = sourceText
    .replace(/\r/g, '')
    .replace(/([.!?])\s+/g, '$1\n')
    .split(/\n+/)
    .map((line) => line.replace(/^[-*•\d.)\s]+/, '').trim())
    .filter((line) => line.length >= 12)
    .map((line) => line.slice(0, 180));
  return [...new Set(points)].slice(0, 8);
}

export function makeLocalLyrics(title: string, sourceText: string, language: 'en' | 'hi' = 'en') {
  const points = extractStudyPoints(sourceText);
  if (!points.length) throw new Error('Add a few complete sentences or bullet points from your notes first.');
  const first = points.slice(0, 4);
  const next = points.slice(4, 8);
  if (language === 'hi') {
    return [
      '[अंतरा 1 — आपके नोट्स से]',
      ...first,
      '',
      '[मुखड़ा]',
      `${title || 'इन बातों को'} पढ़ें, समझें, याद रखें,`,
      'हर दिन दोहराएँ और आगे बढ़ें।',
      ...(next.length ? ['', '[अंतरा 2 — आपके नोट्स से]', ...next] : []),
      '',
      '[मुखड़ा]',
      `${title || 'इन बातों को'} पढ़ें, समझें, याद रखें,`,
      'हर दिन दोहराएँ और आगे बढ़ें।',
    ].join('\n');
  }
  return [
    `[Verse 1 — from your notes]`,
    ...first,
    '',
    `[Chorus — study refrain]`,
    `${title || 'These ideas'} — read them, say them, let them stay,`,
    `Check each line against your notes as you learn today.`,
    ...(next.length ? ['', '[Verse 2 — from your notes]', ...next] : []),
    '',
    `[Chorus]`,
    `${title || 'These ideas'} — read them, say them, let them stay,`,
    `Check each line against your notes as you learn today.`,
  ].join('\n');
}

export function makeSourceQuiz(sourceText: string): QuizQuestion[] {
  const points = extractStudyPoints(sourceText);
  return points.slice(0, Math.min(points.length, 5)).map((answer, index) => {
    const distractors = points.filter((_, pointIndex) => pointIndex !== index).slice(0, 3);
    const choices = [answer, ...distractors].sort((a, b) => (a.length + index * 7) % 11 - (b.length + index * 7) % 11);
    return { prompt: 'Which statement appears in your source notes?', answer, choices };
  });
}

export function titleFromNotes(sourceText: string) {
  const firstLine = sourceText.split(/\r?\n/).map((line) => line.trim()).find((line) => line.length > 0) ?? '';
  return firstLine.replace(/^#+\s*/, '').replace(/^[-*•\d.)\s]+/, '').slice(0, 45) || 'My study notes';
}
