// Comm-Center users and lists: shared by the Comm-Center tool (users.html) and the admin hierarchy tool.
// Same API and login as the admin hierarchy: Bearer token + companyid header.

import { ApiError, DEFAULT_BASE, createClient, isAuthError } from "./hierarchy-core.js";

export const STANDARD_FIELDS = ["Name", "Email", "Telephone"];
export const EMAIL_RE = /^[^\s@|;,]+@[^\s@|;,]+\.[^\s@|;,]+$/;
const PHONE_RE = /^\+\d{7,15}$/;
const LIST_BATCH = 100;

export function apiClient(config, signal) {
  return createClient({ base: config.base || DEFAULT_BASE, token: config.token, companyId: config.companyId }, signal);
}

// Spaces, dashes and brackets are dropped: "+94 77 123-4567" -> "+94771234567".
// Excel drops the leading + of a number, so 11-15 digits that don't start with 0 get it back:
// 94771234567 -> +94771234567. Local numbers (0771234567) are left as they are and rejected by validation.
export function normalizePhone(value) {
  const phone = String(value ?? "").replace(/[\s()-]/g, "");
  return /^[1-9]\d{10,14}$/.test(phone) ? `+${phone}` : phone;
}

const truthy = value => value === true || String(value).toLowerCase() === "true";

// GET /clienteleLists -> { lists: [{ _id, name, recordCount }] }
export async function fetchLists(request) {
  const resp = await request("GET", `/clienteleLists?_=${Date.now()}`);
  return (Array.isArray(resp?.lists) ? resp.lists : [])
    .map(l => ({ id: String(l._id), name: String(l.name), count: l.recordCount ?? null }));
}

// GET /loyaltyFields -> { fields: [{ field, fieldID, type, default, ... }] }
// Built-in fields (Name, Email, Telephone, facebookID, unsubscribed, ...) have default: true; the company's own
// profile data fields (Settings -> Profile data fields, e.g. "uuid") don't. User data is keyed by the field
// name ("field"), not by "fieldID" (for custom fields that is an internal hash).
export async function fetchProfileFields(request) {
  const resp = await request("GET", `/loyaltyFields?_=${Date.now()}`);
  const list = Array.isArray(resp?.fields) ? resp.fields : [];
  return list
    .filter(f => !truthy(f?.default))
    .map(f => ({ id: String(f.field ?? "").trim(), type: f.type || "text", mandatory: truthy(f.mandatory ?? f.required) }))
    .filter(f => f.id && !STANDARD_FIELDS.includes(f.id));
}

// GET /clientele searching the Email field (the same request Comm-Center's search box sends).
// The search may match partially, so only exact (case-insensitive) email matches count.
export async function findUserByEmail(request, email) {
  const params = new URLSearchParams({
    draw: "1",
    "order[0][column]": "userID",
    "order[0][dir]": "asc",
    start: "0",
    length: "25",
    "search[value]": email,
    "search[regex]": "false",
    "search[fieldID]": "Email",
    pageNumber: "0",
    pageSize: "25",
    encodedFilter: "e30=",
    _: String(Date.now()),
  });
  const resp = await request("GET", `/clientele?${params}`);
  const matches = (resp?.userDetails || []).filter(u => String(u.Email || "").toLowerCase() === email.toLowerCase());
  return { user: matches[0] || null, duplicates: matches.length };
}

// POST /loyaltyUserData. stopIfUpdate: true means an existing user is never modified.
export async function createUser(request, fields) {
  try {
    const resp = await request("POST", "/loyaltyUserData", { data: { stopIfUpdate: true, ...fields } });
    const id = resp?.details?.recordID || resp?.details?.id;
    if (!id) throw new Error(`No user ID in the response: ${JSON.stringify(resp).slice(0, 200)}`);
    return { id: String(id), status: resp.details.status || "", rejected: resp.details.rejected || [] };
  } catch (err) {
    if (err instanceof ApiError) {
      try {
        const body = JSON.parse(err.body);
        const status = String(body?.details?.status || "");
        if (body?.details?.id && status.toLowerCase().includes("already")) return { id: String(body.details.id), status, rejected: [] };
      } catch {
        // not JSON, fall through
      }
    }
    throw err;
  }
}

