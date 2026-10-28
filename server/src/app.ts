import express from 'express'
import { fileURLToPath } from 'node:url'
import { config } from './config.ts'
import { loadUser } from './middleware/auth.ts'
import { errorHandler, notFound } from './middleware/errors.ts'
import { adminRoutes } from './modules/admin/admin.routes.ts'
import { authRoutes } from './modules/auth/auth.routes.ts'
import { chatRoutes } from './modules/chat/chat.routes.ts'
import { eventRoutes } from './modules/events/events.routes.ts'
import { groupRoutes } from './modules/groups/groups.routes.ts'
import { peopleRoutes } from './modules/people/people.routes.ts'
import { notificationRoutes } from './modules/notifications/notifications.routes.ts'
import { requestRoutes } from './modules/requests/requests.routes.ts'
import { safetyRoutes } from './modules/safety/safety.routes.ts'

// Builds the app without starting it, so tests can run it on a random port.
export const app = express()

// Screenshots and posters are bigger than anything else, so only those routes allow ~8 MB.
app.use(
  [
    '/api/events/suggest',
    '/api/events/:id/poster',
    '/api/users/me/photo',
    '/api/groups/:id/photo',
    '/api/groups/:id/messages/voice',
    '/api/messages/with/:userId/voice',
    '/api/groups/:id/messages/photo',
    '/api/messages/with/:userId/photo',
  ],
  express.json({ limit: '8mb' }),
)
app.use(express.json({ limit: '100kb' })) // reads JSON request bodies into req.body
app.use(loadUser) // sets req.user when a valid session cookie is present

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})
app.use('/api/auth', authRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/notifications', notificationRoutes)
app.use('/api/events', eventRoutes)
app.use('/api/groups', requestRoutes) // before groupRoutes: see requests.routes.ts
app.use('/api/groups', groupRoutes)
app.use('/api', peopleRoutes)
app.use('/api', chatRoutes)
app.use('/api', safetyRoutes)
app.use('/api', notFound)

// In production this one server also hands out the built website (`npm run build` → dist/),
// so the page and the API share one address and the login cookie just works.
if (config.isProd) {
  const dist = fileURLToPath(new URL('../../dist', import.meta.url))
  // Pages are always re-checked, so phones get each update; the files they load have the content's
  // fingerprint in their name (index-a1b2c3.js), so those can be kept for a year.
  const pageHeaders = { 'cache-control': 'no-cache' }
  app.use(
    express.static(dist, {
      setHeaders: (res, path) =>
        res.set('cache-control', path.endsWith('.html') ? 'no-cache' : 'public, max-age=31536000, immutable'),
    }),
  )
  // Any other page address (e.g. /groups/abc) gets the app; React Router shows the right screen.
  // /admin… gets the separate admin interface instead (src/admin), which has its own login.
  app.use((req, res, next) => {
    if (req.method !== 'GET') return next()
    res.sendFile(req.path.startsWith('/admin') ? 'admin/index.html' : 'index.html', {
      root: dist,
      headers: pageHeaders,
    })
  })
}

app.use(errorHandler) // must be last: catches every error thrown above
