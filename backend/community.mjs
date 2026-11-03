import { randomUUID } from 'node:crypto';

const MAX_COMMUNITY_IMAGE_BYTES = 2 * 1024 * 1024;
const MAX_COMMUNITY_BODY_BYTES = 8 * 1024 * 1024;
const reputationPoints = Object.freeze({
  question: scoreFromEnv('COMMUNITY_REP_QUESTION', 2),
  answer: scoreFromEnv('COMMUNITY_REP_ANSWER', 5),
  answerUpvote: scoreFromEnv('COMMUNITY_REP_ANSWER_UPVOTE', 2),
  acceptedAnswer: scoreFromEnv('COMMUNITY_REP_ACCEPTED', 10),
});
let schemaReady;

function scoreFromEnv(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value >= 0 && value <= 1000 ? value : fallback;
}

export async function ensureCommunitySchema(database) {
  if (!schemaReady) {
    schemaReady = (async () => {
      const statements = [
        `CREATE TABLE IF NOT EXISTS community_profiles (
          user_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
          display_name VARCHAR(60) NOT NULL DEFAULT '',
          bio VARCHAR(500) NOT NULL DEFAULT '',
          country VARCHAR(80) NOT NULL DEFAULT '',
          academic_level VARCHAR(60) NOT NULL DEFAULT '',
          subjects JSON NOT NULL,
          avatar_media_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
          show_bio TINYINT(1) NOT NULL DEFAULT 0,
          show_subjects TINYINT(1) NOT NULL DEFAULT 0,
          show_country TINYINT(1) NOT NULL DEFAULT 0,
          show_academic_level TINYINT(1) NOT NULL DEFAULT 0,
          reputation INT NOT NULL DEFAULT 0,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          CONSTRAINT community_profiles_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB`,
        `CREATE TABLE IF NOT EXISTS community_questions (
          id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
          author_id BIGINT UNSIGNED NOT NULL,
          idempotency_key VARCHAR(64) NOT NULL,
          title VARCHAR(180) NOT NULL,
          body TEXT NOT NULL,
          subject VARCHAR(60) NOT NULL,
          academic_level VARCHAR(60) NOT NULL DEFAULT '',
          tags JSON NOT NULL,
          accepted_answer_id BIGINT UNSIGNED NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY community_question_idempotency (author_id, idempotency_key),
          KEY community_questions_created (created_at, id),
          KEY community_questions_subject (subject, created_at),
          KEY community_questions_author (author_id, created_at),
          CONSTRAINT community_questions_author_fk FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB`,
        `CREATE TABLE IF NOT EXISTS community_answers (
          id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
          question_id BIGINT UNSIGNED NOT NULL,
          author_id BIGINT UNSIGNED NOT NULL,
          idempotency_key VARCHAR(64) NOT NULL,
          body TEXT NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY community_answer_idempotency (author_id, question_id, idempotency_key),
          KEY community_answers_question (question_id, created_at, id),
          CONSTRAINT community_answers_question_fk FOREIGN KEY (question_id) REFERENCES community_questions(id) ON DELETE CASCADE,
          CONSTRAINT community_answers_author_fk FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB`,
        `CREATE TABLE IF NOT EXISTS community_media (
          id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
          uploader_id BIGINT UNSIGNED NOT NULL,
          mime_type VARCHAR(30) NOT NULL,
          media_data MEDIUMBLOB NOT NULL,
          question_id BIGINT UNSIGNED NULL,
          answer_id BIGINT UNSIGNED NULL,
          profile_user_id BIGINT UNSIGNED NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          KEY community_media_question (question_id, created_at),
          KEY community_media_answer (answer_id, created_at),
          UNIQUE KEY community_media_profile (profile_user_id),
          CONSTRAINT community_media_uploader_fk FOREIGN KEY (uploader_id) REFERENCES users(id) ON DELETE CASCADE,
          CONSTRAINT community_media_question_fk FOREIGN KEY (question_id) REFERENCES community_questions(id) ON DELETE SET NULL,
          CONSTRAINT community_media_answer_fk FOREIGN KEY (answer_id) REFERENCES community_answers(id) ON DELETE SET NULL,
          CONSTRAINT community_media_profile_fk FOREIGN KEY (profile_user_id) REFERENCES community_profiles(user_id) ON DELETE CASCADE
        ) ENGINE=InnoDB`,
        `CREATE TABLE IF NOT EXISTS community_comments (
          id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
          answer_id BIGINT UNSIGNED NOT NULL,
          parent_id BIGINT UNSIGNED NULL,
          author_id BIGINT UNSIGNED NOT NULL,
          body VARCHAR(1200) NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          KEY community_comments_answer (answer_id, created_at, id),
          KEY community_comments_parent (parent_id),
          CONSTRAINT community_comments_answer_fk FOREIGN KEY (answer_id) REFERENCES community_answers(id) ON DELETE CASCADE,
          CONSTRAINT community_comments_author_fk FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE,
          CONSTRAINT community_comments_parent_fk FOREIGN KEY (parent_id) REFERENCES community_comments(id) ON DELETE CASCADE
        ) ENGINE=InnoDB`,
        `CREATE TABLE IF NOT EXISTS community_votes (
          id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
          target_type ENUM('question','answer') NOT NULL,
          target_id BIGINT UNSIGNED NOT NULL,
          user_id BIGINT UNSIGNED NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY community_vote_once (target_type, target_id, user_id),
          KEY community_votes_target (target_type, target_id),
          CONSTRAINT community_votes_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB`,
        `CREATE TABLE IF NOT EXISTS community_bookmarks (
          user_id BIGINT UNSIGNED NOT NULL,
          question_id BIGINT UNSIGNED NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (user_id, question_id),
          KEY community_bookmarks_question (question_id),
          CONSTRAINT community_bookmarks_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          CONSTRAINT community_bookmarks_question_fk FOREIGN KEY (question_id) REFERENCES community_questions(id) ON DELETE CASCADE
        ) ENGINE=InnoDB`,
        `CREATE TABLE IF NOT EXISTS community_notifications (
          id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
          recipient_id BIGINT UNSIGNED NOT NULL,
          actor_id BIGINT UNSIGNED NOT NULL,
          event_type VARCHAR(40) NOT NULL,
          event_key VARCHAR(140) NOT NULL,
          question_id BIGINT UNSIGNED NULL,
          answer_id BIGINT UNSIGNED NULL,
          read_at TIMESTAMP NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY community_notification_once (event_key),
          KEY community_notifications_recipient (recipient_id, read_at, created_at),
          CONSTRAINT community_notifications_recipient_fk FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE,
          CONSTRAINT community_notifications_actor_fk FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE CASCADE,
          CONSTRAINT community_notifications_question_fk FOREIGN KEY (question_id) REFERENCES community_questions(id) ON DELETE CASCADE,
          CONSTRAINT community_notifications_answer_fk FOREIGN KEY (answer_id) REFERENCES community_answers(id) ON DELETE CASCADE
        ) ENGINE=InnoDB`,
        `CREATE TABLE IF NOT EXISTS community_notification_preferences (
          user_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
          notify_answers TINYINT(1) NOT NULL DEFAULT 1,
          notify_replies TINYINT(1) NOT NULL DEFAULT 1,
          notify_upvotes TINYINT(1) NOT NULL DEFAULT 1,
          notify_accepted TINYINT(1) NOT NULL DEFAULT 1,
          CONSTRAINT community_notification_preferences_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB`,
        `CREATE TABLE IF NOT EXISTS community_reports (
          id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
          reporter_id BIGINT UNSIGNED NOT NULL,
          target_type ENUM('question','answer','comment') NOT NULL,
          target_id BIGINT UNSIGNED NOT NULL,
          reason VARCHAR(60) NOT NULL,
          description VARCHAR(1000) NOT NULL DEFAULT '',
          status ENUM('open','reviewed','dismissed','actioned') NOT NULL DEFAULT 'open',
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          KEY community_reports_review (status, created_at),
          CONSTRAINT community_reports_reporter_fk FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB`,
        `CREATE TABLE IF NOT EXISTS community_follows (
          user_id BIGINT UNSIGNED NOT NULL,
          followed_user_id BIGINT UNSIGNED NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (user_id, followed_user_id),
          CONSTRAINT community_follows_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          CONSTRAINT community_follows_followed_fk FOREIGN KEY (followed_user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB`,
        `CREATE TABLE IF NOT EXISTS community_blocks (
          blocker_id BIGINT UNSIGNED NOT NULL,
          blocked_id BIGINT UNSIGNED NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (blocker_id, blocked_id),
          CONSTRAINT community_blocks_blocker_fk FOREIGN KEY (blocker_id) REFERENCES users(id) ON DELETE CASCADE,
          CONSTRAINT community_blocks_blocked_fk FOREIGN KEY (blocked_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB`,
      ];
      for (const statement of statements) await database.query(statement);
    })().catch((error) => { schemaReady = undefined; throw error; });
  }
  return schemaReady;
}

