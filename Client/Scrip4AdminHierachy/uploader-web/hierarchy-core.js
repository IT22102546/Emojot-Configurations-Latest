// Shared admin hierarchy upload logic: PUT /incidents/userHierarchy, one request per row.

export const DEFAULT_BASE = "https://wkseq0mv55.execute-api.us-west-2.amazonaws.com/v1";

// A contact cell holds entries separated by ; , or newline. Each entry is "email" or "email|userId".
export function splitEntries(value) {
  return String(value ?? "")
    .split(/[;,\n]/)
    .map(item => item.trim())
    .filter(Boolean)
    .map(item => {
      const [emailPart, idPart] = item.split("|").map(part => part.trim());
      return { email: emailPart || null, id: idPart || null };
    });
}

// Reads what the admin hierarchy needs from a workflow JSON export.
export function parseWorkflow(wf) {
  const ah = wf?.adminHierarchy;
  if (!ah?.id || !Array.isArray(ah.headers)) throw new Error("No adminHierarchy.id / headers in this workflow JSON.");
  const keyCols = ah.headers.filter(h => h.type !== "contact").map(h => h.id);
  const contactCols = ah.headers.filter(h => h.type === "contact").map(h => h.id);
  const values = {};
  // Values come from the custom field, or from a ticket-level list (e.g. the ticket "type") with that id.
  for (const col of keyCols) {
    const field = wf.customFields?.[col] || wf[col];
    if (Array.isArray(field?.values)) values[col] = field.values.map(v => String(v.id));
  }
  return { name: wf.name || "", hierarchyId: ah.id, keyCols, contactCols, values };
}

// Splits sheet columns into ticket fields and contact roles. The workflow decides when given;
// otherwise a column is a contact column if it holds an email or is named like a role.
export function classifyColumns(headers, rows, workflow) {
  const dataCols = headers.filter(h => h && h !== "_id");
  const isContact = workflow
    ? h => workflow.contactCols.includes(h)
    : h => /assignee|alert/i.test(h) || rows.some(r => String(r[h] ?? "").includes("@"));
  const contactCols = dataCols.filter(isContact);
  return { keyCols: dataCols.filter(h => !contactCols.includes(h)), contactCols };
}

// One row per combination of the workflow's ticket field values. `fill` maps a role column to
// the contacts every row gets (e.g. { defaultAssignee: "a@x.com; b@x.com" }).
export function buildTemplateRows(workflow, fill = {}) {
  const { keyCols, contactCols, values } = workflow;
  const missing = keyCols.filter(col => !values[col]?.length);
  if (missing.length) throw new Error(`Workflow has no list of values for: ${missing.join(", ")}`);
  let combos = [{}];
  for (const col of keyCols) {
    combos = combos.flatMap(combo => values[col].map(v => ({ ...combo, [col]: v })));
  }
  return combos.map(combo => {
    const row = { _id: "", ...combo };
    for (const col of contactCols) row[col] = fill[col] || "";
    return row;
  });
}

function uniqueContacts(contacts) {
  const seen = new Set();
  return contacts.filter(contact => {
    const key = `${contact.id}:${contact.type}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function rowKey(row, keyCols) {
  return JSON.stringify(keyCols.map(col => String(row[col] ?? "").trim()));
}

export class ApiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

export function createClient({ base, token, companyId }, signal) {
  const headers = {
    "content-type": "application/json",
    authorization: `Bearer ${token}`,
    companyid: companyId,
  };

  return async function request(method, path, body) {
    const res = await fetch(`${base}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal,
    });
    const text = await res.text();
    if (!res.ok) throw new ApiError(`${method} ${path} failed: ${res.status} ${text.slice(0, 300)}`, res.status, text);
    return text ? JSON.parse(text) : {};
  };
}

async function lookupOrCreateUser(request, email) {
  const payload = { data: { stopIfUpdate: true, Name: email, Email: email } };
  try {
    const resp = await request("POST", "/loyaltyUserData", payload);
    const userId = resp?.details?.recordID || resp?.details?.id;
    if (!userId) throw new Error(`Could not extract user id for ${email}. Response: ${JSON.stringify(resp).slice(0, 300)}`);
    return userId;
  } catch (err) {
    if (err instanceof ApiError) {
      try {
        const body = JSON.parse(err.body);
        const existingId = body?.details?.id;
        const status = String(body?.details?.status || "").toLowerCase();
        if (existingId && status.includes("already")) return existingId;
      } catch {
        // not JSON, fall through
      }
    }
    throw err;
  }
}

