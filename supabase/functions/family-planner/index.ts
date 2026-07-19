import "jsr:@supabase/functions-js@2.5.0/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";

const ALLOWED_EMAILS = new Set([
  "tyler109j@gmail.com",
  "kaylajilljoyce@gmail.com",
]);
const ACTOR_EMAILS: Record<string, string> = {
  Tyler: "tyler109j@gmail.com",
  Kayla: "kaylajilljoyce@gmail.com",
};
const FAMILY_HOUSEHOLD_ID = "f1111111-1111-4111-8111-111111111111";
const GOOGLE_OAUTH_CLIENT_ID =
  "716942219100-bui92ujltr06i4b1ta67npashu3qejcr.apps.googleusercontent.com";

const ITEM_TYPES = new Set([
  "calendar", "task", "shopping", "meal", "note", "routine", "reminder",
  "appointment", "maintenance", "bill", "activity", "list",
]);
const STATUSES = new Set(["active", "completed", "cancelled"]);
const OPERATIONS = new Set([
  "list",
  "create",
  "update",
  "complete",
  "cancel",
  "undo",
  "history",
  "skip",
  "pause",
  "resume",
]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ITEM_SELECT = [
  "id",
  "item_type",
  "title",
  "details",
  "status",
  "starts_at",
  "ends_at",
  "due_at",
  "planned_for",
  "assignee",
  "created_by_email",
  "created_via",
  "updated_via",
  "created_at",
  "updated_at",
].join(",");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function respond(status: number, payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function cleanText(value: unknown, field: string, maxLength = 300) {
  if (value === null) return null;
  if (typeof value !== "string") throw new Error(`${field} must be text.`);
  const cleaned = value.trim();
  if (!cleaned) throw new Error(`${field} cannot be empty.`);
  if (cleaned.length > maxLength) throw new Error(`${field} is too long.`);
  return cleaned;
}

function cleanTimestamp(value: unknown, field: string) {
  if (value === null) return null;
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
    throw new Error(`${field} must be an ISO 8601 date-time with a timezone.`);
  }
  return new Date(value).toISOString();
}

function cleanDate(value: unknown) {
  if (value === null) return null;
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) {
    throw new Error("planned_for must use YYYY-MM-DD.");
  }
  return value;
}

function mutationFromBody(
  body: Record<string, unknown>,
  creating: boolean,
  existingDetails: Record<string, unknown> = {},
) {
  const mutation: Record<string, unknown> = {};

  if (creating || Object.hasOwn(body, "item_type")) {
    if (typeof body.item_type !== "string" || !ITEM_TYPES.has(body.item_type)) {
      throw new Error("item_type is not a supported Family Planner category.");
    }
    mutation.item_type = body.item_type;
  }

  if (creating || Object.hasOwn(body, "title")) {
    mutation.title = cleanText(body.title, "title");
  }

  const details: Record<string, unknown> = { ...existingDetails };
  let detailsChanged = false;
  if (Object.hasOwn(body, "details")) {
    if (
      body.details === null ||
      typeof body.details !== "object" ||
      Array.isArray(body.details)
    ) {
      throw new Error("details must be a JSON object.");
    }
    Object.assign(details, body.details);
    detailsChanged = true;
  }

  const detailFields = [
    "recurrence", "recurrence_days", "reminder_minutes", "steps", "time",
    "location", "amount", "autopay", "items", "notes", "text", "category", "quantity",
  ];
  for (const field of detailFields) {
    if (Object.hasOwn(body, field)) {
      details[field] = body[field];
      detailsChanged = true;
    }
  }
  if (Object.hasOwn(details, "recurrence")) {
    const allowedRecurrence = new Set(["", "daily", "weekdays", "weekly", "monthly", "quarterly", "yearly"]);
    if (typeof details.recurrence !== "string" || !allowedRecurrence.has(details.recurrence)) {
      throw new Error("recurrence must be daily, weekdays, weekly, monthly, quarterly, yearly, or empty.");
    }
  }
  if (Object.hasOwn(details, "steps") && (!Array.isArray(details.steps) || details.steps.some(step => typeof step !== "string"))) {
    throw new Error("steps must be a list of checklist text.");
  }
  if (Object.hasOwn(details, "items") && !Array.isArray(details.items)) {
    throw new Error("items must be a list.");
  }
  if (creating || detailsChanged) mutation.details = details;

  if (Object.hasOwn(body, "status")) {
    if (typeof body.status !== "string" || !STATUSES.has(body.status)) {
      throw new Error("status must be active, completed, or cancelled.");
    }
    mutation.status = body.status;
  }

  if (Object.hasOwn(body, "starts_at")) {
    mutation.starts_at = cleanTimestamp(body.starts_at, "starts_at");
  }
  if (Object.hasOwn(body, "ends_at")) {
    mutation.ends_at = cleanTimestamp(body.ends_at, "ends_at");
  }
  if (Object.hasOwn(body, "due_at")) {
    mutation.due_at = cleanTimestamp(body.due_at, "due_at");
  }
  if (Object.hasOwn(body, "planned_for")) {
    mutation.planned_for = cleanDate(body.planned_for);
  }
  if (Object.hasOwn(body, "assignee")) {
    mutation.assignee = body.assignee === null
      ? null
      : cleanText(body.assignee, "assignee", 120);
  }

  if (creating) {
    mutation.created_via = "chatgpt";
  }
  mutation.updated_via = "chatgpt";
  return mutation;
}