function jsonValue(value, fallback = []) {
  if (typeof value !== 'string') return value ?? fallback;
  try { return JSON.parse(value); } catch { return fallback; }
}

function cleanText(value, max, multiline = false) {
  if (typeof value !== 'string') return '';
  return value.replace(/\u0000/g, '').replace(/\r/g, '').trim().slice(0, max).replace(multiline ? /[^\S\n]+/g : /\s+/g, ' ');
}

function asId(value) {
  const id = String(value ?? '');
  return /^\d{1,20}$/.test(id) ? id : '';
}

function inferredBaseUrl(req) {
  const proto = String(req.headers?.['x-forwarded-proto'] ?? 'http').split(',')[0].trim();
  return `${proto}://${req.headers?.host ?? 'localhost'}`;
}

function mediaUrl(req, id) {
  return `${inferredBaseUrl(req)}/api/community/media/${id}`;
}

function communityLevel(points) {
  if (points >= 500) return 'Expert';
  if (points >= 150) return 'Scholar';
  if (points >= 50) return 'Contributor';
  if (points >= 10) return 'Learner';
  return 'Beginner';
}

function publicProfile(row, req) {
  const reputation = Number(row.reputation ?? 0);
  return {
    id: String(row.user_id ?? row.id),
    name: row.profile_name || row.display_name || 'Student',
    bio: row.show_bio ? (row.bio || '') : '',
    country: row.show_country ? (row.country || '') : '',
    academicLevel: row.show_academic_level ? (row.academic_level || '') : '',
    subjects: row.show_subjects ? jsonValue(row.subjects, []) : [],
    avatar: row.avatar_media_id ? { id: row.avatar_media_id, url: mediaUrl(req, row.avatar_media_id), mimeType: row.avatar_mime_type || 'image/jpeg' } : null,
    showBio: Boolean(row.show_bio),
    showSubjects: Boolean(row.show_subjects),
    reputation,
    level: communityLevel(reputation),
    showCountry: Boolean(row.show_country),
    showAcademicLevel: Boolean(row.show_academic_level),
  };
}

function createQuota(ctx, req, user, action, limit, windowMs) {
  ctx.enforceQuota(user.uid, `community-${action}`, limit, windowMs);
  ctx.enforceQuota(`ip:${req.socket?.remoteAddress ?? 'unknown'}`, `community-${action}`, limit * 4, windowMs);
}

async function readBody(req) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_COMMUNITY_BODY_BYTES) throw Object.assign(new Error('This upload is too large. Choose smaller images and try again.'), { statusCode: 413 });
    chunks.push(chunk);
  }
  try {
    const result = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Error();
    return result;
  } catch { throw Object.assign(new Error('Request body must be a JSON object.'), { statusCode: 400 }); }
}

async function addNotification(database, { recipientId, actorId, type, key, questionId, answerId }) {
  if (String(recipientId) === String(actorId)) return;
  const preferenceColumn = ({ answer: 'notify_answers', reply: 'notify_replies', upvote: 'notify_upvotes', accepted: 'notify_accepted' })[type];
  if (preferenceColumn) {
    const [preferences] = await database.execute(`SELECT ${preferenceColumn} AS enabled FROM community_notification_preferences WHERE user_id=? LIMIT 1`, [recipientId]);
    if (preferences.length && !preferences[0].enabled) return;
  }
  await database.execute(
    'INSERT IGNORE INTO community_notifications (recipient_id, actor_id, event_type, event_key, question_id, answer_id) VALUES (?, ?, ?, ?, ?, ?)',
    [recipientId, actorId, type, key, questionId ?? null, answerId ?? null],
  );
}

async function mediaFor(database, req, column, ids) {
  if (!ids.length) return new Map();
  const [rows] = await database.execute(`SELECT id, ${column} AS parent_id, mime_type FROM community_media WHERE ${column} IN (?) ORDER BY id`, [ids]);
  const result = new Map();
  for (const row of rows) {
    const parentId = String(row.parent_id);
    const current = result.get(parentId) ?? [];
    current.push({ id: row.id, url: mediaUrl(req, row.id), mimeType: row.mime_type });
    result.set(parentId, current);
  }
  return result;
}

