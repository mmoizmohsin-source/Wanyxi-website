/* Wanyxi Lead Intelligence: hosted configuration.
 *
 * These two values are PUBLIC by design. The publishable (anon) key only
 * identifies your project; the data is protected by Row Level Security,
 * which lets only your administrator account read it.
 *
 * NEVER put the service_role / sb_secret_ key here. The dashboard refuses
 * to start if it finds one.
 *
 * Supabase → Project Settings → API (or "API Keys"):
 *   supabaseUrl = Project URL
 *   supabaseKey = publishable key (sb_publishable_...) or the legacy "anon" key
 */
window.WANYXI_DASHBOARD = {
  mode: "supabase",
  supabaseUrl: "https://YOUR-PROJECT-REF.supabase.co",
  supabaseKey: "sb_publishable_EY0tJAOs_plyGri0dlDt6A_h7WXaV2O"
};
