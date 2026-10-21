import fs from "fs";
import { buildTemplateRows, parseWorkflow } from "./uploader/hierarchy-core.js";

// Builds an admin hierarchy CSV with one row per combination of the workflow's ticket field values
// (e.g. every category x branch). Works for any workflow JSON export.
//
//   node build-template.js <workflow.json> [output.csv] [--fill "a@x.com; b@x.com"] [--roles role1,role2]
//
// --fill puts the same contacts in every row (all roles, or only --roles). Without it the contact cells are empty.

const args = process.argv.slice(2);
const positional = [];
const flags = {};
for (let i = 0; i < args.length; i += 1) {
  if (args[i].startsWith("--")) flags[args[i].slice(2)] = args[++i];
  else positional.push(args[i]);
}

const [wfPath, outPath = "admin-hierarchy-template.csv"] = positional;
if (!wfPath) {
  console.error('Usage: node build-template.js <workflow.json> [output.csv] [--fill "a@x.com; b@x.com"] [--roles role1,role2]');
  process.exit(1);
}

const workflow = parseWorkflow(JSON.parse(fs.readFileSync(wfPath, "utf8")));
const roles = flags.roles ? flags.roles.split(",").map(r => r.trim()) : workflow.contactCols;
const unknownRoles = roles.filter(r => !workflow.contactCols.includes(r));
if (unknownRoles.length) {
  console.error(`Unknown role(s): ${unknownRoles.join(", ")}. Workflow roles: ${workflow.contactCols.join(", ")}`);
  process.exit(1);
}

const fill = flags.fill ? Object.fromEntries(roles.map(r => [r, flags.fill])) : {};
const rows = buildTemplateRows(workflow, fill);
const headers = ["_id", ...workflow.keyCols, ...workflow.contactCols];

const csvCell = value => (/[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);
const lines = [headers.join(","), ...rows.map(row => headers.map(h => csvCell(String(row[h] ?? ""))).join(","))];
fs.writeFileSync(outPath, `${lines.join("\n")}\n`);

const sizes = workflow.keyCols.map(c => `${workflow.values[c].length} ${c}`).join(" x ");
console.log(`${workflow.name || wfPath} (${workflow.hierarchyId}): ${sizes} = ${rows.length} rows. Wrote ${outPath}`);