// PUT /clienteleLists adds users (by _id) to a list (by name) without removing anyone.
export async function addToList(request, listName, userIds) {
  for (let i = 0; i < userIds.length; i += LIST_BATCH) {
    await request("PUT", "/clienteleLists", {
      name: listName,
      userListIDType: "_id",
      userList: userIds.slice(i, i + LIST_BATCH),
      userListUpdateType: "add",
    });
  }
}

// Checks a users sheet before anything is sent. Returns a list of problems (empty = fine).
export function validateUserRows(rows, headers, profileFields = []) {
  const issues = [];
  const known = new Set([...STANDARD_FIELDS, ...profileFields.map(f => f.id)]);
  if (!headers.includes("Email")) issues.push("The sheet has no Email column.");
  if (!headers.includes("Name")) issues.push("The sheet has no Name column.");
  if (profileFields.length) {
    const unknown = headers.filter(h => h && !known.has(h));
    if (unknown.length) issues.push(`Column(s) not in this company's profile data fields: ${unknown.join(", ")}`);
  }
  const seen = new Map();
  const seenPhones = new Map(); // Telephone is unique in Comm-Center
  rows.forEach((row, i) => {
    const line = i + 2;
    const email = String(row.Email ?? "").trim();
    if (!email) issues.push(`Row ${line}: Email is empty`);
    else if (!EMAIL_RE.test(email)) issues.push(`Row ${line}: "${email}" is not a valid email (one email per row)`);
    else if (seen.has(email.toLowerCase())) issues.push(`Row ${line}: same email as row ${seen.get(email.toLowerCase())}`);
    else seen.set(email.toLowerCase(), line);
    if (!String(row.Name ?? "").trim()) issues.push(`Row ${line}: Name is empty`);
    const phone = normalizePhone(row.Telephone);
    if (phone && !PHONE_RE.test(phone)) {
      issues.push(phone.startsWith("0")
        ? `Row ${line}: Telephone "${row.Telephone}" needs the country code instead of the leading 0, e.g. 94771234567 or +94771234567`
        : `Row ${line}: Telephone "${row.Telephone}" is not a valid phone number, e.g. 94771234567 or +94771234567`);
    }
    else if (phone && seenPhones.has(phone)) issues.push(`Row ${line}: same Telephone as row ${seenPhones.get(phone)} (each person needs their own number)`);
    else if (phone) seenPhones.set(phone, line);
    for (const f of profileFields) {
      if (f.mandatory && headers.includes(f.id) && !String(row[f.id] ?? "").trim()) issues.push(`Row ${line}: ${f.id} is mandatory`);
    }
  });
  return issues;
}

/**
 * Adds users to Comm-Center and to lists. Yields progress events:
 *   { type: "log", level, message }
 *   { type: "row", index, ok, status: "exists" | "new" | "created" | "failed", userId, message }
 *   { type: "progress", done, total }
 *   { type: "done", created, existing, failed, listed, stopped }
 *
 * Existing users (matched by email) are never created again or changed; they are still added to the lists.
 * Without apply, only read requests are made (who exists, who would be created).
 *
 * config:  { base, token, companyId }
 * input:   { rows: [{ Name, Email, Telephone, ...custom }], fields: [column names to send] }
 * options: { apply, lists: [list names] }
 */
