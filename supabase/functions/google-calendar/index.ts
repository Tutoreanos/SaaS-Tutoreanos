import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.110.7";
import { corsHeaders } from "npm:@supabase/supabase-js@2.110.7/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID") ?? "";
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET") ?? "";
const APP_URL = Deno.env.get("GOOGLE_CALENDAR_APP_URL") ?? "https://tutoreanos.github.io/SaaS-Tutoreanos/";
const REDIRECT_URI = Deno.env.get("GOOGLE_CALENDAR_REDIRECT_URI") ?? `${SUPABASE_URL}/functions/v1/google-calendar/callback`;
const TIME_ZONE = Deno.env.get("GOOGLE_CALENDAR_TIME_ZONE") ?? "America/Sao_Paulo";
const GOOGLE_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
];

const allowedAppUrls = [
  APP_URL,
  "https://tutoreanos.github.io/SaaS-Tutoreanos/",
  "https://crm-consultores.eron-tutoreanos.chatgpt.site/",
  "http://localhost:3000/",
].map((value) => new URL(value));

function getServerKey() {
  for (const name of ["SUPABASE_SECRET_KEYS"]) {
    const raw = Deno.env.get(name);
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw) as Record<string, string>;
      if (parsed.default) return parsed.default;
      const first = Object.values(parsed)[0];
      if (first) return first;
    } catch {
      return raw;
    }
  }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
}

const admin = createClient(SUPABASE_URL, getServerKey(), {
  auth: { autoRefreshToken: false, persistSession: false },
});

type Connection = {
  user_id: string;
  google_email: string | null;
  calendar_id: string;
  calendar_summary: string;
  access_token: string;
  refresh_token: string | null;
  token_expires_at: string;
  scopes: string[];
  sync_enabled: boolean;
  connected_at: string;
  updated_at: string;
};

type Activity = {
  id: string;
  user_id: string;
  title: string;
  details: string | null;
  due_at: string;
  ends_at: string | null;
  location: string | null;
  attendee_emails: string[];
  send_invites: boolean;
  sync_to_google: boolean;
  google_event_id: string | null;
  google_calendar_id: string | null;
};

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function configured() {
  return Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET && SUPABASE_URL && getServerKey());
}

function safeRedirect(value: unknown) {
  if (typeof value !== "string") return APP_URL;
  try {
    const candidate = new URL(value);
    const match = allowedAppUrls.find((allowed) => candidate.origin === allowed.origin && candidate.pathname === allowed.pathname);
    return match ? match.toString() : APP_URL;
  } catch {
    return APP_URL;
  }
}

function callbackRedirect(target: string, result: "connected" | "error", message?: string) {
  const url = new URL(target);
  url.searchParams.set("google_calendar", result);
  if (message) url.searchParams.set("google_calendar_message", message.slice(0, 180));
  return Response.redirect(url.toString(), 302);
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function randomState() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

async function requireUser(req: Request) {
  const authorization = req.headers.get("Authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) throw new HttpError(401, "Entre novamente no CRM para continuar.");
  const token = authorization.slice(7);
  const { data: { user }, error } = await admin.auth.getUser(token);
  if (error || !user) throw new HttpError(401, "Sua sessão expirou. Entre novamente no CRM.");
  return user;
}

async function parseResponse(response: Response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { message: text };
  }
}

function googleError(data: Record<string, unknown> | null, fallback: string) {
  const nested = data?.error;
  if (typeof nested === "object" && nested && "message" in nested && typeof nested.message === "string") return nested.message;
  if (typeof data?.error_description === "string") return data.error_description;
  if (typeof data?.message === "string") return data.message;
  return fallback;
}

async function exchangeCode(code: string) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      code,
      grant_type: "authorization_code",
      redirect_uri: REDIRECT_URI,
    }),
  });
  const data = await parseResponse(response);
  if (!response.ok || !data || typeof data.access_token !== "string") {
    throw new HttpError(400, googleError(data, "O Google não concluiu a autorização."));
  }
  return data as Record<string, unknown> & { access_token: string; refresh_token?: string; expires_in?: number; scope?: string };
}

async function loadConnection(userId: string) {
  const { data, error } = await admin.from("google_calendar_connections").select("*").eq("user_id", userId).maybeSingle();
  if (error) throw new HttpError(500, "Não foi possível consultar a conexão com o Google.");
  return data as Connection | null;
}

