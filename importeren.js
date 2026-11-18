/* =====================================================================
   Importeren uit Grainfather (BeerXML)
   Levert brouwsels in het formaat van de tabel "brews".
   ===================================================================== */
(function (root) {
  "use strict";

  const n = (v) => {
    if (v === null || v === undefined) return null;
    const x = parseFloat(String(v).replace(",", "."));
    return isFinite(x) ? x : null;
  };
  const r = (v, d = 1) => (v === null || v === undefined ? null : Math.round(v * 10 ** d) / 10 ** d);
  const sg = (v) => {
    let x = n(v);
    if (x === null || x <= 0) return null;
    if (x > 2) x = x >= 900 ? x / 1000 : 1 + x / 1000;
    return x >= 0.95 && x <= 1.2 ? Math.round(x * 1000) / 1000 : null;
  };
  // Lovibond → EBC (via SRM)
  const lovibondToEbc = (l) => (l === null ? null : r(Math.max(0, 1.3546 * l - 0.76) * 1.97, 1));
  const srmToEbc = (s) => (s === null ? null : r(s * 1.97, 1));

  const HOP_USE = (u, isDays) => {
    const s = String(u || "").toLowerCase();
    if (s.includes("dry")) return "Dryhop";
    if (s.includes("first")) return "First wort";
    if (s.includes("mash")) return "Maischen";
    if (s.includes("aroma") || s.includes("whirl") || s.includes("hop stand") || s.includes("flameout")) return "Whirlpool";
    if (isDays) return "Dryhop";
    return "Koken";
  };


  /* ---------------- BeerXML ---------------- */
  function parseBeerXML(text) {
    // Sommige exports (o.a. Grainfather) bevatten losse & tekens: repareren
    const clean = String(text).replace(/&(?!(amp|lt|gt|quot|apos|#\d+|#x[0-9a-f]+);)/gi, "&amp;");
    const doc = new DOMParser().parseFromString(clean, "application/xml");
    if (doc.getElementsByTagName("parsererror").length) throw new Error("Dit lijkt geen geldig BeerXML-bestand.");
    const kids = (el, tag) => Array.from(el.children).filter((c) => c.tagName.toUpperCase() === tag);
    const val = (el, tag) => { const c = el && kids(el, tag)[0]; return c ? c.textContent.trim() : null; };
    const list = (el, group, item) => { const g = kids(el, group)[0]; return g ? kids(g, item) : []; };

    const recipes = Array.from(doc.getElementsByTagName("*")).filter((e) => e.tagName.toUpperCase() === "RECIPE");
    if (!recipes.length) throw new Error("Geen recepten gevonden in dit bestand.");

    return recipes.map((rec) => {
      const style = kids(rec, "STYLE")[0];
      const ferm = list(rec, "FERMENTABLES", "FERMENTABLE");
      const fermentables = [], others = [];
      ferm.forEach((f) => {
        const type = String(val(f, "TYPE") || "").toLowerCase();
        const row = { name: val(f, "NAME") || "", kg: r(n(val(f, "AMOUNT")), 3), ebc: lovibondToEbc(n(val(f, "COLOR"))) };
        if (val(f, "ADD_AFTER_BOIL") === "TRUE" && type.includes("sugar")) others.push({ name: row.name, amount: `${r(row.kg * 1000, 0)} g`, use: "Na het koken" });
        else fermentables.push(row);
      });
      const hops = list(rec, "HOPS", "HOP").map((h) => {
        const use = val(h, "USE");
        let time = n(val(h, "TIME"));
        const dry = String(use || "").toLowerCase().includes("dry");
        if (dry && time !== null && time >= 1440) time = r(time / 1440, 1); // minuten → dagen
        return { name: val(h, "NAME") || "", g: r((n(val(h, "AMOUNT")) || 0) * 1000, 1), alpha: r(n(val(h, "ALPHA")), 1), use: HOP_USE(use), min: time };
      });
      const yeasts = list(rec, "YEASTS", "YEAST").map((y) => [val(y, "LABORATORY"), val(y, "NAME"), val(y, "PRODUCT_ID") ? `(${val(y, "PRODUCT_ID")})` : ""].filter(Boolean).join(" ").trim());
      list(rec, "MISCS", "MISC").forEach((m) => {
        const amt = n(val(m, "AMOUNT"));
        const weight = String(val(m, "AMOUNT_IS_WEIGHT") || "").toUpperCase() === "TRUE";
        const amount = amt === null ? "" : weight ? `${r(amt * 1000, 1)} g` : `${r(amt * 1000, 0)} ml`;
        const t = n(val(m, "TIME"));
        others.push({ name: val(m, "NAME") || "", amount, use: [val(m, "USE"), t ? `${t} min` : ""].filter(Boolean).join(", ") });
      });
      const mash = kids(rec, "MASH")[0];
      const mashSteps = mash ? list(mash, "MASH_STEPS", "MASH_STEP").map((s) => `${val(s, "NAME") || "Stap"}: ${r(n(val(s, "STEP_TEMP")), 1)} °C – ${r(n(val(s, "STEP_TIME")), 0)} min`) : [];

      const og = sg(val(rec, "OG")) || sg(val(rec, "EST_OG"));
      const fg = sg(val(rec, "FG")) || sg(val(rec, "EST_FG"));
      const estColor = n(val(rec, "EST_COLOR"));
      const notes = [val(rec, "NOTES"), val(rec, "TASTE_NOTES") ? `Smaak: ${val(rec, "TASTE_NOTES")}` : null].filter(Boolean).join("\n\n");

      return {
        brew: {
          name: val(rec, "NAME") || "Geïmporteerd recept",
          style: style ? val(style, "NAME") : null,
          status: "gepland",
          volume_l: r(n(val(rec, "BATCH_SIZE")), 1),
          target_og: og, target_fg: fg,
          target_abv: r(n(val(rec, "EST_ABV")) || n(val(rec, "ABV")) || (og && fg ? (og - fg) * 131.25 : null), 1),
          ibu: r(n(val(rec, "IBU")) || n(val(rec, "EST_IBU")), 1),
          ebc: estColor !== null ? srmToEbc(estColor) : null,
          efficiency_pct: r(n(val(rec, "EFFICIENCY")), 1),
          fermentables, hops, others,
          yeast: yeasts.join(" + ") || null,
          mash_schedule: mashSteps.join("\n") || null,
          process_notes: notes || null
        },
        measurements: []
      };
    });
  }

  function parseFile(text, filename) {
    return parseBeerXML(String(text).trim());
  }

  root.MVM_IMPORT = { parseFile, parseBeerXML };
})(typeof window !== "undefined" ? window : globalThis);
