jest.mock("../src/shared/database", () => ({
  query: jest.fn(),
}));

jest.mock("../src/shared/redis", () => ({
  getClient: jest.fn(),
}));

jest.mock("../src/shared/s3", () => ({
  lessonKey: jest.fn((courseId, lessonId) => `courses/${courseId}/${lessonId}.md`),
  getObject: jest.fn(),
  putObject: jest.fn(),
  deleteObject: jest.fn(),
}));

jest.mock("marked", () => ({
  marked: { parse: jest.fn((md) => `<p>${md}</p>`) },
}));

const { query } = require("../src/shared/database");
const redis = require("../src/shared/redis");
const s3 = require("../src/shared/s3");
const service = require("../src/modules/courses/service");

function makeRedis(isOpen) {
  return {
    isOpen: isOpen === undefined ? true : isOpen,
    get: jest.fn(),
    setEx: jest.fn(),
    del: jest.fn(),
  };
}

describe("course service", () => {
  let client;

  beforeEach(() => {
    jest.clearAllMocks();
    client = makeRedis();
    redis.getClient.mockReturnValue(client);
  });

  describe("listCourses", () => {
    it("returns cached courses when Redis has the key", async () => {
      const cached = [{ id: 1, title: "Kubernetes Basics" }];
      client.get.mockResolvedValue(JSON.stringify(cached));

      const result = await service.listCourses();

      expect(result).toEqual({ source: "cache", data: cached });
      expect(query).not.toHaveBeenCalled();
    });

    it("queries DB and caches the result when cache miss", async () => {
      client.get.mockResolvedValue(null);
      const rows = [{ id: 1, title: "K8s", lesson_count: "3" }];
      query.mockResolvedValue({ rows });

      const result = await service.listCourses();

      expect(result).toEqual({ source: "database", data: rows });
      expect(client.setEx).toHaveBeenCalledWith("courses:all", 300, JSON.stringify(rows));
    });

    it("falls back to DB when Redis is not ready", async () => {
      redis.getClient.mockReturnValue(makeRedis(false));
      const rows = [{ id: 2, title: "Ingress" }];
      query.mockResolvedValue({ rows });

      const result = await service.listCourses();

      expect(result.source).toBe("database");
      expect(query).toHaveBeenCalled();
    });
  });

  describe("getLessonContent", () => {
    const course = { id: 5, title: "K8s Advanced", slug: "k8s-advanced" };
    const lesson = {
      id: 10,
      title: "RBAC",
      slug: "rbac",
      order_index: 1,
      s3_key: "courses/5/10.md",
    };

    beforeEach(() => {
      query
        .mockResolvedValueOnce({ rows: [course] })
        .mockResolvedValueOnce({ rows: [{ id: 1, title: "Intro", slug: "intro", order_index: 0 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // enrollment found
        .mockResolvedValueOnce({ rows: [lesson] })
        .mockResolvedValueOnce({ rows: [] });
    });

    it("injects converted markdown and reports not completed", async () => {
      client.get.mockResolvedValue(null);
      s3.getObject.mockResolvedValue("# RBAC\n\nLes rôles");

      const result = await service.getLessonContent("7", "k8s-advanced", "rbac", "user");

      expect(s3.getObject).toHaveBeenCalledWith("courses/5/10.md");
      expect(result.contentHtml).toBe("<p># RBAC\n\nLes rôles</p>");
      expect(result.completed).toBe(false);
      expect(result.course).toEqual(course);
      expect(result.lesson).toEqual(lesson);
      expect(client.setEx).toHaveBeenCalledWith(
        "content:5:10",
        3600,
        JSON.stringify("# RBAC\n\nLes rôles")
      );
    });

    it("reports completed when lesson_progress row exists", async () => {
      client.get.mockResolvedValue(null);
      s3.getObject.mockResolvedValue("contenu");
      query
        .mockReset()
        .mockResolvedValueOnce({ rows: [course] })
        .mockResolvedValueOnce({ rows: [] }) // lessons list (getCourseBySlug)
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // enrollment found
        .mockResolvedValueOnce({ rows: [lesson] })
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }); // progress found

      const result = await service.getLessonContent("7", "k8s-advanced", "rbac", "user");

      expect(result.completed).toBe(true);
    });

    it("throws 403 when user is not enrolled", async () => {
      query
        .mockReset()
        .mockResolvedValueOnce({ rows: [course] })
        .mockResolvedValueOnce({ rows: [] }) // lessons list
        .mockResolvedValueOnce({ rows: [] }); // enrollment empty

      await expect(service.getLessonContent("7", "k8s-advanced", "rbac", "user")).rejects.toMatchObject({
        status: 403,
      });
    });

    it("allows admin to read lesson without enrolling", async () => {
      client.get.mockResolvedValue(null);
      s3.getObject.mockResolvedValue("contenu");
      query
        .mockReset()
        .mockResolvedValueOnce({ rows: [course] })
        .mockResolvedValueOnce({ rows: [] }) // lessons list
        .mockResolvedValueOnce({ rows: [lesson] })
        .mockResolvedValueOnce({ rows: [] }); // progress

      const result = await service.getLessonContent("1", "k8s-advanced", "rbac", "admin");

      expect(result.contentHtml).toBe("<p>contenu</p>");
      expect(result.completed).toBe(false);
    });

    it("throws 404 when lesson does not exist", async () => {
      client.get.mockResolvedValue(null);
      query
        .mockReset()
        .mockResolvedValueOnce({ rows: [course] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // enrollment found
        .mockResolvedValueOnce({ rows: [] });

      await expect(service.getLessonContent("7", "k8s-advanced", "nope", "user")).rejects.toMatchObject({
        status: 404,
      });
    });
  });

  describe("getLessonRawContent", () => {
    const lesson = { id: 10, course_id: 5, s3_key: "courses/5/10.md" };

    it("returns the markdown from S3", async () => {
      client.get.mockResolvedValue(null);
      s3.getObject.mockResolvedValue("# RBAC\n\nraw");
      query.mockResolvedValueOnce({ rows: [lesson] });

      const result = await service.getLessonRawContent("5", "10");

      expect(s3.getObject).toHaveBeenCalledWith("courses/5/10.md");
      expect(result.content).toBe("# RBAC\n\nraw");
    });

    it("uses the cached markdown when present", async () => {
      client.get.mockResolvedValue(JSON.stringify("# cached"));
      query.mockResolvedValueOnce({ rows: [lesson] });

      const result = await service.getLessonRawContent("5", "10");

      expect(result.content).toBe("# cached");
      expect(s3.getObject).not.toHaveBeenCalled();
    });

    it("throws 404 when lesson does not exist", async () => {
      query.mockResolvedValueOnce({ rows: [] });

      await expect(service.getLessonRawContent("5", "10")).rejects.toMatchObject({ status: 404 });
    });
  });

  describe("course CRUD", () => {
    it("creates a course with slugified title and invalidates cache", async () => {
      query.mockResolvedValue({
        rows: [{ id: 3, title: "K8s Ingress", slug: "k8s-ingress" }],
      });

      const result = await service.createCourse({ title: "K8s  Ingress!" });

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO courses"),
        ["K8s  Ingress!", "", "beginner", "k8s-ingress", ""]
      );
      expect(client.del).toHaveBeenCalledWith("courses:all");
      expect(result.slug).toBe("k8s-ingress");
    });

    it("throws 400 when title missing", async () => {
      await expect(service.createCourse({})).rejects.toMatchObject({ status: 400 });
    });

    it("updates course fields only when provided", async () => {
      query
        .mockResolvedValueOnce({ rows: [{ id: 3 }] }) // exists
        .mockResolvedValueOnce({ rows: [{ id: 3, title: "New", slug: "new" }] });

      const result = await service.updateCourse(3, { description: "D" });

      expect(query).toHaveBeenLastCalledWith(expect.stringContaining("UPDATE courses"), ["D", 3]);
      expect(client.del).toHaveBeenCalledWith("courses:all");
      expect(result.id).toBe(3);
    });

    it("throws 404 when course does not exist on update", async () => {
      query.mockResolvedValue({ rows: [] });
      await expect(service.updateCourse(99, { title: "X" })).rejects.toMatchObject({ status: 404 });
    });

    it("deletes a course", async () => {
      query
        .mockResolvedValueOnce({ rows: [{ id: 3 }] })
        .mockResolvedValueOnce({ rowCount: 1 });

      const result = await service.deleteCourse(3);

      expect(query).toHaveBeenLastCalledWith("DELETE FROM courses WHERE id = $1", [3]);
      expect(result).toEqual({ success: true });
    });
  });

  describe("lesson CRUD", () => {
    it("creates a lesson, assigns s3_key and stores content if provided", async () => {
      query
        .mockResolvedValueOnce({ rows: [{ id: 5 }] }) // course exists
        .mockResolvedValueOnce({ rows: [{ next: 0 }] }) // order
        .mockResolvedValueOnce({ rows: [{ id: 10, title: "RBAC", slug: "rbac", order_index: 0, duration_minutes: 15 }] }) // insert
        .mockResolvedValueOnce({ rows: [] }); // update s3_key
      s3.lessonKey.mockReturnValue("courses/5/10.md");

      const result = await service.createLesson(5, { title: "RBAC", duration_minutes: 15, content: "# RBAC" });

      expect(s3.putObject).toHaveBeenCalledWith("courses/5/10.md", "# RBAC");
      expect(result.s3_key).toBe("courses/5/10.md");
    });

    it("does not write content to S3 when absent", async () => {
      query
        .mockResolvedValueOnce({ rows: [{ id: 5 }] })
        .mockResolvedValueOnce({ rows: [{ next: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 11, title: "T", slug: "t", order_index: 1, duration_minutes: 0 }] })
        .mockResolvedValueOnce({ rows: [] });

      await service.createLesson(5, { title: "T" });

      expect(s3.putObject).not.toHaveBeenCalled();
    });

    it("updates lesson and stores new content to S3", async () => {
      query
        .mockResolvedValueOnce({ rows: [{ id: 5 }] }) // course
        .mockResolvedValueOnce({ rows: [{ id: 10, s3_key: "courses/5/10.md" }] }) // existing
        .mockResolvedValueOnce({ rows: [] }) // update title
        .mockResolvedValueOnce({ rows: [{ id: 10, title: "RBAC v2", slug: "rbac", order_index: 0 }] }); // re-read
      s3.lessonKey.mockReturnValue("courses/5/10.md");

      const result = await service.updateLesson(5, 10, { title: "RBAC v2", content: "# RBAC v2" });

      expect(s3.putObject).toHaveBeenCalledWith("courses/5/10.md", "# RBAC v2");
      expect(client.del).toHaveBeenCalledWith("content:5:10");
      expect(result.title).toBe("RBAC v2");
    });

    it("deletes lesson object from S3 best-effort", async () => {
      query
        .mockResolvedValueOnce({ rows: [{ id: 5 }] })
        .mockResolvedValueOnce({ rows: [{ id: 10, s3_key: "courses/5/10.md" }] })
        .mockResolvedValueOnce({ rowCount: 1 });
      s3.deleteObject.mockResolvedValue(true);

      const result = await service.deleteLesson(5, 10);

      expect(s3.deleteObject).toHaveBeenCalledWith("courses/5/10.md");
      expect(result).toEqual({ success: true });
    });
  });

  describe("progress", () => {
    it("enrolls a user idempotently", async () => {
      query.mockResolvedValue({ rows: [{ id: 2 }] });
      const result = await service.enroll("7", 2);
      expect(result).toEqual({ success: true });
      expect(query).toHaveBeenLastCalledWith(
        expect.stringContaining("ON CONFLICT"),
        [7, 2]
      );
    });

    it("computes progress percentages", async () => {
      query.mockResolvedValue({
        rows: [
          {
            course_id: 1,
            title: "K8s",
            slug: "k8s",
            level: "beginner",
            status: "active",
            enrolled_at: "2026-01-01T00:00:00Z",
            total_lessons: "4",
            completed_lessons: "1",
          },
        ],
      });

      const result = await service.getProgress("7");

      expect(result.data[0]).toMatchObject({
        totalLessons: 4,
        completedLessons: 1,
        progress: 25,
      });
    });

    it("marks a lesson completed", async () => {
      query
        .mockResolvedValueOnce({ rows: [{ id: 2 }] }) // course
        .mockResolvedValueOnce({ rows: [{ id: 10 }] }) // lesson
        .mockResolvedValueOnce({ rows: [] }); // insert progress

      const result = await service.setLessonCompleted("7", 2, 10, true);

      expect(query).toHaveBeenLastCalledWith(
        expect.stringContaining("INSERT INTO lesson_progress"),
        [7, 10]
      );
      expect(result).toEqual({ success: true, completed: true });
    });

    it("unmarks a lesson completed", async () => {
      query
        .mockResolvedValueOnce({ rows: [{ id: 2 }] })
        .mockResolvedValueOnce({ rows: [{ id: 10 }] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await service.setLessonCompleted("7", 2, 10, false);

      expect(query).toHaveBeenLastCalledWith("DELETE FROM lesson_progress WHERE user_id = $1 AND lesson_id = $2", [7, 10]);
      expect(result).toEqual({ success: true, completed: false });
    });
  });
});