import * as React from "react";
import { supabase } from "../../utils/supabase";
import { Button } from "../ui/Button";

function webcalUrl(icsUrl: string) {
  // Safari/Apple Calendar uses webcal:// or webcals:// (secure)
  return icsUrl.replace(/^https:\/\//, "webcal://").replace(/^http:\/\//, "webcal://");
}

export default function SubscribeCalendarsModal() {
  const [open, setOpen] = React.useState(false);
  const [token, setToken] = React.useState<string>("");
  const [copiedUrl, setCopiedUrl] = React.useState<string | null>(null);

  // Use environment variable for Supabase URL - works for local dev and production
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://tbwtfimnbmvbgesidbxh.supabase.co';
  const base = `${supabaseUrl}/functions/v1/calendar-feed`;

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedUrl(label);
      setTimeout(() => setCopiedUrl(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

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
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Calendar Feed URL</label>
              <div className="flex gap-2 mb-2">
                <input
                  readOnly
                  value={urls.events}
                  onFocus={(e) => e.currentTarget.select()}
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-sm font-mono"
                />
                <button
                  onClick={() => copyToClipboard(urls.events, 'events')}
                  className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors text-sm font-medium"
                >
                  {copiedUrl === 'events' ? '✓ Copied!' : 'Copy'}
                </button>
              </div>
              <div className="flex flex-wrap gap-2 mb-2">
                <a 
                  className="inline-flex items-center gap-2 px-4 py-2 bg-black text-white rounded-md hover:bg-gray-800 transition-colors text-sm font-medium" 
                  href={webcalUrl(urls.events)}
                >
                  � Subscribe in Apple Calendar
                </a>
              </div>
              <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md border border-blue-200 dark:border-blue-800">
                <p className="text-xs font-semibold text-blue-900 dark:text-blue-200 mb-1">� For Google Calendar:</p>
                <ol className="text-xs text-blue-800 dark:text-blue-300 space-y-1 ml-4 list-decimal">
                  <li>Copy the URL above</li>
                  <li>Open <a href="https://calendar.google.com" target="_blank" rel="noreferrer" className="underline">Google Calendar</a></li>
                  <li>Click the <strong>+</strong> next to "Other calendars"</li>
                  <li>Select <strong>"From URL"</strong></li>
                  <li>Paste the URL and click "Add calendar"</li>
                </ol>
              </div>
            </section>

            {/* Section: Events + Job Requests */}
            <section>
              <h3 className="font-semibold mb-2 text-gray-900 dark:text-white">Events & Job Requests</h3>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Calendar Feed URL</label>
              <div className="flex gap-2 mb-2">
                <input
                  readOnly
                  value={urls.eventsAndRequests}
                  onFocus={(e) => e.currentTarget.select()}
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-sm font-mono"
                />
                <button
                  onClick={() => copyToClipboard(urls.eventsAndRequests, 'eventsAndRequests')}
                  className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors text-sm font-medium"
                >
                  {copiedUrl === 'eventsAndRequests' ? '✓ Copied!' : 'Copy'}
                </button>
              </div>
              <div className="flex flex-wrap gap-2 mb-2">
                <a 
                  className="inline-flex items-center gap-2 px-4 py-2 bg-black text-white rounded-md hover:bg-gray-800 transition-colors text-sm font-medium" 
                  href={webcalUrl(urls.eventsAndRequests)}
                >
                  � Subscribe in Apple Calendar
                </a>
              </div>
              <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md border border-blue-200 dark:border-blue-800">
                <p className="text-xs font-semibold text-blue-900 dark:text-blue-200 mb-1">� For Google Calendar:</p>
                <ol className="text-xs text-blue-800 dark:text-blue-300 space-y-1 ml-4 list-decimal">
                  <li>Copy the URL above</li>
                  <li>Open <a href="https://calendar.google.com" target="_blank" rel="noreferrer" className="underline">Google Calendar</a></li>
                  <li>Click the <strong>+</strong> next to "Other calendars"</li>
                  <li>Select <strong>"From URL"</strong></li>
                  <li>Paste the URL and click "Add calendar"</li>
                </ol>
              </div>
            </section>

            {/* Section: Completed Jobs */}
            <section>
              <h3 className="font-semibold mb-2 text-gray-900 dark:text-white">Completed Jobs</h3>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Calendar Feed URL</label>
              <div className="flex gap-2 mb-2">
                <input
                  readOnly
                  value={urls.completed}
                  onFocus={(e) => e.currentTarget.select()}
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-sm font-mono"
                />
                <button
                  onClick={() => copyToClipboard(urls.completed, 'completed')}
                  className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors text-sm font-medium"
                >
                  {copiedUrl === 'completed' ? '✓ Copied!' : 'Copy'}
                </button>
              </div>
              <div className="flex flex-wrap gap-2 mb-2">
                <a 
                  className="inline-flex items-center gap-2 px-4 py-2 bg-black text-white rounded-md hover:bg-gray-800 transition-colors text-sm font-medium" 
                  href={webcalUrl(urls.completed)}
                >
                  � Subscribe in Apple Calendar
                </a>
              </div>
              <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md border border-blue-200 dark:border-blue-800">
                <p className="text-xs font-semibold text-blue-900 dark:text-blue-200 mb-1">� For Google Calendar:</p>
                <ol className="text-xs text-blue-800 dark:text-blue-300 space-y-1 ml-4 list-decimal">
                  <li>Copy the URL above</li>
                  <li>Open <a href="https://calendar.google.com" target="_blank" rel="noreferrer" className="underline">Google Calendar</a></li>
                  <li>Click the <strong>+</strong> next to "Other calendars"</li>
                  <li>Select <strong>"From URL"</strong></li>
                  <li>Paste the URL and click "Add calendar"</li>
                </ol>
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