function questionShape(row, images = [], req) {
  return {
    id: String(row.id),
    title: row.title,
    body: row.body,
    subject: row.subject,
    academicLevel: row.academic_level || '',
    tags: jsonValue(row.tags, []),
    images,
    author: {
      id: String(row.author_id), name: row.profile_name || row.author_name || 'Student',
      avatarUrl: row.avatar_media_id ? mediaUrl(req, row.avatar_media_id) : '',
      country: row.show_country ? (row.country || '') : '',
      reputation: Number(row.reputation ?? 0), level: communityLevel(Number(row.reputation ?? 0)),
    },
    answerCount: Number(row.answer_count ?? 0),
    voteCount: Number(row.vote_count ?? 0),
    accepted: Boolean(row.accepted_answer_id),
    acceptedAnswerId: row.accepted_answer_id == null ? null : String(row.accepted_answer_id),
    hasVoted: Boolean(row.has_voted),
    bookmarked: Boolean(row.bookmarked),
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

async function questionBase(database, userId, id) {
    const [rows] = await database.execute(
    `SELECT q.*, u.display_name AS author_name, p.display_name AS profile_name,
      p.country, p.show_country, p.reputation, p.avatar_media_id,
      (SELECT COUNT(*) FROM community_answers a WHERE a.question_id=q.id) AS answer_count,
      (SELECT COUNT(*) FROM community_votes v WHERE v.target_type='question' AND v.target_id=q.id) AS vote_count,
      EXISTS(SELECT 1 FROM community_votes v WHERE v.target_type='question' AND v.target_id=q.id AND v.user_id=?) AS has_voted,
      EXISTS(SELECT 1 FROM community_bookmarks b WHERE b.question_id=q.id AND b.user_id=?) AS bookmarked
      FROM community_questions q JOIN users u ON u.id=q.author_id
      LEFT JOIN community_profiles p ON p.user_id=q.author_id WHERE q.id=? LIMIT 1`, [userId, userId, id],
  );
  return rows[0] ?? null;
}

export async function handleCommunityRoute(req, res, url, ctx) {
  const path = url.pathname;
  if (!path.startsWith('/api/community')) return false;
  try {
    await ensureCommunitySchema(ctx.database);

    const mediaMatch = /^\/api\/community\/media\/([0-9a-f-]{36})$/i.exec(path);
    if (req.method === 'GET' && mediaMatch) {
      const [rows] = await ctx.database.execute('SELECT mime_type, media_data FROM community_media WHERE id=? AND (question_id IS NOT NULL OR answer_id IS NOT NULL OR profile_user_id IS NOT NULL) LIMIT 1', [mediaMatch[1]]);
      if (!rows.length) return ctx.sendJson(res, 404, { error: 'This community image is unavailable.' });
      res.writeHead(200, { 'Content-Type': rows[0].mime_type, 'Content-Length': rows[0].media_data.length, 'Cache-Control': 'public, max-age=86400', 'X-Content-Type-Options': 'nosniff' });
      res.end(rows[0].media_data);
      return true;
    }

    const user = ctx.requireAccount(req);
    await ctx.database.execute('INSERT IGNORE INTO community_profiles (user_id, display_name, subjects) VALUES (?, ?, JSON_ARRAY())', [Number(user.uid), user.name]);
    await ctx.database.execute('INSERT IGNORE INTO community_notification_preferences (user_id) VALUES (?)', [Number(user.uid)]);
    const uid = Number(user.uid);

    if (req.method === 'GET' && path === '/api/community/feed') {
      const filter = url.searchParams.get('filter') ?? 'latest';
      const search = cleanText(url.searchParams.get('q'), 140);
      const subject = cleanText(url.searchParams.get('subject'), 60);
      const academicLevel = cleanText(url.searchParams.get('academicLevel'), 60);
      const answered = url.searchParams.get('answered');
      const limit = Math.max(1, Math.min(30, Number(url.searchParams.get('limit')) || 15));
      const offset = Math.max(0, Math.min(100000, Number(url.searchParams.get('offset')) || 0));
      const clauses = [
        'NOT EXISTS (SELECT 1 FROM community_blocks b WHERE (b.blocker_id=? AND b.blocked_id=q.author_id) OR (b.blocker_id=q.author_id AND b.blocked_id=?))',
      ];
      const params = [uid, uid];
      if (filter === 'unanswered') clauses.push('NOT EXISTS (SELECT 1 FROM community_answers ax WHERE ax.question_id=q.id)');
      if (filter === 'for_you') {
        clauses.push(`(EXISTS (SELECT 1 FROM community_follows f WHERE f.user_id=? AND f.followed_user_id=q.author_id)
          OR EXISTS (SELECT 1 FROM community_profiles own WHERE own.user_id=? AND JSON_CONTAINS(own.subjects, JSON_QUOTE(q.subject)))
          OR (NOT EXISTS (SELECT 1 FROM community_follows f WHERE f.user_id=?)
              AND NOT EXISTS (SELECT 1 FROM community_profiles own WHERE own.user_id=? AND JSON_LENGTH(own.subjects)>0)))`);
        params.push(uid, uid, uid, uid);
      }
      if (filter === 'following') {
        clauses.push('EXISTS (SELECT 1 FROM community_follows f WHERE f.user_id=? AND f.followed_user_id=q.author_id)');
        params.push(uid);
      }
      if (filter === 'trending') clauses.push('q.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)');
      if (subject) { clauses.push('q.subject=?'); params.push(subject); }
      if (academicLevel) { clauses.push('q.academic_level=?'); params.push(academicLevel); }
      if (answered === 'yes') clauses.push('EXISTS (SELECT 1 FROM community_answers ax WHERE ax.question_id=q.id)');
      if (answered === 'no') clauses.push('NOT EXISTS (SELECT 1 FROM community_answers ax WHERE ax.question_id=q.id)');
      if (search) {
        clauses.push('(q.title LIKE ? OR q.body LIKE ? OR q.subject LIKE ? OR CAST(q.tags AS CHAR) LIKE ? OR EXISTS (SELECT 1 FROM community_answers sa WHERE sa.question_id=q.id AND sa.body LIKE ?) OR EXISTS (SELECT 1 FROM users su WHERE su.id=q.author_id AND su.display_name LIKE ?) OR EXISTS (SELECT 1 FROM community_profiles sp WHERE sp.user_id=q.author_id AND sp.display_name LIKE ?))');
        const match = `%${search}%`;
        params.push(match, match, match, match, match, match, match);
      }
      const order = filter === 'upvoted'
        ? 'vote_count DESC, q.updated_at DESC'
        : filter === 'trending'
          ? '((vote_count * 2 + answer_count * 3) / (TIMESTAMPDIFF(HOUR, q.created_at, NOW()) + 2)) DESC, q.created_at DESC'
          : 'q.updated_at DESC, q.id DESC';
      const [rows] = await ctx.database.execute(
        `SELECT q.id, q.author_id, q.title, q.body, q.subject, q.academic_level, q.tags, q.accepted_answer_id, q.created_at, q.updated_at,
          u.display_name AS author_name, p.display_name AS profile_name, p.country, p.show_country, p.reputation, p.avatar_media_id,
          (SELECT COUNT(*) FROM community_answers a WHERE a.question_id=q.id) AS answer_count,
          (SELECT COUNT(*) FROM community_votes v WHERE v.target_type='question' AND v.target_id=q.id) AS vote_count,
          EXISTS(SELECT 1 FROM community_votes v WHERE v.target_type='question' AND v.target_id=q.id AND v.user_id=?) AS has_voted,
          EXISTS(SELECT 1 FROM community_bookmarks b WHERE b.question_id=q.id AND b.user_id=?) AS bookmarked
          FROM community_questions q JOIN users u ON u.id=q.author_id LEFT JOIN community_profiles p ON p.user_id=q.author_id
          WHERE ${clauses.join(' AND ')} ORDER BY ${order} LIMIT ? OFFSET ?`,
        [uid, uid, ...params, limit, offset],
      );
      const media = await mediaFor(ctx.database, req, 'question_id', rows.map((row) => row.id));
      const questions = rows.map((row) => questionShape(row, media.get(String(row.id)) ?? [], req));
      return ctx.sendJson(res, 200, { questions, nextOffset: questions.length === limit ? offset + questions.length : null });
    }

    if (req.method === 'POST' && path === '/api/community/media') {
      createQuota(ctx, req, user, 'media-upload', 30, 60 * 60 * 1000);
      await ctx.database.execute('DELETE FROM community_media WHERE question_id IS NULL AND answer_id IS NULL AND profile_user_id IS NULL AND created_at < DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 1 DAY)');
      const body = await readBody(req);
      const mime = body.mimeType;
      const encoded = body.base64;
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(mime) || typeof encoded !== 'string' || encoded.length > Math.ceil(MAX_COMMUNITY_IMAGE_BYTES * 4 / 3) + 8 || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) {
        return ctx.sendJson(res, 400, { error: 'Choose a JPEG, PNG, or WebP image no larger than 2 MB.' });
      }
      const buffer = Buffer.from(encoded, 'base64');
      const validSignature = mime === 'image/jpeg'
        ? buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff
        : mime === 'image/png'
          ? buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
          : buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP';
      if (!buffer.length || buffer.length > MAX_COMMUNITY_IMAGE_BYTES || !validSignature) return ctx.sendJson(res, 400, { error: 'This image is invalid or larger than 2 MB. Choose another image.' });
      const id = randomUUID();
      await ctx.database.execute('INSERT INTO community_media (id, uploader_id, mime_type, media_data) VALUES (?, ?, ?, ?)', [id, uid, mime, buffer]);
      return ctx.sendJson(res, 201, { image: { id, url: mediaUrl(req, id), mimeType: mime } });
    }

    if (req.method === 'POST' && path === '/api/community/questions') {
      createQuota(ctx, req, user, 'question-create', 12, 60 * 60 * 1000);
      const body = await readBody(req);
      const title = cleanText(body.title, 180);
      const description = cleanText(body.body, 6000, true);
      const subject = cleanText(body.subject, 60);
      const level = cleanText(body.academicLevel, 60);
      const tags = Array.isArray(body.tags) ? [...new Set(body.tags.map((tag) => cleanText(tag, 28).replace(/^#/, '')).filter(Boolean))].slice(0, 8) : [];
      const imageIds = Array.isArray(body.imageIds) ? [...new Set(body.imageIds.filter((id) => typeof id === 'string' && /^[0-9a-f-]{36}$/i.test(id)))].slice(0, 4) : [];
      const key = cleanText(body.idempotencyKey, 64);
      if (title.length < 6) return ctx.sendJson(res, 400, { error: 'Use a clear question title with at least 6 characters.' });
      if (!description && !imageIds.length) return ctx.sendJson(res, 400, { error: 'Add a description or an image so other students can understand the question.' });
      if (!subject) return ctx.sendJson(res, 400, { error: 'Choose a subject for this question.' });
      if (!/^[A-Za-z0-9_-]{10,64}$/.test(key)) return ctx.sendJson(res, 400, { error: 'The question could not be safely submitted. Please try again.' });
      const connection = await ctx.database.getConnection();
      try {
        await connection.beginTransaction();
        const [existing] = await connection.execute('SELECT id FROM community_questions WHERE author_id=? AND idempotency_key=? LIMIT 1', [uid, key]);
        if (existing.length) {
          await connection.rollback();
          return ctx.sendJson(res, 200, { questionId: String(existing[0].id), duplicate: true });
        }
        if (imageIds.length) {
          const [images] = await connection.execute('SELECT id FROM community_media WHERE id IN (?) AND uploader_id=? AND question_id IS NULL AND answer_id IS NULL FOR UPDATE', [imageIds, uid]);
          if (images.length !== imageIds.length) throw Object.assign(new Error('An image upload expired or belongs to another account. Reattach the image and retry.'), { statusCode: 400 });
        }
        const [result] = await connection.execute('INSERT INTO community_questions (author_id, idempotency_key, title, body, subject, academic_level, tags) VALUES (?, ?, ?, ?, ?, ?, ?)', [uid, key, title, description, subject, level, JSON.stringify(tags)]);
        if (imageIds.length) await connection.execute('UPDATE community_media SET question_id=? WHERE id IN (?) AND uploader_id=?', [result.insertId, imageIds, uid]);
        await connection.execute('UPDATE community_profiles SET reputation=reputation+? WHERE user_id=?', [reputationPoints.question, uid]);
        await connection.commit();
        return ctx.sendJson(res, 201, { questionId: String(result.insertId) });
      } catch (error) {
        await connection.rollback();
        if (error?.code === 'ER_DUP_ENTRY') {
          const [existing] = await ctx.database.execute('SELECT id FROM community_questions WHERE author_id=? AND idempotency_key=? LIMIT 1', [uid, key]);
          if (existing.length) return ctx.sendJson(res, 200, { questionId: String(existing[0].id), duplicate: true });
        }
        throw error;
      }
      finally { connection.release(); }
    }

    const questionMatch = /^\/api\/community\/questions\/(\d+)$/.exec(path);
    if (req.method === 'PATCH' && questionMatch) {
      const body = await readBody(req);
      const title = cleanText(body.title, 180);
      const description = cleanText(body.body, 6000, true);
      const subject = cleanText(body.subject, 60);
      const academicLevel = cleanText(body.academicLevel, 60);
      const tags = Array.isArray(body.tags) ? [...new Set(body.tags.map((tag) => cleanText(tag, 28).replace(/^#/, '')).filter(Boolean))].slice(0, 8) : [];
      if (title.length < 6 || !subject) return ctx.sendJson(res, 400, { error: 'Add a clear title and subject before saving.' });
      const [rows] = await ctx.database.execute('SELECT author_id FROM community_questions WHERE id=? LIMIT 1', [questionMatch[1]]);
      if (!rows.length) return ctx.sendJson(res, 404, { error: 'This question could not be found.' });
      if (String(rows[0].author_id) !== String(uid)) return ctx.sendJson(res, 403, { error: 'You can only edit your own question.' });
      if (!description) {
        const [images] = await ctx.database.execute('SELECT 1 FROM community_media WHERE question_id=? LIMIT 1', [questionMatch[1]]);
        if (!images.length) return ctx.sendJson(res, 400, { error: 'Add a description or keep at least one question image.' });
      }
      await ctx.database.execute('UPDATE community_questions SET title=?, body=?, subject=?, academic_level=?, tags=?, updated_at=CURRENT_TIMESTAMP WHERE id=?', [title, description, subject, academicLevel, JSON.stringify(tags), questionMatch[1]]);
      return ctx.sendJson(res, 200, { saved: true });
    }
    if (req.method === 'DELETE' && questionMatch) {
      const connection = await ctx.database.getConnection();
      try {
        await connection.beginTransaction();
        const [questions] = await connection.execute('SELECT author_id, accepted_answer_id FROM community_questions WHERE id=? FOR UPDATE', [questionMatch[1]]);
        if (!questions.length) throw Object.assign(new Error('This question could not be found.'), { statusCode: 404 });
        if (String(questions[0].author_id) !== String(uid)) throw Object.assign(new Error('You can only delete your own question.'), { statusCode: 403 });
        const [answers] = await connection.execute(
          `SELECT a.id, a.author_id, (? + IF(a.id=?, ?,0) + (SELECT COUNT(*)*? FROM community_votes v WHERE v.target_type='answer' AND v.target_id=a.id)) AS earned
           FROM community_answers a WHERE a.question_id=?`, [reputationPoints.answer, questions[0].accepted_answer_id ?? 0, reputationPoints.acceptedAnswer, reputationPoints.answerUpvote, questionMatch[1]],
        );
        for (const answer of answers) await connection.execute('UPDATE community_profiles SET reputation=GREATEST(0, reputation-?) WHERE user_id=?', [Number(answer.earned), answer.author_id]);
        const answerIds = answers.map((answer) => answer.id);
        if (answerIds.length) {
          await connection.execute('DELETE FROM community_media WHERE answer_id IN (?)', [answerIds]);
          await connection.execute("DELETE FROM community_votes WHERE target_type='answer' AND target_id IN (?)", [answerIds]);
        }
        await connection.execute('DELETE FROM community_media WHERE question_id=?', [questionMatch[1]]);
        await connection.execute("DELETE FROM community_votes WHERE target_type='question' AND target_id=?", [questionMatch[1]]);
        await connection.execute('UPDATE community_profiles SET reputation=GREATEST(0, reputation-?) WHERE user_id=?', [reputationPoints.question, questions[0].author_id]);
        await connection.execute('DELETE FROM community_questions WHERE id=?', [questionMatch[1]]);
        await connection.commit();
        return ctx.sendJson(res, 200, { deleted: true });
      } catch (error) { await connection.rollback(); throw error; }
      finally { connection.release(); }
    }
    if (req.method === 'GET' && questionMatch) {
      const q = await questionBase(ctx.database, uid, questionMatch[1]);
      if (!q) return ctx.sendJson(res, 404, { error: 'This question could not be found.' });
      const block = await ctx.database.execute('SELECT 1 FROM community_blocks WHERE (blocker_id=? AND blocked_id=?) OR (blocker_id=? AND blocked_id=?) LIMIT 1', [uid, q.author_id, q.author_id, uid]);
      if (block[0].length) return ctx.sendJson(res, 404, { error: 'This question is unavailable.' });
      const [answerRows] = await ctx.database.execute(
        `SELECT a.*, u.display_name AS author_name, p.display_name AS profile_name, p.reputation,
          EXISTS(SELECT 1 FROM community_votes v WHERE v.target_type='answer' AND v.target_id=a.id AND v.user_id=?) AS has_voted,
          (SELECT COUNT(*) FROM community_votes v WHERE v.target_type='answer' AND v.target_id=a.id) AS vote_count,
          p.avatar_media_id, EXISTS(SELECT 1 FROM community_questions qx WHERE qx.accepted_answer_id=a.id) AS accepted
          FROM community_answers a JOIN users u ON u.id=a.author_id LEFT JOIN community_profiles p ON p.user_id=a.author_id
          WHERE a.question_id=? AND NOT EXISTS (SELECT 1 FROM community_blocks b WHERE (b.blocker_id=? AND b.blocked_id=a.author_id) OR (b.blocker_id=a.author_id AND b.blocked_id=?))
          ORDER BY accepted DESC, vote_count DESC, a.created_at ASC LIMIT 100`, [uid, questionMatch[1], uid, uid],
      );
      const answerMedia = await mediaFor(ctx.database, req, 'answer_id', answerRows.map((row) => row.id));
      const answerIds = answerRows.map((row) => row.id);
      const commentRows = answerIds.length ? (await ctx.database.execute(
        `SELECT c.id, c.answer_id, c.parent_id, c.author_id, c.body, c.created_at, u.display_name AS author_name, p.display_name AS profile_name
          FROM community_comments c JOIN users u ON u.id=c.author_id LEFT JOIN community_profiles p ON p.user_id=c.author_id
          WHERE c.answer_id IN (?)
            AND NOT EXISTS (SELECT 1 FROM community_blocks b WHERE (b.blocker_id=? AND b.blocked_id=c.author_id) OR (b.blocker_id=c.author_id AND b.blocked_id=?))
          ORDER BY c.created_at ASC LIMIT 300`, [answerIds, uid, uid],
      ))[0] : [];
      const commentsByAnswer = new Map();
      for (const row of commentRows) {
        const answerId = String(row.answer_id);
        const list = commentsByAnswer.get(answerId) ?? [];
        list.push({ id: String(row.id), parentId: row.parent_id == null ? null : String(row.parent_id), authorId: String(row.author_id), author: row.profile_name || row.author_name, body: row.body, createdAt: new Date(row.created_at).toISOString() });
        commentsByAnswer.set(answerId, list);
      }
      const questionImages = await mediaFor(ctx.database, req, 'question_id', [q.id]);
      const answers = answerRows.map((row) => ({
        id: String(row.id), questionId: String(row.question_id), authorId: String(row.author_id), author: row.profile_name || row.author_name, avatarUrl: row.avatar_media_id ? mediaUrl(req, row.avatar_media_id) : '',
        reputation: Number(row.reputation ?? 0), level: communityLevel(Number(row.reputation ?? 0)), body: row.body,
        images: answerMedia.get(String(row.id)) ?? [], comments: commentsByAnswer.get(String(row.id)) ?? [],
        voteCount: Number(row.vote_count ?? 0), hasVoted: Boolean(row.has_voted), accepted: Boolean(row.accepted), createdAt: new Date(row.created_at).toISOString(),
      }));
      return ctx.sendJson(res, 200, { question: questionShape(q, questionImages.get(String(q.id)) ?? [], req), answers });
    }

    if (req.method === 'POST' && path === '/api/community/answers') {
      createQuota(ctx, req, user, 'answer-create', 30, 60 * 60 * 1000);
      const body = await readBody(req);
      const questionId = asId(body.questionId);
      const content = cleanText(body.body, 6000, true);
      const imageIds = Array.isArray(body.imageIds) ? [...new Set(body.imageIds.filter((id) => typeof id === 'string' && /^[0-9a-f-]{36}$/i.test(id)))].slice(0, 4) : [];
      const key = cleanText(body.idempotencyKey, 64);
      if (!questionId || (!content && !imageIds.length) || !/^[A-Za-z0-9_-]{10,64}$/.test(key)) return ctx.sendJson(res, 400, { error: 'Write an explanation or attach an image before posting your answer.' });
      const connection = await ctx.database.getConnection();
      try {
        await connection.beginTransaction();
        const [questions] = await connection.execute('SELECT id, author_id FROM community_questions WHERE id=? FOR UPDATE', [questionId]);
        if (!questions.length) throw Object.assign(new Error('This question could not be found.'), { statusCode: 404 });
        const [existing] = await connection.execute('SELECT id FROM community_answers WHERE author_id=? AND question_id=? AND idempotency_key=? LIMIT 1', [uid, questionId, key]);
        if (existing.length) {
          await connection.rollback();
          return ctx.sendJson(res, 200, { answerId: String(existing[0].id), duplicate: true });
        }
        if (imageIds.length) {
          const [images] = await connection.execute('SELECT id FROM community_media WHERE id IN (?) AND uploader_id=? AND question_id IS NULL AND answer_id IS NULL FOR UPDATE', [imageIds, uid]);
          if (images.length !== imageIds.length) throw Object.assign(new Error('An image upload expired or belongs to another account. Reattach the image and retry.'), { statusCode: 400 });
        }
        const [result] = await connection.execute('INSERT INTO community_answers (question_id, author_id, idempotency_key, body) VALUES (?, ?, ?, ?)', [questionId, uid, key, content]);
        if (imageIds.length) await connection.execute('UPDATE community_media SET answer_id=? WHERE id IN (?) AND uploader_id=?', [result.insertId, imageIds, uid]);
        await connection.execute('UPDATE community_profiles SET reputation=reputation+? WHERE user_id=?', [reputationPoints.answer, uid]);
        await connection.execute('UPDATE community_questions SET updated_at=CURRENT_TIMESTAMP WHERE id=?', [questionId]);
        await addNotification(connection, { recipientId: questions[0].author_id, actorId: uid, type: 'answer', key: `answer:${result.insertId}`, questionId, answerId: result.insertId });
        await connection.commit();
        return ctx.sendJson(res, 201, { answerId: String(result.insertId) });
      } catch (error) {
        await connection.rollback();
        if (error?.code === 'ER_DUP_ENTRY') {
          const [existing] = await ctx.database.execute('SELECT id FROM community_answers WHERE author_id=? AND question_id=? AND idempotency_key=? LIMIT 1', [uid, questionId, key]);
          if (existing.length) return ctx.sendJson(res, 200, { answerId: String(existing[0].id), duplicate: true });
        }
        throw error;
      }
      finally { connection.release(); }
    }

    const answerMatch = /^\/api\/community\/answers\/(\d+)$/.exec(path);
    if (req.method === 'PATCH' && answerMatch) {
      const body = await readBody(req);
      const content = cleanText(body.body, 6000, true);
      if (content.length < 2) return ctx.sendJson(res, 400, { error: 'Write at least two characters before saving.' });
      const [rows] = await ctx.database.execute('SELECT author_id, question_id FROM community_answers WHERE id=? LIMIT 1', [answerMatch[1]]);
      if (!rows.length) return ctx.sendJson(res, 404, { error: 'This answer could not be found.' });
      if (String(rows[0].author_id) !== String(uid)) return ctx.sendJson(res, 403, { error: 'You can only edit your own answer.' });
      await ctx.database.execute('UPDATE community_answers SET body=?, updated_at=CURRENT_TIMESTAMP WHERE id=?', [content, answerMatch[1]]);
      await ctx.database.execute('UPDATE community_questions SET updated_at=CURRENT_TIMESTAMP WHERE id=?', [rows[0].question_id]);
      return ctx.sendJson(res, 200, { saved: true });
    }
    if (req.method === 'DELETE' && answerMatch) {
      const connection = await ctx.database.getConnection();
      try {
        await connection.beginTransaction();
        const [rows] = await connection.execute('SELECT a.author_id, a.question_id, q.accepted_answer_id, (SELECT COUNT(*)*? FROM community_votes v WHERE v.target_type=\'answer\' AND v.target_id=a.id) AS vote_points FROM community_answers a JOIN community_questions q ON q.id=a.question_id WHERE a.id=? FOR UPDATE', [reputationPoints.answerUpvote, answerMatch[1]]);
        if (!rows.length) throw Object.assign(new Error('This answer could not be found.'), { statusCode: 404 });
        const row = rows[0];
        if (String(row.author_id) !== String(uid)) throw Object.assign(new Error('You can only delete your own answer.'), { statusCode: 403 });
        const earned = reputationPoints.answer + Number(row.vote_points) + (String(row.accepted_answer_id ?? '') === String(answerMatch[1]) ? reputationPoints.acceptedAnswer : 0);
        await connection.execute('UPDATE community_profiles SET reputation=GREATEST(0, reputation-?) WHERE user_id=?', [earned, row.author_id]);
        await connection.execute('DELETE FROM community_media WHERE answer_id=?', [answerMatch[1]]);
        await connection.execute("DELETE FROM community_votes WHERE target_type='answer' AND target_id=?", [answerMatch[1]]);
        if (String(row.accepted_answer_id ?? '') === String(answerMatch[1])) await connection.execute('UPDATE community_questions SET accepted_answer_id=NULL, updated_at=CURRENT_TIMESTAMP WHERE id=?', [row.question_id]);
        else await connection.execute('UPDATE community_questions SET updated_at=CURRENT_TIMESTAMP WHERE id=?', [row.question_id]);
        await connection.execute('DELETE FROM community_answers WHERE id=?', [answerMatch[1]]);
        await connection.commit();
        return ctx.sendJson(res, 200, { deleted: true });
      } catch (error) { await connection.rollback(); throw error; }
      finally { connection.release(); }
    }

    const commentMatch = /^\/api\/community\/comments\/(\d+)$/.exec(path);
    if (req.method === 'DELETE' && commentMatch) {
      const [rows] = await ctx.database.execute('SELECT author_id FROM community_comments WHERE id=? LIMIT 1', [commentMatch[1]]);
      if (!rows.length) return ctx.sendJson(res, 404, { error: 'This reply could not be found.' });
      if (String(rows[0].author_id) !== String(uid)) return ctx.sendJson(res, 403, { error: 'You can only delete your own reply.' });
      await ctx.database.execute('DELETE FROM community_comments WHERE id=?', [commentMatch[1]]);
      return ctx.sendJson(res, 200, { deleted: true });
    }

    const answerCommentMatch = /^\/api\/community\/questions\/(\d+)\/answers\/(\d+)\/comments$/.exec(path);
    if (req.method === 'POST' && answerCommentMatch) {
      createQuota(ctx, req, user, 'comment-create', 45, 60 * 60 * 1000);
      const body = await readBody(req);
      const content = cleanText(body.body, 1200, true);
      if (content.length < 2) return ctx.sendJson(res, 400, { error: 'Write a short reply before posting.' });
      const [answerRows] = await ctx.database.execute('SELECT id, author_id FROM community_answers WHERE id=? AND question_id=? LIMIT 1', [answerCommentMatch[2], answerCommentMatch[1]]);
      if (!answerRows.length) return ctx.sendJson(res, 404, { error: 'This answer could not be found.' });
      let parentId = null;
      let recipientId = answerRows[0].author_id;
      if (body.parentId != null) {
        const [parents] = await ctx.database.execute('SELECT id, author_id, parent_id FROM community_comments WHERE id=? AND answer_id=? LIMIT 1', [asId(body.parentId), answerCommentMatch[2]]);
        if (!parents.length || parents[0].parent_id != null) return ctx.sendJson(res, 400, { error: 'Replies can be nested one level deep.' });
        parentId = parents[0].id;
        recipientId = parents[0].author_id;
      }
      const [result] = await ctx.database.execute('INSERT INTO community_comments (answer_id, parent_id, author_id, body) VALUES (?, ?, ?, ?)', [answerCommentMatch[2], parentId, uid, content]);
      await addNotification(ctx.database, { recipientId, actorId: uid, type: 'reply', key: `comment:${result.insertId}`, questionId: answerCommentMatch[1], answerId: answerCommentMatch[2] });
      return ctx.sendJson(res, 201, { commentId: String(result.insertId) });
    }

    if (req.method === 'POST' && path === '/api/community/vote') {
      createQuota(ctx, req, user, 'vote', 180, 60 * 60 * 1000);
      const body = await readBody(req);
      const type = body.targetType === 'answer' ? 'answer' : body.targetType === 'question' ? 'question' : '';
      const targetId = asId(body.targetId);
      if (!type || !targetId || typeof body.voted !== 'boolean') return ctx.sendJson(res, 400, { error: 'This vote target is invalid.' });
      const table = type === 'answer' ? 'community_answers' : 'community_questions';
      const [targets] = await ctx.database.execute(`SELECT id, author_id${type === 'answer' ? ', question_id' : ''} FROM ${table} WHERE id=? LIMIT 1`, [targetId]);
      if (!targets.length) return ctx.sendJson(res, 404, { error: 'This post could not be found.' });
      if (String(targets[0].author_id) === String(uid)) return ctx.sendJson(res, 403, { error: 'You cannot upvote your own post.' });
      const connection = await ctx.database.getConnection();
      try {
        await connection.beginTransaction();
        const voted = body.voted;
        if (body.voted) {
          const [result] = await connection.execute('INSERT IGNORE INTO community_votes (target_type, target_id, user_id) VALUES (?, ?, ?)', [type, targetId, uid]);
          if (result.affectedRows === 1 && type === 'answer') {
            await connection.execute('UPDATE community_profiles SET reputation=reputation+? WHERE user_id=?', [reputationPoints.answerUpvote, targets[0].author_id]);
            await addNotification(connection, { recipientId: targets[0].author_id, actorId: uid, type: 'upvote', key: `upvote:answer:${targetId}:${uid}`, questionId: targets[0].question_id, answerId: targetId });
          }
        } else {
          const [result] = await connection.execute('DELETE FROM community_votes WHERE target_type=? AND target_id=? AND user_id=?', [type, targetId, uid]);
          if (result.affectedRows === 1 && type === 'answer') await connection.execute('UPDATE community_profiles SET reputation=GREATEST(0, reputation-?) WHERE user_id=?', [reputationPoints.answerUpvote, targets[0].author_id]);
        }
        const [counts] = await connection.execute('SELECT COUNT(*) AS count FROM community_votes WHERE target_type=? AND target_id=?', [type, targetId]);
        await connection.commit();
        return ctx.sendJson(res, 200, { voted, voteCount: Number(counts[0].count) });
      } catch (error) { await connection.rollback(); throw error; }
      finally { connection.release(); }
    }

    if (req.method === 'POST' && path === '/api/community/bookmark') {
      const body = await readBody(req);
      const questionId = asId(body.questionId);
      if (!questionId || typeof body.saved !== 'boolean') return ctx.sendJson(res, 400, { error: 'This question is invalid.' });
      const [questions] = await ctx.database.execute('SELECT id FROM community_questions WHERE id=? LIMIT 1', [questionId]);
      if (!questions.length) return ctx.sendJson(res, 404, { error: 'This question could not be found.' });
      const saved = body.saved;
      if (saved) await ctx.database.execute('INSERT IGNORE INTO community_bookmarks (user_id, question_id) VALUES (?, ?)', [uid, questionId]);
      else await ctx.database.execute('DELETE FROM community_bookmarks WHERE user_id=? AND question_id=?', [uid, questionId]);
      return ctx.sendJson(res, 200, { saved });
    }

    if (req.method === 'GET' && path === '/api/community/saved') {
      const offset = Math.max(0, Math.min(100000, Number(url.searchParams.get('offset')) || 0));
      const [rows] = await ctx.database.execute(
        `SELECT q.id, q.author_id, q.title, q.body, q.subject, q.academic_level, q.tags, q.accepted_answer_id, q.created_at, q.updated_at,
          u.display_name AS author_name, p.display_name AS profile_name, p.country, p.show_country, p.reputation, p.avatar_media_id,
          (SELECT COUNT(*) FROM community_answers a WHERE a.question_id=q.id) AS answer_count,
          (SELECT COUNT(*) FROM community_votes v WHERE v.target_type='question' AND v.target_id=q.id) AS vote_count,
          EXISTS(SELECT 1 FROM community_votes v WHERE v.target_type='question' AND v.target_id=q.id AND v.user_id=?) AS has_voted,
          1 AS bookmarked FROM community_bookmarks b JOIN community_questions q ON q.id=b.question_id JOIN users u ON u.id=q.author_id
          LEFT JOIN community_profiles p ON p.user_id=q.author_id WHERE b.user_id=?
          AND NOT EXISTS (SELECT 1 FROM community_blocks bl WHERE (bl.blocker_id=? AND bl.blocked_id=q.author_id) OR (bl.blocker_id=q.author_id AND bl.blocked_id=?))
          ORDER BY b.created_at DESC LIMIT 20 OFFSET ?`, [uid, uid, uid, offset],
      );
      const media = await mediaFor(ctx.database, req, 'question_id', rows.map((row) => row.id));
      return ctx.sendJson(res, 200, { questions: rows.map((row) => questionShape(row, media.get(String(row.id)) ?? [], req)), nextOffset: rows.length === 20 ? offset + rows.length : null });
    }

    const acceptedMatch = /^\/api\/community\/answers\/(\d+)\/accept$/.exec(path);
    if (req.method === 'POST' && acceptedMatch) {
      const connection = await ctx.database.getConnection();
      try {
        await connection.beginTransaction();
        const [answers] = await connection.execute('SELECT a.id, a.question_id, a.author_id, q.author_id AS question_author, q.accepted_answer_id FROM community_answers a JOIN community_questions q ON q.id=a.question_id WHERE a.id=? FOR UPDATE', [acceptedMatch[1]]);
        if (!answers.length) throw Object.assign(new Error('This answer could not be found.'), { statusCode: 404 });
        const row = answers[0];
        if (String(row.question_author) !== String(uid)) throw Object.assign(new Error('Only the question author can accept an answer.'), { statusCode: 403 });
        if (String(row.accepted_answer_id ?? '') === String(row.id)) {
          await connection.execute('UPDATE community_questions SET accepted_answer_id=NULL WHERE id=?', [row.question_id]);
          await connection.execute('UPDATE community_profiles SET reputation=GREATEST(0, reputation-?) WHERE user_id=?', [reputationPoints.acceptedAnswer, row.author_id]);
          await connection.commit();
          return ctx.sendJson(res, 200, { accepted: false });
        }
        if (row.accepted_answer_id != null) {
          const [old] = await connection.execute('SELECT author_id FROM community_answers WHERE id=? LIMIT 1', [row.accepted_answer_id]);
          if (old.length) await connection.execute('UPDATE community_profiles SET reputation=GREATEST(0, reputation-?) WHERE user_id=?', [reputationPoints.acceptedAnswer, old[0].author_id]);
        }
        await connection.execute('UPDATE community_questions SET accepted_answer_id=?, updated_at=CURRENT_TIMESTAMP WHERE id=?', [row.id, row.question_id]);
        await connection.execute('UPDATE community_profiles SET reputation=reputation+? WHERE user_id=?', [reputationPoints.acceptedAnswer, row.author_id]);
        await addNotification(connection, { recipientId: row.author_id, actorId: uid, type: 'accepted', key: `accepted:${row.question_id}:${row.id}`, questionId: row.question_id, answerId: row.id });
        await connection.commit();
        return ctx.sendJson(res, 200, { accepted: true });
      } catch (error) { await connection.rollback(); throw error; }
      finally { connection.release(); }
    }

    if (req.method === 'POST' && path === '/api/community/report') {
      createQuota(ctx, req, user, 'report', 20, 60 * 60 * 1000);
      const body = await readBody(req);
      const type = ['question', 'answer', 'comment'].includes(body.targetType) ? body.targetType : '';
      const targetId = asId(body.targetId);
      const reason = cleanText(body.reason, 60);
      const description = cleanText(body.description, 1000, true);
      const table = type === 'question' ? 'community_questions' : type === 'answer' ? 'community_answers' : type === 'comment' ? 'community_comments' : '';
      if (!table || !targetId || !reason) return ctx.sendJson(res, 400, { error: 'Choose a reason for this report.' });
      const [targets] = await ctx.database.execute(`SELECT id FROM ${table} WHERE id=? LIMIT 1`, [targetId]);
      if (!targets.length) return ctx.sendJson(res, 404, { error: 'This post could not be found.' });
      await ctx.database.execute('INSERT INTO community_reports (reporter_id, target_type, target_id, reason, description) VALUES (?, ?, ?, ?, ?)', [uid, type, targetId, reason, description]);
      return ctx.sendJson(res, 201, { reported: true });
    }

    if (req.method === 'GET' && path === '/api/community/notifications') {
      const [rows] = await ctx.database.execute(
        `SELECT n.id, n.event_type, n.question_id, n.answer_id, n.read_at, n.created_at, u.display_name AS actor_name
          FROM community_notifications n JOIN users u ON u.id=n.actor_id WHERE n.recipient_id=? ORDER BY n.created_at DESC LIMIT 100`, [uid],
      );
      const [countRows] = await ctx.database.execute('SELECT COUNT(*) AS count FROM community_notifications WHERE recipient_id=? AND read_at IS NULL', [uid]);
      return ctx.sendJson(res, 200, { notifications: rows.map((row) => ({ id: String(row.id), type: row.event_type, questionId: row.question_id == null ? null : String(row.question_id), answerId: row.answer_id == null ? null : String(row.answer_id), actor: row.actor_name, read: Boolean(row.read_at), createdAt: new Date(row.created_at).toISOString() })), unreadCount: Number(countRows[0].count) });
    }
    if (req.method === 'POST' && path === '/api/community/notifications/read-all') {
      await ctx.database.execute('UPDATE community_notifications SET read_at=CURRENT_TIMESTAMP WHERE recipient_id=? AND read_at IS NULL', [uid]);
      return ctx.sendJson(res, 200, { read: true });
    }
    const readNotificationMatch = /^\/api\/community\/notifications\/(\d+)\/read$/.exec(path);
    if (req.method === 'POST' && readNotificationMatch) {
      await ctx.database.execute('UPDATE community_notifications SET read_at=COALESCE(read_at, CURRENT_TIMESTAMP) WHERE id=? AND recipient_id=?', [readNotificationMatch[1], uid]);
      return ctx.sendJson(res, 200, { read: true });
    }

    if (req.method === 'GET' && path === '/api/community/notification-preferences') {
      const [rows] = await ctx.database.execute('SELECT notify_answers AS answers, notify_replies AS replies, notify_upvotes AS upvotes, notify_accepted AS accepted FROM community_notification_preferences WHERE user_id=? LIMIT 1', [uid]);
      const row = rows[0] ?? {};
      return ctx.sendJson(res, 200, { preferences: { answers: Boolean(row.answers ?? 1), replies: Boolean(row.replies ?? 1), upvotes: Boolean(row.upvotes ?? 1), accepted: Boolean(row.accepted ?? 1) } });
    }
    if (req.method === 'PATCH' && path === '/api/community/notification-preferences') {
      const body = await readBody(req);
      await ctx.database.execute('UPDATE community_notification_preferences SET notify_answers=?, notify_replies=?, notify_upvotes=?, notify_accepted=? WHERE user_id=?', [body.answers ? 1 : 0, body.replies ? 1 : 0, body.upvotes ? 1 : 0, body.accepted ? 1 : 0, uid]);
      return ctx.sendJson(res, 200, { saved: true });
    }

    const profileMatch = /^\/api\/community\/profiles\/(\d+)$/.exec(path);
    if (req.method === 'GET' && profileMatch) {
      const [rows] = await ctx.database.execute(
        `SELECT u.id, u.display_name, p.display_name AS profile_name, p.bio, p.country, p.academic_level, p.subjects, p.avatar_media_id, p.show_bio, p.show_subjects, p.show_country, p.show_academic_level, p.reputation, avatar.mime_type AS avatar_mime_type,
          (SELECT COUNT(*) FROM community_questions q WHERE q.author_id=u.id) AS question_count,
          (SELECT COUNT(*) FROM community_answers a WHERE a.author_id=u.id) AS answer_count,
          (SELECT COUNT(*) FROM community_answers a JOIN community_questions q ON q.accepted_answer_id=a.id WHERE a.author_id=u.id) AS accepted_count,
          EXISTS(SELECT 1 FROM community_follows f WHERE f.user_id=? AND f.followed_user_id=u.id) AS following
          FROM users u LEFT JOIN community_profiles p ON p.user_id=u.id LEFT JOIN community_media avatar ON avatar.id=p.avatar_media_id WHERE u.id=? LIMIT 1`, [uid, profileMatch[1]],
      );
      if (!rows.length) return ctx.sendJson(res, 404, { error: 'This student profile could not be found.' });
      const block = await ctx.database.execute('SELECT 1 FROM community_blocks WHERE (blocker_id=? AND blocked_id=?) OR (blocker_id=? AND blocked_id=?) LIMIT 1', [uid, profileMatch[1], profileMatch[1], uid]);
      if (block[0].length) return ctx.sendJson(res, 404, { error: 'This profile is unavailable.' });
      const profile = publicProfile(rows[0], req);
      const [questions] = await ctx.database.execute('SELECT id, title, subject, created_at FROM community_questions WHERE author_id=? ORDER BY created_at DESC LIMIT 10', [profileMatch[1]]);
      const [answers] = await ctx.database.execute('SELECT id, question_id, body, created_at FROM community_answers WHERE author_id=? ORDER BY created_at DESC LIMIT 10', [profileMatch[1]]);
      return ctx.sendJson(res, 200, { profile: { ...profile, questionCount: Number(rows[0].question_count), answerCount: Number(rows[0].answer_count), acceptedCount: Number(rows[0].accepted_count), following: Boolean(rows[0].following), isSelf: String(uid) === String(profileMatch[1]) }, questions: questions.map((row) => ({ id: String(row.id), title: row.title, subject: row.subject, createdAt: new Date(row.created_at).toISOString() })), answers: answers.map((row) => ({ id: String(row.id), questionId: String(row.question_id), body: row.body, createdAt: new Date(row.created_at).toISOString() })) });
    }

    if (req.method === 'PATCH' && path === '/api/community/profile') {
      const body = await readBody(req);
      const name = cleanText(body.name, 60);
      const bio = cleanText(body.bio, 500, true);
      const country = cleanText(body.country, 80);
      const level = cleanText(body.academicLevel, 60);
      const subjects = Array.isArray(body.subjects) ? [...new Set(body.subjects.map((item) => cleanText(item, 40)).filter(Boolean))].slice(0, 12) : [];
      if (name.length < 2) return ctx.sendJson(res, 400, { error: 'Use a display name with at least 2 characters.' });
      const connection = await ctx.database.getConnection();
      try {
        await connection.beginTransaction();
        const [profiles] = await connection.execute('SELECT avatar_media_id FROM community_profiles WHERE user_id=? FOR UPDATE', [uid]);
        const previousAvatarId = profiles[0]?.avatar_media_id ?? null;
        const requestedAvatarId = body.avatarMediaId === undefined ? previousAvatarId : (body.avatarMediaId == null || body.avatarMediaId === '' ? null : String(body.avatarMediaId));
        if (requestedAvatarId && !/^[0-9a-f-]{36}$/i.test(requestedAvatarId)) throw Object.assign(new Error('Choose a supported profile image.'), { statusCode: 400 });
        if (requestedAvatarId && requestedAvatarId !== previousAvatarId) {
          const [images] = await connection.execute('SELECT id FROM community_media WHERE id=? AND uploader_id=? AND question_id IS NULL AND answer_id IS NULL AND profile_user_id IS NULL FOR UPDATE', [requestedAvatarId, uid]);
          if (!images.length) throw Object.assign(new Error('The profile image upload expired. Choose the image again.'), { statusCode: 400 });
          await connection.execute('UPDATE community_media SET profile_user_id=NULL WHERE profile_user_id=?', [uid]);
          await connection.execute('UPDATE community_media SET profile_user_id=? WHERE id=?', [uid, requestedAvatarId]);
        } else if (!requestedAvatarId && previousAvatarId) {
          await connection.execute('UPDATE community_media SET profile_user_id=NULL WHERE profile_user_id=?', [uid]);
        }
        await connection.execute('UPDATE community_profiles SET display_name=?, bio=?, country=?, academic_level=?, subjects=?, avatar_media_id=?, show_bio=?, show_subjects=?, show_country=?, show_academic_level=? WHERE user_id=?', [name, bio, country, level, JSON.stringify(subjects), requestedAvatarId, body.showBio ? 1 : 0, body.showSubjects ? 1 : 0, body.showCountry ? 1 : 0, body.showAcademicLevel ? 1 : 0, uid]);
        await connection.commit();
      } catch (error) { await connection.rollback(); throw error; }
      finally { connection.release(); }
      return ctx.sendJson(res, 200, { saved: true });
    }

    if (req.method === 'POST' && path === '/api/community/follow') {
      const body = await readBody(req);
      const target = asId(body.userId);
      if (!target || target === String(uid) || typeof body.following !== 'boolean') return ctx.sendJson(res, 400, { error: 'Choose another student to follow.' });
      const [rows] = await ctx.database.execute('SELECT id FROM users WHERE id=? LIMIT 1', [target]);
      if (!rows.length) return ctx.sendJson(res, 404, { error: 'This student could not be found.' });
      const following = body.following;
      if (following) await ctx.database.execute('INSERT IGNORE INTO community_follows (user_id, followed_user_id) VALUES (?, ?)', [uid, target]);
      else await ctx.database.execute('DELETE FROM community_follows WHERE user_id=? AND followed_user_id=?', [uid, target]);
      return ctx.sendJson(res, 200, { following });
    }

    if (req.method === 'POST' && path === '/api/community/block') {
      const body = await readBody(req);
      const target = asId(body.userId);
      if (!target || target === String(uid)) return ctx.sendJson(res, 400, { error: 'Choose another student to block.' });
      await ctx.database.execute('INSERT IGNORE INTO community_blocks (blocker_id, blocked_id) VALUES (?, ?)', [uid, target]);
      await ctx.database.execute('DELETE FROM community_follows WHERE (user_id=? AND followed_user_id=?) OR (user_id=? AND followed_user_id=?)', [uid, target, target, uid]);
      return ctx.sendJson(res, 200, { blocked: true });
    }

    return ctx.sendJson(res, 404, { error: 'Community route not found.' });
  } catch (error) {
    if (error?.statusCode) return ctx.sendJson(res, error.statusCode, { error: error.message });
    if (error?.code?.startsWith?.('ER_') || ['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND'].includes(error?.code)) {
      console.error('Community MySQL request failed:', error.code);
      return ctx.sendJson(res, 503, { error: 'The community database is unavailable. Start MySQL and check the existing backend connection settings.' });
    }
    console.error('Community request failed', error?.message ?? 'unknown error');
    return ctx.sendJson(res, 500, { error: 'The community request could not be completed.' });
  }
}