async function refreshConnection(connection: Connection, force = false) {
  const expiresSoon = new Date(connection.token_expires_at).getTime() <= Date.now() + 60_000;
  if (!force && !expiresSoon) return connection;
  if (!connection.refresh_token) throw new HttpError(401, "Reconecte sua conta Google para renovar a autorização.");

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: connection.refresh_token,
      grant_type: "refresh_token",
    }),
  });
  const data = await parseResponse(response);
  if (!response.ok || !data || typeof data.access_token !== "string") {
    throw new HttpError(401, googleError(data, "Reconecte sua conta Google para continuar."));
  }

  const next = {
    ...connection,
    access_token: data.access_token,
    token_expires_at: new Date(Date.now() + Number(data.expires_in ?? 3600) * 1000).toISOString(),
  };
  const { error } = await admin.from("google_calendar_connections").update({
    access_token: next.access_token,
    token_expires_at: next.token_expires_at,
  }).eq("user_id", connection.user_id);
  if (error) throw new HttpError(500, "Não foi possível renovar a conexão com o Google.");
  return next;
}

async function googleRequest(connection: Connection, url: string, init: RequestInit = {}, allowMissing = false) {
  let active = await refreshConnection(connection);
  const request = () => fetch(url, {
    ...init,
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers ?? {}),
      Authorization: `Bearer ${active.access_token}`,
    },
  });

  let response = await request();
  if (response.status === 401 && active.refresh_token) {
    active = await refreshConnection(active, true);
    response = await request();
  }
  if (allowMissing && (response.status === 404 || response.status === 410)) return null;
  const data = await parseResponse(response);
  if (!response.ok) throw new HttpError(response.status, googleError(data, "O Google Agenda recusou a operação."));
  return data;
}

async function handleCallback(url: URL) {
  const rawState = url.searchParams.get("state") ?? "";
  const code = url.searchParams.get("code") ?? "";
  if (!rawState) return callbackRedirect(APP_URL, "error", "A autorização retornou sem o código de segurança.");

  const stateHash = await sha256(rawState);
  const { data: state, error } = await admin.from("google_calendar_oauth_states")
    .delete()
    .eq("state_hash", stateHash)
    .gt("expires_at", new Date().toISOString())
    .select("user_id, redirect_to")
    .maybeSingle();
  const target = state?.redirect_to ? safeRedirect(state.redirect_to) : APP_URL;
  if (error || !state) return callbackRedirect(target, "error", "Esta autorização expirou. Tente conectar novamente.");
  if (url.searchParams.get("error")) return callbackRedirect(target, "error", "A autorização do Google foi cancelada.");
  if (!code) return callbackRedirect(target, "error", "O Google não retornou o código de autorização.");

  try {
    const tokens = await exchangeCode(code);
    const existing = await loadConnection(state.user_id);
    const userInfoResponse = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const userInfo = await parseResponse(userInfoResponse);
    const refreshToken = typeof tokens.refresh_token === "string" ? tokens.refresh_token : existing?.refresh_token ?? null;
    const payload = {
      user_id: state.user_id,
      google_email: typeof userInfo?.email === "string" ? userInfo.email : existing?.google_email ?? null,
      calendar_id: existing?.calendar_id ?? "primary",
      calendar_summary: existing?.calendar_summary ?? "Agenda principal",
      access_token: tokens.access_token,
      refresh_token: refreshToken,
      token_expires_at: new Date(Date.now() + Number(tokens.expires_in ?? 3600) * 1000).toISOString(),
      scopes: typeof tokens.scope === "string" ? tokens.scope.split(" ") : GOOGLE_SCOPES,
      sync_enabled: true,
      connected_at: existing?.connected_at ?? new Date().toISOString(),
    };
    const { error: upsertError } = await admin.from("google_calendar_connections").upsert(payload, { onConflict: "user_id" });
    if (upsertError) throw new HttpError(500, "Não foi possível salvar a conexão com o Google.");
    return callbackRedirect(target, "connected");
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Não foi possível conectar o Google Agenda.";
    return callbackRedirect(target, "error", message);
  }
}

async function authorize(req: Request, redirectTo: unknown) {
  if (!configured()) throw new HttpError(503, "A integração ainda precisa das credenciais do Google Cloud.");
  const user = await requireUser(req);
  const state = randomState();
  const stateHash = await sha256(state);
  await admin.from("google_calendar_oauth_states").delete().lt("expires_at", new Date().toISOString());
  const { error } = await admin.from("google_calendar_oauth_states").insert({
    state_hash: stateHash,
    user_id: user.id,
    redirect_to: safeRedirect(redirectTo),
    expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
  });
  if (error) throw new HttpError(500, "Não foi possível iniciar a conexão com o Google.");

  const authorizationUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authorizationUrl.search = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: GOOGLE_SCOPES.join(" "),
    access_type: "offline",
    include_granted_scopes: "true",
    prompt: "consent select_account",
    state,
    login_hint: user.email ?? "",
  }).toString();
  return { authorization_url: authorizationUrl.toString(), redirect_uri: REDIRECT_URI };
}

