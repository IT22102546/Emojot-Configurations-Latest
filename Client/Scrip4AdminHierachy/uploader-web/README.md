# Bulk Upload: Admin Hierarchies & Comm-Center (browser-only, for Vercel)

Live: https://emojot-bulk-upload.vercel.app (Vercel project `emojot-bulk-upload`, account `sanjana-faf7`)

Same tool as `../uploader/`, without the Node server: the page calls the Emojot API directly from the browser (the API allows cross-origin requests). The token goes from the user's browser to Emojot only.

Two tools on one site (links in the header switch between them):

| Page | What it does |
|---|---|
| `index.html` | **Home**: pick a tool |
| `hierarchy.html` | **Admin Hierarchy**: workflow JSON → template → filled Excel → upload rows to the workflow's admin hierarchy. Optional: first add everyone in the sheet to Comm-Center list(s). |
| `users.html` | **Comm-Center Users**: company → template (Name, Email, Telephone, profile data fields) → filled Excel → create missing users and add everyone to list(s). |

| File | What it is |
|---|---|
| `hierarchy-core.js` | Admin hierarchy upload logic and safety check. **Copy of `../uploader/hierarchy-core.js`**: change that one, then copy it here |
| `commcenter-core.js` | Comm-Center logic: find user by email, create user, add to list, load lists and profile fields |
| `styles.css` | Shared styling |
| `vercel.json` | Security headers: the pages may only load SheetJS from cdnjs and only call `*.amazonaws.com` |

## Comm-Center rules

- A person is identified by **email**. If the email already exists in Comm-Center, the user is **not created again and not changed**; they are still added to the selected lists (people already in a list are skipped).
- New users are created with `stopIfUpdate: true` (the same request Comm-Center's *Add user* sends).
- Telephone must be in international format (`+94771234567`); spaces and dashes are removed.
- In the Admin Hierarchy tool, the Comm-Center option runs **after** the hierarchy safety check passes and **before** the hierarchy rows are written. If it doesn't complete, the hierarchy is not written. New users created there get their email as the name; use the Comm-Center Users tool first when proper names are needed.

API calls used (same API and Bearer token + `companyid` header as the hierarchy):
`GET /clienteleLists`, `GET /loyaltyFields`, `GET /clientele?search[fieldID]=Email&search[value]=…`, `POST /loyaltyUserData`, `PUT /clienteleLists`.

## Run locally

Module scripts don't load from `file://`, so serve the folder:

```bash
cd uploader-web
python3 -m http.server 8080      # then open http://localhost:8080
```

## Deploy to Vercel

No build step. From this folder:

```bash
npx vercel          # first time: link/create the project (pick the company team, not a personal account)
npx vercel --prod   # deploy to production
```

Or in the Vercel dashboard: New Project → import the repo → **Root Directory** `Client/Scrip4AdminHierachy/uploader-web` → Framework preset **Other** → no build command.

Before sharing the URL:

1. **Protect it**: Project → Settings → Deployment Protection → enable **Vercel Authentication** so only team members can open it.
2. **Check once on the live URL**: upload one test row, then try a wrong token and confirm the log shows a clear error.

## Keeping the two versions in sync

`hierarchy.html` here started as a copy of `../uploader/public/index.html` and now also has the Comm-Center option, the header links and `styles.css`. `users.html` exists only here. The local Node version (`../uploader/`) does not have the Comm-Center features.
