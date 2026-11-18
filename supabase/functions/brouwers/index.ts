// Supabase Edge Function "brouwers"
// Ledenlijst bekijken en brouwers uitnodigen / verwijderen vanuit de brouwlog.
// Alleen ingelogde leden (tabel members) mogen dit gebruiken.
// Geen eigen secrets nodig: SUPABASE_URL, SUPABASE_ANON_KEY en
// SUPABASE_SERVICE_ROLE_KEY zijn standaard beschikbaar in Edge Functions.
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // wie vraagt dit? (moet een ingelogd lid zijn)
    const caller = createClient(url, anon, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
    const { data: { user } } = await caller.auth.getUser();
    if (!user) return json({ error: "Niet ingelogd." }, 401);
    const { data: isMember } = await caller.rpc("is_member");
    if (isMember !== true) return json({ error: "Geen toegang: alleen voor leden." }, 403);

    const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
    const body = await req.json().catch(() => ({}));
    const action = body.action;
    const email = String(body.email ?? "").trim().toLowerCase();
    const name = body.name ? String(body.name).trim().slice(0, 80) : null;

    const allUsers = async () => {
      const out: any[] = [];
      for (let page = 1; page <= 10; page++) {
        const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
        if (error) throw error;
        out.push(...data.users);
        if (data.users.length < 200) break;
      }
      return out;
    };

    if (action === "list") {
      const [{ data: members, error }, users] = await Promise.all([admin.from("members").select("*").order("created_at"), allUsers()]);
      if (error) throw error;
      const byEmail = new Map(users.map((u) => [String(u.email ?? "").toLowerCase(), u]));
      return json({
        me: user.email,
        members: (members ?? []).map((m: any) => {
          const u = byEmail.get(String(m.email).toLowerCase());
          const status = !u ? "geen account" : u.last_sign_in_at ? "actief" : u.invited_at ? "uitgenodigd" : "aangemaakt";
          return { email: m.email, name: m.name, status, invited_at: u?.invited_at ?? null, last_sign_in_at: u?.last_sign_in_at ?? null, created_at: m.created_at };
        }),
      });
    }

    if (action === "invite") {
      if (!EMAIL.test(email)) return json({ error: "Dat is geen geldig e-mailadres." }, 400);
      const { error: mErr } = await admin.from("members").upsert({ email, name }, { onConflict: "email" });
      if (mErr) throw mErr;
      const redirectTo = typeof body.redirectTo === "string" ? body.redirectTo : undefined;
      const { error } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo, data: { name } });
      if (error) {
        if (/already|registered|exists/i.test(error.message)) {
          return json({ ok: true, note: "Dit adres heeft al een account. Het staat nu op de ledenlijst en kan inloggen (of 'Wachtwoord vergeten' gebruiken)." });
        }
        return json({ error: "Uitnodigen mislukt: " + error.message }, 400);
      }
      return json({ ok: true, note: "Uitnodiging verstuurd naar " + email + "." });
    }

    if (action === "rename") {
      const { error } = await admin.from("members").update({ name }).eq("email", email);
      if (error) throw error;
      return json({ ok: true });
    }

    if (action === "remove") {
      if (email === String(user.email).toLowerCase()) return json({ error: "Je kunt jezelf niet verwijderen." }, 400);
      const { error } = await admin.from("members").delete().eq("email", email);
      if (error) throw error;
      const u = (await allUsers()).find((x) => String(x.email ?? "").toLowerCase() === email);
      if (u) await admin.auth.admin.deleteUser(u.id);
      return json({ ok: true, note: email + " is verwijderd." });
    }

    return json({ error: "Onbekende actie." }, 400);
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
