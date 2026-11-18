/* =====================================================================
   Mannen van Mout – Brouwlog
   Recepten, doelwaarden, gemeten waarden en SG-metingen per batch.
   ===================================================================== */
(function () {
  "use strict";
  const cfg = window.MVM_CONFIG || {};
  const main = document.getElementById("main");
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const STATUSES = ["gepland", "vergisting", "lagering", "gebotteld", "op"];
  let KETTLES = (cfg.kettles && cfg.kettles.length ? cfg.kettles : ["Brewmonk", "Grainfather"]);
  let PROFILES = {}, profilesLoaded = false, profilesMissing = false;
  // Ketelprofiel: velden (sleutel, label, eenheid, groep, type)
  const P_FIELDS = [
    ["title", "Naam uitrusting", "", "Algemeen", "text"], ["brand", "Merk", "", "Algemeen", "text"],
    ["batch_size_l", "Batchgrootte", "L", "Algemeen"], ["vessels", "Aantal vaten", "", "Algemeen"],
    ["recirculation", "Recirculatie", "", "Algemeen", "text"], ["controller", "Controller", "", "Algemeen", "text"],
    ["mash_tun_l", "Volume maischvat", "L", "Maischen"], ["mash_eff", "Maischrendement", "%", "Maischen"],
    ["mash_deadspace_l", "Dode ruimte maischvat", "L", "Maischen"], ["mash_thickness", "Maischdikte", "L/kg", "Maischen"],
    ["mash_tun_loss_l", "Verlies maischvat", "L", "Maischen"], ["grain_absorption", "Graanabsorptie", "L/kg", "Maischen"],
    ["sparge_vessel_l", "Volume spoelwatervat", "L", "Spoelen"], ["sparge_grain_absorption", "Graanabsorptie spoelen", "L/kg", "Spoelen"],
    ["sparge_deadspace_l", "Dode ruimte spoelvat", "L", "Spoelen"],
    ["boil_volume_l", "Kookvolume", "L", "Koken"], ["boil_loss_lh", "Verdamping", "L/uur", "Koken"],
    ["wort_shrinkage", "Krimp wort (afkoelen)", "%", "Koken"], ["trub_chiller_loss_l", "Verlies trub en koeler", "L", "Koken"],
    ["kettle_diameter_cm", "Diameter ketel", "cm", "Koken"],
    ["cooling", "Koelmethode", "", "Koelen", "text"], ["cooling_param", "Koelparameter", "", "Koelen", "text"],
    ["brewhouse_eff", "Brouwzaalrendement", "%", "Gemeten"]
  ];
  const isSugar = (name) => /suiker|sugar|dextro|candi|kandij|honing|honey|sucrose|glucose|siroop|syrup/i.test(name || "");
  const yieldOf = (f) => (num(f.yield) != null ? num(f.yield) : isSugar(f.name) ? 100 : 80);
  // rendement en verliezen uit één ketel-registratie
  function calcEff(rec, ferms, boilMin, prof) {
    const pot = (list) => list.reduce((a, f) => a + (num(f.kg) || 0) * yieldOf(f) / 100 * 384, 0);
    const all = pot(ferms || []), mashOnly = pot((ferms || []).filter((f) => !isSugar(f.name) && yieldOf(f) < 95));
    const out = {};
    if (rec.og && rec.volume_l && all) out.bh = ((rec.og - 1) * 1000 * rec.volume_l) / all * 100;
    if (rec.pre_boil_sg && rec.pre_boil_l && mashOnly) out.mash = ((rec.pre_boil_sg - 1) * 1000 * rec.pre_boil_l) / mashOnly * 100;
    if (rec.pre_boil_l && rec.post_boil_l && boilMin) out.boil = (rec.pre_boil_l - rec.post_boil_l) / (boilMin / 60);
    if (rec.post_boil_l && rec.volume_l) out.loss = rec.post_boil_l * (1 - ((prof && num(prof.wort_shrinkage)) || 4) / 100) - rec.volume_l;
    return out;
  }
  async function loadProfiles() {
    let data = null, error = null;
    try { ({ data, error } = await sb.from("kettle_profiles").select("*").order("sort")); } catch (e) { error = e; }
    profilesLoaded = true;
    if (error || !data) { profilesMissing = true; return; }
    profilesMissing = false;
    PROFILES = {}; data.forEach((r) => (PROFILES[r.name] = r.profile || {}));
    if (data.length) KETTLES = data.map((r) => r.name);
  }
  const KETTLE_COLORS = ["#7d1d1d", "#4f6b26", "#1c5378", "#b36b00"];
  const K_FIELDS = [["og", "Begin-SG (OG)", "1.074", "sg"], ["fg", "Eind-SG (FG)", "1.009", "sg"], ["pre_boil_sg", "SG voor koken", "1.062", "sg"],
    ["mash_ph", "pH maisch", "5.3", "num"], ["volume_l", "Volume vergister (L)", "23", "num"], ["bottled_l", "Gebotteld (L)", "20", "num"]];
  const VOL_FIELDS = [["pre_boil_l", "Volume voor koken (L)", "28", "num"], ["post_boil_l", "Volume na koken (L)", "25", "num"]];
  const HOP_USES = ["Koken", "Whirlpool", "Dryhop", "First wort", "Maischen"];

  /* ---------- rekenwerk ---------- */
  // "1065", "1.065", "1,065" en "65" (punten) worden allemaal 1.065
  function parseSG(v) {
    if (v === null || v === undefined) return null;
    let s = String(v).trim().replace(",", ".");
    if (s === "") return null;
    let n = Number(s);
    if (!isFinite(n)) return null;
    if (n >= 900) n = n / 1000;          // 1065 → 1.065
    else if (n > 1.2 && n < 200) n = 1 + n / 1000; // 65 → 1.065
    return Math.round(n * 1000) / 1000;
  }
  const num = (v) => {
    if (v === null || v === undefined || String(v).trim() === "") return null;
    const n = Number(String(v).replace(",", "."));
    return isFinite(n) ? n : null;
  };
  const abv = (og, fg) => (og && fg ? (og - fg) * 131.25 : null);
  const attenuation = (og, fg) => (og && fg && og > 1 ? ((og - fg) / (og - 1)) * 100 : null);
  const plato = (sg) => (sg ? 259 - 259 / sg : null);
  const fmtSG = (v) => (v ? Number(v).toFixed(3) : "–");
  const fmt1 = (v) => (v === null || v === undefined || isNaN(v) ? "–" : Number(v).toFixed(1).replace(".", ","));
  const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" }) : "");
  const fmtDateTime = (d) => (d ? new Date(d).toLocaleString("nl-NL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "");
  const toLocalInput = (d) => {
    const x = d ? new Date(d) : new Date();
    const p = (n) => String(n).padStart(2, "0");
    return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}T${p(x.getHours())}:${p(x.getMinutes())}`;
  };

  /* ---------- Supabase ---------- */
  if (!cfg.supabaseUrl || !cfg.supabaseAnonKey || !window.supabase) {
    main.innerHTML = `<div class="card login"><h1>Bijna klaar 🍺</h1>
      <p>De brouwlog is nog niet gekoppeld aan de database.</p>
      <p class="hint">Vul <code>supabaseUrl</code> en <code>supabaseAnonKey</code> in <code>config.js</code> in.
      Zie de LEESMIJ voor het stappenplan.</p></div>`;
    return;
  }
  // uitnodigings- en herstel-links: eerst een wachtwoord laten kiezen
  let recovering = /type=(invite|recovery)/.test(location.hash);
  const sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
  let session = null;
  let dirty = false;

  window.addEventListener("beforeunload", (e) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } });

  sb.auth.onAuthStateChange((event, s) => {
    const had = !!session;
    session = s;
    if (event === "PASSWORD_RECOVERY") { recovering = true; }
    updateUserbar();
    // SIGNED_IN komt ook bij terugkeren naar het tabblad; dan niet opnieuw tekenen (anders raak je invoer kwijt)
    if (event === "INITIAL_SESSION" || event === "SIGNED_OUT" || event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && !had)) {
      setTimeout(route, 0);
    }
  });

  function updateUserbar() {
    $("#who").textContent = session ? session.user.email : "";
    $("#btnLogout").classList.toggle("hidden", !session);
    $("#btnPw").classList.toggle("hidden", !session);
  }
  $("#btnLogout").onclick = async () => { if (dirty && !confirm("Niet-opgeslagen wijzigingen gaan verloren. Toch uitloggen?")) return; dirty = false; await sb.auth.signOut(); location.hash = ""; };
  $("#btnPw").onclick = () => viewSetPassword(false);

  window.addEventListener("hashchange", () => route());

  async function route() {
    if (recovering && session) return viewSetPassword(true);
    if (!session) return viewLogin();
    if (!profilesLoaded) await loadProfiles();
    const h = location.hash || "#/";
    if (h.startsWith("#/b/")) return viewBrew(h.slice(4));
    if (h === "#/nieuw") return viewBrew(null);
    if (h === "#/import") return viewImport();
    if (h === "#/ketels") return viewKettles();
    if (h === "#/brouwers") return viewBrewers();
    return viewList();
  }

  /* ---------- Login ---------- */
  function viewLogin(msg) {
    main.innerHTML = `
      <div class="card login">
        <h1>Brouwlog</h1>
        <p class="sub">Alleen voor de Mannen van Mout. Geen dorst? Dan geen toegang.</p>
        <div id="m">${msg || ""}</div>
        <form id="f">
          <div class="field"><label for="em">E-mail</label><input id="em" type="email" autocomplete="username" required></div>
          <div class="field"><label for="pw">Wachtwoord</label><input id="pw" type="password" autocomplete="current-password" required></div>
          <button class="btn" style="width:100%;justify-content:center">Inloggen</button>
        </form>
        <p style="text-align:center;margin-top:14px"><button class="linkbtn" id="forgot">Wachtwoord vergeten of nog nooit ingesteld?</button></p>
        <p style="text-align:center"><a href="index.html" style="color:var(--muted)">← terug naar de site</a></p>
      </div>`;
    $("#f").onsubmit = async (e) => {
      e.preventDefault();
      const { error } = await sb.auth.signInWithPassword({ email: $("#em").value.trim(), password: $("#pw").value });
      if (error) $("#m").innerHTML = `<div class="msg err">Inloggen mislukt: ${esc(nlError(error.message))}</div>`;
    };
    $("#forgot").onclick = async () => {
      const email = $("#em").value.trim();
      if (!email) { $("#m").innerHTML = `<div class="msg info">Vul eerst je e-mailadres in en klik dan nogmaals.</div>`; return; }
      const redirectTo = location.origin + location.pathname;
      const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo });
      $("#m").innerHTML = error
        ? `<div class="msg err">${esc(nlError(error.message))}</div>`
        : `<div class="msg ok">Als dit adres bekend is, staat er een mail met een link in je inbox. Klik erop om een (nieuw) wachtwoord in te stellen.</div>`;
    };
  }
  function nlError(m) {
    if (/Invalid login credentials/i.test(m)) return "onbekend e-mailadres of verkeerd wachtwoord.";
    if (/Email not confirmed/i.test(m)) return "e-mailadres is nog niet bevestigd.";
    if (/rate limit/i.test(m)) return "te veel pogingen, probeer het over een paar minuten opnieuw.";
    return m;
  }

  function viewSetPassword(fromRecovery) {
    main.innerHTML = `
      <div class="card login">
        <h1>${fromRecovery ? "Nieuw wachtwoord" : "Wachtwoord wijzigen"}</h1>
        <div id="m"></div>
        <form id="f">
          <div class="field"><label>Nieuw wachtwoord (min. 8 tekens)</label><input id="p1" type="password" autocomplete="new-password" minlength="8" required></div>
          <div class="field"><label>Herhaal</label><input id="p2" type="password" autocomplete="new-password" minlength="8" required></div>
          <div class="row"><button class="btn">Opslaan</button>${fromRecovery ? "" : `<a class="btn ghost" href="#/" style="color:var(--red)">Annuleren</a>`}</div>
        </form>
      </div>`;
    $("#f").onsubmit = async (e) => {
      e.preventDefault();
      if ($("#p1").value !== $("#p2").value) { $("#m").innerHTML = `<div class="msg err">De wachtwoorden zijn niet gelijk.</div>`; return; }
      const { error } = await sb.auth.updateUser({ password: $("#p1").value });
      if (error) { $("#m").innerHTML = `<div class="msg err">${esc(error.message)}</div>`; return; }
      recovering = false;
      $("#m").innerHTML = `<div class="msg ok">Opgeslagen! Proost. 🍻</div>`;
      setTimeout(() => { location.hash = "#/"; route(); }, 900);
    };
  }

  /* ---------- Lijst ---------- */
  let cacheList = [];
  async function viewList() {
    main.innerHTML = `<div class="empty">Brouwsels ophalen…</div>`;
    const [{ data: me }, { data, error }] = await Promise.all([
      sb.from("members").select("email").limit(1),
      sb.from("brews").select("*").order("brew_date", { ascending: false, nullsFirst: true })
    ]);
    if (error) { main.innerHTML = `<div class="msg err">Fout bij ophalen: ${esc(error.message)}</div>`; return; }
    if (!me || me.length === 0) {
      main.innerHTML = `<div class="card login"><h1>Geen toegang</h1><p>Je bent ingelogd als <b>${esc(session.user.email)}</b>, maar dit adres staat (nog) niet op de ledenlijst.</p><p class="hint">Vraag een van de mannen om je e-mailadres toe te voegen aan de tabel <code>members</code> in Supabase.</p></div>`;
      return;
    }
    cacheList = data || [];
    main.innerHTML = `
      <div class="lijst-kop">
        <div><h1 style="margin:0">Brouwlog</h1>
          <p class="hint" style="margin:2px 0 0">${cacheList.length} brouwsel${cacheList.length === 1 ? "" : "s"} · alles wat we ooit (bijna) goed deden</p></div>
        <a class="btn nieuw" href="#/nieuw"><svg class="icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>Nieuw brouwsel</a>
      </div>
      <nav class="snelmenu" aria-label="Beheer">
        <a href="#/brouwers"><svg class="icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6"/></svg><span>Brouwers</span></a>
        <a href="#/ketels"><svg class="icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 8h14v9a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3z"/><path d="M3 8h18M9 4h6M10 4v4M14 4v4M19 11h2v4h-2"/></svg><span>Ketels</span></a>
        <a href="#/import"><svg class="icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12M7 10l5 5 5-5"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></svg><span>Importeren</span></a>
      </nav>
      <div class="toolbar zoekbalk">
        <input id="q" type="search" placeholder="Zoek op naam, stijl of batch…" aria-label="Zoeken">
        <select id="st" aria-label="Status"><option value="">Alle statussen</option>${STATUSES.map((s) => `<option>${s}</option>`).join("")}</select>
      </div>
      <div class="brews" id="list"></div>`;
    const draw = () => {
      const q = $("#q").value.toLowerCase(), st = $("#st").value;
      const items = cacheList.filter((b) => (!st || b.status === st) && (!q || [b.name, b.style, b.batch_no].join(" ").toLowerCase().includes(q)));
      $("#list").innerHTML = items.length ? items.map(card).join("") :
        `<div class="empty" style="grid-column:1/-1">Nog niks hier. Tijd om de ketel aan te zetten! 🔥<br><br><a class="btn" href="#/nieuw">Eerste brouwsel toevoegen</a></div>`;
    };
    $("#q").oninput = draw; $("#st").onchange = draw; draw();
  }
  function card(b) {
    const a = b.abv ?? abv(b.og, b.fg);
    return `<a class="card brew" href="#/b/${b.id}">
      <div class="row"><span class="badge ${b.status}">${esc(b.status)}</span>${b.is_public ? `<span class="badge pub">publiek</span>` : ""}<span class="spacer"></span>${b.rating ? "★".repeat(b.rating) : ""}</div>
      <h3 style="margin-top:8px">${esc(b.name)}</h3>
      <div class="sub">${esc(b.style || "")}${b.batch_no ? ` · batch ${esc(b.batch_no)}` : ""}${b.brew_date ? ` · ${fmtDate(b.brew_date)}` : ""}</div>
      ${(b.kettles || []).length ? `<div class="sub" style="margin-top:4px">Ketel: ${(b.kettles || []).map(esc).join(" + ")}</div>` : ""}
      <div class="stats">
        <span class="stat">OG <b>${fmtSG(b.og)}</b></span>
        <span class="stat">FG <b>${fmtSG(b.fg)}</b></span>
        <span class="stat">ABV <b>${a ? fmt1(a) + "%" : "–"}</b></span>
      </div></a>`;
  }


  /* ---------- Importeren (Grainfather, BeerXML) ---------- */
  async function saveImported(item) {
    const { brew: b, measurements: ms } = item;
    const { data, error } = await sb.from("brews").insert(b).select("id").single();
    if (error) throw new Error(error.message);
    if (ms && ms.length) {
      const rows = ms.map((m) => Object.assign({}, m, { brew_id: data.id }));
      const { error: e2 } = await sb.from("measurements").insert(rows);
      if (e2) throw new Error(e2.message);
    }
    return data.id;
  }


  async function viewImport() {
    main.innerHTML = `
      <p style="margin:0 0 6px"><a href="#/" style="color:var(--muted)">← alle brouwsels</a></p>
      <h1 style="margin:0 0 4px">Importeren</h1>
      <p class="hint" style="margin-top:0">Haal recepten binnen uit Grainfather, zonder overtikken.</p>
      <div style="max-width:720px">
        <div class="card">
          <h2>BeerXML-bestand importeren</h2>
          <p class="hint">Exporteer het recept in <b>Grainfather</b> als BeerXML (.xml) en kies het bestand hieronder. Werkt ook met BeerXML uit andere brouwsoftware.</p>
          <div class="field"><input type="file" id="imf" accept=".xml,.beerxml,text/xml" multiple></div>
          <div id="impreview"></div>
        </div>
        </div>`;

    $("#imf").onchange = async (e) => {
      const files = Array.from(e.target.files || []);
      const out = $("#impreview"); let items = [];
      const errors = [];
      for (const f of files) {
        try { items = items.concat(window.MVM_IMPORT.parseFile(await f.text(), f.name)); }
        catch (err) { errors.push(`${esc(f.name)}: ${esc(err.message)}`); }
      }
      out.innerHTML = (errors.length ? `<div class="msg err">${errors.join("<br>")}</div>` : "") + (items.length ? `
        <table class="list"><thead><tr><th></th><th>Naam</th><th>Stijl</th><th>OG → FG</th><th>Ingr.</th></tr></thead><tbody>
        ${items.map((it, i) => `<tr><td><input type="checkbox" data-pick="${i}" checked style="width:auto"></td><td><b>${esc(it.brew.name)}</b>${it.brew.batch_no ? ` <span class="hint">#${esc(it.brew.batch_no)}</span>` : ""}</td>
          <td>${esc(it.brew.style || "")}</td><td>${fmtSG(it.brew.og || it.brew.target_og)} → ${fmtSG(it.brew.fg || it.brew.target_fg)}</td>
          <td class="hint">${it.brew.fermentables.length} mout · ${it.brew.hops.length} hop${it.measurements.length ? ` · ${it.measurements.length} metingen` : ""}</td></tr>`).join("")}
        </tbody></table>
        <div class="row" style="margin-top:12px"><button class="btn" id="imgo">Importeer selectie</button><span class="hint" id="immsg"></span></div>` : "");
      if (!items.length) return;
      $("#imgo").onclick = async () => {
        const picked = $$("[data-pick]", out).filter((c) => c.checked).map((c) => items[Number(c.dataset.pick)]);
        if (!picked.length) return;
        $("#imgo").disabled = true; let ok = 0, lastId = null;
        for (const it of picked) {
          try { lastId = await saveImported(it); ok++; $("#immsg").textContent = `${ok} van ${picked.length}…`; }
          catch (err) { $("#immsg").innerHTML = `<span style="color:#a33">${esc(err.message)}</span>`; $("#imgo").disabled = false; return; }
        }
        location.hash = picked.length === 1 ? "#/b/" + lastId : "#/";
      };
    };


  }

  /* ---------- Proefmomenten (scoreformulier, BJCP-schaal) ---------- */
  const T_CATS = [["aroma", "Aroma", 12, "Mout, hop, esters, fenolen, alcohol…"], ["appearance", "Uiterlijk", 3, "Kleur, helderheid, schuim"],
    ["flavor", "Smaak", 20, "Mout, hop, bitterheid, balans, afdronk"], ["mouthfeel", "Mondgevoel", 5, "Body, koolzuur, warmte, droogte"],
    ["overall", "Totaalindruk", 10, "Drinkbaarheid, plezier, past het bij de stijl?"]];
  const tLabel = (t) => (t >= 45 ? "Uitmuntend" : t >= 38 ? "Excellent" : t >= 30 ? "Zeer goed" : t >= 21 ? "Goed" : t >= 14 ? "Redelijk" : "Matig");
  const tTotal = (t) => T_CATS.reduce((a, [k]) => a + (Number(t[k]) || 0), 0);

  function renderTastings() {
    const host = $("#tastingCard"); if (!host) return;
    if (!brew.id) { host.innerHTML = `<h2>Proefmomenten</h2><div class="msg info">Sla het brouwsel eerst op; daarna kun je proeven vastleggen.</div>`; return; }
    if (tastingsMissing) { host.innerHTML = `<h2>Proefmomenten</h2><div class="msg info">De database kent de proefmomenten nog niet. Draai eerst de SQL voor ketels en proeven in Supabase.</div>`; return; }
    const tasters = (cfg.brewers || []).map((b) => b.name);
    const bottle = brew.bottle_date ? new Date(brew.bottle_date) : null;
    const plan = [14, 28, 56].map((d) => {
      const at = bottle ? new Date(bottle.getTime() + d * 864e5) : null;
      const done = at && tastings.some((t) => Math.abs(new Date(t.tasted_on) - at) <= 7 * 864e5);
      return `<span class="badge ${done ? "gebotteld" : at && at < new Date() ? "vergisting" : ""}" style="font-size:.8rem;padding:4px 10px">${d / 7} weken${at ? " · " + at.toLocaleDateString("nl-NL", { day: "numeric", month: "short" }) : ""}${done ? " ✓" : ""}</span>`;
    }).join(" ");
    const avg = (list) => (list.length ? list.reduce((a, t) => a + tTotal(t), 0) / list.length : null);
    const perK = (brew.kettles || []).length > 1 ? brew.kettles.map((k) => { const l = tastings.filter((t) => t.kettle === k); return l.length ? `${esc(k)}: <b>${fmt1(avg(l))}</b>/50` : ""; }).filter(Boolean).join(" · ") : "";
    host.innerHTML = `
      <h2>Proefmomenten</h2>
      <p class="hint" style="margin-top:0">Vast scoreformulier (BJCP-schaal, max. 50 punten). Proef bij voorkeur 2, 4 en 8 weken na het bottelen${bottle ? "" : " (vul een botteldatum in voor de data)"}.</p>
      <div class="row" style="margin-bottom:14px">${plan}</div>
      ${tastings.length ? `<div class="msg ok" style="margin-top:0">Gemiddeld <b>${fmt1(avg(tastings))}</b>/50 (${tLabel(avg(tastings))}) over ${tastings.length} proeving${tastings.length === 1 ? "" : "en"}${perK ? " · " + perK : ""}</div>
      <div class="tablewrap"><table class="list"><thead><tr><th>Datum</th><th>Proever</th>${(brew.kettles || []).length > 1 ? "<th>Ketel</th>" : ""}${T_CATS.map(([, l, m]) => `<th>${l} /${m}</th>`).join("")}<th>Totaal</th><th>Notities</th><th></th></tr></thead><tbody>
        ${tastings.map((t) => `<tr><td>${fmtDate(t.tasted_on)}</td><td>${esc(t.taster || "")}</td>${(brew.kettles || []).length > 1 ? `<td>${esc(t.kettle || "–")}</td>` : ""}
          ${T_CATS.map(([k]) => `<td>${t[k] ?? ""}</td>`).join("")}<td><b>${tTotal(t)}</b> <span class="hint">${tLabel(tTotal(t))}</span></td><td style="white-space:pre-line">${esc(t.notes || "")}</td>
          <td><button class="x" data-tdel="${t.id}" title="Verwijderen">×</button></td></tr>`).join("")}
      </tbody></table></div>` : ""}
      <h3 style="font-family:var(--display);font-weight:400;color:var(--red);margin:18px 0 8px">Nieuwe proeving</h3>
      <form id="tf">
        <div class="grid g3">
          <div class="field"><label>Datum</label><input type="date" id="t_on" value="${new Date().toISOString().slice(0, 10)}"></div>
          <div class="field"><label>Proever</label><select id="t_by">${tasters.map((n) => `<option>${esc(n)}</option>`).join("")}<option>Gast</option></select></div>
          ${(brew.kettles || []).length > 1 ? `<div class="field"><label>Ketel</label><select id="t_k">${brew.kettles.map((k) => `<option>${esc(k)}</option>`).join("")}<option value="">Gemengd / onbekend</option></select></div>` : "<div></div>"}
        </div>
        <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr))">
          ${T_CATS.map(([k, l, m, h]) => `<div class="field"><label title="${esc(h)}">${l} (0–${m})</label><input type="number" min="0" max="${m}" step="1" data-tc="${k}"><div class="hint" style="font-size:.75rem">${h}</div></div>`).join("")}
        </div>
        <div class="field"><label>Notities</label><textarea id="t_notes" style="min-height:80px" placeholder="Wat proef je? Wat zou je de volgende keer anders doen?"></textarea></div>
        <div class="row"><button class="btn">Proeving opslaan</button><span class="hint" id="t_sum"></span></div>
      </form>`;
    const sum = () => { const t = {}; $$("[data-tc]", host).forEach((i) => (t[i.dataset.tc] = num(i.value) || 0)); const tot = tTotal(t); $("#t_sum").textContent = `Totaal: ${tot}/50 · ${tLabel(tot)}`; };
    $$("[data-tc]", host).forEach((i) => (i.oninput = sum)); sum();
    $("#tf").onsubmit = async (e) => {
      e.preventDefault();
      const row = { brew_id: brew.id, tasted_on: $("#t_on").value || new Date().toISOString().slice(0, 10), taster: $("#t_by").value, kettle: $("#t_k") ? $("#t_k").value || null : (brew.kettles || [])[0] || null, notes: $("#t_notes").value.trim() || null };
      let bad = false;
      T_CATS.forEach(([k, , m]) => { const v = num($(`[data-tc="${k}"]`, host).value); if (v != null && (v < 0 || v > m)) bad = true; row[k] = v == null ? null : Math.round(v); });
      if (bad) return alert("Een score valt buiten het bereik. Kijk even naar de maxima per onderdeel.");
      if (T_CATS.every(([k]) => row[k] == null)) return alert("Vul minstens één score in.");
      const { data, error } = await sb.from("tastings").insert(row).select().single();
      if (error) return alert(error.message);
      tastings.push(data); tastings.sort((a, b) => String(a.tasted_on).localeCompare(String(b.tasted_on))); renderTastings();
    };
    $$("[data-tdel]", host).forEach((b) => (b.onclick = async () => {
      if (!confirm("Deze proeving verwijderen?")) return;
      const { error } = await sb.from("tastings").delete().eq("id", b.dataset.tdel);
      if (error) return alert(error.message);
      tastings = tastings.filter((t) => t.id !== b.dataset.tdel); renderTastings();
    }));
  }

  /* ---------- Ketelprofielen ---------- */
  async function viewKettles() {
    main.innerHTML = `<div class="empty">Ketels ophalen…</div>`;
    await loadProfiles();
    if (profilesMissing) {
      main.innerHTML = `<p><a href="#/" style="color:var(--muted)">← alle brouwsels</a></p><div class="card"><h1>Ketels</h1><div class="msg info">De database kent de ketelprofielen nog niet. Draai eerst de SQL voor ketels en proeven in Supabase.</div></div>`;
      return;
    }
    const { data: brews } = await sb.from("brews").select("*");
    // gemeten gemiddelden per ketel uit alle brouwsels
    const stats = {};
    KETTLES.forEach((k) => (stats[k] = { bh: [], mash: [], boil: [], loss: [] }));
    (brews || []).forEach((b) => {
      const ks = Array.isArray(b.kettles) ? b.kettles : [];
      ks.forEach((k) => {
        if (!stats[k]) return;
        const v = (b.kettle_values || {})[k] || {};
        const rec = ks.length > 1 ? v : Object.assign({}, v, { og: b.og, pre_boil_sg: b.pre_boil_sg, volume_l: b.volume_l });
        const e = calcEff(rec, b.fermentables, b.boil_min, PROFILES[k]);
        ["bh", "mash", "boil", "loss"].forEach((x) => { if (e[x] != null && isFinite(e[x]) && e[x] > -50 && e[x] < 150) stats[k][x].push(e[x]); });
      });
    });
    const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
    const groups = [...new Set(P_FIELDS.map((f) => f[3]))];
    main.innerHTML = `
      <p style="margin:0 0 6px"><a href="#/" style="color:var(--muted)">← alle brouwsels</a></p>
      <h1 style="margin:0 0 4px">Ketels</h1>
      <p class="hint" style="margin-top:0">De profielen zijn gevuld met de standaardwaarden uit de Grainfather-app. Meet ze na (zie onderaan) en verfijn ze; de brouwlog vergelijkt elk brouwsel met dit profiel.</p>
      <div class="grid g2" style="align-items:start">
        ${KETTLES.map((k, i) => {
          const p = PROFILES[k] || {}, st = stats[k];
          const meas = [["bh", "Brouwzaalrendement", "%", "brewhouse_eff"], ["mash", "Maischrendement", "%", "mash_eff"], ["boil", "Verdamping", " L/uur", "boil_loss_lh"], ["loss", "Verlies na koken → vergister", " L", "trub_chiller_loss_l"]];
          return `<div class="card" style="border-top:5px solid ${KETTLE_COLORS[i % KETTLE_COLORS.length]}">
            <h2 style="margin-bottom:2px">${esc(k)}</h2><div class="hint" style="margin-bottom:12px">${esc(p.title || "")}${p.brand ? " · " + esc(p.brand) : ""}</div>
            <div class="msg ok" style="margin-top:0"><b>Gemeten in jullie brouwsels</b><br>
              ${meas.map(([x, l, u, pk]) => { const m = mean(st[x]); return `${l}: ${m == null ? "<span class='hint'>nog geen data</span>" : `<b>${fmt1(m)}${u}</b> <span class="hint">(${st[x].length}×)</span>`}${m != null && pk ? ` <button type="button" class="linkbtn" data-take="${esc(k)}|${pk}|${Math.round(m * 10) / 10}">overnemen</button>` : ""}`; }).join("<br>")}
            </div>
            ${groups.map((g) => `<h3 style="font-family:var(--sans);font-size:.8rem;text-transform:uppercase;letter-spacing:1px;color:var(--red);margin:16px 0 8px">${g}</h3>
              <div class="grid g2">${P_FIELDS.filter((f) => f[3] === g).map(([f, l, u, , t]) => `<div class="field"><label>${l}${u ? ` (${u})` : ""}</label>
                <input data-pf="${esc(k)}|${f}" ${t === "text" ? 'type="text"' : 'inputmode="decimal"'} value="${esc(p[f] ?? "")}"></div>`).join("")}</div>`).join("")}
            <div class="field"><label>Notities</label><textarea data-pf="${esc(k)}|notes" style="min-height:70px">${esc(p.notes || "")}</textarea></div>
            <div class="row"><button class="btn" data-psave="${esc(k)}">Profiel opslaan</button><span class="hint" data-pmsg="${esc(k)}"></span></div>
          </div>`;
        }).join("")}
      </div>
      <div class="card" style="margin-top:16px">
        <h2>Zo achterhaal je de echte waarden</h2>
        <ol style="padding-left:20px;line-height:1.7">
          <li><b>Dode ruimte (maischvat):</b> vul de lege ketel met een afgemeten hoeveelheid water, laat leeglopen via de kraan of pomp tot er niets meer komt en meet wat er achterblijft (giet het eruit in een maatbeker).</li>
          <li><b>Verdamping per uur:</b> kook een afgemeten hoeveelheid water (bijv. 25 L) precies 60 minuten met hetzelfde vermogen als op brouwdag, laat afkoelen en meet het verschil. Of: vul op brouwdag <i>Volume voor koken</i>, <i>Volume na koken</i> en de <i>Kooktijd</i> in, dan rekent de brouwlog het zelf uit.</li>
          <li><b>Verlies trub en koeler:</b> meet op brouwdag het volume na koken en het volume dat in de vergister belandt. Het verschil (minus ±4% krimp door afkoelen) is je verlies.</li>
          <li><b>Rendement:</b> vul per brouwsel OG, SG voor koken en de volumes in (en bij suikers/kandij de opbrengst 100%). Na 3–5 brouwsels geeft het gemiddelde hierboven een betrouwbaar rendement; klik op <i>overnemen</i>.</li>
          <li><b>Graanabsorptie:</b> hoeveel liter water er per kg mout achterblijft in het graan. Meet: water in − (wort uit + dode ruimte), gedeeld door kg mout. De app-standaard (0,8–1,0 L/kg) is meestal prima.</li>
          <li><b>Meet altijd op dezelfde manier:</b> SG bij 20 °C (of corrigeer voor temperatuur), en volumes op een vaste plek met een gekalibreerde maatstok of maatstreep.</li>
        </ol>
        <p class="hint">Neem de verfijnde waarden daarna ook over in de Grainfather-app, dan kloppen de receptberekeningen daar ook.</p>
      </div>`;
    $$("[data-take]", main).forEach((b) => (b.onclick = () => {
      const [k, f, v] = b.dataset.take.split("|"); const el = $(`[data-pf="${CSS.escape(k + "|" + f)}"]`, main); if (el) { el.value = v; el.focus(); }
    }));
    $$("[data-psave]", main).forEach((b) => (b.onclick = async () => {
      const k = b.dataset.psave, prof = {};
      $$(`[data-pf^="${CSS.escape(k + "|")}"]`, main).forEach((el) => {
        const f = el.dataset.pf.split("|")[1], def = P_FIELDS.find((x) => x[0] === f);
        prof[f] = !def || def[4] === "text" ? (el.value.trim() || null) : num(el.value);
      });
      b.disabled = true;
      const { error } = await sb.from("kettle_profiles").update({ profile: prof, updated_at: new Date().toISOString() }).eq("name", k);
      b.disabled = false;
      $(`[data-pmsg="${CSS.escape(k)}"]`, main).textContent = error ? "Fout: " + error.message : "Opgeslagen ✓";
      if (!error) PROFILES[k] = prof;
    }));
  }

  /* ---------- Brouwers (leden) ---------- */
  async function brouwersFn(body) {
    const { data, error } = await sb.functions.invoke("brouwers", { body });
    if (error) {
      let msg = error.message, missing = false;
      try { const j = await error.context.json(); if (j && j.error) msg = j.error; } catch (e) { missing = true; }
      if (/Failed to send|NOT_FOUND|not found|404/i.test(msg)) missing = true;
      const err = new Error(missing ? "missing" : msg); err.missing = missing; throw err;
    }
    return typeof data === "string" ? JSON.parse(data) : data;
  }
  async function viewBrewers(flash) {
    main.innerHTML = `<div class="empty">Brouwers ophalen…</div>`;
    let list = [], me = session.user.email, fnOk = true, warn = "";
    try { const r = await brouwersFn({ action: "list" }); list = r.members || []; me = r.me || me; }
    catch (e) {
      fnOk = false;
      warn = e.missing ? "De uitnodigingsfunctie is nog niet geïnstalleerd in Supabase (Edge Function <code>brouwers</code>). Je ziet hieronder alleen de ledenlijst." : esc(e.message);
      const { data } = await sb.from("members").select("*").order("created_at");
      list = (data || []).map((m) => Object.assign({}, m, { status: "onbekend" }));
    }
    const badge = { actief: "gebotteld", uitgenodigd: "vergisting", "geen account": "op", aangemaakt: "lagering", onbekend: "" };
    main.innerHTML = `
      <p style="margin:0 0 6px"><a href="#/" style="color:var(--muted)">← alle brouwsels</a></p>
      <h1 style="margin:0 0 4px">Brouwers</h1>
      <p class="hint" style="margin-top:0">Iedereen op deze lijst kan inloggen op de brouwlog. De kwartetkaarten op de publieke site pas je aan in <code>config.js</code>.</p>
      ${flash ? `<div class="msg ok">${flash}</div>` : ""}${warn ? `<div class="msg info">${warn}</div>` : ""}
      <div class="card">
        <div class="tablewrap"><table class="list"><thead><tr><th>Naam</th><th>E-mail</th><th>Status</th><th>Laatst ingelogd</th><th></th></tr></thead><tbody>
          ${list.map((m) => `<tr>
            <td><b>${esc(m.name || "–")}</b>${m.email.toLowerCase() === String(me).toLowerCase() ? ' <span class="hint">(jij)</span>' : ""}</td>
            <td>${esc(m.email)}</td>
            <td><span class="badge ${badge[m.status] || ""}">${esc(m.status)}</span></td>
            <td>${m.last_sign_in_at ? fmtDateTime(m.last_sign_in_at) : m.invited_at ? `<span class="hint">uitgenodigd ${fmtDate(m.invited_at)}</span>` : "–"}</td>
            <td style="text-align:right;white-space:nowrap">
              <button class="btn small ghost" style="color:var(--red)" data-ren="${esc(m.email)}" data-name="${esc(m.name || "")}">Naam</button>
              ${fnOk && m.status !== "actief" ? `<button class="btn small" data-inv="${esc(m.email)}" data-name="${esc(m.name || "")}">${m.status === "uitgenodigd" ? "Opnieuw uitnodigen" : "Uitnodigen"}</button>` : ""}
              ${m.email.toLowerCase() !== String(me).toLowerCase() ? `<button class="btn small danger" data-rm="${esc(m.email)}">Verwijderen</button>` : ""}
            </td></tr>`).join("")}
        </tbody></table></div>
      </div>
      <div class="card" style="margin-top:16px;max-width:720px">
        <h2>Nieuwe brouwer uitnodigen</h2>
        <form id="invf" class="grid g2" style="align-items:end">
          <div class="field"><label>Naam</label><input id="inv_name" type="text" placeholder="Bijv. Jan J" required></div>
          <div class="field"><label>E-mail</label><input id="inv_email" type="email" placeholder="jan@voorbeeld.nl" required></div>
          <div class="field" style="grid-column:1/-1;margin-bottom:0"><button class="btn" ${fnOk ? "" : "disabled"}>✉ Uitnodiging versturen</button> <span class="hint" id="invmsg"></span></div>
        </form>
        <p class="hint">De brouwer krijgt een mail van Supabase, klikt op de link en kiest een wachtwoord. Supabase verstuurt standaard maar een paar mails per uur.</p>
      </div>`;
    const busy = (b, t) => { b.disabled = true; b.textContent = t; };
    $("#invf").onsubmit = async (e) => {
      e.preventDefault();
      const b = $("#invf button"); busy(b, "Versturen…");
      try { const r = await brouwersFn({ action: "invite", email: $("#inv_email").value, name: $("#inv_name").value, redirectTo: location.origin + location.pathname }); viewBrewers(esc(r.note || "Uitnodiging verstuurd.")); }
      catch (err) { $("#invmsg").innerHTML = `<span style="color:#a33">${esc(err.missing ? "Installeer eerst de functie 'brouwers' in Supabase." : err.message)}</span>`; b.disabled = false; b.textContent = "✉ Uitnodiging versturen"; }
    };
    $$("[data-inv]", main).forEach((b) => (b.onclick = async () => {
      busy(b, "Bezig…");
      try { const r = await brouwersFn({ action: "invite", email: b.dataset.inv, name: b.dataset.name || null, redirectTo: location.origin + location.pathname }); viewBrewers(esc(r.note || "Uitnodiging verstuurd.")); }
      catch (err) { alert(err.message); viewBrewers(); }
    }));
    $$("[data-rm]", main).forEach((b) => (b.onclick = async () => {
      if (!confirm(`${b.dataset.rm} verwijderen? Deze persoon kan dan niet meer inloggen.`)) return;
      busy(b, "Bezig…");
      try {
        if (fnOk) { const r = await brouwersFn({ action: "remove", email: b.dataset.rm }); viewBrewers(esc(r.note || "Verwijderd.")); }
        else { const { error } = await sb.from("members").delete().eq("email", b.dataset.rm); if (error) throw error; viewBrewers("Verwijderd van de ledenlijst."); }
      } catch (err) { alert(err.message); viewBrewers(); }
    }));
    $$("[data-ren]", main).forEach((b) => (b.onclick = async () => {
      const n = prompt("Naam voor " + b.dataset.ren, b.dataset.name || "");
      if (n === null) return;
      const { error } = await sb.from("members").update({ name: n.trim() || null }).eq("email", b.dataset.ren);
      if (error) return alert(error.message + "\n\nDraai eerst brouwers.sql in Supabase.");
      viewBrewers("Naam bijgewerkt.");
    }));
  }

  /* ---------- Brouwsel detail / bewerken ---------- */
  const EMPTY = {
    name: "", style: "", batch_no: "", status: "gepland", brew_date: new Date().toISOString().slice(0, 10), bottle_date: null,
    volume_l: null, bottled_l: null, target_og: null, target_fg: null, target_abv: null, ibu: null, ebc: null, efficiency_pct: null,
    og: null, fg: null, pre_boil_sg: null, mash_ph: null, ferment_temp_c: null, priming_g_per_l: null,
    fermentables: [], hops: [], yeast: "", others: [], mash_schedule: "", water_notes: "", process_notes: "",
    tasting_notes: "", rating: null, is_public: false, public_description: "",
    kettles: [], kettle_values: {}, boil_min: null, ferment_schedule: []
  };
  const multi = () => (brew.kettles || []).length >= 2;
  const kv = (k) => { brew.kettle_values = brew.kettle_values || {}; return (brew.kettle_values[k] = brew.kettle_values[k] || {}); };
  // gecombineerde waarden van meerdere ketels (SG gewogen naar volume)
  function combineKettles() {
    if (!multi()) return;
    const rows = brew.kettles.map((k) => kv(k));
    const wavg = (f) => {
      const xs = rows.filter((r) => r[f]);
      if (!xs.length) return null;
      const w = xs.every((r) => r.volume_l) ? xs.map((r) => Number(r.volume_l)) : xs.map(() => 1);
      const t = w.reduce((a, b) => a + b, 0);
      return Math.round((xs.reduce((a, r, i) => a + Number(r[f]) * w[i], 0) / t) * 1000) / 1000;
    };
    const sum = (f) => { const xs = rows.filter((r) => r[f] != null); return xs.length ? Math.round(xs.reduce((a, r) => a + Number(r[f]), 0) * 10) / 10 : null; };
    const avg = (f) => { const xs = rows.filter((r) => r[f] != null); return xs.length ? Math.round((xs.reduce((a, r) => a + Number(r[f]), 0) / xs.length) * 100) / 100 : null; };
    brew.og = wavg("og"); brew.fg = wavg("fg"); brew.pre_boil_sg = wavg("pre_boil_sg");
    brew.mash_ph = avg("mash_ph"); brew.volume_l = sum("volume_l"); brew.bottled_l = sum("bottled_l");
  }
  const SG_FIELDS = ["target_og", "target_fg", "og", "fg", "pre_boil_sg"];
  const NUM_FIELDS = ["volume_l", "bottled_l", "target_abv", "ibu", "ebc", "efficiency_pct", "mash_ph", "ferment_temp_c", "priming_g_per_l", "boil_min"];
  // één ketel: algemene velden + ketelspecifieke volumes samenvoegen
  const effRec = (k) => (multi() ? kv(k) : Object.assign({}, kv(k), { og: brew.og, fg: brew.fg, pre_boil_sg: brew.pre_boil_sg, volume_l: brew.volume_l, bottled_l: brew.bottled_l }));

  let brew = null, measurements = [], tastings = [], tastingsMissing = false, activeTab = "basis";

  async function viewBrew(id) {
    dirty = false;
    if (id) {
      main.innerHTML = `<div class="empty">Brouwsel ophalen…</div>`;
      const [{ data, error }, m, tq] = await Promise.all([
        sb.from("brews").select("*").eq("id", id).maybeSingle(),
        sb.from("measurements").select("*").eq("brew_id", id).order("measured_at"),
        sb.from("tastings").select("*").eq("brew_id", id).order("tasted_on")
      ]);
      tastings = (tq && !tq.error && tq.data) || []; tastingsMissing = !!(tq && tq.error);
      if (error || !data) { main.innerHTML = `<div class="msg err">Brouwsel niet gevonden. <a href="#/">Terug</a></div>`; return; }
      brew = data; measurements = m.data || [];
      if (!Array.isArray(brew.kettles)) brew.kettles = [];
      if (!brew.kettle_values || typeof brew.kettle_values !== "object") brew.kettle_values = {};
      if (!Array.isArray(brew.ferment_schedule)) brew.ferment_schedule = [];
    } else {
      brew = JSON.parse(JSON.stringify(EMPTY)); measurements = []; tastings = [];
      if (KETTLES.length === 1) brew.kettles = [KETTLES[0]];
      activeTab = "basis";
    }
    renderBrew();
  }

  const inp = (key, label, opts = {}) => {
    const v = brew[key];
    const val = SG_FIELDS.includes(key) ? (v ? Number(v).toFixed(3) : "") : (v ?? "");
    return `<div class="field"><label for="f_${key}">${label}</label>
      <input id="f_${key}" data-k="${key}" ${opts.type ? `type="${opts.type}"` : `inputmode="decimal"`} value="${esc(val)}" placeholder="${esc(opts.ph || "")}"></div>`;
  };

  function renderBrew() {
    const isNew = !brew.id;
    main.innerHTML = `
      <p style="margin:0 0 6px"><a href="#/" style="color:var(--muted)">← alle brouwsels</a></p>
      <div class="row"><h1 style="margin:0" id="title">${esc(brew.name || "Nieuw brouwsel")}</h1>
        <span class="badge ${brew.status}" id="statBadge">${esc(brew.status)}</span></div>
      <div class="kpis" id="kpis"></div>
      <div class="tabs" id="tabs">
        ${[["basis", "Basis & cijfers"], ["recept", "Recept"], ["metingen", "Metingen" + (measurements.length ? ` (${measurements.length})` : "")], ["proeven", "Proeven & publiek"]]
          .map(([k, l]) => `<button data-t="${k}" class="${activeTab === k ? "on" : ""}">${l}</button>`).join("")}
      </div>

      <div class="pane" data-p="basis">
        <div class="card">
          <h2>Basis</h2>
          <div class="grid g2">
            ${inp("name", "Naam *", { type: "text", ph: "Gouden Broeder Tripel" })}
            ${inp("style", "Stijl", { type: "text", ph: "Belgische tripel" })}
          </div>
          <div class="grid g4">
            ${inp("batch_no", "Batchnummer", { type: "text", ph: "2026-03" })}
            <div class="field"><label for="f_status">Status</label><select id="f_status" data-k="status">${STATUSES.map((s) => `<option ${brew.status === s ? "selected" : ""}>${s}</option>`).join("")}</select></div>
            ${inp("brew_date", "Brouwdatum", { type: "date" })}
            ${inp("bottle_date", "Botteldatum", { type: "date" })}
          </div>
          <div class="field" style="margin-bottom:0"><label>Ketel(s)</label>
            <div class="row" id="kettlePick">${KETTLES.map((k) => `<label style="display:flex;gap:8px;align-items:center;text-transform:none;font-size:1rem;color:var(--ink);font-weight:600;margin:0 14px 0 0">
              <input type="checkbox" data-kettle="${esc(k)}" style="width:auto" ${(brew.kettles || []).includes(k) ? "checked" : ""}> ${esc(k)}</label>`).join("")}</div>
            <p class="hint" style="margin:6px 0 0">Gebruik je beide ketels voor één brouwsel? Vink ze allebei aan, dan registreer je de SG-waarden per ketel.</p>
          </div>
        </div>
        <div class="grid g2" style="margin-top:16px">
          <div class="card">
            <h2>Doel (recept)</h2>
            <div class="grid g2">
              ${inp("target_og", "Doel OG", { ph: "1.075" })}
              ${inp("target_fg", "Doel FG", { ph: "1.010" })}
              ${inp("target_abv", "Doel ABV %", { ph: "8.5" })}
              ${inp("efficiency_pct", "Rendement %", { ph: "72" })}
              ${inp("ibu", "IBU", { ph: "30" })}
              ${inp("ebc", "Kleur (EBC)", { ph: "9" })}
              ${inp("boil_min", "Kooktijd (min)", { ph: "90" })}
            </div>
          </div>
          <div class="card" id="gemeten"></div>
        </div>
      </div>

      <div class="pane" data-p="recept">
        <div class="card"><h2>Moutstort</h2><div id="ed_fermentables"></div></div>
        <div class="card" style="margin-top:16px"><h2>Hop</h2><div id="ed_hops"></div></div>
        <div class="grid g2" style="margin-top:16px">
          <div class="card"><h2>Gist</h2>
            <div class="field"><input id="f_yeast" data-k="yeast" value="${esc(brew.yeast || "")}" placeholder="bijv. SafAle BE-256, 2 pakjes" type="text"></div>
            <h2 style="margin-top:14px">Overige ingrediënten</h2><div id="ed_others"></div>
          </div>
          <div class="card"><h2>Maischschema</h2>
            <div class="field"><textarea data-k="mash_schedule" placeholder="62 °C – 60 min&#10;72 °C – 15 min&#10;78 °C – uitmaischen">${esc(brew.mash_schedule || "")}</textarea></div>
            <h2>Water</h2>
            <div class="field"><textarea data-k="water_notes" placeholder="Hoofdgieting / spoelwater, zouten, aanzuren…">${esc(brew.water_notes || "")}</textarea></div>
          </div>
        </div>
        <div class="card" style="margin-top:16px">
          <div class="row"><h2 style="margin:0">Vergistingsschema</h2><span class="spacer"></span>
            <button type="button" class="btn small ghost" style="color:var(--red)" data-tpl="belgisch">Sjabloon: Belgisch oplopend</button>
            <button type="button" class="btn small ghost" style="color:var(--red)" data-tpl="ale">Sjabloon: Ale</button></div>
          <p class="hint">Stappen na het aanstellen van de gist. Met een brouwdatum zie je wanneer elke stap begint.</p>
          <div id="ed_ferment_schedule"></div>
        </div>
        <div class="card" style="margin-top:16px"><h2>Brouwdag-notities</h2>
          <div class="field"><textarea data-k="process_notes" placeholder="Wat ging er goed, wat ging er mis, wie had de opener?">${esc(brew.process_notes || "")}</textarea></div>
        </div>
      </div>

      <div class="pane" data-p="metingen">
        <div class="card">
          <h2>Metingen</h2>
          ${isNew ? `<div class="msg info">Sla het brouwsel eerst op; daarna kun je metingen toevoegen.</div>` : `
          <form id="mf" class="grid g4" style="align-items:end">
            <div class="field"><label>Datum/tijd</label><input type="datetime-local" id="m_at" value="${toLocalInput()}"></div>
            <div class="field"><label>SG</label><input id="m_sg" inputmode="decimal" placeholder="1.032"></div>
            <div class="field"><label>Temp °C</label><input id="m_t" inputmode="decimal" placeholder="19.5"></div>
            <div class="field"><label>pH</label><input id="m_ph" inputmode="decimal" placeholder=""></div>
            <div class="field" id="m_kettle_wrap" style="grid-column:1/-1;${multi() ? "" : "display:none"}"><label>Ketel</label>
              <div class="row">${(brew.kettles || []).map((k, i) => `<label style="display:flex;gap:6px;align-items:center;text-transform:none;font-size:1rem;color:var(--ink);margin:0 14px 0 0"><input type="radio" name="m_kettle" value="${esc(k)}" style="width:auto" ${i === 0 ? "checked" : ""}> ${esc(k)}</label>`).join("")}</div></div>
            <div class="field" style="grid-column:1/-2"><label>Opmerking</label><input id="m_note" type="text" placeholder="Krausen ingezakt, ruikt naar banaan…"></div>
            <div class="field"><button class="btn" style="width:100%;justify-content:center">＋ Meting</button></div>
          </form>
          <div id="mlist"></div>
          <div id="chart"></div>`}
        </div>
      </div>

      <div class="pane" data-p="proeven">
        <div class="card" id="tastingCard" style="margin-bottom:16px"></div>
        <div class="card">
          <h2>Algemene proefnotities</h2>
          <div class="field"><label>Beoordeling</label><div class="rating" id="rating">${[1, 2, 3, 4, 5].map((i) => `<button type="button" data-r="${i}" class="${brew.rating >= i ? "on" : ""}">★</button>`).join("")}</div></div>
          <div class="field"><textarea data-k="tasting_notes" placeholder="Uiterlijk, geur, smaak, mondgevoel, afdronk… en wat de buurman ervan vond.">${esc(brew.tasting_notes || "")}</textarea></div>
        </div>
        <div class="card" style="margin-top:16px">
          <h2>Publieke site</h2>
          <label style="display:flex;gap:10px;align-items:center;text-transform:none;font-size:1rem;color:var(--ink)">
            <input type="checkbox" id="f_is_public" data-k="is_public" style="width:auto" ${brew.is_public ? "checked" : ""}>
            Toon dit bier op mannenvanmout.nl (alleen naam, stijl, batch, ABV en de tekst hieronder)
          </label>
          <div class="field" style="margin-top:12px"><label>Publieke omschrijving</label>
            <textarea data-k="public_description" placeholder="Een karaktervolle tripel, goud van kleur…">${esc(brew.public_description || "")}</textarea></div>
        </div>
      </div>

      <div class="sticky-save"><div class="row">
        <button class="btn" id="save">Opslaan</button>
        <span id="saveMsg" class="hint"></span>
        <span class="spacer"></span>
        ${isNew ? "" : `<button class="btn small ghost" id="dup" style="color:var(--red)" title="Kopie als nieuwe batch">Kopie<span class="hide-sm"> als nieuwe batch</span></button><button class="btn small danger" id="del" title="Verwijderen">Verwijder<span class="hide-sm">en</span></button>`}
      </div></div>`;

    // tabs
    const showTab = (t) => { activeTab = t; $$("#tabs button").forEach((b) => b.classList.toggle("on", b.dataset.t === t)); $$(".pane").forEach((p) => p.classList.toggle("on", p.dataset.p === t)); };
    $$("#tabs button").forEach((b) => (b.onclick = () => showTab(b.dataset.t)));
    showTab(activeTab);

    // velden binden
    bindFields(main);
    renderGemeten();
    $$("[data-kettle]", main).forEach((c) => (c.onchange = () => {
      brew.kettles = KETTLES.filter((k) => $(`[data-kettle="${CSS.escape(k)}"]`, main).checked);
      if (multi()) {
        // eerste keer naar meerdere ketels: huidige waarden overnemen in de eerste ketel
        const first = kv(brew.kettles[0]);
        if (!Object.values(first).some((x) => x != null)) K_FIELDS.forEach(([f]) => { if (brew[f] != null) first[f] = brew[f]; });
        combineKettles();
      }
      markDirty(); renderGemeten(); drawKpis();
      const w = $("#m_kettle_wrap");
      if (w) { w.style.display = multi() ? "" : "none"; w.querySelector(".row").innerHTML = brew.kettles.map((k, i) => `<label style="display:flex;gap:6px;align-items:center;text-transform:none;font-size:1rem;color:var(--ink);margin:0 14px 0 0"><input type="radio" name="m_kettle" value="${esc(k)}" style="width:auto" ${i === 0 ? "checked" : ""}> ${esc(k)}</label>`).join(""); }
    }));
    $$("#rating button").forEach((b) => (b.onclick = () => {
      const r = Number(b.dataset.r); brew.rating = brew.rating === r ? null : r;
      $$("#rating button").forEach((x) => x.classList.toggle("on", brew.rating >= Number(x.dataset.r))); markDirty();
    }));

    rowsEditor("fermentables", [
      { k: "name", l: "Mout / suiker", ph: "Pilsmout", w: "50%" },
      { k: "kg", l: "kg", ph: "5.5", n: true },
      { k: "ebc", l: "EBC", ph: "3.5", n: true },
      { k: "yield", l: "Opbr. %", ph: "80", n: true }
    ], (rows) => { const t = rows.reduce((s, r) => s + (num(r.kg) || 0), 0); return t ? `Totaal: <b>${fmt1(t)} kg</b> · opbrengst leeg = 80% (suikers 100%)` : ""; });
    rowsEditor("ferment_schedule", [
      { k: "step", l: "Stap", ph: "Primaire vergisting", w: "34%" },
      { k: "temp_c", l: "Temp °C", ph: "19", n: true },
      { k: "days", l: "Dagen", ph: "3", n: true },
      { k: "note", l: "Opmerking", ph: "Daarna vrij laten oplopen" }
    ], (rows) => {
      let d = 0; const start = brew.brew_date ? new Date(brew.brew_date) : null;
      const parts = rows.map((r) => { const at = d; d += num(r.days) || 0; return start && r.step ? `${esc(r.step)}: ${new Date(start.getTime() + at * 864e5).toLocaleDateString("nl-NL", { day: "numeric", month: "short" })}` : ""; }).filter(Boolean);
      return d ? `Totaal <b>${fmt1(d)} dagen</b>${start ? ` · klaar rond <b>${new Date(start.getTime() + d * 864e5).toLocaleDateString("nl-NL", { day: "numeric", month: "short" })}</b><br>${parts.join(" · ")}` : ""}` : "";
    });
    $$("[data-tpl]", main).forEach((b) => (b.onclick = () => {
      if (brew.ferment_schedule.length && !confirm("Huidige schema vervangen door het sjabloon?")) return;
      brew.ferment_schedule = b.dataset.tpl === "belgisch"
        ? [{ step: "Aanstellen en start", temp_c: 18, days: 2, note: "Rustig beginnen tegen fusels" }, { step: "Vrij laten oplopen", temp_c: 22, days: 3, note: "Gist warmt zelf op" },
           { step: "Uitgisten", temp_c: 24, days: 7, note: "Tot FG stabiel is (2 dagen gelijk)" }, { step: "Cold crash", temp_c: 2, days: 3, note: "Helderen voor bottelen" }]
        : [{ step: "Primaire vergisting", temp_c: 19, days: 7, note: "" }, { step: "Diacetylrust", temp_c: 21, days: 3, note: "" }, { step: "Cold crash", temp_c: 2, days: 2, note: "" }];
      markDirty(); renderBrew(); activeTabTo("recept");
    }));
    renderTastings();
    rowsEditor("hops", [
      { k: "name", l: "Hop", ph: "Saaz", w: "34%" },
      { k: "g", l: "gram", ph: "40", n: true },
      { k: "alpha", l: "alfa %", ph: "3.5", n: true },
      { k: "use", l: "Moment", opts: HOP_USES },
      { k: "min", l: "min / dagen", ph: "60", n: true }
    ], (rows) => { const t = rows.reduce((s, r) => s + (num(r.g) || 0), 0); return t ? `Totaal: <b>${Math.round(t)} g</b>` : ""; });
    rowsEditor("others", [
      { k: "name", l: "Wat", ph: "Kandijsuiker / koriander", w: "45%" },
      { k: "amount", l: "Hoeveelheid", ph: "500 g" },
      { k: "use", l: "Wanneer", ph: "10 min voor einde koken" }
    ]);

    $("#save").onclick = save;
    if (!isNew) {
      $("#del").onclick = del;
      $("#dup").onclick = duplicate;
      $("#mf").onsubmit = addMeasurement;
      drawMeasurements();
    }
    drawKpis();
  }

  function bindFields(root) {
    $$("[data-k]", root).forEach((el) => {
      const k = el.dataset.k;
      const ev = el.type === "checkbox" || el.tagName === "SELECT" ? "change" : "input";
      el.addEventListener(ev, () => {
        let v = el.type === "checkbox" ? el.checked : el.value;
        if (SG_FIELDS.includes(k)) v = parseSG(v);
        else if (NUM_FIELDS.includes(k)) v = num(v);
        else if (el.type === "date") v = v || null;
        brew[k] = v; markDirty();
        if (k === "name") $("#title").textContent = v || "Nieuw brouwsel";
        if (k === "status") { const b = $("#statBadge"); b.textContent = v; b.className = "badge " + v; }
        drawKpis();
      });
      if (SG_FIELDS.includes(k)) el.addEventListener("blur", () => { if (brew[k]) el.value = Number(brew[k]).toFixed(3); });
    });
    $$("[data-kk]", root).forEach((el) => {
      const [k, f, type] = el.dataset.kk.split("|");
      el.addEventListener("input", () => {
        kv(k)[f] = type === "sg" ? parseSG(el.value) : num(el.value);
        combineKettles(); markDirty(); drawKpis(); drawCombined();
      });
      if (type === "sg") el.addEventListener("blur", () => { const v = kv(k)[f]; if (v) el.value = Number(v).toFixed(3); });
    });
  }

  function renderGemeten() {
    const host = $("#gemeten"); if (!host) return;
    const extra = `${inp("ferment_temp_c", "Vergistingstemp. °C", { ph: "20" })}${inp("priming_g_per_l", "Bottelsuiker g/L", { ph: "7" })}`;
    if (!multi()) {
      host.innerHTML = `<h2>Gemeten${brew.kettles && brew.kettles.length ? ` <span class="hint" style="font-family:var(--sans)">· ${esc(brew.kettles[0])}</span>` : ""}</h2>
        <div class="grid g2">
          ${inp("og", "Begin-SG (OG)", { ph: "1.074" })}
          ${inp("fg", "Eind-SG (FG)", { ph: "1.009" })}
          ${inp("pre_boil_sg", "SG voor koken", { ph: "1.062" })}
          ${inp("mash_ph", "pH maisch", { ph: "5.3" })}
          ${inp("volume_l", "Volume vergister (L)", { ph: "23" })}
          ${inp("bottled_l", "Gebotteld (L)", { ph: "20" })}
          ${(brew.kettles || []).length === 1 ? VOL_FIELDS.map(([f, l, ph, t]) => { const v = kv(brew.kettles[0])[f]; return `<div class="field"><label>${l}</label><input inputmode="decimal" data-kk="${esc(brew.kettles[0])}|${f}|${t}" value="${v == null ? "" : esc(v)}" placeholder="${ph}"></div>`; }).join("") : ""}
          ${extra}
        </div>
        <p class="hint">Tip: SG mag je ook als <b>1074</b> of <b>74</b> typen.${(brew.kettles || []).length === 1 ? " Met de volumes voor en na het koken berekent de brouwlog het rendement en de verdamping van de ketel." : ""}</p>`;
    } else {
      host.innerHTML = `<h2>Gemeten per ketel</h2>
        ${brew.kettles.map((k, i) => `<div style="border-left:4px solid ${KETTLE_COLORS[i % KETTLE_COLORS.length]};padding-left:12px;margin-bottom:14px">
          <div style="font-weight:700;margin-bottom:6px">${esc(k)}</div>
          <div class="grid g3">${K_FIELDS.concat(VOL_FIELDS).map(([f, l, ph, t]) => {
            const v = kv(k)[f];
            return `<div class="field"><label>${l}</label><input inputmode="decimal" data-kk="${esc(k)}|${f}|${t}" value="${v == null ? "" : t === "sg" ? esc(Number(v).toFixed(3)) : esc(v)}" placeholder="${ph}"></div>`;
          }).join("")}</div></div>`).join("")}
        <div id="combined" class="msg info" style="margin-top:0"></div>
        <div class="grid g2">${extra}</div>
        <p class="hint">Het totaal (SG gewogen naar volume) wordt gebruikt voor de ABV op de site.</p>`;
      drawCombined();
    }
    bindFields(host);
  }
  function drawCombined() {
    const el = $("#combined"); if (!el) return;
    el.innerHTML = `<b>Totaal:</b> OG ${fmtSG(brew.og)} · FG ${fmtSG(brew.fg)} · ${brew.og && brew.fg ? fmt1(abv(brew.og, brew.fg)) + "% ABV" : "ABV –"} · ${brew.volume_l ? fmt1(brew.volume_l) + " L" : "– L"}${brew.bottled_l ? ` · ${fmt1(brew.bottled_l)} L gebotteld` : ""}`;
  }

  function markDirty() { dirty = true; const m = $("#saveMsg"); if (m) m.textContent = "Niet-opgeslagen wijzigingen"; }

  function rowsEditor(key, cols, footer) {
    const host = $("#ed_" + key);
    if (!Array.isArray(brew[key])) brew[key] = [];
    const draw = () => {
      const rows = brew[key];
      host.innerHTML = `<div class="tablewrap"><table class="list edit"><thead><tr>${cols.map((c) => `<th style="${c.w ? `width:${c.w}` : ""}">${c.l}</th>`).join("")}<th></th></tr></thead><tbody>
        ${rows.map((r, i) => `<tr>${cols.map((c, ci) => `<td data-l="${esc(c.l)}" class="${ci === 0 ? "first" : ""}">${c.opts
          ? `<select data-i="${i}" data-c="${c.k}">${c.opts.map((o) => `<option ${r[c.k] === o ? "selected" : ""}>${o}</option>`).join("")}</select>`
          : `<input data-i="${i}" data-c="${c.k}" value="${esc(r[c.k] ?? "")}" placeholder="${esc(c.ph || "")}" ${c.n ? `inputmode="decimal"` : ""}>`}</td>`).join("")}
          <td><button class="x" data-del="${i}" title="Verwijderen">×</button></td></tr>`).join("")}
      </tbody></table></div>
      <div class="row" style="margin-top:8px"><button class="btn small ghost" style="color:var(--red)" data-add>＋ Regel</button><span class="spacer"></span><span class="hint" data-foot>${footer ? footer(rows) : ""}</span></div>`;
      $$("[data-c]", host).forEach((el) => el.addEventListener(el.tagName === "SELECT" ? "change" : "input", () => {
        const c = cols.find((x) => x.k === el.dataset.c);
        rows[el.dataset.i][el.dataset.c] = c.n ? num(el.value) : el.value;
        markDirty(); if (footer) $("[data-foot]", host).innerHTML = footer(rows);
      }));
      $$("[data-del]", host).forEach((b) => (b.onclick = () => { rows.splice(Number(b.dataset.del), 1); markDirty(); draw(); }));
      $("[data-add]", host).onclick = () => {
        const r = {}; cols.forEach((c) => (r[c.k] = c.opts ? c.opts[0] : c.n ? null : "")); rows.push(r); markDirty(); draw();
        const inputs = $$("tbody tr:last-child input", host); if (inputs[0]) inputs[0].focus();
      };
    };
    draw();
  }

  function drawKpis() {
    const el = $("#kpis"); if (!el) return;
    const last = [...measurements].reverse().find((m) => m.sg);
    const og = brew.og, fg = brew.fg, cur = fg || (last && last.sg) || null;
    const a = abv(og, cur), att = attenuation(og, cur);
    const k = (label, val, sub) => `<div class="kpi"><small>${label}</small><strong>${val}</strong>${sub ? `<br><span>${sub}</span>` : ""}</div>`;
    el.innerHTML =
      k("Begin-SG", fmtSG(og), og ? `${fmt1(plato(og))} °P · doel ${fmtSG(brew.target_og)}` : brew.target_og ? `doel ${fmtSG(brew.target_og)}` : "") +
      k(fg ? "Eind-SG" : "Laatste SG", fmtSG(cur), cur ? `doel ${fmtSG(brew.target_fg)}` : "") +
      k(fg ? "Alcohol" : "Alcohol tot nu", a ? fmt1(a) + "%" : "–", brew.target_abv ? `doel ${fmt1(brew.target_abv)}%` : "") +
      k("Vergistingsgraad", att ? Math.round(att) + "%" : "–", "schijnbaar") +
      k("Volume", brew.volume_l ? fmt1(brew.volume_l) + " L" : "–", brew.bottled_l ? `${fmt1(brew.bottled_l)} L gebotteld` : "");
    if ((brew.kettles || []).length) {
      el.innerHTML += `<div class="kpi" style="grid-column:1/-1;background:#fffaf0;color:var(--ink);border:1px solid var(--line)">
        <small style="color:var(--red)">${multi() ? "Per ketel" : "Ketel"}</small>
        <div class="tablewrap"><table class="list" style="margin-top:4px"><thead><tr><th>Ketel</th><th>OG</th><th>FG / laatste SG</th><th>ABV</th><th>Vergisting</th><th>Volume</th><th>Brouwzaalrend.</th><th>Maischrend.</th><th>Verdamping</th></tr></thead><tbody>
        ${brew.kettles.map((kn, i) => {
          const v = effRec(kn), prof = PROFILES[kn] || {};
          const lm = [...measurements].reverse().find((m) => m.sg && (!multi() || m.kettle === kn));
          const c = v.fg || (lm && lm.sg) || null;
          const a2 = abv(v.og, c), t2 = attenuation(v.og, c);
          const e = calcEff(v, brew.fermentables, brew.boil_min, prof);
          const vs = (val, ref, unit) => val == null ? "–" : `${fmt1(val)}${unit}${ref != null && ref !== "" ? ` <span class="hint">(profiel ${fmt1(num(ref))})</span>` : ""}`;
          return `<tr><td><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${KETTLE_COLORS[i % KETTLE_COLORS.length]};margin-right:6px"></span><b>${esc(kn)}</b></td>
            <td>${fmtSG(v.og)}</td><td>${fmtSG(c)}${!v.fg && c ? ' <span class="hint">(meting)</span>' : ""}</td><td>${a2 ? fmt1(a2) + "%" : "–"}</td><td>${t2 ? Math.round(t2) + "%" : "–"}</td><td>${v.volume_l ? fmt1(v.volume_l) + " L" : "–"}</td>
            <td>${vs(e.bh, prof.brewhouse_eff, "%")}</td><td>${vs(e.mash, prof.mash_eff, "%")}</td><td>${vs(e.boil, prof.boil_loss_lh, " L/u")}</td></tr>`;
        }).join("")}</tbody></table></div></div>`;
    }
  }

  function payload() {
    const p = {};
    Object.keys(EMPTY).forEach((k) => (p[k] = brew[k] === undefined ? EMPTY[k] : brew[k]));
    ["fermentables", "hops", "others"].forEach((k) => (p[k] = (p[k] || []).filter((r) => Object.values(r).some((v) => v !== null && v !== "" && !HOP_USES.includes(v)) || r.name)));
    return p;
  }

  async function save() {
    if (!brew.name || !brew.name.trim()) { activeTabTo("basis"); alert("Geef het brouwsel eerst een naam."); return; }
    const btn = $("#save"); btn.disabled = true; $("#saveMsg").textContent = "Opslaan…";
    combineKettles();
    const p = payload();
    const q = brew.id ? sb.from("brews").update(p).eq("id", brew.id).select().single() : sb.from("brews").insert(p).select().single();
    const { data, error } = await q;
    btn.disabled = false;
    if (error) {
      const m = /kettle|boil_min|ferment_schedule|schema cache/i.test(error.message) ? "De database mist nog kolommen. Draai eerst de SQL voor ketels en proeven in Supabase. (" + error.message + ")" : error.message;
      $("#saveMsg").innerHTML = `<span style="color:#a33">Fout: ${esc(m)}</span>`; return;
    }
    const wasNew = !brew.id;
    brew = data; dirty = false;
    if (wasNew) { location.hash = "#/b/" + data.id; return; } // laadt opnieuw
    $("#saveMsg").textContent = "Opgeslagen ✓ " + new Date().toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" });
    drawKpis();
  }
  function activeTabTo(t) { const b = $(`#tabs button[data-t="${t}"]`); if (b) b.click(); }

  async function del() {
    if (!confirm(`“${brew.name}” en alle metingen definitief verwijderen?`)) return;
    const { error } = await sb.from("brews").delete().eq("id", brew.id);
    if (error) return alert(error.message);
    dirty = false; location.hash = "#/";
  }

  function duplicate() {
    if (dirty && !confirm("Er zijn niet-opgeslagen wijzigingen. Toch een kopie maken?")) return;
    const copy = JSON.parse(JSON.stringify(brew));
    ["id", "created_at", "updated_at", "created_by", "abv"].forEach((k) => delete copy[k]);
    Object.assign(copy, { og: null, fg: null, pre_boil_sg: null, mash_ph: null, bottled_l: null, bottle_date: null, tasting_notes: "", rating: null,
      is_public: false, status: "gepland", brew_date: new Date().toISOString().slice(0, 10), batch_no: "", kettle_values: {} });
    brew = copy; measurements = []; activeTab = "basis";
    history.replaceState(null, "", "#/nieuw");
    renderBrew(); markDirty();
    $("#saveMsg").textContent = "Kopie – vergeet niet op te slaan";
  }

  /* ---------- Metingen ---------- */
  async function addMeasurement(e) {
    e.preventDefault();
    const row = {
      brew_id: brew.id,
      measured_at: new Date($("#m_at").value || Date.now()).toISOString(),
      sg: parseSG($("#m_sg").value), temp_c: num($("#m_t").value), ph: num($("#m_ph").value),
      note: $("#m_note").value.trim() || null
    };
    if (multi()) { const r = $('input[name="m_kettle"]:checked'); row.kettle = r ? r.value : null; }
    else if ((brew.kettles || []).length === 1) row.kettle = brew.kettles[0];
    if (row.sg === null && row.temp_c === null && row.ph === null && !row.note) return;
    const { data, error } = await sb.from("measurements").insert(row).select().single();
    if (error) return alert(/kettle/i.test(error.message) ? "De database kent de ketels nog niet. Draai eerst de ketel-SQL in Supabase." : error.message);
    measurements.push(data); measurements.sort((a, b) => new Date(a.measured_at) - new Date(b.measured_at));
    // eerste SG-meting = OG als die nog leeg is
    if (multi() && data.kettle) {
      if (!kv(data.kettle).og && data.sg && measurements.filter((m) => m.sg && m.kettle === data.kettle).length === 1) {
        kv(data.kettle).og = data.sg; combineKettles(); renderGemeten(); markDirty();
      }
    } else if (!brew.og && data.sg && measurements.filter((m) => m.sg).length === 1) {
      brew.og = data.sg; const f = $("#f_og"); if (f) f.value = data.sg.toFixed(3); markDirty();
    }
    ["m_sg", "m_t", "m_ph", "m_note"].forEach((id) => ($("#" + id).value = ""));
    $("#m_at").value = toLocalInput();
    drawMeasurements(); drawKpis();
  }
  async function delMeasurement(id) {
    if (!confirm("Deze meting verwijderen?")) return;
    const { error } = await sb.from("measurements").delete().eq("id", id);
    if (error) return alert(error.message);
    measurements = measurements.filter((m) => m.id !== id); drawMeasurements(); drawKpis();
  }
  function drawMeasurements() {
    const host = $("#mlist"); if (!host) return;
    const t = $(`#tabs button[data-t="metingen"]`); if (t) t.textContent = "Metingen" + (measurements.length ? ` (${measurements.length})` : "");
    if (!measurements.length) { host.innerHTML = `<p class="hint">Nog geen metingen. Pak de hydrometer of refractometer!</p>`; $("#chart").innerHTML = ""; return; }
    const ogFor = (m) => (multi() && m.kettle && kv(m.kettle).og) || brew.og || (measurements.find((x) => x.sg && (!multi() || x.kettle === m.kettle)) || {}).sg;
    const showK = multi() || measurements.some((m) => m.kettle && (brew.kettles || []).length > 1);
    host.innerHTML = `<div class="tablewrap"><table class="list"><thead><tr><th>Wanneer</th>${showK ? "<th>Ketel</th>" : ""}<th>SG</th><th>°P</th><th>ABV</th><th>°C</th><th>pH</th><th>Opmerking</th><th></th></tr></thead><tbody>
      ${measurements.map((m) => { const og = ogFor(m); return `<tr><td>${fmtDateTime(m.measured_at)}</td>${showK ? `<td>${esc(m.kettle || "–")}</td>` : ""}<td><b>${fmtSG(m.sg)}</b></td><td>${m.sg ? fmt1(plato(m.sg)) : ""}</td>
        <td>${og && m.sg ? fmt1(abv(og, m.sg)) + "%" : ""}</td><td>${m.temp_c ?? ""}</td><td>${m.ph ?? ""}</td><td>${esc(m.note || "")}</td>
        <td><button class="x" data-mdel="${m.id}" title="Verwijderen">×</button></td></tr>`; }).join("")}
      </tbody></table></div>`;
    $$("[data-mdel]", host).forEach((b) => (b.onclick = () => delMeasurement(b.dataset.mdel)));
    $("#chart").innerHTML = chart();
  }
  function chart() {
    const all = measurements.filter((m) => m.sg).map((m) => ({ t: new Date(m.measured_at).getTime(), v: Number(m.sg), c: m.temp_c, k: m.kettle || null }));
    if (all.length < 2) return "";
    const kettles = multi() ? brew.kettles : [];
    const series = kettles.length
      ? kettles.map((k, i) => ({ name: k, color: KETTLE_COLORS[i % KETTLE_COLORS.length], pts: all.filter((p) => p.k === k) }))
          .concat([{ name: "Algemeen", color: "#8a6d50", pts: all.filter((p) => !p.k || !kettles.includes(p.k)) }]).filter((s) => s.pts.length)
      : [{ name: "SG", color: "#7d1d1d", pts: all }];
    const W = 720, H = 260, L = 56, R = 16, T = series.length > 1 ? 30 : 16, B = 34;
    const t0 = Math.min(...all.map((p) => p.t)), t1 = Math.max(...all.map((p) => p.t)) || t0 + 1;
    const vals = all.map((p) => p.v).concat(brew.target_fg ? [Number(brew.target_fg)] : []);
    const vmin = Math.min(...vals) - 0.003, vmax = Math.max(...vals) + 0.003;
    const x = (t) => L + ((t - t0) / Math.max(1, t1 - t0)) * (W - L - R);
    const y = (v) => T + (1 - (v - vmin) / (vmax - vmin)) * (H - T - B);
    const days = (t1 - t0) / 864e5;
    let grid = "";
    for (let i = 0; i <= 4; i++) {
      const v = vmin + ((vmax - vmin) * i) / 4;
      grid += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="#eee"/><text x="${L - 8}" y="${y(v) + 4}" text-anchor="end" font-size="11" fill="#8a6d50">${v.toFixed(3)}</text>`;
    }
    const step = days > 20 ? 7 : days > 8 ? 2 : 1;
    for (let d = 0; d <= days + 0.001; d += step) grid += `<text x="${x(t0 + d * 864e5)}" y="${H - 10}" text-anchor="middle" font-size="11" fill="#8a6d50">dag ${Math.round(d)}</text>`;
    const tgt = brew.target_fg ? `<line x1="${L}" x2="${W - R}" y1="${y(brew.target_fg)}" y2="${y(brew.target_fg)}" stroke="#4f6b26" stroke-dasharray="5 4"/><text x="${L + 6}" y="${y(brew.target_fg) - 5}" text-anchor="start" font-size="11" fill="#4f6b26">doel FG ${fmtSG(brew.target_fg)}</text>` : "";
    const legend = series.length > 1 ? series.map((s, i) => `<circle cx="${L + i * 130 + 6}" cy="12" r="5" fill="${s.color}"/><text x="${L + i * 130 + 16}" y="16" font-size="12" fill="#2b1a10">${esc(s.name)}</text>`).join("") : "";
    const single = series.length === 1;
    const lines = series.map((s) => {
      const path = s.pts.map((p, i) => `${i ? "L" : "M"}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
      const area = single && s.pts.length > 1 ? `<path d="${path} L${x(s.pts[s.pts.length - 1].t)},${H - B} L${x(s.pts[0].t)},${H - B} Z" fill="url(#g)"/>` : "";
      return `${area}<path d="${path}" fill="none" stroke="${s.color}" stroke-width="2.5"/>` +
        s.pts.map((p) => `<circle cx="${x(p.t)}" cy="${y(p.v)}" r="4" fill="#fff" stroke="${s.color}" stroke-width="2"><title>${esc(s.name)}: ${fmtSG(p.v)}${p.c != null ? " · " + p.c + " °C" : ""}</title></circle>`).join("");
    }).join("");
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="SG-verloop">
      <defs><linearGradient id="g" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#e0a63a" stop-opacity=".35"/><stop offset="1" stop-color="#e0a63a" stop-opacity="0"/></linearGradient></defs>
      ${grid}${tgt}${legend}${lines}
    </svg>`;
  }
})();