async function connectionFor(req: Request) {
  if (!configured()) throw new HttpError(503, "A integração ainda precisa das credenciais do Google Cloud.");
  const user = await requireUser(req);
  const connection = await loadConnection(user.id);
  if (!connection) throw new HttpError(404, "Conecte sua conta Google primeiro.");
  return { user, connection };
}

async function listCalendars(req: Request) {
  const { connection } = await connectionFor(req);
  const data = await googleRequest(connection, "https://www.googleapis.com/calendar/v3/users/me/calendarList?minAccessRole=writer&showHidden=false&maxResults=250");
  const items = Array.isArray(data?.items) ? data.items : [];
  return {
    calendars: items.map((item) => ({
      id: String((item as Record<string, unknown>).id ?? ""),
      summary: String((item as Record<string, unknown>).summaryOverride ?? (item as Record<string, unknown>).summary ?? "Agenda"),
      primary: Boolean((item as Record<string, unknown>).primary),
      access_role: String((item as Record<string, unknown>).accessRole ?? "reader"),
    })).filter((item) => item.id),
  };
}

async function selectCalendar(req: Request, calendarId: unknown) {
  if (typeof calendarId !== "string" || !calendarId) throw new HttpError(400, "Selecione uma agenda válida.");
  const { user, connection } = await connectionFor(req);
  const data = await googleRequest(connection, `https://www.googleapis.com/calendar/v3/users/me/calendarList/${encodeURIComponent(calendarId)}`);
  const summary = String(data?.summaryOverride ?? data?.summary ?? "Agenda Google");
  const { error } = await admin.from("google_calendar_connections").update({
    calendar_id: calendarId,
    calendar_summary: summary,
  }).eq("user_id", user.id);
  if (error) throw new HttpError(500, "Não foi possível selecionar esta agenda.");
  return { calendar_id: calendarId, calendar_summary: summary };
}

