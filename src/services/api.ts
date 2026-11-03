import type { StudyArtifactContent, StudyArtifactKind, StudyLanguage, StudyScene, StudyVideoStatus } from '@/state/app-store';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

function detectDevelopmentBackend() {
  if (!__DEV__) return '';
  const hostUri = Constants.expoConfig?.hostUri;
  let host = '';
  if (hostUri) {
    try { host = new URL(hostUri.includes('://') ? hostUri : `http://${hostUri}`).hostname; }
    catch { host = ''; }
  }
  if (!host && Platform.OS === 'web') host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
  if (!host && Platform.OS === 'android') host = '10.0.2.2';
  if (!host && Platform.OS === 'ios') host = 'localhost';
  if (Platform.OS === 'android' && ['localhost', '127.0.0.1', '[::1]', '::1'].includes(host)) host = '10.0.2.2';
  if (host.includes(':') && !host.startsWith('[')) host = `[${host}]`;
  return host ? `http://${host}:8787` : '';
}

const configuredApiBase = (process.env.EXPO_PUBLIC_API_URL ?? '').trim();
const apiBase = (configuredApiBase || detectDevelopmentBackend()).replace(/\/+$/, '').replace(/\/api$/i, '');
const missingApiBaseMessage = 'No backend URL found. Set EXPO_PUBLIC_API_URL in the project .env and restart Expo. Local development usually detects the Expo host automatically.';
const GEMINI_REQUEST_TIMEOUT_MS = 135_000;

export const hasBackend = Boolean(apiBase);

export type BackendHealth = {
  status?: string;
  aiConfigured?: boolean;
  musicConfigured?: boolean;
  videoConfigured?: boolean;
  videoProvider?: string;
  imageGenerationConfigured?: boolean;
};

let guestToken: string | null = null;
let guestExpiresAt = 0;
let accountToken: string | null = null;

export type AccountUser = { id: string; name: string; email: string };
export type CommunityImage = { id: string; url: string; mimeType: string };
export type CommunityQuestion = {
  id: string; title: string; body: string; subject: string; academicLevel: string; tags: string[]; images: CommunityImage[];
  author: { id: string; name: string; avatarUrl: string; country: string; reputation: number; level: string };
  answerCount: number; voteCount: number; accepted: boolean; acceptedAnswerId: string | null; hasVoted: boolean; bookmarked: boolean; createdAt: string; updatedAt: string;
};
export type CommunityComment = { id: string; parentId: string | null; authorId: string; author: string; body: string; createdAt: string };
export type CommunityAnswer = {
  id: string; questionId: string; authorId: string; author: string; avatarUrl: string; reputation: number; level: string; body: string;
  images: CommunityImage[]; comments: CommunityComment[]; voteCount: number; hasVoted: boolean; accepted: boolean; createdAt: string;
};
export type CommunityProfile = {
  id: string; name: string; bio: string; country: string; academicLevel: string; subjects: string[]; avatar: CommunityImage | null; reputation: number; level: string;
  showBio: boolean; showSubjects: boolean; showCountry: boolean; showAcademicLevel: boolean; questionCount: number; answerCount: number; acceptedCount: number; following: boolean; isSelf: boolean;
};
export type CommunityNotification = { id: string; type: string; questionId: string | null; answerId: string | null; actor: string; read: boolean; createdAt: string };
export type CommunityNotificationPreferences = { answers: boolean; replies: boolean; upvotes: boolean; accepted: boolean };
export type WhiteboardShape = 'line' | 'rectangle' | 'ellipse' | 'triangle' | 'arrow';
export type WhiteboardStroke = { color: string; width: number; mode?: 'pen' | 'eraser'; shape?: WhiteboardShape; clientId?: string; points: { x: number; y: number }[] };
export type WhiteboardEvent = { id: number; author: string; type: 'stroke' | 'clear'; data: WhiteboardStroke | Record<string, never> };
export type WhiteboardRoom = { code: string; name: string };
export type TopicGuide = {
  summary: string;
  keyIdeas: string[];
  relatedDetails: string[];
  vocabulary: { term: string; definition: string }[];
  example: string;
  studyQuestions: string[];
  lyrics: string;
};

export function setAccountToken(token: string | null) { accountToken = token; }

