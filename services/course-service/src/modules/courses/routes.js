const express = require("express");
const { isAuthenticated, isAdmin } = require("../../shared/middlewares/auth.middleware");
const service = require("./service");

const router = express.Router();

function handleError(res, err) {
  if (err && err.status) {
    return res.status(err.status).json({ error: err.message });
  }
  console.error("Course Service API error:", err);
  res.status(500).json({ error: "Erreur serveur" });
}

// ── Accès public ───────────────────────────────────────────────
router.get("/api/courses", async (req, res) => {
  try {
    const result = await service.listCourses();
    res.json({ courses: result.data, source: result.source });
  } catch (err) {
    handleError(res, err);
  }
});

router.get("/api/courses/:slug", async (req, res) => {
  try {
    const { course, lessons } = await service.getCourseBySlug(req.params.slug);
    res.json({ course, lessons });
  } catch (err) {
    handleError(res, err);
  }
});

// ── Admin : cours ──────────────────────────────────────────────
router.post("/api/courses", isAdmin, async (req, res) => {
  try {
    const course = await service.createCourse(req.body);
    res.status(201).json({ course });
  } catch (err) {
    handleError(res, err);
  }
});

router.put("/api/courses/:id", isAdmin, async (req, res) => {
  try {
    const course = await service.updateCourse(req.params.id, req.body);
    res.json({ course });
  } catch (err) {
    handleError(res, err);
  }
});

router.delete("/api/courses/:id", isAdmin, async (req, res) => {
  try {
    const result = await service.deleteCourse(req.params.id);
    res.json(result);
  } catch (err) {
    handleError(res, err);
  }
});

// ── Admin : leçons ─────────────────────────────────────────────
router.post("/api/courses/:courseId/lessons", isAdmin, async (req, res) => {
  try {
    const lesson = await service.createLesson(req.params.courseId, req.body);
    res.status(201).json({ lesson });
  } catch (err) {
    handleError(res, err);
  }
});

router.put("/api/courses/:courseId/lessons/:lessonId", isAdmin, async (req, res) => {
  try {
    const lesson = await service.updateLesson(req.params.courseId, req.params.lessonId, req.body);
    res.json({ lesson });
  } catch (err) {
    handleError(res, err);
  }
});

router.delete("/api/courses/:courseId/lessons/:lessonId", isAdmin, async (req, res) => {
  try {
    const result = await service.deleteLesson(req.params.courseId, req.params.lessonId);
    res.json(result);
  } catch (err) {
    handleError(res, err);
  }
});

// ── Progression (le contenu des leçons requiert une session) ───
router.get("/api/courses/:slug/lessons/:lessonSlug", isAuthenticated, async (req, res) => {
  try {
    const result = await service.getLessonContent(req.user.id, req.params.slug, req.params.lessonSlug);
    res.json(result);
  } catch (err) {
    handleError(res, err);
  }
});

router.post("/api/progress/courses/:courseId/enroll", isAuthenticated, async (req, res) => {
  try {
    const result = await service.enroll(req.user.id, req.params.courseId);
    res.status(201).json(result);
  } catch (err) {
    handleError(res, err);
  }
});

router.get("/api/progress", isAuthenticated, async (req, res) => {
  try {
    const result = await service.getProgress(req.user.id);
    res.json(result);
  } catch (err) {
    handleError(res, err);
  }
});

router.post("/api/progress/courses/:courseId/lessons/:lessonId/complete", isAuthenticated, async (req, res) => {
  try {
    const result = await service.setLessonCompleted(req.user.id, req.params.courseId, req.params.lessonId, true);
    res.json(result);
  } catch (err) {
    handleError(res, err);
  }
});

router.delete("/api/progress/courses/:courseId/lessons/:lessonId/complete", isAuthenticated, async (req, res) => {
  try {
    const result = await service.setLessonCompleted(req.user.id, req.params.courseId, req.params.lessonId, false);
    res.json(result);
  } catch (err) {
    handleError(res, err);
  }
});

module.exports = router;