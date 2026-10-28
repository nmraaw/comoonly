import type { Project } from './types'

// The Idea Graveyard's words, in one place (the server keeps the keys: groups.schema.ts).
export const STAGES: Record<Project['stage'], string> = {
  idea: '💭 Just an idea',
  sketches: '✏️ Sketches',
  prototype: '🛠️ Prototype',
  almost: '🏁 Almost done',
}
export const STOPPED: Record<Project['stopped'], string> = {
  time: 'No time',
  skills: 'Missing skills',
  teammates: 'No teammates',
  money: 'No money',
  other: 'Something else',
}
export const STATUS: Record<Project['status'], string> = {
  resting: '🪦 Unfinished',
  reviving: '🌱 Being revived',
  alive: '✨ Alive again',
}
export const NEEDS = ['Design', 'Code', 'Marketing', 'Writing', 'Video', 'Money', 'A teammate', 'Feedback']

// Key from a label, for the Create form's chips.
export const keyOf = <K extends string>(labels: Record<K, string>, label: string) =>
  (Object.keys(labels) as K[]).find((k) => labels[k] === label)!