async function listEvents(req: Request, input: Record<string, unknown>) {
  const { connection } = await connectionFor(req);
  const timeMin = typeof input.time_min === "string" ? input.time_min : new Date(Date.now() - 24 * 60 * 60_000).toISOString();
  const timeMax = typeof input.time_max === "string" ? input.time_max : new Date(Date.now() + 90 * 24 * 60 * 60_000).toISOString();
  const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(connection.calendar_id)}/events`);
  url.search = new URLSearchParams({
    singleEvents: "true",
    orderBy: "startTime",
    showDeleted: "false",
    maxResults: "100",
    timeMin,
    timeMax,
  }).toString();
  const data = await googleRequest(connection, url.toString());
  const items = Array.isArray(data?.items) ? data.items : [];
  return {
    events: items.map((raw) => {
      const item = raw as Record<string, unknown>;
      const start = (item.start ?? {}) as Record<string, unknown>;
      const end = (item.end ?? {}) as Record<string, unknown>;
      return {
        id: String(item.id ?? ""),
        title: String(item.summary ?? "Sem título"),
        description: typeof item.description === "string" ? item.description : null,
        location: typeof item.location === "string" ? item.location : null,
        starts_at: String(start.dateTime ?? start.date ?? ""),
        ends_at: String(end.dateTime ?? end.date ?? ""),
        all_day: Boolean(start.date && !start.dateTime),
        status: String(item.status ?? "confirmed"),
        html_link: typeof item.htmlLink === "string" ? item.htmlLink : null,
      };
    }).filter((item) => item.id && item.starts_at),
  };
}

async function loadActivity(userId: string, activityId: unknown) {
  if (typeof activityId !== "string" || !activityId) throw new HttpError(400, "Atividade inválida.");
  const { data, error } = await admin.from("activities").select("*").eq("id", activityId).eq("user_id", userId).maybeSingle();
  if (error || !data) throw new HttpError(404, "A atividade não foi encontrada.");
  return data as Activity;
}

async function syncActivity(req: Request, activityId: unknown) {
  const { user, connection } = await connectionFor(req);
  const activity = await loadActivity(user.id, activityId);
  await admin.from("activities").update({ google_sync_status: "pending", google_sync_error: null }).eq("id", activity.id).eq("user_id", user.id);
  const calendarId = activity.google_calendar_id || connection.calendar_id;
  const endAt = activity.ends_at || new Date(new Date(activity.due_at).getTime() + 60 * 60_000).toISOString();
  const event = {
    summary: activity.title,
    description: activity.details || undefined,
    location: activity.location || undefined,
    start: { dateTime: activity.due_at, timeZone: TIME_ZONE },
    end: { dateTime: endAt, timeZone: TIME_ZONE },
    attendees: activity.attendee_emails.filter((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)).map((email) => ({ email })),
    extendedProperties: { private: { nexoActivityId: activity.id } },
  };
  const params = new URLSearchParams({ sendUpdates: activity.send_invites ? "all" : "none" });
  const updating = Boolean(activity.google_event_id);
  const endpoint = updating
    ? `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(activity.google_event_id!)}?${params}`
    : `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`;

  try {
    const data = await googleRequest(connection, endpoint, { method: updating ? "PATCH" : "POST", body: JSON.stringify(event) });
    const { error } = await admin.from("activities").update({
      sync_to_google: true,
      google_event_id: String(data?.id ?? activity.google_event_id ?? ""),
      google_calendar_id: calendarId,
      google_event_link: typeof data?.htmlLink === "string" ? data.htmlLink : null,
      google_sync_status: "synced",
      google_sync_error: null,
      google_last_synced_at: new Date().toISOString(),
    }).eq("id", activity.id).eq("user_id", user.id);
    if (error) throw new HttpError(500, "O evento foi criado, mas o CRM não conseguiu salvar o vínculo.");
    return { event_id: data?.id, html_link: data?.htmlLink ?? null };
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Não foi possível sincronizar a atividade.";
    await admin.from("activities").update({ google_sync_status: "error", google_sync_error: message }).eq("id", activity.id).eq("user_id", user.id);
    throw cause;
  }
}

async function deleteActivityEvent(req: Request, activityId: unknown) {
  const { user, connection } = await connectionFor(req);
  const activity = await loadActivity(user.id, activityId);
  if (activity.google_event_id) {
    const calendarId = activity.google_calendar_id || connection.calendar_id;
    const sendUpdates = activity.send_invites ? "all" : "none";
    await googleRequest(connection, `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(activity.google_event_id)}?sendUpdates=${sendUpdates}`, { method: "DELETE" }, true);
  }
  const { error } = await admin.from("activities").update({
    sync_to_google: false,
    google_event_id: null,
    google_calendar_id: null,
    google_event_link: null,
    google_sync_status: "not_synced",
    google_sync_error: null,
    google_last_synced_at: null,
  }).eq("id", activity.id).eq("user_id", user.id);
  if (error) throw new HttpError(500, "Não foi possível remover o vínculo com o Google.");
  return { removed: true };
}

async function disconnect(req: Request) {
  const user = await requireUser(req);
  const connection = await loadConnection(user.id);
  if (connection) {
    const token = connection.refresh_token || connection.access_token;
    try {
      await fetch("https://oauth2.googleapis.com/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ token }),
      });
    } catch {
      // The local connection is still removed if Google is temporarily unavailable.
    }
  }
  await admin.from("google_calendar_connections").delete().eq("user_id", user.id);
  await admin.from("activities").update({
    sync_to_google: false,
    google_event_id: null,
    google_calendar_id: null,
    google_event_link: null,
    google_sync_status: "not_synced",
    google_sync_error: null,
    google_last_synced_at: null,
  }).eq("user_id", user.id);
  return { disconnected: true };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const url = new URL(req.url);
  if (req.method === "GET" && url.pathname.endsWith("/callback")) return handleCallback(url);
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);

  try {
    const input = await req.json() as Record<string, unknown>;
    const action = String(input.action ?? "status");
    if (action === "status") {
      const user = await requireUser(req);
      const connection = await loadConnection(user.id);
      return json({
        configured: configured(),
        connected: Boolean(connection),
        redirect_uri: REDIRECT_URI,
        connection: connection ? {
          google_email: connection.google_email,
          calendar_id: connection.calendar_id,
          calendar_summary: connection.calendar_summary,
          connected_at: connection.connected_at,
        } : null,
      });
    }
    if (action === "authorize") return json(await authorize(req, input.redirect_to));
    if (action === "calendars") return json(await listCalendars(req));
    if (action === "select_calendar") return json(await selectCalendar(req, input.calendar_id));
    if (action === "events") return json(await listEvents(req, input));
    if (action === "sync_activity") return json(await syncActivity(req, input.activity_id));
    if (action === "delete_activity_event") return json(await deleteActivityEvent(req, input.activity_id));
    if (action === "disconnect") return json(await disconnect(req));
    throw new HttpError(400, "Ação desconhecida.");
  } catch (cause) {
    const status = cause instanceof HttpError ? cause.status : 500;
    const message = cause instanceof Error ? cause.message : "Não foi possível concluir a operação.";
    return json({ error: message }, status);
  }
});
