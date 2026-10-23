// A person as the backend sends it (GET /api/users/:id). `connection` is how you're linked to them:
// 'pending' = you asked, 'incoming' = they asked you, 'accepted' = connected, null = not yet.
export type User = {
  id: string; name: string; city: string; tagline: string; bio: string; interests: string[]
  connection?: 'pending' | 'incoming' | 'accepted' | null
}
