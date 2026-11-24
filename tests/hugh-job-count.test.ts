import { afterEach, describe, expect, it, vi } from "vitest";
import { businessMidnight, dateContext, parseFollowUp, regularPaintWeek, shiftDay } from "../supabase/functions/hugh-ai/index";

const mocks = vi.hoisted(() => ({
  serve: vi.fn<(handler: (request: Request) => Promise<Response>) => void>(),
  createClient: vi.fn(),
}));

vi.mock("https://deno.land/std@0.168.0/http/server.ts", () => ({ serve: mocks.serve }));
vi.mock("https://esm.sh/@supabase/supabase-js@2", () => ({ createClient: mocks.createClient }));

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("Hugh's Regular Paint count", () => {
  it("uses the previous Monday through Sunday for the question reported in chat", () => {
    const dates = dateContext(new Date("2026-11-24T20:39:00Z"));
    expect(regularPaintWeek("How many regular paint jobs were there last week?", dates))
      .toEqual({ from: "2026-11-16", through: "2026-11-22" });
    expect(regularPaintWeek("How many regular paint jobs were completed last week?", dates))
      .toBeNull();
  });

  it("uses Eastern midnight on both sides of daylight saving changes", () => {
    expect(businessMidnight("2026-03-08")).toBe("2026-03-08T00:00:00-05:00");
    expect(businessMidnight(shiftDay("2026-03-08", 1))).toBe("2026-03-09T00:00:00-04:00");
    expect(businessMidnight("2026-11-01")).toBe("2026-11-01T00:00:00-04:00");
    expect(businessMidnight(shiftDay("2026-11-01", 1))).toBe("2026-11-02T00:00:00-05:00");
  });
});

describe("Hugh's follow-up options", () => {
  it("lists jobs using the original count window even after the calendar week changes", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-24T20:39:00Z"));
    vi.stubGlobal("Deno", { env: { get: vi.fn() } });
    const countQuery = {
      select: vi.fn().mockReturnThis(),
      ilike: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lt: vi.fn().mockResolvedValue({ count: 1, error: null }),
    };
    const listQuery = {
      select: vi.fn().mockReturnThis(),
      ilike: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lt: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({
        count: 1, error: null,
        data: [{ id: "job-1", work_order_num: 42, unit_number: "3B", property: { property_name: "Oak Court" } }],
      }),
    };
    const profile = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: { role: "admin" } }) };
    const jobs = vi.fn().mockReturnValueOnce(countQuery).mockReturnValueOnce(listQuery);
    mocks.createClient.mockReturnValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
      from: (table: string) => table === "profiles" ? profile : jobs(),
    });
    const [[handler]] = mocks.serve.mock.calls;
    const ask = async (message: string) => (await handler(new Request("http://localhost/hugh-ai", {
      method: "POST", headers: { authorization: "Bearer test" }, body: JSON.stringify({ message }),
    }))).json();

    const count = await ask("How many regular paint jobs were there last week?");
    expect(count.reply).toContain("1 Regular Paint job");
    vi.setSystemTime(new Date("2026-12-01T20:39:00Z"));
    const list = await ask(count.followUp.options[0].message);
    expect(list.reply).toContain("[WO-000042](/dashboard/jobs/job-1) · Oak Court · Unit 3B");
    expect(listQuery.gte).toHaveBeenCalledWith("scheduled_date", "2026-11-16T00:00:00-05:00");
    expect(listQuery.lt).toHaveBeenCalledWith("scheduled_date", "2026-11-23T00:00:00-05:00");
    expect(list.followUp).toBeUndefined();
  });

  it("separates a contextual quick reply from the answer", () => {
    const followUp = {
      question: "Would you like to see the matching jobs?",
      options: [{ label: "Yes, list the jobs", message: "List Regular Paint jobs scheduled from 2026-11-16 through 2026-11-22." }],
    };
    expect(parseFollowUp(`There were 12 jobs.\nHUGH_FOLLOW_UP: ${JSON.stringify(followUp)}`))
      .toEqual({ reply: "There were 12 jobs.", followUp });
  });

  it("leaves plain answers alone and discards incomplete metadata", () => {
    expect(parseFollowUp("No jobs matched.")).toEqual({ reply: "No jobs matched." });
    expect(parseFollowUp("There were 12 jobs.\nHUGH_FOLLOW_UP: {")).toEqual({ reply: "There were 12 jobs." });
  });
});