async function fetchAccount<T>(path: string, init?: RequestInit, timeoutMs = 20_000): Promise<T> {
  if (!apiBase) throw new Error(missingApiBaseMessage);
  if (!accountToken) throw new Error('Sign in to use student accounts and shared whiteboards.');
  const headers = new Headers(init?.headers);
  headers.set('Authorization', `Bearer ${accountToken}`);
  if (init?.body) headers.set('Content-Type', 'application/json');
  const response = await fetchBackend(path, { ...init, headers }, timeoutMs);
  const data = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) {
    if (response.status === 404 && path.startsWith('/api/community/') && /route not found/i.test(data.error ?? '')) {
      throw new Error('This backend is an older version and does not include Community routes. Stop the running backend, start Smart Education/backend again with npm run backend, then tap Retry.');
    }
    throw new Error(data.error || 'The study service could not complete that request.');
  }
  return data;
}

export async function signIn(email: string, password: string) {
  return submitAccount('/api/auth/login', { email, password });
}

export async function registerAccount(name: string, email: string, password: string) {
  return submitAccount('/api/auth/register', { name, email, password });
}

async function submitAccount(path: string, payload: Record<string, string>) {
  const response = await fetchBackend(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  const data = await response.json() as { token?: string; user?: AccountUser; error?: string };
  if (!response.ok || !data.token || !data.user) throw new Error(data.error || 'Could not sign in. Please try again.');
  return { token: data.token, user: data.user };
}

export async function getSignedInUser() {
  return fetchAccount<{ user?: AccountUser }>('/api/auth/me');
}

export async function getCommunityFeed(options: { filter?: string; query?: string; subject?: string; academicLevel?: string; answered?: 'yes' | 'no'; offset?: number; limit?: number } = {}) {
  const params = new URLSearchParams();
  if (options.filter) params.set('filter', options.filter);
  if (options.query) params.set('q', options.query);
  if (options.subject) params.set('subject', options.subject);
  if (options.academicLevel) params.set('academicLevel', options.academicLevel);
  if (options.answered) params.set('answered', options.answered);
  if (options.offset) params.set('offset', String(options.offset));
  if (options.limit) params.set('limit', String(options.limit));
  try {
    return await fetchAccount<{ questions: CommunityQuestion[]; nextOffset: number | null }>(`/api/community/feed?${params.toString()}`);
  } catch (cause) {
    if (cause instanceof Error && /route not found/i.test(cause.message)) {
      throw new Error('This backend is an older version and does not include Community routes. Stop the running backend, start Smart Education/backend again with npm run backend, then tap Retry.');
    }
    throw cause;
  }
}

export async function uploadCommunityImage(image: { base64: string; mimeType: string }) {
  return fetchAccount<{ image: CommunityImage }>('/api/community/media', { method: 'POST', body: JSON.stringify(image) }, 45_000);
}

export async function createCommunityQuestion(payload: { idempotencyKey: string; title: string; body: string; subject: string; academicLevel: string; tags: string[]; imageIds: string[] }) {
  return fetchAccount<{ questionId: string; duplicate?: boolean }>('/api/community/questions', { method: 'POST', body: JSON.stringify(payload) }, 30_000);
}

export async function updateCommunityQuestion(id: string, payload: { title: string; body: string; subject: string; academicLevel: string; tags: string[] }) {
  return fetchAccount<{ saved: boolean }>(`/api/community/questions/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(payload) });
}

export async function deleteCommunityQuestion(id: string) {
  return fetchAccount<{ deleted: boolean }>(`/api/community/questions/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function getCommunityQuestion(id: string) {
  return fetchAccount<{ question: CommunityQuestion; answers: CommunityAnswer[] }>(`/api/community/questions/${encodeURIComponent(id)}`);
}

export async function createCommunityAnswer(payload: { questionId: string; idempotencyKey: string; body: string; imageIds: string[] }) {
  return fetchAccount<{ answerId: string; duplicate?: boolean }>('/api/community/answers', { method: 'POST', body: JSON.stringify(payload) }, 30_000);
}

export async function updateCommunityAnswer(id: string, body: string) {
  return fetchAccount<{ saved: boolean }>(`/api/community/answers/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ body }) });
}

export async function deleteCommunityAnswer(id: string) {
  return fetchAccount<{ deleted: boolean }>(`/api/community/answers/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function deleteCommunityComment(id: string) {
  return fetchAccount<{ deleted: boolean }>(`/api/community/comments/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function createCommunityComment(questionId: string, answerId: string, body: string, parentId?: string) {
  return fetchAccount<{ commentId: string }>(`/api/community/questions/${encodeURIComponent(questionId)}/answers/${encodeURIComponent(answerId)}/comments`, { method: 'POST', body: JSON.stringify({ body, parentId }) });
}

export async function toggleCommunityVote(targetType: 'question' | 'answer', targetId: string, voted: boolean) {
  return fetchAccount<{ voted: boolean; voteCount: number }>('/api/community/vote', { method: 'POST', body: JSON.stringify({ targetType, targetId, voted }) });
}

export async function toggleCommunityBookmark(questionId: string, saved: boolean) {
  return fetchAccount<{ saved: boolean }>('/api/community/bookmark', { method: 'POST', body: JSON.stringify({ questionId, saved }) });
}

export async function acceptCommunityAnswer(answerId: string) {
  return fetchAccount<{ accepted: boolean }>(`/api/community/answers/${encodeURIComponent(answerId)}/accept`, { method: 'POST', body: '{}' });
}

export async function reportCommunityContent(targetType: 'question' | 'answer' | 'comment', targetId: string, reason: string, description = '') {
  return fetchAccount<{ reported: boolean }>('/api/community/report', { method: 'POST', body: JSON.stringify({ targetType, targetId, reason, description }) });
}

export async function getSavedCommunityQuestions(offset = 0) {
  return fetchAccount<{ questions: CommunityQuestion[]; nextOffset: number | null }>(`/api/community/saved?offset=${offset}`);
}

export async function getCommunityNotifications() {
  return fetchAccount<{ notifications: CommunityNotification[]; unreadCount: number }>('/api/community/notifications');
}

export async function markCommunityNotificationRead(id?: string) {
  return id
    ? fetchAccount<{ read: boolean }>(`/api/community/notifications/${encodeURIComponent(id)}/read`, { method: 'POST', body: '{}' })
    : fetchAccount<{ read: boolean }>('/api/community/notifications/read-all', { method: 'POST', body: '{}' });
}

export async function getCommunityNotificationPreferences() {
  return fetchAccount<{ preferences: CommunityNotificationPreferences }>('/api/community/notification-preferences');
}

export async function updateCommunityNotificationPreferences(preferences: CommunityNotificationPreferences) {
  return fetchAccount<{ saved: boolean }>('/api/community/notification-preferences', { method: 'PATCH', body: JSON.stringify(preferences) });
}

export async function getCommunityProfile(id: string) {
  return fetchAccount<{ profile: CommunityProfile; questions: { id: string; title: string; subject: string; createdAt: string }[]; answers: { id: string; questionId: string; body: string; createdAt: string }[] }>(`/api/community/profiles/${encodeURIComponent(id)}`);
}

export async function updateCommunityProfile(payload: { name: string; bio: string; country: string; academicLevel: string; subjects: string[]; avatarMediaId: string | null; showBio: boolean; showSubjects: boolean; showCountry: boolean; showAcademicLevel: boolean }) {
  return fetchAccount<{ saved: boolean }>('/api/community/profile', { method: 'PATCH', body: JSON.stringify(payload) });
}

export async function toggleCommunityFollow(userId: string, following: boolean) {
  return fetchAccount<{ following: boolean }>('/api/community/follow', { method: 'POST', body: JSON.stringify({ userId, following }) });
}

export async function blockCommunityUser(userId: string) {
  return fetchAccount<{ blocked: boolean }>('/api/community/block', { method: 'POST', body: JSON.stringify({ userId }) });
}

export async function createWhiteboard(name: string) {
  const data = await fetchAccount<{ room?: WhiteboardRoom }>('/api/whiteboards', { method: 'POST', body: JSON.stringify({ name }) });
  if (!data.room) throw new Error('Could not create a whiteboard room.');
  return data.room;
}

export async function getWhiteboardEvents(code: string, after: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    return await fetchAccount<{ room: WhiteboardRoom; events: WhiteboardEvent[]; cursor: number }>(`/api/whiteboards/${encodeURIComponent(code.toUpperCase())}?after=${after}`, { signal: controller.signal });
  } finally { clearTimeout(timeout); }
}

export async function sendWhiteboardStroke(code: string, stroke: WhiteboardStroke) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    return await fetchAccount<{ id: number }>(`/api/whiteboards/${encodeURIComponent(code.toUpperCase())}/events`, { method: 'POST', body: JSON.stringify({ type: 'stroke', stroke }), signal: controller.signal });
  } finally { clearTimeout(timeout); }
}

export async function clearWhiteboard(code: string) {
  return fetchAccount<{ id: number }>(`/api/whiteboards/${encodeURIComponent(code.toUpperCase())}/events`, { method: 'POST', body: JSON.stringify({ type: 'clear' }) });
}

export function hasGuestSession() {
  return Boolean(guestToken && guestExpiresAt > Date.now());
}

export function endGuestSession() {
  guestToken = null;
  guestExpiresAt = 0;
}

export async function createGuestSession(forceNew = false) {
  if (!apiBase) throw new Error(missingApiBaseMessage);
  if (!forceNew && hasGuestSession()) return guestToken as string;
  const response = await fetchBackend('/api/session', { method: 'POST' });
  const data = await response.json() as { token?: string; expiresIn?: number; error?: string };
  if (!response.ok || !data.token) throw new Error(data.error || 'Could not connect to the study service. Start the backend and try again.');
  guestToken = data.token;
  guestExpiresAt = Date.now() + (data.expiresIn ?? 8 * 60 * 60) * 1000;
  return guestToken;
}

async function getGuestToken() {
  if (!apiBase) throw new Error(missingApiBaseMessage);
  return createGuestSession();
}

async function fetchBackend(path: string, init?: RequestInit, timeoutMs = 20_000) {
  if (!apiBase) throw new Error(missingApiBaseMessage);
  const controller = new AbortController();
  const externalSignal = init?.signal;
  let timedOut = false;
  const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
  const abortWithRequest = () => controller.abort();
  if (externalSignal?.aborted) abortWithRequest();
  else externalSignal?.addEventListener('abort', abortWithRequest, { once: true });
  try {
    return await fetch(`${apiBase}${path}`, { ...init, signal: controller.signal });
  } catch {
    if (timedOut) throw new Error(`The study service did not respond within ${Math.ceil(timeoutMs / 1000)} seconds. Check your connection and try again.`);
    if (externalSignal?.aborted) throw new Error('The request was cancelled.');
    throw new Error(`Cannot reach the study backend at ${apiBase}. Start it with npm run backend and make sure your device can reach your computer. For Expo tunnel or production, set EXPO_PUBLIC_API_URL in .env and restart Expo.`);
  } finally {
    clearTimeout(timeout);
    externalSignal?.removeEventListener('abort', abortWithRequest);
  }
}

export async function getBackendHealth(): Promise<BackendHealth> {
  if (!apiBase) throw new Error(missingApiBaseMessage);
  const response = await fetchBackend('/health');
  const data = await response.json() as BackendHealth & { error?: string };
  if (!response.ok) throw new Error(data.error || 'Could not check connected services.');
  return data;
}

export async function generateLyrics(sourceText: string, title: string, style: string, language: StudyLanguage, image?: { base64: string; mimeType: string }) {
  if (!apiBase) return null;
  const token = await getGuestToken();
  const response = await fetchBackend('/api/lyrics', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ sourceText, title, style, language, image }),
  }, GEMINI_REQUEST_TIMEOUT_MS);
  const data = await response.json() as { lyrics?: string; error?: string };
  if (!response.ok || !data.lyrics) throw new Error(data.error || 'AI lyric generation failed. Your notes are still here; try again or use the local draft.');
  return data.lyrics;
}

export async function generateTopicGuide(topic: string, context = '', signal?: AbortSignal) {
  const token = await getGuestToken();
  const response = await fetchBackend('/api/topic-guide', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ topic, context }),
    signal,
  }, 60_000);
  const data = await response.json() as { guide?: TopicGuide; error?: string };
  if (response.status === 404) throw new Error('The Study AI route is missing from the connected backend. Restart it from this project with npm run backend, then try again.');
  if (!response.ok || !data.guide) throw new Error(data.error || 'Gemini could not make a topic guide. Try again.');
  return data.guide;
}

export type PlannedStudyScene = Omit<StudyScene, 'status' | 'imageUri' | 'imageMimeType' | 'error' | 'updatedAt'>;

export async function planStudyScenes(title: string, sourceText: string, sections: { heading: string; body: string }[], sceneCount = 3) {
  const token = await getGuestToken();
  const response = await fetchBackend('/api/scenes/plan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ title, sourceText, sections, sceneCount }),
  }, 60_000);
  const data = await response.json() as { scenes?: PlannedStudyScene[]; error?: string };
  if (!response.ok || !Array.isArray(data.scenes) || !data.scenes.length) throw new Error(data.error || 'Could not plan illustration scenes from these notes.');
  return data.scenes;
}

export async function generateStudySceneImage(scene: Pick<StudyScene, 'title' | 'concept' | 'description' | 'caption' | 'visualPrompt'>) {
  const token = await getGuestToken();
  const response = await fetchBackend('/api/scenes/image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(scene),
  }, 120_000);
  const data = await response.json() as { imageBase64?: string; mimeType?: string; error?: string };
  if (!response.ok || !data.imageBase64 || !data.mimeType) throw new Error(data.error || 'Gemini could not generate this scene. Retry this image.');
  return { imageBase64: data.imageBase64, mimeType: data.mimeType };
}

export async function extractPdfNotes(fileName: string, base64: string) {
  if (!apiBase) throw new Error(`PDF note extraction needs the connected AI backend. ${missingApiBaseMessage}`);
  const token = await getGuestToken();
  const response = await fetchBackend('/api/pdf/notes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ pdf: { fileName, base64 } }),
  }, GEMINI_REQUEST_TIMEOUT_MS);
  const data = await response.json() as { notes?: string; error?: string };
  if (response.status === 404) throw new Error('The PDF extraction route is missing from the connected backend. Restart it from this project with npm run backend, then try again.');
  if (!response.ok || !data.notes) throw new Error(data.error || 'Could not extract readable notes from this PDF.');
  return data.notes;
}

export async function extractImageNotes(base64: string, mimeType: string) {
  const token = await getGuestToken();
  const response = await fetchBackend('/api/image/notes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ image: { base64, mimeType } }),
  }, GEMINI_REQUEST_TIMEOUT_MS);
  const data = await response.json() as { notes?: string; error?: string };
  if (!response.ok || !data.notes) throw new Error(data.error || 'Could not extract readable text from this photo.');
  return data.notes;
}

export async function generateStudyArtifact(kind: StudyArtifactKind, title: string, subject: string, sourceText: string) {
  if (!apiBase) return null;
  const token = await getGuestToken();
  const response = await fetchBackend('/api/artifacts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ kind, title, subject, sourceText }),
  }, GEMINI_REQUEST_TIMEOUT_MS);
  const data = await response.json() as { artifact?: StudyArtifactContent; error?: string };
  if (!response.ok || !data.artifact) throw new Error(data.error || 'The study studio could not create this artifact.');
  return data.artifact;
}

export async function requestAudio(lyrics: string, title: string, style: string, language: StudyLanguage = 'en') {
  const token = await getGuestToken();
  const response = await fetchBackend('/api/music/jobs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ lyrics, title, style, language }),
  });
  const data = await response.json() as { jobId?: string; audioUrl?: string; mimeType?: string; error?: string };
  if (!response.ok || !data.jobId) throw new Error(data.error || 'The music provider did not accept this request.');
  return data;
}

export async function checkAudioJob(jobId: string) {
  const token = await getGuestToken();
  const response = await fetchBackend(`/api/music/jobs/${encodeURIComponent(jobId)}`, { headers: { Authorization: `Bearer ${token}` } });
  const data = await response.json() as { status?: string; audioUrl?: string; mimeType?: string; error?: string };
  if (!response.ok) throw new Error(data.error || 'Could not check song generation.');
  return data;
}

export async function renderStudyVideo(title: string, sections: { heading: string; body: string }[]) {
  const token = await getGuestToken();
  const response = await fetchBackend('/api/videos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ title, sections }),
  }, 65_000);
  const data = await response.json() as { project?: string; status?: StudyVideoStatus; error?: string };
  if (!response.ok || !data.project) throw new Error(data.error || 'JSON2Video could not start this render.');
  return { projectId: data.project, status: data.status ?? 'pending' };
}

export async function checkStudyVideo(projectId: string) {
  const token = await getGuestToken();
  const response = await fetchBackend(`/api/videos/${encodeURIComponent(projectId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await response.json() as {
    status?: StudyVideoStatus;
    url?: string | null;
    thumbnail?: string | null;
    duration?: number | null;
    message?: string;
    error?: string;
  };
  if (!response.ok) throw new Error(data.error || 'Could not check video rendering.');
  return data;
}
