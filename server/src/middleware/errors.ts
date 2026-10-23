import { ZodError } from 'zod'

// Throw this anywhere (services, routes) to send a clean error to the browser.
export class HttpError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export function notFound() {
  throw new HttpError(404, 'Not found')
}

// Express recognises an error handler by its four parameters, so `_next` must stay.
export function errorHandler(err: any, _req: any, res: any, _next: any) {
  if (err instanceof ZodError) {
    const issues = err.issues.map((i) => ({ path: i.path.join('.'), message: i.message }))
    return res.status(400).json({ error: 'Invalid input', issues })
  }
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message })
  // Body-parser errors (e.g. broken JSON) carry their own 4xx status.
  if (typeof err.status === 'number' && err.status < 500) {
    return res.status(err.status).json({ error: 'Bad request' })
  }
  console.error(err) // real details stay in the server log, never in the response
  res.status(500).json({ error: 'Something went wrong' })
}
