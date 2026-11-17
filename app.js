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
    const h = location.hash || "#/";
    if (h.startsWith("#/b/")) return viewBrew(h.slice(4));
    if (h === "#/nieuw") return viewBrew(null);
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
      sb.from("brews").select("id,name,style,batch_no,status,brew_date,bottle_date,og,fg,abv,target_og,target_fg,is_public,rating,updated_at").order("brew_date", { ascending: false, nullsFirst: true })
    ]);
    if (error) { main.innerHTML = `<div class="msg err">Fout bij ophalen: ${esc(error.message)}</div>`; return; }
    if (!me || me.length === 0) {
      main.innerHTML = `<div class="card login"><h1>Geen toegang</h1><p>Je bent ingelogd als <b>${esc(session.user.email)}</b>, maar dit adres staat (nog) niet op de ledenlijst.</p><p class="hint">Vraag een van de mannen om je e-mailadres toe te voegen aan de tabel <code>members</code> in Supabase.</p></div>`;
      return;
    }
    cacheList = data || [];
    main.innerHTML = `
      <div class="row" style="margin-bottom:6px"><h1 style="margin:0">Brouwlog</h1><span class="spacer"></span>
        <a class="btn" href="#/nieuw">＋ Nieuw brouwsel</a></div>
      <p class="hint" style="margin-top:0">${cacheList.length} brouwsel${cacheList.length === 1 ? "" : "s"} · alles wat we ooit (bijna) goed deden</p>
      <div class="toolbar">
        <input id="q" placeholder="Zoek op naam, stijl of batch…">
        <select id="st" style="max-width:180px"><option value="">Alle statussen</option>${STATUSES.map((s) => `<option>${s}</option>`).join("")}</select>
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
      <div class="stats">
        <span class="stat">OG <b>${fmtSG(b.og)}</b></span>
        <span class="stat">FG <b>${fmtSG(b.fg)}</b></span>
        <span class="stat">ABV <b>${a ? fmt1(a) + "%" : "–"}</b></span>
      </div></a>`;
  }

  /* ---------- Brouwsel detail / bewerken ---------- */
  const EMPTY = {
    name: "", style: "", batch_no: "", status: "gepland", brew_date: new Date().toISOString().slice(0, 10), bottle_date: null,
    volume_l: null, bottled_l: null, target_og: null, target_fg: null, target_abv: null, ibu: null, ebc: null, efficiency_pct: null,
    og: null, fg: null, pre_boil_sg: null, mash_ph: null, ferment_temp_c: null, priming_g_per_l: null,
    fermentables: [], hops: [], yeast: "", others: [], mash_schedule: "", water_notes: "", process_notes: "",
    tasting_notes: "", rating: null, is_public: false, public_description: ""
  };
  const SG_FIELDS = ["target_og", "target_fg", "og", "fg", "pre_boil_sg"];
  const NUM_FIELDS = ["volume_l", "bottled_l", "target_abv", "ibu", "ebc", "efficiency_pct", "mash_ph", "ferment_temp_c", "priming_g_per_l"];

  let brew = null, measurements = [], activeTab = "basis";

  async function viewBrew(id) {
    dirty = false;
    if (id) {
      main.innerHTML = `<div class="empty">Brouwsel ophalen…</div>`;
      const [{ data, error }, m] = await Promise.all([
        sb.from("brews").select("*").eq("id", id).maybeSingle(),
        sb.from("measurements").select("*").eq("brew_id", id).order("measured_at")
      ]);
      if (error || !data) { main.innerHTML = `<div class="msg err">Brouwsel niet gevonden. <a href="#/">Terug</a></div>`; return; }
      brew = data; measurements = m.data || [];
    } else {
      brew = JSON.parse(JSON.stringify(EMPTY)); measurements = [];
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
            </div>
          </div>
          <div class="card">
            <h2>Gemeten</h2>
            <div class="grid g2">
              ${inp("og", "Begin-SG (OG)", { ph: "1.074" })}
              ${inp("fg", "Eind-SG (FG)", { ph: "1.009" })}
              ${inp("pre_boil_sg", "SG voor koken", { ph: "1.062" })}
              ${inp("mash_ph", "pH maisch", { ph: "5.3" })}
              ${inp("volume_l", "Volume vergister (L)", { ph: "23" })}
              ${inp("bottled_l", "Gebotteld (L)", { ph: "20" })}
              ${inp("ferment_temp_c", "Vergistingstemp. °C", { ph: "20" })}
              ${inp("priming_g_per_l", "Bottelsuiker g/L", { ph: "7" })}
            </div>
            <p class="hint">Tip: SG mag je ook als <b>1074</b> of <b>74</b> typen.</p>
          </div>
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
            <div class="field" style="grid-column:1/-2"><label>Opmerking</label><input id="m_note" type="text" placeholder="Krausen ingezakt, ruikt naar banaan…"></div>
            <div class="field"><button class="btn" style="width:100%;justify-content:center">＋ Meting</button></div>
          </form>
          <div id="mlist"></div>
          <div id="chart"></div>`}
        </div>
      </div>

      <div class="pane" data-p="proeven">
        <div class="card">
          <h2>Proefnotities</h2>
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
        <button class="btn" id="save">💾 Opslaan</button>
        <span id="saveMsg" class="hint"></span>
        <span class="spacer"></span>
        ${isNew ? "" : `<button class="btn small ghost" id="dup" style="color:var(--red)">Kopie als nieuwe batch</button><button class="btn small danger" id="del">Verwijderen</button>`}
      </div></div>`;

    // tabs
    const showTab = (t) => { activeTab = t; $$("#tabs button").forEach((b) => b.classList.toggle("on", b.dataset.t === t)); $$(".pane").forEach((p) => p.classList.toggle("on", p.dataset.p === t)); };
    $$("#tabs button").forEach((b) => (b.onclick = () => showTab(b.dataset.t)));
    showTab(activeTab);

    // velden binden
    $$("[data-k]", main).forEach((el) => {
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
    $$("#rating button").forEach((b) => (b.onclick = () => {
      const r = Number(b.dataset.r); brew.rating = brew.rating === r ? null : r;
      $$("#rating button").forEach((x) => x.classList.toggle("on", brew.rating >= Number(x.dataset.r))); markDirty();
    }));

    rowsEditor("fermentables", [
      { k: "name", l: "Mout / suiker", ph: "Pilsmout", w: "50%" },
      { k: "kg", l: "kg", ph: "5.5", n: true },
      { k: "ebc", l: "EBC", ph: "3.5", n: true }
    ], (rows) => { const t = rows.reduce((s, r) => s + (num(r.kg) || 0), 0); return t ? `Totaal: <b>${fmt1(t)} kg</b>` : ""; });
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

  function markDirty() { dirty = true; const m = $("#saveMsg"); if (m) m.textContent = "Niet-opgeslagen wijzigingen"; }

  function rowsEditor(key, cols, footer) {
    const host = $("#ed_" + key);
    if (!Array.isArray(brew[key])) brew[key] = [];
    const draw = () => {
      const rows = brew[key];
      host.innerHTML = `<div class="tablewrap"><table class="list"><thead><tr>${cols.map((c) => `<th style="${c.w ? `width:${c.w}` : ""}">${c.l}</th>`).join("")}<th></th></tr></thead><tbody>
        ${rows.map((r, i) => `<tr>${cols.map((c) => `<td>${c.opts
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
    const p = payload();
    const q = brew.id ? sb.from("brews").update(p).eq("id", brew.id).select().single() : sb.from("brews").insert(p).select().single();
    const { data, error } = await q;
    btn.disabled = false;
    if (error) { $("#saveMsg").innerHTML = `<span style="color:#a33">Fout: ${esc(error.message)}</span>`; return; }
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
      is_public: false, status: "gepland", brew_date: new Date().toISOString().slice(0, 10), batch_no: "" });
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
    if (row.sg === null && row.temp_c === null && row.ph === null && !row.note) return;
    const { data, error } = await sb.from("measurements").insert(row).select().single();
    if (error) return alert(error.message);
    measurements.push(data); measurements.sort((a, b) => new Date(a.measured_at) - new Date(b.measured_at));
    // eerste SG-meting = OG als die nog leeg is
    if (!brew.og && data.sg && measurements.filter((m) => m.sg).length === 1) {
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
    const og = brew.og || (measurements.find((m) => m.sg) || {}).sg;
    host.innerHTML = `<div class="tablewrap"><table class="list"><thead><tr><th>Wanneer</th><th>SG</th><th>°P</th><th>ABV</th><th>°C</th><th>pH</th><th>Opmerking</th><th></th></tr></thead><tbody>
      ${measurements.map((m) => `<tr><td>${fmtDateTime(m.measured_at)}</td><td><b>${fmtSG(m.sg)}</b></td><td>${m.sg ? fmt1(plato(m.sg)) : ""}</td>
        <td>${og && m.sg ? fmt1(abv(og, m.sg)) + "%" : ""}</td><td>${m.temp_c ?? ""}</td><td>${m.ph ?? ""}</td><td>${esc(m.note || "")}</td>
        <td><button class="x" data-mdel="${m.id}" title="Verwijderen">×</button></td></tr>`).join("")}
      </tbody></table></div>`;
    $$("[data-mdel]", host).forEach((b) => (b.onclick = () => delMeasurement(b.dataset.mdel)));
    $("#chart").innerHTML = chart();
  }
  function chart() {
    const pts = measurements.filter((m) => m.sg).map((m) => ({ t: new Date(m.measured_at).getTime(), v: Number(m.sg), c: m.temp_c }));
    if (pts.length < 2) return "";
    const W = 720, H = 260, L = 56, R = 16, T = 16, B = 34;
    const t0 = pts[0].t, t1 = pts[pts.length - 1].t || t0 + 1;
    const vals = pts.map((p) => p.v).concat(brew.target_fg ? [Number(brew.target_fg)] : []);
    let vmin = Math.min(...vals) - 0.003, vmax = Math.max(...vals) + 0.003;
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
    const path = pts.map((p, i) => `${i ? "L" : "M"}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
    const area = `${path} L${x(pts[pts.length - 1].t)},${H - B} L${x(t0)},${H - B} Z`;
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="SG-verloop">
      <defs><linearGradient id="g" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#e0a63a" stop-opacity=".35"/><stop offset="1" stop-color="#e0a63a" stop-opacity="0"/></linearGradient></defs>
      ${grid}${tgt}<path d="${area}" fill="url(#g)"/><path d="${path}" fill="none" stroke="#7d1d1d" stroke-width="2.5"/>
      ${pts.map((p) => `<circle cx="${x(p.t)}" cy="${y(p.v)}" r="4" fill="#fff" stroke="#7d1d1d" stroke-width="2"><title>${fmtSG(p.v)}${p.c != null ? " · " + p.c + " °C" : ""}</title></circle>`).join("")}
    </svg>`;
  }
})();
