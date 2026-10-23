# Comoonly development plan

## Starting point — 19 October 2026
- Existing React + Vite + TypeScript app with React Router already installed.
- Five working routes render temporary headings. Discover has an unused page component; the other four page files are empty.
- Starter CSS and assets are present. No backend, persistence, test framework, or Git repository was found.
- The Figma reference was reviewed earlier in this chat: cream surfaces, dark-purple text/navigation, lime active states, rounded cards. Direct Figma access was rate-limited. No claim of a fresh full-file audit or exact visual match.

## Development order
1. **Foundation and mock Discover feed (completed milestone):** shared layout, accessible five-tab navigation, reuse existing page files, typed local mock data, one reusable GroupCard. Keep other routes as honest placeholders. Add no dependencies.
2. **Discover → request → group:** one data-driven group-detail page, request/pending/accepted states using mock state. Preserve one group identity through the flow. Add create-group within this milestone only after agreeing its form fields.
3. **Group workspace:** reuse one group page with Chat, Activities, To-do, Members tabs; tasks and activities stay scoped to their group. Reuse forms and cards rather than duplicating Figma examples.
4. **Simple connections and messaging:** profile request states, accepted-connection messaging, group conversations and requests using mock data.
5. **Flow review:** test keyboard/mobile navigation, back actions, empty states, and complete approved journeys. Discuss backend needs only when mock flows work.

## Milestone 1 boundaries
- Keep the existing route URLs and React Router. No new state library, UI kit, services, auth, real messaging, storage, or paid tools.
- Sample cards are intentionally read-only until the detail flow is implemented.
- Use system fonts and simple text branding. Do not fabricate or replace the original logo/illustrations; import approved assets in a later visual pass.
- Stop after this milestone. Get approval before major architecture, backend/auth, deployment, persistence, or paid services.

## Validation
- Baseline: production build and lint passed before editing.
- After implementation: run build and lint; smoke-test all five routes, active tab, deep links, browser back, unknown URL recovery, and narrow-screen overflow.
- Result: `npm run build` and `npm run lint` passed after implementation; no dependencies added.
- Browser smoke tests passed: all five tabs show the expected pages, active tabs are marked, browser Back returns to the previous page, `/messages` loads directly and survives refresh, and an unknown route offers working navigation back to Discover.
- Visual check passed at desktop width and 320px mobile width; no horizontal overflow at 320px. Temporary viewport override was reset.
- Milestone 1 is complete. Group cards remain read-only and Groups/Create/Messages/Me remain placeholders by design; later feature flows have not been implemented or tested.

## Learning concept
A reusable component is a single UI recipe. GroupCard receives a group object and displays it; changing the recipe updates every card without copying screen markup.
