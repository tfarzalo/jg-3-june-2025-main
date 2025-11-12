import * as React from "react";
import { supabase } from "../../utils/supabase";
import { Button } from "../ui/Button";

type SubProfile = { id: string; full_name: string | null; email: string; role: string; token?: string };

function googleAddUrl(icsUrl: string) {
  return `https://calendar.google.com/calendar/u/0/r?cid=${encodeURIComponent(icsUrl)}`;
}
function webcalUrl(icsUrl: string) {
  // Safari/Apple Calendar uses webcal://
  return icsUrl.replace(/^https?:\/\//, "webcal://");
}

export default function SubscribeCalendarsModal() {
  const [open, setOpen] = React.useState(false);
  const [token, setToken] = React.useState<string>("");
  const [subs, setSubs] = React.useState<SubProfile[]>([]);
  const [role, setRole] = React.useState<string>("user");

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

        // 2) Load my role
        const { data: me } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", (await supabase.auth.getUser()).data.user?.id)
          .single();
        setRole(me?.role || "user");
        console.log("My role:", me?.role);

        // 3) If admin-like, fetch subcontractors + their tokens
        if (["admin","jg_management","is_super_admin"].includes(me?.role || "")) {
          const { data: rows } = await supabase
            .from("profiles")
            .select("id, full_name, email, role")
            .eq("role", "subcontractor")
            .order("full_name", { ascending: true });
          
          console.log("Found subcontractors:", rows?.length || 0);
          
          const subsWithTokens: SubProfile[] = [];
          for (const r of rows || []) {
            // Read or create token for each subcontractor if not exists (admin permitted by RLS)
            let { data: ct } = await supabase
              .from("calendar_tokens")
              .select("token")
              .eq("user_id", r.id)
              .single();
            
            if (!ct) {
              // Create on behalf of subcontractor if missing
              const newToken = crypto.randomUUID();
              console.log("Creating new token for subcontractor:", r.id, newToken);
              
              const { error: insertError } = await supabase
                .from("calendar_tokens")
                .insert({ user_id: r.id, token: newToken });
              
              if (!insertError) {
                ct = { token: newToken };
                console.log("Successfully created token for subcontractor:", r.id);
              } else {
                console.error("Failed to create token for subcontractor:", r.id, insertError);
              }
            } else {
              console.log("Found existing token for subcontractor:", r.id);
            }
            
            if (ct?.token) {
              subsWithTokens.push({ ...r, token: ct.token });
            } else {
              console.error("No token available for subcontractor:", r.id);
            }
          }
          setSubs(subsWithTokens);
          console.log("Final subcontractors with tokens:", subsWithTokens.length);
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
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">ICS URL</label>
              <input
                readOnly
                value={urls.events}
                onFocus={(e) => e.currentTarget.select()}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white mb-2"
              />
              <div className="flex gap-2">
                <a className="underline text-sm text-blue-600 dark:text-blue-400" href={webcalUrl(urls.events)}>Open in Apple Calendar</a>
                <a className="underline text-sm text-blue-600 dark:text-blue-400" target="_blank" rel="noreferrer" href={googleAddUrl(urls.events)}>Add to Google Calendar</a>
              </div>
            </section>

            {/* Section: Events + Job Requests */}
            <section>
              <h3 className="font-semibold mb-2 text-gray-900 dark:text-white">Events & Job Requests</h3>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">ICS URL</label>
              <input
                readOnly
                value={urls.eventsAndRequests}
                onFocus={(e) => e.currentTarget.select()}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white mb-2"
              />
              <div className="flex gap-2">
                <a className="underline text-sm text-blue-600 dark:text-blue-400" href={webcalUrl(urls.eventsAndRequests)}>Open in Apple Calendar</a>
                <a className="underline text-sm text-blue-600 dark:text-blue-400" target="_blank" rel="noreferrer" href={googleAddUrl(urls.eventsAndRequests)}>Add to Google Calendar</a>
              </div>
            </section>

            {/* Section: Completed Jobs */}
            <section>
              <h3 className="font-semibold mb-2 text-gray-900 dark:text-white">Completed Jobs</h3>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">ICS URL</label>
              <input
                readOnly
                value={urls.completed}
                onFocus={(e) => e.currentTarget.select()}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white mb-2"
              />
              <div className="flex gap-2">
                <a className="underline text-sm text-blue-600 dark:text-blue-400" href={webcalUrl(urls.completed)}>Open in Apple Calendar</a>
                <a className="underline text-sm text-blue-600 dark:text-blue-400" target="_blank" rel="noreferrer" href={googleAddUrl(urls.completed)}>Add to Google Calendar</a>
              </div>
            </section>

            {/* Section: Per-Subcontractor Feeds (Admin/JG only) */}
            {["admin","jg_management","is_super_admin"].includes(role) && (
              <section>
                <h3 className="font-semibold mb-2 text-gray-900 dark:text-white">Per-Subcontractor Feeds</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">Each link shows only the jobs assigned to that subcontractor.</p>
                <div className="space-y-3 max-h-72 overflow-auto pr-2">
                  {subs.map(s => {
                    if (!s.token) {
                      return (
                        <div key={s.id} className="border border-red-200 dark:border-red-600 rounded p-2 bg-red-50 dark:bg-red-900/20">
                          <div className="font-medium text-gray-900 dark:text-white">{s.full_name || s.email}</div>
                          <p className="text-sm text-red-600 dark:text-red-400">No calendar token available</p>
                        </div>
                      );
                    }
                    
                    const url = `${base}?scope=subcontractor&token=${s.token}&subcontractor_id=${s.id}`;
                    return (
                      <div key={s.id} className="border border-gray-200 dark:border-gray-600 rounded p-2">
                        <div className="font-medium text-gray-900 dark:text-white">{s.full_name || s.email}</div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">ICS URL</label>
                        <input
                          readOnly
                          value={url}
                          onFocus={(e) => e.currentTarget.select()}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white mb-2"
                        />
                        <div className="flex gap-2">
                          <a className="underline text-sm text-blue-600 dark:text-blue-400" href={webcalUrl(url)}>Open in Apple Calendar</a>
                          <a className="underline text-sm text-blue-600 dark:text-blue-400" target="_blank" rel="noreferrer" href={googleAddUrl(url)}>Add to Google Calendar</a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
