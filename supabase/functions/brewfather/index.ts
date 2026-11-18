// Supabase Edge Function "brewfather"
// Haalt (alleen-lezen) recepten, batches en metingen op uit de Brewfather API v2.
// De Brewfather-sleutel blijft op de server; alleen ingelogde leden mogen dit gebruiken.
//
// Secrets (Supabase → Edge Functions → Secrets):
//   BF_USER_ID  = Brewfather User ID
//   BF_API_KEY  = Brewfather API-key (scopes: batches.read, recipes.read)
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

// Alleen deze paden mogen worden opgevraagd (lezen)
const ALLOWED = /^(batches|recipes)(\/[A-Za-z0-9_-]+)?(\/readings(\/last)?)?$/;
const ALLOWED_PARAMS = ["limit", "start_after", "include", "complete", "status", "order_by", "order_by_direction"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const auth = req.headers.get("Authorization") ?? "";
    const anon = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? "";
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, anon, { global: { headers: { Authorization: auth } } });
    const { data: member, error } = await sb.rpc("is_member");
    if (error || member !== true) return json({ error: "Geen toegang: alleen voor leden." }, 403);

    const userId = Deno.env.get("BF_USER_ID"), apiKey = Deno.env.get("BF_API_KEY");
    if (!userId || !apiKey) return json({ error: "Brewfather is nog niet gekoppeld (BF_USER_ID / BF_API_KEY ontbreken)." }, 500);

    const { path, params } = await req.json().catch(() => ({}));
    if (typeof path !== "string" || !ALLOWED.test(path)) return json({ error: "Ongeldig pad." }, 400);
    const url = new URL("https://api.brewfather.app/v2/" + path);
    for (const [k, v] of Object.entries(params ?? {})) {
      if (ALLOWED_PARAMS.includes(k) && v !== undefined && v !== null) url.searchParams.set(k, String(v));
    }
    const res = await fetch(url, { headers: { Authorization: "Basic " + btoa(`${userId}:${apiKey}`) } });
    const text = await res.text();
    if (!res.ok) return json({ error: `Brewfather antwoordde met ${res.status}`, detail: text.slice(0, 300) }, res.status === 429 ? 429 : 502);
    return new Response(text, { headers: { ...CORS, "Content-Type": "application/json" } });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
