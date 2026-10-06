// Keep the browser application and Supabase Edge Functions on one canonical
// set of employee-onboarding definitions. The canonical module lives inside
// the Edge Functions tree so Supabase can bundle it during deployment.
export * from '../supabase/functions/_shared/employeeOnboarding';
