# Admin Hierarchy Bulk Upload

Bulk-loads rows into any workflow's admin hierarchy through `PUT /incidents/userHierarchy`, one request per row. Works for any client: nothing here is tied to a company, workflow or set of ticket fields.

| Path | What it is |
|---|---|
| `uploader/` | Web tool (recommended). `node server.js`, then open http://localhost:4321 |
| `uploader-web/` | Same tool without a server, for hosting on Vercel (see its README) |
| `bulk-admin-hierarchy.js` | Command-line upload, same logic as the web tool |
| `build-template.js` | Builds a CSV with one row per ticket field combination from a workflow JSON |
| `admin-hierarchy-template.csv` | Example sheet showing the format |
| `<client>/` | Per-client files (workflow JSON, sheets), e.g. `alliance-finance/` |

## What you need

- **Company ID** and **Workflow ID** of the client's workflow.
- **Workflow JSON** exported from the portal. Its `adminHierarchy.id` is the hierarchy ID (`AHI_` + 10 digits) and its `adminHierarchy.headers` list the ticket field columns and the contact roles.
- **Bearer token** (only for real uploads): portal → DevTools → Network → any API call → `authorization` header, without `Bearer `. It expires after 24 hours. Never commit it.

## Sheet format

First sheet, header in row 1 (.xlsx, .xls or .csv).

- **Ticket field columns**: the workflow's custom field ids from `adminHierarchy.headers`, e.g. `complaintType`, `Branch`. Values must match the field's values exactly.
- **Contact columns**: the role ids, e.g. `defaultAssignee`, `ticketCreationAlert`, `ticketOverdueAlert_01`.
  - Several people per cell, separated by `;`
  - `email|userId` when the Emojot user ID is known; plain emails are looked up (and created if missing) once each.
- **`_id`** (optional): set it to replace the contacts of that existing row. Leave blank to create a new row.

## Safety: only the given hierarchy is touched

Every write is a `PUT /incidents/userHierarchy` carrying the Workflow ID and Hierarchy ID you entered. Before anything is created or written, a read-only check loads that hierarchy's current rows and stops the whole run (nothing sent, no users created) when:

- a row's `_id` is not a row of this hierarchy (e.g. copied from another workflow's sheet),
- a row without `_id` already exists in the hierarchy and Merge is off (it would be duplicated),
- with Merge on, the matching row exists more than once in the hierarchy,
- the sheet has the same ticket field combination twice,
- the server returns rows belonging to another hierarchy.

The check runs on every real upload, and on dry runs when a token is given. What it cannot catch: a wrong but valid Workflow ID / Hierarchy ID pair. Load the workflow JSON so the Hierarchy ID comes from the workflow itself, and read the confirmation dialog.

Creating users (`POST /loyaltyUserData`) is company-wide, not per workflow: emails that don't exist yet become users of the company. Existing users are never modified.

## Web tool

```bash
cd uploader
node server.js        # http://localhost:4321, Ctrl+C to stop
```

1. Drop the **workflow JSON**: fills the hierarchy ID, checks the sheet's columns and values against the workflow, and enables the full template download (optionally pre-filled with the same contacts in every role).
2. Enter **Company ID** and **Workflow ID**.
3. Drop the **sheet** and fix any issues the preview lists.
4. Keep **Dry run** on and preview. Then paste a token, turn Dry run off and upload.
5. If rows fail or you stop the run, use **Download failed rows** / **Download unsent rows** and upload only those.

The page loads SheetJS from cdnjs, so it needs internet access. No `npm install` is needed. The token is never stored or logged.

## Command line

```bash
# One row per ticket field combination, same contacts in every role
node build-template.js <client>/wf.json <client>/hierarchy.csv --fill "a@company.com; b@company.com"
# ...or only some roles
node build-template.js <client>/wf.json <client>/hierarchy.csv --fill "a@company.com" --roles defaultAssignee,ticketCreationAlert

# Dry run (prints payloads, sends nothing)
node bulk-admin-hierarchy.js <client>/hierarchy.csv --company <companyId> --workflow <workflowId> --wf <client>/wf.json

# Upload
export EMOJOT_TOKEN='...'
node bulk-admin-hierarchy.js <client>/hierarchy.csv --company <companyId> --workflow <workflowId> --wf <client>/wf.json --apply
```

Options: `--hierarchy <AHI_...>` (instead of `--wf`), `--merge-existing` (add to contacts on matching existing rows instead of replacing), `--no-ensure-users` (every contact must be `email|userId`), `--base <url>` (another API environment). The command line reads CSV only; save Excel sheets as CSV first.
