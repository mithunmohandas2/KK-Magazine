# മൊഴി (Mozhi)

Mozhi is a single public digital magazine with a private editorial dashboard. The reader opens at the cover and supports page buttons and left or right arrow keys. Visitors can read every published page without an account. The wordmark uses locally hosted [Chilanka](https://fonts.google.com/specimen/Chilanka), and Malayalam content uses [Gayathri](https://fonts.google.com/specimen/Gayathri). Both are provided under their respective Open Font Licenses for [Chilanka](public/fonts/chilanka-OFL.txt) and [Gayathri](public/fonts/gayathri-OFL.txt).

On phones and tablets, the footer provides page turns and a contents list. The right drawer offers links to share the current page or the whole magazine, a contact form, saved light and dark preferences, and staff login. Contact submissions appear under **Reader messages** in the admin dashboard.

Readers can install Mozhi from the desktop header icon or **Install app** in the mobile reader drawer. The action opens the browser's install prompt or shows Safari's Home Screen or Dock steps. Use HTTPS or localhost for installation. The action is hidden in the installed app and when the browser reports a completed installation.

## Offline fallback

After a successful visit on HTTPS or localhost, Mozhi stores a standalone fallback and its wordmark font in the browser. The fallback appears on page navigation when the connection fails or the server returns a 5xx error. **Try again** reopens the requested page. The fallback restores the reader's saved light or dark theme. A first visit during a complete outage requires a fallback served by the host or reverse proxy.

## Run locally

Use Node.js 22.13 or later. Copy [`.env.example`](.env.example) to `.env.local` and set `MONGODB_URI` and `MONGODB_DATABASE`. In an empty database, the first login attempt creates the administrator from `KK_ADMIN_EMAIL` and `KK_ADMIN_PASSWORD`. Use a unique password between 8 and 128 characters. Once the account exists, its bootstrap credentials can be removed from the environment.

```bash
npm install
npm run dev
```

Open [the magazine](http://localhost:3000) and select **Login** to reach the dashboard.

## Editorial roles

| Role | Access |
| --- | --- |
| Editor | Create and edit page drafts, add contributors, and submit pages for review. |
| Reviewer | Review submissions, approve pages, or return them to draft with feedback. |
| Publisher | Publish approved pages. |
| Admin | Perform all editorial actions, create accounts, assign roles, and delete non-admin accounts under **Users**. |

Account deletion requires confirmation and ends the deleted user's active sessions.

Publishing replaces the live page with the approved version. When an editor starts a revision, the last published version stays visible to readers throughout editing and review.

Admins can use **Import browser drafts** under **Magazine pages** if the current browser has an export stored under the `kk-demo-data` key. New or changed pages are added as drafts for editorial review. Import is available once per database.

## MongoDB Atlas and Vercel

Set `MONGODB_URI` to the Atlas connection string and `MONGODB_DATABASE` to the database name. Use a database user with read and write access to that database and allow your deployment's connections in Atlas. The app uses transactions, so a development MongoDB instance also needs to run as a replica set or sharded cluster. On Vercel, set these variables and the Cloudinary credentials in the project's environment settings. Set `KK_SECURE_COOKIES=true` for HTTPS deployments and keep Preview and Production databases separate.

MongoDB is required in every environment. It stores user accounts in the `kk_users` collection of the database named by `MONGODB_DATABASE`, which defaults to `kk`. It also stores pages, author profiles, sessions, and media metadata. Each publication adds a versioned snapshot while the reader loads the current live pages. Restart the server after changing database settings.

### Move an existing SQLite workspace

Stop writes to the local app and point `KK_DB_PATH` at the source file if it uses a custom path. Set `MONGODB_URI` and `MONGODB_DATABASE` for an empty destination before starting the app against that database.

```bash
node --env-file-if-exists=.env --env-file-if-exists=.env.local scripts/migrate-sqlite-to-mongo.mjs
```

This copies drafts, live pages, contributors, accounts, existing publication snapshots, media records, and reader messages. The source file is read-only and the destination must be empty. Staff sign in again after the move.

## Cloudinary media

Set `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` from the same product environment. Editors and admins can upload from an **Image** block or the **Media library**. Uploading from a block adds the image to the draft and the library. The browser resizes photos to a maximum edge of 1,200 pixels and encodes them as WebP before uploading directly to the `KK-Magazine` Cloudinary folder. GIFs and animated WebP files retain their animation. The app verifies the upload with Cloudinary and records it in the database. Existing image URLs remain usable.

Cloudinary uploads use authenticated delivery. Mozhi issues a signed delivery URL only to a signed-in staff member or when the asset appears on a live page. Treat the resulting Cloudinary URL as a shareable link.

Draft autosave, advanced HTML layout and pagination, realistic page turns, and offline magazine reading remain pending.
