import "jsr:@supabase/functions-js@2.5.0/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";

const ALLOWED_EMAILS = new Set([
  "tyler109j@gmail.com",
  "kaylajilljoyce@gmail.com",
]);

const ITEM_TYPES = new Set(["calendar", "task", "shopping", "meal", "note"]);
const STATUSES = new Set(["active", "completed", "cancelled"]);
const OPERATIONS = new Set([
  "list",
  "create",
  "update",
  "complete",
  "cancel",
  "undo",
  "history",
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

function mutationFromBody(body: Record<string, unknown>, creating: boolean) {
  const mutation: Record<string, unknown> = {};

  if (creating || Object.hasOwn(body, "item_type")) {
    if (typeof body.item_type !== "string" || !ITEM_TYPES.has(body.item_type)) {
      throw new Error("item_type must be calendar, task, shopping, meal, or note.");
    }
    mutation.item_type = body.item_type;
  }

  if (creating || Object.hasOwn(body, "title")) {
    mutation.title = cleanText(body.title, "title");
  }

  if (Object.hasOwn(body, "details")) {
    if (
      body.details === null ||
      typeof body.details !== "object" ||
      Array.isArray(body.details)
    ) {
      throw new Error("details must be a JSON object.");
    }
    mutation.details = body.details;
  } else if (creating) {
    mutation.details = {};
  }

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
  const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !supabaseKey) {
    return respond(500, { error: "The planner service is not configured." });
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: authorization } },
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });

  const { data: authData, error: authError } = await supabase.auth.getUser();
  const user = authData.user;
  const email = user?.email?.trim().toLowerCase();
  if (authError || !user || !email) {
    return respond(401, { error: "Your Family Planner sign-in has expired." });
  }
  if (!ALLOWED_EMAILS.has(email)) {
    return respond(403, { error: "This account is not a member of this family planner." });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return respond(400, { error: "Send a valid JSON command." });
  }

  const operation = typeof body.operation === "string" ? body.operation : "";
  if (!OPERATIONS.has(operation)) {
    return respond(400, {
      error: "operation must be list, create, update, complete, cancel, undo, or history.",
    });
  }

  const limit = Math.min(Math.max(Number(body.limit) || 50, 1), 100);

  try {
    if (operation === "list") {
      let query = supabase
        .from("planner_items")
        .select(ITEM_SELECT)
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
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return respond(200, { ok: true, activity: data ?? [] });
    }

    if (operation === "create") {
      const mutation = mutationFromBody(body, true);
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
        .eq("actor_user_id", user.id)
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

    let mutation: Record<string, unknown>;
    if (operation === "complete") {
      mutation = { status: "completed", updated_via: "chatgpt" };
    } else if (operation === "cancel") {
      mutation = { status: "cancelled", updated_via: "chatgpt" };
    } else {
      mutation = mutationFromBody(body, false);
      if (Object.keys(mutation).length === 1) {
        return respond(400, { error: "Include at least one field to update." });
      }
    }

    const { data, error } = await supabase
      .from("planner_items")
      .update(mutation)
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