function mutableSnapshot(item: Record<string, unknown> | null) {
  if (!item) return null;
  return {
    item_type: item.item_type ?? null,
    title: item.title ?? null,
    details: item.details ?? {},
    status: item.status ?? null,
    starts_at: item.starts_at ?? null,
    ends_at: item.ends_at ?? null,
    due_at: item.due_at ?? null,
    planned_for: item.planned_for ?? null,
    assignee: item.assignee ?? null,
  };
}

async function stableActorId(email: string) {
  const digest = new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(email)),
  );
  digest[6] = (digest[6] & 0x0f) | 0x40;
  digest[8] = (digest[8] & 0x3f) | 0x80;
  const hex = Array.from(digest.slice(0, 16), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${
    hex.slice(16, 20)
  }-${hex.slice(20, 32)}`;
}

function secureEqual(left: string, right: string) {
  const leftBytes = new TextEncoder().encode(left);
  const rightBytes = new TextEncoder().encode(right);
  if (leftBytes.length !== rightBytes.length) return false;

  let difference = 0;
  for (let index = 0; index < leftBytes.length; index += 1) {
    difference |= leftBytes[index] ^ rightBytes[index];
  }
  return difference === 0;
}

function familyToday() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = (type: string) => parts.find(part => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

async function verifyGoogleIdentity(accessToken: string) {
  const tokenInfoResponse = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?access_token=${
      encodeURIComponent(accessToken)
    }`,
  );
  if (!tokenInfoResponse.ok) return null;

  const tokenInfo = await tokenInfoResponse.json() as Record<string, unknown>;
  const audience = String(tokenInfo.aud ?? tokenInfo.issued_to ?? "");
  if (audience !== GOOGLE_OAUTH_CLIENT_ID) return null;

  const userInfoResponse = await fetch(
    "https://openidconnect.googleapis.com/v1/userinfo",
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!userInfoResponse.ok) return null;

  const userInfo = await userInfoResponse.json() as Record<string, unknown>;
  const email = String(userInfo.email ?? "").trim().toLowerCase();
  const emailVerified = userInfo.email_verified === true ||
    userInfo.email_verified === "true";
  if (!email || !emailVerified) return null;

  return { email, actorId: await stableActorId(email) };
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return respond(405, { error: "Use POST for planner commands." });
  }

  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return respond(401, { error: "Sign in to the Family Planner first." });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const familyAgentApiKey = Deno.env.get("FAMILY_AGENT_API_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return respond(500, { error: "The planner service is not configured." });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return respond(400, { error: "Send a valid JSON command." });
  }

  const accessToken = authorization.slice("Bearer ".length).trim();
  let identity: { email: string; actorId: string } | null = null;
  const isFamilyAgent = Boolean(
    familyAgentApiKey && secureEqual(accessToken, familyAgentApiKey),
  );

  if (isFamilyAgent) {
    const actor = typeof body.actor === "string" ? body.actor : "";
    const email = ACTOR_EMAILS[actor];
    if (!email) {
      return respond(400, { error: "actor must be Tyler or Kayla." });
    }
    identity = { email, actorId: await stableActorId(email) };
  } else {
    try {
      identity = await verifyGoogleIdentity(accessToken);
    } catch (error) {
      console.error("Google token verification failed", error);
    }
  }
  if (!identity) {
    return respond(401, { error: "Your Family Planner authorization has expired." });
  }

  const { email, actorId } = identity;
  if (!ALLOWED_EMAILS.has(email)) {
    return respond(403, { error: "This account is not a member of this family planner." });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    global: {
      headers: {
        "x-family-actor-email": email,
        "x-family-actor-id": actorId,
      },
    },
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });

  const operation = typeof body.operation === "string" ? body.operation : "";
  if (!OPERATIONS.has(operation)) {
    return respond(400, {
      error: "operation must be list, create, update, complete, cancel, undo, history, skip, pause, or resume.",
    });
  }

  const limit = Math.min(Math.max(Number(body.limit) || 50, 1), 100);

  try {
    if (operation === "list") {
      let query = supabase
        .from("planner_items")
        .select(ITEM_SELECT)
        .eq("household_id", FAMILY_HOUSEHOLD_ID)
        .order("updated_at", { ascending: false })
        .limit(limit);

      if (typeof body.item_type === "string" && ITEM_TYPES.has(body.item_type)) {
        query = query.eq("item_type", body.item_type);
      }
      if (typeof body.status === "string" && STATUSES.has(body.status)) {
        query = query.eq("status", body.status);
      } else {
        query = query.neq("status", "cancelled");
      }
      if (typeof body.search === "string" && body.search.trim()) {
        const search = body.search.trim().slice(0, 100).replace(/[%_]/g, "");
        query = query.ilike("title", `%${search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return respond(200, {
        ok: true,
        timezone: "America/New_York",
        items: data ?? [],
      });
    }

    if (operation === "history") {
      const { data, error } = await supabase
        .from("agent_activity_log")
        .select("id,item_id,actor_email,operation,source,summary,created_at")
        .eq("household_id", FAMILY_HOUSEHOLD_ID)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return respond(200, { ok: true, activity: data ?? [] });
    }

    if (operation === "create") {
      const mutation = {
        ...mutationFromBody(body, true),
        household_id: FAMILY_HOUSEHOLD_ID,
        created_by: actorId,
        created_by_email: email,
      };
      const { data, error } = await supabase
        .from("planner_items")
        .insert(mutation)
        .select(ITEM_SELECT)
        .single();
      if (error) throw error;
      return respond(200, { ok: true, message: `Added ${data.title}.`, item: data });
    }

    if (operation === "undo") {
      const { data: activity, error: activityError } = await supabase
        .from("agent_activity_log")
        .select("id,item_id,operation,before_state,after_state,created_at")
        .eq("household_id", FAMILY_HOUSEHOLD_ID)
        .eq("actor_user_id", actorId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (activityError) throw activityError;
      if (!activity) {
        return respond(200, { ok: true, message: "There is no recent change to undo." });
      }
      if (activity.operation === "undo") {
        return respond(200, { ok: true, message: "The most recent change was already an undo." });
      }
      if (!activity.item_id) {
        return respond(409, { error: "The most recent change cannot be undone safely." });
      }

      const { data: current, error: currentError } = await supabase
        .from("planner_items")
        .select(ITEM_SELECT)
        .eq("household_id", FAMILY_HOUSEHOLD_ID)
        .eq("id", activity.item_id)
        .maybeSingle();
      if (currentError) throw currentError;
      if (!current) {
        return respond(409, { error: "That item no longer exists, so it cannot be undone." });
      }

      if (
        activity.after_state &&
        JSON.stringify(mutableSnapshot(current)) !==
          JSON.stringify(mutableSnapshot(activity.after_state as Record<string, unknown>))
      ) {
        return respond(409, {
          error: "Someone changed that item afterward. Review it before making another change.",
        });
      }

      let undoMutation: Record<string, unknown>;
      if (activity.operation === "create") {
        undoMutation = { status: "cancelled", updated_via: "undo" };
      } else if (activity.before_state) {
        undoMutation = {
          ...mutableSnapshot(activity.before_state as Record<string, unknown>),
          updated_via: "undo",
        };
      } else {
        return respond(409, { error: "That change does not have enough history to undo." });
      }

      const { data, error } = await supabase
        .from("planner_items")
        .update(undoMutation)
        .eq("household_id", FAMILY_HOUSEHOLD_ID)
        .eq("id", activity.item_id)
        .eq("updated_at", current.updated_at)
        .select(ITEM_SELECT)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        return respond(409, { error: "The item changed while undoing. Please review it first." });
      }
      return respond(200, { ok: true, message: `Undid the change to ${data.title}.`, item: data });
    }

    const itemId = typeof body.item_id === "string" ? body.item_id : "";
    if (!UUID_PATTERN.test(itemId)) {
      return respond(400, { error: "A valid item_id is required for this operation." });
    }

    const { data: currentItem, error: currentItemError } = await supabase
      .from("planner_items")
      .select(ITEM_SELECT)
      .eq("household_id", FAMILY_HOUSEHOLD_ID)
      .eq("id", itemId)
      .maybeSingle();
    if (currentItemError) throw currentItemError;
    if (!currentItem) {
      return respond(404, { error: "No matching family planner item was found." });
    }

    let mutation: Record<string, unknown>;
    if (operation === "complete") {
      const currentDetails = (currentItem.details ?? {}) as Record<string, unknown>;
      if (currentItem.item_type === "routine" || currentDetails.recurrence) {
        const completedDates = new Set(Array.isArray(currentDetails.completed_dates) ? currentDetails.completed_dates : []);
        completedDates.add(familyToday());
        mutation = {
          status: "active",
          details: { ...currentDetails, completed_dates: [...completedDates] },
          updated_via: "chatgpt",
        };
      } else {
        mutation = { status: "completed", updated_via: "chatgpt" };
      }
    } else if (operation === "cancel") {
      mutation = { status: "cancelled", updated_via: "chatgpt" };
    } else if (operation === "skip") {
      const currentDetails = (currentItem.details ?? {}) as Record<string, unknown>;
      const skippedDates = new Set(Array.isArray(currentDetails.skipped_dates) ? currentDetails.skipped_dates : []);
      skippedDates.add(familyToday());
      mutation = { details: { ...currentDetails, skipped_dates: [...skippedDates] }, updated_via: "chatgpt" };
    } else if (operation === "pause" || operation === "resume") {
      const currentDetails = (currentItem.details ?? {}) as Record<string, unknown>;
      mutation = { details: { ...currentDetails, paused: operation === "pause" }, updated_via: "chatgpt" };
    } else {
      mutation = mutationFromBody(body, false, (currentItem.details ?? {}) as Record<string, unknown>);
      if (Object.keys(mutation).length === 1) {
        return respond(400, { error: "Include at least one field to update." });
      }
    }

    const { data, error } = await supabase
      .from("planner_items")
      .update(mutation)
      .eq("household_id", FAMILY_HOUSEHOLD_ID)
      .eq("id", itemId)
      .select(ITEM_SELECT)
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      return respond(404, { error: "No matching family planner item was found." });
    }

    const verb = operation === "complete"
      ? "Completed"
      : operation === "cancel"
      ? "Cancelled"
      : operation === "skip"
      ? "Skipped today for"
      : operation === "pause"
      ? "Paused"
      : operation === "resume"
      ? "Resumed"
      : "Updated";
    return respond(200, { ok: true, message: `${verb} ${data.title}.`, item: data });
  } catch (error) {
    console.error("Family Planner command failed", error);
    const message = error instanceof Error ? error.message : "Planner command failed.";
    if (
      message.includes("must be") ||
      message.includes("cannot be") ||
      message.includes("too long")
    ) {
      return respond(400, { error: message });
    }
    return respond(500, { error: "The planner could not save that change. Please try again." });
  }
});