export function isAuthError(err) {
  return err instanceof ApiError && (err.status === 401 || err.status === 403);
}

/**
 * Runs an upload (or dry run) and yields progress events:
 *   { type: "log", level, message }
 *   { type: "preview", payloads, total }          dry run only
 *   { type: "progress", done, total }
 *   { type: "row", index, ok, message }
 *   { type: "done", sent, failed, stopped }
 *
 * config:  { base, token, companyId, workflowId, hierarchyId }
 * input:   { rows, keyCols, contactCols }
 * options: { apply, merge, ensureUsers }
 */
export async function* runUpload({ config, input, options, signal }) {
  const { rows, keyCols, contactCols } = input;
  const apply = Boolean(options.apply);
  const base = config.base || DEFAULT_BASE;

  for (const field of ["companyId", "workflowId", "hierarchyId"]) {
    if (!config[field]) throw new Error(`Missing ${field}.`);
  }
  if (apply && !config.token) throw new Error("Missing bearer token.");
  if (!Array.isArray(rows) || !rows.length) throw new Error("No rows to upload.");
  if (!keyCols?.length) throw new Error("No ticket field columns found.");
  if (!contactCols?.length) throw new Error("No contact columns found.");

  const request = createClient({ base, token: config.token, companyId: config.companyId }, signal);

  // Validate rows up front so nothing is sent when the sheet has gaps.
  const badRows = rows
    .map((row, index) => ({ index, missing: keyCols.filter(col => !String(row[col] ?? "").trim()) }))
    .filter(r => r.missing.length);
  if (badRows.length) {
    const sample = badRows.slice(0, 5).map(r => `row ${r.index + 2} (${r.missing.join(", ")})`).join("; ");
    throw new Error(`${badRows.length} row(s) have empty ticket fields: ${sample}`);
  }

  const sheetKeys = new Map();
  for (const [index, row] of rows.entries()) {
    if (String(row._id ?? "").trim()) continue;
    const key = rowKey(row, keyCols);
    if (sheetKeys.has(key)) {
      throw new Error(`Rows ${sheetKeys.get(key) + 2} and ${index + 2} are the same ${keyCols.join(" / ")}. Combine them into one row.`);
    }
    sheetKeys.set(key, index);
  }

  // Safety check (read-only, before anything is created or written): the rows we touch must belong to
  // this hierarchy, and nothing may be duplicated. Runs whenever a token is given, including dry runs.
  const existingByKey = new Map();
  const existingById = new Map();
  if (config.token) {
    const params = new URLSearchParams({ hierarchyId: config.hierarchyId, workflowId: config.workflowId });
    const resp = await request("GET", `/incidents/userHierarchy/${encodeURIComponent(config.hierarchyId)}?${params}`);
    const existing = Array.isArray(resp?.hierarchies) ? resp.hierarchies : [];

    const normalize = id => String(id).replace(/\s+/g, "");
    const foreign = existing.find(r =>
      typeof r.adminHierarchyId === "string" && r.adminHierarchyId.startsWith("AHI_")
      && normalize(r.adminHierarchyId) !== normalize(config.hierarchyId));
    if (foreign) {
      throw new Error(`Safety check: the server returned rows of another hierarchy (${foreign.adminHierarchyId}). Nothing was sent.`);
    }

    for (const row of existing) existingById.set(String(row._id), row);
    for (const row of existing) {
      const key = rowKey(row, keyCols);
      existingByKey.set(key, [...(existingByKey.get(key) || []), row]);
    }

    const problems = [];
    const clashes = [];
    for (const [index, row] of rows.entries()) {
      const id = String(row._id ?? "").trim();
      const label = keyCols.map(col => row[col]).join(" / ");
      const matches = existingByKey.get(rowKey(row, keyCols)) || [];
      if (id && !existingById.has(id)) problems.push(`row ${index + 2}: _id ${id} is not a row of ${config.hierarchyId}`);
      else if (!id && matches.length > 1 && options.merge) problems.push(`row ${index + 2}: ${label} exists ${matches.length} times in the hierarchy; delete the duplicates or set _id`);
      else if (!id && matches.length && !options.merge) clashes.push(label);
    }
    if (problems.length) {
      throw new Error(`Safety check failed, nothing was sent. ${problems.slice(0, 5).join("; ")}${problems.length > 5 ? `; and ${problems.length - 5} more` : ""}`);
    }
    if (clashes.length) {
      throw new Error(`Safety check failed, nothing was sent. ${clashes.length} row(s) already exist in ${config.hierarchyId} `
        + `(e.g. ${clashes.slice(0, 3).join("; ")}) and would be duplicated. Turn on "Merge with existing rows" to add the contacts to them, `
        + "or put their _id in the sheet to replace their contacts.");
    }
    yield { type: "log", level: "info", message: `Safety check passed: ${config.hierarchyId} has ${existing.length} row(s); every row in the sheet targets only this hierarchy.` };
  } else {
    yield { type: "log", level: "warn", message: "No token: skipped the read-only check against the live hierarchy. Add a token to the dry run to include it." };
  }

  // Resolve every email once.
  const userIds = new Map();
  const unresolved = new Set();
  for (const row of rows) {
    for (const col of contactCols) {
      for (const entry of splitEntries(row[col])) {
        if (entry.id && entry.email) userIds.set(entry.email.toLowerCase(), entry.id);
        else if (entry.email) unresolved.add(entry.email.toLowerCase());
      }
    }
  }
  for (const email of userIds.keys()) unresolved.delete(email);

  if (unresolved.size) {
    if (!apply) {
      for (const email of unresolved) userIds.set(email, `DRY_RUN_USER_ID_FOR_${email}`);
      yield { type: "log", level: "info", message: `${unresolved.size} email(s) will be looked up or created on upload.` };
    } else if (!options.ensureUsers) {
      throw new Error(`No user ID for ${[...unresolved].slice(0, 5).join(", ")}. Use email|userId or enable "Create missing users".`);
    } else {
      for (const email of unresolved) {
        yield { type: "log", level: "info", message: `Resolving user ${email}...` };
        userIds.set(email, await lookupOrCreateUser(request, email));
      }
    }
  }

  const payloads = rows.map(row => {
    const incoming = [];
    for (const col of contactCols) {
      for (const entry of splitEntries(row[col])) {
        const id = entry.id || userIds.get(entry.email.toLowerCase());
        incoming.push({ id, type: col });
      }
    }
    const rowId = String(row._id ?? "").trim();
    const existing = !options.merge ? null : rowId ? existingById.get(rowId) : existingByKey.get(rowKey(row, keyCols))?.[0];
    const hierarchy = {
      contacts: uniqueContacts(existing ? [...(existing.contacts || []), ...incoming] : incoming),
    };
    for (const col of keyCols) hierarchy[col] = String(row[col]).trim();
    const id = rowId || existing?._id;
    if (id) hierarchy._id = id;
    return { workflowId: config.workflowId, hierarchyId: config.hierarchyId, hierarchy };
  });

  if (!apply) {
    yield { type: "preview", payloads: payloads.slice(0, 20), total: payloads.length };
    yield { type: "done", sent: 0, failed: 0, stopped: false };
    return;
  }

  let sent = 0;
  let failed = 0;
  for (let index = 0; index < payloads.length; index += 1) {
    if (signal?.aborted) {
      yield { type: "done", sent, failed, stopped: true };
      return;
    }
    const label = keyCols.map(col => payloads[index].hierarchy[col]).join(" / ");
    try {
      const resp = await request("PUT", "/incidents/userHierarchy", payloads[index]);
      sent += 1;
      yield { type: "row", index, ok: true, message: `${label} -> ${resp?.id || "ok"}` };
    } catch (err) {
      if (signal?.aborted) {
        yield { type: "done", sent, failed, stopped: true };
        return;
      }
      failed += 1;
      yield { type: "row", index, ok: false, message: `${label}: ${err.message}` };
      if (isAuthError(err)) {
        yield { type: "log", level: "error", message: "Token rejected (401/403). Stopped. Paste a fresh token and retry the remaining rows." };
        yield { type: "done", sent, failed, stopped: true };
        return;
      }
    }
    yield { type: "progress", done: index + 1, total: payloads.length };
  }

  yield { type: "done", sent, failed, stopped: false };
}