export async function* runUserUpload({ config, input, options, signal }) {
  const { rows, fields } = input;
  const apply = Boolean(options.apply);
  const lists = options.lists || [];
  if (!config.companyId) throw new Error("Missing companyId.");
  if (!rows?.length) throw new Error("No rows to upload.");
  if (!config.token) {
    if (apply) throw new Error("Missing bearer token.");
    yield { type: "log", level: "warn", message: "No token: skipped checking which users already exist. Add a token to the dry run to include it." };
    yield { type: "done", created: 0, existing: 0, failed: 0, listed: 0, stopped: false };
    return;
  }

  const request = apiClient(config, signal);
  const stop = function* (counts) { yield { type: "done", ...counts, stopped: true }; };
  const counts = { created: 0, existing: 0, failed: 0, listed: 0 };

  // 1. Who already exists (read-only).
  const found = [];
  for (const [index, row] of rows.entries()) {
    if (signal?.aborted) return yield* stop(counts);
    const email = String(row.Email).trim();
    const { user, duplicates } = await findUserByEmail(request, email);
    found[index] = user;
    if (duplicates > 1) yield { type: "log", level: "warn", message: `${email} exists ${duplicates} times in Comm-Center; using the first one.` };
    if (!apply) {
      const inLists = user?.clienteleList?.length ? ` (in: ${user.clienteleList.join(", ")})` : "";
      yield { type: "row", index, ok: true, status: user ? "exists" : "new", userId: user?._id, message: user ? `${email} already exists${inLists}` : `${email} will be created` };
      yield { type: "progress", done: index + 1, total: rows.length };
    }
  }
  if (!apply) {
    const existing = found.filter(Boolean).length;
    yield { type: "log", level: "info", message: `Dry run: ${existing} existing user(s), ${rows.length - existing} would be created${lists.length ? `, then added to: ${lists.join(", ")}` : ""}.` };
    yield { type: "done", ...counts, existing, stopped: false };
    return;
  }

  // 2. Create the missing ones; existing users are left untouched.
  const ids = [];
  for (const [index, row] of rows.entries()) {
    if (signal?.aborted) return yield* stop(counts);
    const email = String(row.Email).trim();
    if (found[index]) {
      counts.existing += 1;
      ids[index] = String(found[index]._id);
      yield { type: "row", index, ok: true, status: "exists", userId: ids[index], message: `${email} already exists, not changed` };
    } else {
      const data = {};
      for (const field of fields) {
        const raw = String(row[field] ?? "").trim();
        data[field] = raw === "" ? null : field === "Telephone" ? normalizePhone(raw) : raw;
      }
      try {
        const result = await createUser(request, data);
        counts.created += 1;
        ids[index] = result.id;
        const rejected = result.rejected?.length ? ` (rejected fields: ${result.rejected.join(", ")})` : "";
        yield { type: "row", index, ok: true, status: "created", userId: result.id, message: `${email} created${rejected}` };
      } catch (err) {
        if (signal?.aborted) return yield* stop(counts);
        counts.failed += 1;
        yield { type: "row", index, ok: false, status: "failed", message: `${email}: ${err.message}` };
        if (isAuthError(err)) {
          yield { type: "log", level: "error", message: "Token rejected (401/403). Stopped. Paste a fresh token and retry the remaining rows." };
          return yield* stop(counts);
        }
      }
    }
    yield { type: "progress", done: index + 1, total: rows.length };
  }

  // 3. Add everyone (new and existing) to each list, skipping people already in it.
  for (const listName of lists) {
    if (signal?.aborted) return yield* stop(counts);
    const toAdd = rows.map((_, i) => i)
      .filter(i => ids[i] && !(found[i]?.clienteleList || []).includes(listName))
      .map(i => ids[i]);
    if (!toAdd.length) {
      yield { type: "log", level: "info", message: `List "${listName}": everyone is already in it.` };
      continue;
    }
    try {
      await addToList(request, listName, toAdd);
      counts.listed += toAdd.length;
      yield { type: "log", level: "info", message: `List "${listName}": added ${toAdd.length} user(s).` };
    } catch (err) {
      if (signal?.aborted) return yield* stop(counts);
      yield { type: "log", level: "error", message: `List "${listName}": ${err.message}` };
      return yield* stop(counts);
    }
  }

  yield { type: "done", ...counts, stopped: false };
}
