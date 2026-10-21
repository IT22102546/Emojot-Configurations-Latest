import fs from "fs";
import { DEFAULT_BASE, classifyColumns, parseWorkflow, runUpload } from "./uploader/hierarchy-core.js";

// Command-line version of the uploader (uploader/ has the web version). Works for any client/workflow.
//
//   node bulk-admin-hierarchy.js <sheet.csv> --company <id> --workflow <id> [--wf <workflow.json>]
//        [--hierarchy <AHI_...>] [--apply] [--merge-existing] [--no-ensure-users] [--base <url>]
//
// --wf fills the hierarchy ID and decides which columns are contact roles. Without --apply it is a dry run.
// IDs can also come from EMOJOT_COMPANY_ID, EMOJOT_WORKFLOW_ID, EMOJOT_HIERARCHY_ID, EMOJOT_API_BASE.
// The token is read from EMOJOT_TOKEN only, so it never ends up in shell history as an argument.

const USAGE = "Usage: node bulk-admin-hierarchy.js <sheet.csv> --company <id> --workflow <id> [--wf <workflow.json>] [--hierarchy <AHI_...>] [--apply] [--merge-existing] [--no-ensure-users]";

function parseArgs(argv) {
  const flags = {};
  const positional = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) positional.push(arg);
    else if (["--apply", "--merge-existing", "--no-ensure-users"].includes(arg)) flags[arg.slice(2)] = true;
    else flags[arg.slice(2)] = argv[++i];
  }
  return { flags, positional };
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];

    if (ch === '"' && inQuotes && next === '"') {
      field += '"';
      i += 1;
    } else if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      row.push(field);
      field = "";
    } else if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (ch === "\r" && next === "\n") i += 1;
      row.push(field);
      if (row.some(value => value.trim() !== "")) rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }

  row.push(field);
  if (row.some(value => value.trim() !== "")) rows.push(row);
  if (rows.length < 2) return { headers: [], rows: [] };

  const headers = rows[0].map(value => value.trim().replace(/^﻿/, ""));
  return {
    headers,
    rows: rows.slice(1).map(values => Object.fromEntries(headers.map((h, i) => [h, (values[i] || "").trim()]))),
  };
}

async function main() {
  const { flags, positional } = parseArgs(process.argv.slice(2));
  const sheetPath = positional[0];
  if (!sheetPath) throw new Error(USAGE);

  const workflow = flags.wf ? parseWorkflow(JSON.parse(fs.readFileSync(flags.wf, "utf8"))) : null;
  const config = {
    base: flags.base || process.env.EMOJOT_API_BASE || DEFAULT_BASE,
    companyId: flags.company || process.env.EMOJOT_COMPANY_ID,
    workflowId: flags.workflow || process.env.EMOJOT_WORKFLOW_ID,
    hierarchyId: flags.hierarchy || process.env.EMOJOT_HIERARCHY_ID || workflow?.hierarchyId,
    token: process.env.EMOJOT_TOKEN,
  };
  if (workflow && config.hierarchyId !== workflow.hierarchyId) {
    console.warn(`Warning: hierarchy ${config.hierarchyId} differs from the workflow JSON (${workflow.hierarchyId}).`);
  }

  const { headers, rows } = parseCsv(fs.readFileSync(sheetPath, "utf8"));
  const { keyCols, contactCols } = classifyColumns(headers, rows, workflow);
  console.log(`${rows.length} row(s). Ticket fields: ${keyCols.join(", ")}. Contact roles: ${contactCols.join(", ")}.`);

  const options = { apply: Boolean(flags.apply), merge: Boolean(flags["merge-existing"]), ensureUsers: !flags["no-ensure-users"] };
  for await (const event of runUpload({ config, input: { rows, keyCols, contactCols }, options })) {
    if (event.type === "log") console.log(event.message);
    else if (event.type === "preview") {
      console.log(JSON.stringify(event.payloads, null, 2));
      console.log(`Dry run only (first ${event.payloads.length} shown). Add --apply to send ${event.total} PUT request(s).`);
    } else if (event.type === "row") console.log(`${event.ok ? "PUT ok" : "FAILED"}: row ${event.index + 2} ${event.message}`);
    else if (event.type === "done" && options.apply) {
      console.log(`${event.stopped ? "Stopped" : "Done"}. Sent ${event.sent}, failed ${event.failed}.`);
      if (event.failed || event.stopped) process.exitCode = 1;
    }
  }
}

main().catch(err => {
  console.error("Failed:", err.message);
  process.exit(1);
});
