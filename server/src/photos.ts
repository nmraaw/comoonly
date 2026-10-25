import { z } from 'zod'
import { db } from './db/connection.ts'
import { HttpError } from './middleware/errors.ts'

// A picture sent as a data URL (the app shrinks it first). ~7 MB of text is a ~5 MB image.
export const imageSchema = z
  .string()
  .regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/, 'Use a PNG, JPG or WebP image')
  .max(7_000_000, 'That image is too big; try a smaller one')

export const photoSchema = z.object({ image: imageSchema })

// Each kind of picture has its own table, so a person or group going away takes its picture with it.
// Table and column names come from this list only, never from a request.
const TABLES = {
  poster: ['event_posters', 'event_id'],
  user: ['user_photos', 'user_id'],
  group: ['group_photos', 'group_id'],
} as const
type Kind = keyof typeof TABLES

// shortcut: pictures live in the database as bytes (a few hundred KB each), move them to file storage
// (e.g. Cloudflare R2) if there are thousands.
export function savePhoto(kind: Kind, id: string, dataUrl: string) {
  const [table, key] = TABLES[kind]
  const [, mime, base64] = dataUrl.match(/^data:([^;]+);base64,(.+)$/)!
  db.prepare(
    `INSERT INTO ${table} (${key}, mime, bytes) VALUES (?, ?, ?)
     ON CONFLICT (${key}) DO UPDATE SET mime = excluded.mime, bytes = excluded.bytes`,
  ).run(id, mime, Buffer.from(base64, 'base64'))
}

export function deletePhoto(kind: Kind, id: string) {
  const [table, key] = TABLES[kind]
  db.prepare(`DELETE FROM ${table} WHERE ${key} = ?`).run(id)
}

// Answers with the picture. `no-cache` + the automatic ETag: browsers reuse it until it changes.
export function sendPhoto(res: any, kind: Kind, id: string) {
  const [table, key] = TABLES[kind]
  const photo = db.prepare(`SELECT mime, bytes FROM ${table} WHERE ${key} = ?`).get(id) as
    { mime: string; bytes: Uint8Array } | undefined
  if (!photo) throw new HttpError(404, 'No picture')
  res.type(photo.mime).set('cache-control', 'private, no-cache').send(Buffer.from(photo.bytes))
}
