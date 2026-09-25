jest.mock("../src/modules/courses/service", () => ({
  listCourses: jest.fn(),
  getCourseBySlug: jest.fn(),
  getLessonContent: jest.fn(),
  createCourse: jest.fn(),
  updateCourse: jest.fn(),
  deleteCourse: jest.fn(),
  createLesson: jest.fn(),
  updateLesson: jest.fn(),
  deleteLesson: jest.fn(),
  enroll: jest.fn(),
  getProgress: jest.fn(),
  setLessonCompleted: jest.fn(),
}));

const request = require("supertest");
const express = require("express");
const routes = require("../src/modules/courses/routes");
const service = require("../src/modules/courses/service");

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/", routes);
  return app;
}

describe("courses routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("GET /api/courses returns the course list (public)", async () => {
    service.listCourses.mockResolvedValue({
      source: "database",
      data: [{ id: 1, title: "Kubernetes" }],
    });

    const res = await request(buildApp()).get("/api/courses");

    expect(res.status).toBe(200);
    expect(res.body.courses).toEqual([{ id: 1, title: "Kubernetes" }]);
  });

  it("GET /api/courses/:slug returns course detail (public)", async () => {
    service.getCourseBySlug.mockResolvedValue({
      course: { id: 1, slug: "k8s", title: "Kubernetes" },
      lessons: [{ id: 1, title: "Intro" }],
    });

    const res = await request(buildApp()).get("/api/courses/k8s");

    expect(res.status).toBe(200);
    expect(res.body.course.slug).toBe("k8s");
  });

  it("GET /api/courses/:slug/lessons/:lessonSlug requires auth", async () => {
    const res = await request(buildApp()).get("/api/courses/k8s/lessons/intro");

    expect(res.status).toBe(401);
  });

  it("GET lesson content returns converted HTML when authenticated", async () => {
    service.getLessonContent.mockResolvedValue({
      course: { id: 1 },
      lesson: { id: 2 },
      contentHtml: "<p>hello</p>",
      completed: false,
    });

    const res = await request(buildApp())
      .get("/api/courses/k8s/lessons/intro")
      .set("x-user-id", "7")
      .set("x-user-role", "user");

    expect(res.status).toBe(200);
    expect(service.getLessonContent).toHaveBeenCalledWith("7", "k8s", "intro");
    expect(res.body.contentHtml).toBe("<p>hello</p>");
  });

  it("POST /api/courses requires admin", async () => {
    const res = await request(buildApp())
      .post("/api/courses")
      .set("x-user-id", "7")
      .set("x-user-role", "user")
      .send({ title: "K8s" });

    expect(res.status).toBe(403);
  });

  it("POST /api/courses creates course for admin", async () => {
    service.createCourse.mockResolvedValue({ id: 9, slug: "k8s", title: "K8s" });

    const res = await request(buildApp())
      .post("/api/courses")
      .set("x-user-id", "1")
      .set("x-user-role", "ADMIN")
      .send({ title: "K8s" });

    expect(res.status).toBe(201);
    expect(service.createCourse).toHaveBeenCalledWith({ title: "K8s" });
  });

  it("GET /api/progress returns progress when authenticated", async () => {
    service.getProgress.mockResolvedValue({
      source: "database",
      data: [{ courseId: 1, progress: 50 }],
    });

    const res = await request(buildApp())
      .get("/api/progress")
      .set("x-user-id", "3")
      .set("x-user-role", "user");

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([{ courseId: 1, progress: 50 }]);
  });

  it("GET /api/progress requires auth", async () => {
    const res = await request(buildApp()).get("/api/progress");
    expect(res.status).toBe(401);
  });

  it("POST enroll requires auth and calls service", async () => {
    service.enroll.mockResolvedValue({ success: true });

    const res = await request(buildApp())
      .post("/api/progress/courses/5/enroll")
      .set("x-user-id", "3")
      .set("x-user-role", "user");

    expect(res.status).toBe(201);
    expect(service.enroll).toHaveBeenCalledWith("3", "5");
  });

  it("DELETE lesson completion behaves when authenticated", async () => {
    service.setLessonCompleted.mockResolvedValue({ success: true, completed: false });

    const res = await request(buildApp())
      .delete("/api/progress/courses/5/lessons/8/complete")
      .set("x-user-id", "3")
      .set("x-user-role", "user");

    expect(res.status).toBe(200);
    expect(service.setLessonCompleted).toHaveBeenCalledWith("3", "5", "8", false);
  });

  it("maps service HttpError to status code", async () => {
    service.getCourseBySlug.mockRejectedValue(Object.assign(new Error("Course not found"), { status: 404 }));

    const res = await request(buildApp()).get("/api/courses/does-not-exist");

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Course not found");
  });
});