const {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
} = require("@aws-sdk/client-s3");

const enabled = !!(process.env.S3_BUCKET && process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);
const bucket = process.env.S3_BUCKET || "";

let client = null;
if (enabled) {
  client = new S3Client({
    region: process.env.AWS_REGION || "us-west-2",
  });
}

/**
 * Clé d'un contenu de leçon dans le bucket
 */
function lessonKey(courseId, lessonId) {
  return `courses/${courseId}/${lessonId}.md`;
}

/**
 * Récupère le contenu Markdown d'une leçon
 */
async function getObject(key) {
  if (!client) return null;
  const result = await client.send(
    new GetObjectCommand({ Bucket: bucket, Key: key })
  );
  return result.Body.transformToString();
}

/**
 * Écrit le contenu Markdown d'une leçon
 */
async function putObject(key, body) {
  if (!client) return null;
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: "text/markdown",
    })
  );
  return true;
}

/**
 * Supprime le contenu Markdown d'une leçon (best-effort)
 */
async function deleteObject(key) {
  if (!client) return null;
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  return true;
}

module.exports = {
  enabled,
  lessonKey,
  getObject,
  putObject,
  deleteObject,
};