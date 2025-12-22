import { supabase } from "@/utils/supabase";
import type { CalendarEvent, CalendarEventInsert } from "@/types/calendar";

export async function listCalendarEvents(rangeStartISO: string, rangeEndISO: string) {
  // Return events overlapping the visible range, excluding daily agenda events
  const { data, error } = await supabase
    .from("calendar_events")
    .select("*")
    .gte('start_at', rangeStartISO)
    .lte('start_at', rangeEndISO)
    .not('title', 'like', '%Paint%Callback%Repair%') // Exclude daily agenda events
    .order("start_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as CalendarEvent[];
}

export async function createCalendarEvent(payload: CalendarEventInsert) {
  // Get the current user ID
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("User not authenticated");

  // Add the created_by field to the payload
  const eventPayload = {
    ...payload,
    created_by: user.id
  };

  // Create the calendar event
  const { data: inserted, error } = await supabase
    .from("calendar_events")
    .insert([eventPayload])
    .select()
    .single();

  if (error) throw error;

  return inserted as CalendarEvent;
}

export async function updateCalendarEvent(eventId: string, payload: CalendarEventInsert) {
  // Get the current user ID
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("User not authenticated");

  console.log('updateCalendarEvent: Updating event', eventId, 'with payload:', payload);
  console.log('updateCalendarEvent: User ID:', user.id);

  // Update the calendar event
  const { data: updated, error } = await supabase
    .from("calendar_events")
    .update(payload)
    .eq("id", eventId)
    .eq("created_by", user.id) // Ensure user can only update their own events
    .select()
    .single();

  if (error) {
    console.error('updateCalendarEvent: Supabase error:', error);
    throw error;
  }

  console.log('updateCalendarEvent: Update successful:', updated);
  return updated as CalendarEvent;
}

export async function deleteCalendarEvent(eventId: string) {
  // Get the current user ID
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("User not authenticated");

  // Delete the calendar event
  const { error } = await supabase
    .from("calendar_events")
    .delete()
    .eq("id", eventId)
    .eq("created_by", user.id); // Ensure user can only delete their own events

  if (error) throw error;

  return true;
}

// Function for calendar feed that includes all events (including daily agenda)
export async function listAllCalendarEvents(rangeStartISO: string, rangeEndISO: string) {
  // Return all events overlapping the visible range (including daily agenda events)
  const { data, error } = await supabase
    .from("calendar_events")
    .select("*")
    .gte('start_at', rangeStartISO)
    .lte('start_at', rangeEndISO)
    .order("start_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as CalendarEvent[];
}


