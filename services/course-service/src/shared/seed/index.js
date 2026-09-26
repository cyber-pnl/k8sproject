const { query } = require("../database");
const s3 = require("../s3");

const DEMO_COURSE = {
  title: "Kubernetes Essentials",
  description:
    "Apprendre à déployer et gérer des applications conteneurisées avec Kubernetes : pods, deployments, services et scaling.",
  level: "beginner",
  slug: "kubernetes-essentials",
  tags: "kubernetes,devops,container",
};

const DEMO_LESSONS = [
  {
    title: "Premiers pas",
    slug: "premiers-pas",
    duration_minutes: 10,
    content: `# Premiers pas avec Kubernetes

Bienvenue dans **Kubernetes Essentials** ! Vous allez découvrir ce qu'est Kubernetes et pourquoi il compte.

## C'est quoi Kubernetes ?

Kubernetes est une **plateforme open-source d'orchestration de conteneurs** qui automatise le déploiement, le passage à l'échelle et la gestion d'applications conteneurisées.

### Concepts clés

- **Pod** — la plus petite unité déployable
- **Node** — une machine de travail
- **Deployment** — déclare l'état désiré
- **Service** — point d'entrée réseau stable
- **Ingress** — règles de routage HTTP

\`\`\`bash
kubectl get pods
kubectl get deployments -A
\`\`\`

C'est tout pour l'introduction !`,
  },
  {
    title: "Déployer une application",
    slug: "deployer-une-application",
    duration_minutes: 15,
    content: `# Déployer une application

Déployons notre première application avec \`kubectl\`.

## Créer un Deployment

Enregistrez ce contenu dans \`nginx.yaml\` :

\`\`\`yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nginx
spec:
  replicas: 2
  selector:
    matchLabels:
      app: nginx
  template:
    metadata:
      labels:
        app: nginx
    spec:
      containers:
        - name: nginx
          image: nginx:1.27
          ports:
            - containerPort: 80
\`\`\`

Appliquez-le :

\`\`\`bash
kubectl apply -f nginx.yaml
kubectl rollout status deployment/nginx
kubectl get pods
\`\`\`

## Mettre à l'échelle

\`\`\`bash
kubectl scale deployment nginx --replicas=5
\`\`\`

Bravo, vous avez déployé votre première charge de travail !`,
  },
];

async function seedDemoContent() {
  try {
    const existing = await query("SELECT COUNT(*) AS n FROM courses");
    if (Number(existing.rows[0].n || 0) > 0) return { seeded: false, reason: "courses_exist" };

    const inserted = await query(
      `INSERT INTO courses (title, description, level, slug, tags)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [DEMO_COURSE.title, DEMO_COURSE.description, DEMO_COURSE.level, DEMO_COURSE.slug, DEMO_COURSE.tags]
    );
    const courseId = inserted.rows[0].id;

    for (let i = 0; i < DEMO_LESSONS.length; i++) {
      const lesson = DEMO_LESSONS[i];
      const created = await query(
        `INSERT INTO lessons (course_id, title, slug, order_index, s3_key, duration_minutes)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [courseId, lesson.title, lesson.slug, i, "", lesson.duration_minutes]
      );
      const lessonId = created.rows[0].id;
      const key = s3.lessonKey(courseId, lessonId);

      if (s3.enabled) {
        let exists = false;
        try {
          exists = !!(await s3.getObject(key));
        } catch (err) {
          exists = false;
        }
        if (!exists) await s3.putObject(key, lesson.content);
      }

      await query("UPDATE lessons SET s3_key = $1 WHERE id = $2", [key, lessonId]);
      console.log(`[SEED] lesson "${lesson.title}" -> ${key}`);
    }

    console.log("[SEED] demo course created");
    return { seeded: true };
  } catch (err) {
    console.error("[SEED] error (non fatal):", err.message);
    return { seeded: false, error: err.message };
  }
}

module.exports = { seedDemoContent, DEMO_COURSE, DEMO_LESSONS };