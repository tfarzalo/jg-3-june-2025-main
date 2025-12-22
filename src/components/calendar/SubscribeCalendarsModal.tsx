import * as React from "react";
import { supabase } from "../../utils/supabase";
import { Button } from "../ui/Button";

function googleAddUrl(icsUrl: string) {
  return `https://calendar.google.com/calendar/u/0/r?cid=${encodeURIComponent(icsUrl)}`;
}

function webcalUrl(icsUrl: string) {
  // Safari/Apple Calendar uses webcal:// or webcals:// (secure)
  // Try webcal:// first as it's more compatible with older macOS versions
  return icsUrl.replace(/^https:\/\//, "webcal://").replace(/^http:\/\//, "webcal://");
}

export default function SubscribeCalendarsModal() {
  const [open, setOpen] = React.useState(false);
  const [token, setToken] = React.useState<string>("");

  const base = `https://tbwtfimnbmvbgesidbxh.supabase.co/functions/v1/calendar-feed`;

  // Helper function to get or create token without RLS dependency
  const getOrCreateToken = async () => {
    try {
      // Try RPC if present
      try {
        const { data: rpcData } = await supabase.rpc("ensure_calendar_token");
        if (rpcData) return rpcData as string;
      } catch (rpcError) {
        console.log("RPC ensure_calendar_token not available, using fallback");
      }

      // Fallback: direct upsert (RLS off in dev)
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) throw new Error("Not signed in");
      const { data: existing } = await supabase
        .from("calendar_tokens")
        .select("token")
        .eq("user_id", user.id)
        .maybeSingle();
      if (existing?.token) return existing.token;

      const newToken = crypto.randomUUID();
      await supabase.from("calendar_tokens").insert({ user_id: user.id, token: newToken });
      return newToken;
    } catch (error) {
      console.error("Error in getOrCreateToken:", error);
      throw error;
    }
  };

  React.useEffect(() => {
    if (!open) return;

    (async () => {
      try {
        // 1) Ensure I have a token using fallback method
        try {
          const tok = await getOrCreateToken();
          setToken(tok);
          console.log("Got my calendar token:", tok);
        } catch (error) {
          console.error("Failed to get/create calendar token:", error);
        }

      } catch (error) {
        console.error("Error in SubscribeCalendarsModal useEffect:", error);
      }
    })();
  }, [open]);

  const urls = React.useMemo(() => {
    if (!token) return null;
    return {
      events: `${base}?scope=events&token=${token}`,
      eventsAndRequests: `${base}?scope=events_and_job_requests&token=${token}`,
      completed: `${base}?scope=completed_jobs&token=${token}`
    };
  }, [token]);

  if (!open) {
    return (
      <Button
        variant="secondary"
        onClick={() => setOpen(true)}
      >
        Subscribe to Calendars
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-[#1E293B] rounded-lg p-6 max-w-3xl w-full shadow-xl">
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Subscribe to Calendars</h2>
          <button
            onClick={() => setOpen(false)}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            ✕
          </button>
        </div>

        {!urls ? (
          <p className="text-sm text-gray-600 dark:text-gray-400">Preparing your feed links…</p>
        ) : (
          <div className="space-y-6">
            {/* Section: Events */}
            <section>
              <h3 className="font-semibold mb-2 text-gray-900 dark:text-white">Events</h3>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">ICS URL (copy this if links don't work)</label>
              <input
                readOnly
                value={urls.events}
                onFocus={(e) => e.currentTarget.select()}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white mb-2 text-sm font-mono"
              />
              <div className="flex flex-wrap gap-2">
                <a className="underline text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200" href={webcalUrl(urls.events)}>
                  📱 Apple Calendar Feed
                </a>
                <a className="underline text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200" target="_blank" rel="noreferrer" href={googleAddUrl(urls.events)}>
                  📧 Google Calendar Feed
                </a>
              </div>
            </section>

            {/* Section: Events + Job Requests */}
            <section>
              <h3 className="font-semibold mb-2 text-gray-900 dark:text-white">Events & Job Requests</h3>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">ICS URL (copy this if links don't work)</label>
              <input
                readOnly
                value={urls.eventsAndRequests}
                onFocus={(e) => e.currentTarget.select()}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white mb-2 text-sm font-mono"
              />
              <div className="flex flex-wrap gap-2">
                <a className="underline text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200" href={webcalUrl(urls.eventsAndRequests)}>
                  📱 Apple Calendar Feed
                </a>
                <a className="underline text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200" target="_blank" rel="noreferrer" href={googleAddUrl(urls.eventsAndRequests)}>
                  📧 Google Calendar Feed
                </a>
              </div>
            </section>

            {/* Section: Completed Jobs */}
            <section>
              <h3 className="font-semibold mb-2 text-gray-900 dark:text-white">Completed Jobs</h3>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">ICS URL (copy this if links don't work)</label>
              <input
                readOnly
                value={urls.completed}
                onFocus={(e) => e.currentTarget.select()}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white mb-2 text-sm font-mono"
              />
              <div className="flex flex-wrap gap-2">
                <a className="underline text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200" href={webcalUrl(urls.completed)}>
                  📱 Apple Calendar Feed
                </a>
                <a className="underline text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200" target="_blank" rel="noreferrer" href={googleAddUrl(urls.completed)}>
                  📧 Google Calendar Feed
                </a>
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
