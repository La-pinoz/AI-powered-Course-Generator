import mongoose from 'mongoose';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import Lesson from '../models/Lesson.js';

// Hinglish audio files live in MongoDB GridFS (bucket `lessonAudio`), one MP3 per lesson.
// GridFS ids are only ever read from the lesson document, never taken from the client.

const BUCKET = 'lessonAudio';
let indexReady = null;

const bucket = () => new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: BUCKET });
const filesCollection = () => mongoose.connection.db.collection(`${BUCKET}.files`);
const toId = (id) => new mongoose.Types.ObjectId(String(id));

// For the course cascade delete. Created once per process, lazily.
function ensureIndex() {
  indexReady ??= filesCollection()
    .createIndex({ 'metadata.courseId': 1 })
    .catch((err) => {
      indexReady = null;
      console.warn('[audio] could not create the lessonAudio index:', err.message);
    });
  return indexReady;
}

/** Writes `buffer` and resolves to the new file id. */
export async function saveFile(buffer, { lessonId, courseId, creator, sourceHash, contentType = 'audio/mpeg' }) {
  await ensureIndex();
  const upload = bucket().openUploadStream(`${lessonId}.mp3`, {
    metadata: { lessonId: toId(lessonId), courseId: toId(courseId), creator, sourceHash, contentType },
  });
  await pipeline(Readable.from([buffer]), upload);
  return upload.id;
}

/** { length, uploadDate } of a stored file, or null. */
export async function fileInfo(fileId) {
  if (!fileId) return null;
  const file = await filesCollection().findOne({ _id: toId(fileId) }, { projection: { length: 1, uploadDate: 1 } });
  return file ?? null;
}

export const openStream = (fileId) => bucket().openDownloadStream(toId(fileId));

/** Deletes one file; a file that is already gone is not an error. */
export async function deleteFile(fileId) {
  if (!fileId) return;
  try {
    await bucket().delete(toId(fileId));
  } catch (err) {
    if (!/not found/i.test(err?.message ?? '')) throw err;
  }
}

/** Deletes every audio file of a course (the course delete cascade). */
export async function deleteByCourse(courseId) {
  const files = await filesCollection()
    .find({ 'metadata.courseId': toId(courseId) }, { projection: { _id: 1 } })
    .toArray();
  await Promise.all(files.map((file) => deleteFile(file._id)));
  return files.length;
}

/**
 * Boot sweep: removes files no lesson points at (an interrupted job, or a lesson deleted while its
 * audio was being saved). Files written in the last `graceMs` are kept, in case a job is mid-save.
 */
export async function sweepOrphans({ graceMs = 10 * 60 * 1000 } = {}) {
  const cutoff = new Date(Date.now() - graceMs);
  const files = await filesCollection()
    .find({ uploadDate: { $lt: cutoff } }, { projection: { _id: 1 } })
    .toArray();
  if (files.length === 0) return 0;

  const ids = files.map((file) => file._id);
  const used = await Lesson.find({ 'audio.fileId': { $in: ids } }).select('audio.fileId').lean();
  const usedIds = new Set(used.map((lesson) => String(lesson.audio.fileId)));
  const orphans = ids.filter((id) => !usedIds.has(String(id)));
  await Promise.all(orphans.map((id) => deleteFile(id)));
  if (orphans.length) console.info(`[audio] removed ${orphans.length} orphaned audio file(s)`);
  return orphans.length;
}
