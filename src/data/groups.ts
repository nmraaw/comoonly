// A group as the backend sends it (GET /api/groups). The sample groups now live in server/src/db/seed.ts.
export type GroupPreview = {
  id: string; name: string; title: string; category: string; description: string;
  members: number; spots: number; location: string; mode: string;
  owner: string; ownerId: string; initials: string; color: string
}
