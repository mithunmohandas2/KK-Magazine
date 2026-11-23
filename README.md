# Folio — E-Magazine PWA (development starter)

A Next.js App Router / TypeScript / Tailwind prototype for the frozen v1.3 E-Magazine requirements.

## Run

Requires Node.js 20+ and npm with network access:

```bash
npm install
npm run dev
```

Open http://localhost:3000. Use **Studio** to open the editorial workspace.

## Implemented in this starter

- Responsive editorial landing page, issues archive, story listing and contributors.
- Flipbook-style side-by-side HTML reader and continuous-scroll alternative.
- Magazine issue creation and basic page block editing (heading, text, image, quote).
- Reordering content blocks using move controls, page template selector, multiple authors (primary + co-authors).
- Author profile creation, media gallery, basic workflow status demonstration.
- Browser-local draft persistence with debounced autosave and manual save.
- Light/dark theme toggle persisted in localStorage, with system preference as initial default.

## Important limitations — not production ready

This is a **functional frontend prototype**, not the complete production application. Data is stored in localStorage; there is no real authentication or role enforcement. Workflow buttons demonstrate states but do not implement immutable server-side revisions or approval permissions. Cloudinary uploads, MongoDB CRUD, secure API routes, versioned publication releases, automatic text pagination, advanced drag-and-drop/free positioning, scheduled publishing, and a production page-turn engine still require implementation. Standalone article CRUD, PWA service worker/offline caching, accessibility verification, tests, and production deployment are also outstanding.

The package lists several libraries intended for subsequent development. Their installation/build could not be verified in this environment because npm registry access was unavailable.

## Production milestones

1. Configure MongoDB Atlas, authentication, and Cloudinary, implement server-side RBAC and API validation.
2. Add persistent schemas and immutable revision / release publishing workflow.
3. Build and validate advanced canvas editor with desktop/tablet responsive layouts and autosave conflict protection.
4. Implement mixed manual/automatic pagination and validate flipbook animation library with live HTML content.
5. Complete standalone article CMS, public search/SEO, service worker, media lifecycle, and tests.

## Configuration

Copy `.env.example` to `.env.local` when connecting services. Never commit secrets.
