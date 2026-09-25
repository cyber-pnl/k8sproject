const { query } = require("../../shared/database");
const { getClient } = require("../../shared/redis");
const { marked } = require("marked");
const s3 = require("../../shared/s3");

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// ── Utilitaires ────────────────────────────────────────────────

function slugify(text) {
  return (
    String(text || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 150) || "item"
  );
}

async function cacheGet(key) {
  const client = getClient();
  if (client && client.isOpen) {
    try {
      const value = await client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (err) {
      console.error("Redis get error:", err);
    }
  }
  return null;
}

async function cacheSet(key, ttl, value) {
  const client = getClient();
  if (client && client.isOpen) {
    try {
      await client.setEx(key, ttl, JSON.stringify(value));
    } catch (err) {
      console.error("Redis set error:", err);
    }
  }
}

async function cacheDel(key) {
  const client = getClient();
  if (client && client.isOpen) {
    try {
      await client.del(key);
    } catch (err) {
      console.error("Redis del error:", err);
    }
  }
}

async function getCourseOr404(courseId) {
  const result = await query("SELECT * FROM courses WHERE id = $1", [courseId]);
  if (!result.rows[0]) throw new HttpError(404, "Course not found");
  return result.rows[0];
}

// ── Accès public ───────────────────────────────────────────────

async function listCourses() {
  const cached = await cacheGet("courses:all");
  if (cached) return { source: "cache", data: cached };

  const result = await query(`
    SELECT c.id, c.title, c.slug, c.level, c.description, c.tags, c.created_at,
      (SELECT COUNT(*) FROM lessons l WHERE l.course_id = c.id) AS lesson_count
    FROM courses c
    ORDER BY c.created_at DESC
  `);

  await cacheSet("courses:all", 300, result.rows);
  return { source: "database", data: result.rows };
}

async function getCourseBySlug(slug) {
  const result = await query("SELECT * FROM courses WHERE slug = $1", [slug]);
  if (!result.rows[0]) throw new HttpError(404, "Course not found");

  const lessons = await query(
    "SELECT id, title, slug, order_index, duration_minutes FROM lessons WHERE course_id = $1 ORDER BY order_index",
    [result.rows[0].id]
  );

  return { course: result.rows[0], lessons: lessons.rows };
}

async function getLessonContent(userId, slug, lessonSlug) {
  const { course } = await getCourseBySlug(slug);

  const lessonResult = await query(
    "SELECT * FROM lessons WHERE course_id = $1 AND slug = $2",
    [course.id, lessonSlug]
  );
  if (!lessonResult.rows[0]) throw new HttpError(404, "Lesson not found");
  const lesson = lessonResult.rows[0];

  const key = lesson.s3_key || s3.lessonKey(course.id, lesson.id);
  let markdown = await cacheGet(`content:${course.id}:${lesson.id}`);
  if (markdown == null) {
    markdown = (await s3.getObject(key)) || "";
    await cacheSet(`content:${course.id}:${lesson.id}`, 3600, markdown);
  }

  const contentHtml = marked.parse(markdown || "");
  const progress = await query(
    "SELECT 1 FROM lesson_progress WHERE user_id = $1 AND lesson_id = $2",
    [parseInt(userId, 10), lesson.id]
  );

  return {
    course,
    lesson,
    contentHtml,
    completed: progress.rows.length > 0,
  };
}

// ── Admin : cours ──────────────────────────────────────────────

async function createCourse(data) {
  const title = String(data.title || "").trim();
  if (!title) throw new HttpError(400, "Title is required");

  const slug = slugify(data.slug || title);
  const result = await query(
    `INSERT INTO courses (title, description, level, slug, tags)
     VALUES ($1, $2, $3, $4, $5) RETURNING id, title, slug, level, description, tags, created_at`,
    [title, String(data.description || ""), String(data.level || "beginner"), slug, String(data.tags || "")]
  );

  await cacheDel("courses:all");
  return result.rows[0];
}

async function updateCourse(id, data) {
  await getCourseOr404(id);

  const fields = [];
  const params = [];

  if (data.title !== undefined) {
    fields.push("title = $1");
    params.push(String(data.title).trim());
  }
  if (data.description !== undefined) {
    fields.push(`description = $${fields.length + 1}`);
    params.push(String(data.description));
  }
  if (data.level !== undefined) {
    fields.push(`level = $${fields.length + 1}`);
    params.push(String(data.level));
  }
  if (data.tags !== undefined) {
    fields.push(`tags = $${fields.length + 1}`);
    params.push(String(data.tags));
  }
  if (data.slug !== undefined) {
    fields.push(`slug = $${fields.length + 1}`);
    params.push(slugify(data.slug));
  }

  if (!fields.length) return getCourseOr404(id);

  params.push(id);
  const result = await query(
    `UPDATE courses SET ${fields.join(", ")} WHERE id = $${params.length} RETURNING id, title, slug, level, description, tags, created_at`,
    params
  );

  await cacheDel("courses:all");
  return result.rows[0];
}

async function deleteCourse(id) {
  await getCourseOr404(id);
  await query("DELETE FROM courses WHERE id = $1", [id]);
  await cacheDel("courses:all");
  return { success: true };
}

// ── Admin : leçons ─────────────────────────────────────────────

async function createLesson(courseId, data) {
  const course = await getCourseOr404(courseId);

  const title = String(data.title || "").trim();
  if (!title) throw new HttpError(400, "Title is required");

  const slug = slugify(data.slug || title);
  const orderResult = await query(
    "SELECT COALESCE(MAX(order_index) + 1, 0) AS next FROM lessons WHERE course_id = $1",
    [course.id]
  );
  const orderIndex = data.order_index !== undefined ? parseInt(data.order_index, 10) : orderResult.rows[0].next;

  const inserted = await query(
    `INSERT INTO lessons (course_id, title, slug, order_index, duration_minutes)
     VALUES ($1, $2, $3, $4, $5) RETURNING id, title, slug, order_index, duration_minutes`,
    [course.id, title, slug, orderIndex, parseInt(data.duration_minutes || 0, 10)]
  );

  const lesson = inserted.rows[0];
  const key = s3.lessonKey(course.id, lesson.id);
  await query("UPDATE lessons SET s3_key = $1 WHERE id = $2", [key, lesson.id]);

  if (data.content !== undefined && data.content !== null) {
    await s3.putObject(key, String(data.content));
  }

  await cacheDel("courses:all");
  return { ...lesson, s3_key: key, courseId: course.id };
}

async function updateLesson(courseId, lessonId, data) {
  await getCourseOr404(courseId);

  const existing = await query(
    "SELECT * FROM lessons WHERE id = $1 AND course_id = $2",
    [lessonId, courseId]
  );
  if (!existing.rows[0]) throw new HttpError(404, "Lesson not found");

  const fields = [];
  const params = [];
  if (data.title !== undefined) {
    fields.push("title = $1");
    params.push(String(data.title).trim());
  }
  if (data.slug !== undefined) {
    fields.push(`slug = $${fields.length + 1}`);
    params.push(slugify(data.slug));
  }
  if (data.order_index !== undefined) {
    fields.push(`order_index = $${fields.length + 1}`);
    params.push(parseInt(data.order_index, 10));
  }
  if (data.duration_minutes !== undefined) {
    fields.push(`duration_minutes = $${fields.length + 1}`);
    params.push(parseInt(data.duration_minutes, 10));
  }

  if (fields.length) {
    params.push(lessonId);
    await query(`UPDATE lessons SET ${fields.join(", ")} WHERE id = $${params.length}`, params);
  }

  const key = existing.rows[0].s3_key || s3.lessonKey(courseId, lessonId);
  if (data.content !== undefined && data.content !== null) {
    await s3.putObject(key, String(data.content));
  }

  await cacheDel(`content:${courseId}:${lessonId}`);
  const updated = await query("SELECT * FROM lessons WHERE id = $1", [lessonId]);
  return updated.rows[0];
}

async function deleteLesson(courseId, lessonId) {
  await getCourseOr404(courseId);

  const existing = await query("SELECT * FROM lessons WHERE id = $1 AND course_id = $2", [lessonId, courseId]);
  if (!existing.rows[0]) throw new HttpError(404, "Lesson not found");

  await query("DELETE FROM lessons WHERE id = $1", [lessonId]);

  const key = existing.rows[0].s3_key || s3.lessonKey(courseId, lessonId);
  try {
    await s3.deleteObject(key);
  } catch (err) {
    console.error("S3 delete error (best-effort):", err.message);
  }

  await cacheDel(`content:${courseId}:${lessonId}`);
  await cacheDel("courses:all");
  return { success: true };
}

// ── Progression ────────────────────────────────────────────────

async function enroll(userId, courseId) {
  await getCourseOr404(courseId);
  await query(
    `INSERT INTO enrollments (user_id, course_id)
     VALUES ($1, $2)
     ON CONFLICT (user_id, course_id) DO NOTHING`,
    [parseInt(userId, 10), parseInt(courseId, 10)]
  );
  return { success: true };
}

async function getProgress(userId) {
  const result = await query(
    `
    SELECT e.course_id, c.title, c.slug, c.level, e.status, e.created_at AS enrolled_at,
      CASE WHEN c.id IS NULL THEN 0 ELSE (SELECT COUNT(*) FROM lessons l WHERE l.course_id = c.id) END AS total_lessons,
      (SELECT COUNT(*) FROM lesson_progress lp WHERE lp.user_id = e.user_id AND lp.lesson_id IN
        (SELECT id FROM lessons WHERE course_id = e.course_id)) AS completed_lessons
    FROM enrollments e
    JOIN courses c ON c.id = e.course_id
    WHERE e.user_id = $1
    ORDER BY e.created_at DESC
    `,
    [parseInt(userId, 10)]
  );

  return {
    source: "database",
    data: result.rows.map((row) => ({
      courseId: row.course_id,
      title: row.title,
      slug: row.slug,
      level: row.level,
      status: row.status,
      enrolledAt: row.enrolled_at,
      totalLessons: Number(row.total_lessons || 0),
      completedLessons: Number(row.completed_lessons || 0),
      progress:
        row.total_lessons > 0
          ? Math.round((Number(row.completed_lessons) / Number(row.total_lessons)) * 100)
          : 0,
    })),
  };
}

async function setLessonCompleted(userId, courseId, lessonId, completed) {
  await getCourseOr404(courseId);

  const lessonResult = await query(
    "SELECT id FROM lessons WHERE id = $1 AND course_id = $2",
    [lessonId, courseId]
  );
  if (!lessonResult.rows[0]) throw new HttpError(404, "Lesson not found");

  if (completed) {
    await query(
      `INSERT INTO lesson_progress (user_id, lesson_id)
       VALUES ($1, $2)
       ON CONFLICT (user_id, lesson_id) DO NOTHING`,
      [parseInt(userId, 10), parseInt(lessonId, 10)]
    );
  } else {
    await query(
      "DELETE FROM lesson_progress WHERE user_id = $1 AND lesson_id = $2",
      [parseInt(userId, 10), parseInt(lessonId, 10)]
    );
  }

  return { success: true, completed: !!completed };
}

module.exports = {
  HttpError,
  createCourse,
  updateCourse,
  deleteCourse,
  createLesson,
  updateLesson,
  deleteLesson,
  listCourses,
  getCourseBySlug,
  getLessonContent,
  enroll,
  getProgress,
  setLessonCompleted,
};