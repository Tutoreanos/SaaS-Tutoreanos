import { supabase } from "./supabase";

export type GoogleCalendarConnection = {
  google_email: string | null;
  calendar_id: string;
  calendar_summary: string;
  connected_at: string;
};

export type GoogleCalendarStatus = {
  configured: boolean;
  connected: boolean;
  redirect_uri: string;
  connection: GoogleCalendarConnection | null;
};

export type GoogleCalendarOption = {
  id: string;
  summary: string;
  primary: boolean;
  access_role: string;
};

export type GoogleCalendarEvent = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  starts_at: string;
  ends_at: string;
  all_day: boolean;
  status: string;
  html_link: string | null;
};

async function invoke<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("google-calendar", { body });
  if (error) {
    const context = "context" in error ? error.context : null;
    if (context instanceof Response) {
      let payload: { error?: string } | null = null;
      try {
        payload = await context.clone().json() as { error?: string };
      } catch { /* The generic Functions error below remains the fallback. */ }
      if (payload?.error) throw new Error(payload.error);
    }
    throw new Error(error.message || "Não foi possível acessar o Google Agenda.");
  }
  return data as T;
}

export function getGoogleCalendarStatus() {
  return invoke<GoogleCalendarStatus>({ action: "status" });
}

export async function startGoogleCalendarConnection() {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
  const redirectTo = `${window.location.origin}${basePath}/`;
  const result = await invoke<{ authorization_url: string }>({ action: "authorize", redirect_to: redirectTo });
  window.location.assign(result.authorization_url);
}

export function listGoogleCalendars() {
  return invoke<{ calendars: GoogleCalendarOption[] }>({ action: "calendars" });
}

export function selectGoogleCalendar(calendarId: string) {
  return invoke<{ calendar_id: string; calendar_summary: string }>({ action: "select_calendar", calendar_id: calendarId });
}

export function listGoogleCalendarEvents() {
  return invoke<{ events: GoogleCalendarEvent[] }>({ action: "events" });
}

export function syncActivityToGoogle(activityId: string) {
  return invoke<{ event_id: string; html_link: string | null }>({ action: "sync_activity", activity_id: activityId });
}

export function deleteActivityFromGoogle(activityId: string) {
  return invoke<{ removed: boolean }>({ action: "delete_activity_event", activity_id: activityId });
}

export function disconnectGoogleCalendar() {
  return invoke<{ disconnected: boolean }>({ action: "disconnect" });
}
