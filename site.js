/* Publieke site: brouwers + bierlijst */
(function () {
  const cfg = window.MVM_CONFIG || {};
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  document.getElementById("year").textContent = new Date().getFullYear();

  // Brouwers
  document.getElementById("crew").innerHTML = (cfg.brewers || []).map((b) => `
    <article class="brewer">
      <img src="${esc(b.photo)}" alt="${esc(b.name)}" loading="lazy">
      <div class="role">${esc(b.role)}</div>
      <h3>${esc(b.name)}</h3>
      <p>“${esc(b.quote)}”</p>
    </article>`).join("");

  // Bieren
  const hop = `<img src="assets/hop.svg" alt="" style="width:70px;opacity:.7">`;
  const beerCard = (b) => {
    const abv = b.abv != null && b.abv !== "" ? `<b>${Number(b.abv).toFixed(1).replace(".", ",")}% vol</b>` : "";
    const ph = b.image ? `<div class="ph" style="background-image:url('${esc(b.image)}')"></div>` : `<div class="ph">${hop}</div>`;
    return `<article class="beer">${ph}<div class="body">
      <h3>${esc(b.name)}</h3>
      <div class="meta">${abv}<span>${esc(b.style || "")}</span>${b.batch_no ? `<span>Batch ${esc(b.batch_no)}</span>` : ""}</div>
      ${b.description ? `<p>${esc(b.description)}</p>` : ""}
    </div></article>`;
  };
  const el = document.getElementById("beers");
  const featured = cfg.featuredBeers || [];
  el.innerHTML = featured.map(beerCard).join("");

  // Extra bieren uit de brouwlog die op "publiek" staan
  if (cfg.supabaseUrl && cfg.supabaseAnonKey && window.supabase) {
    const sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
    sb.from("public_beers").select("*").order("brew_date", { ascending: false }).then(({ data, error }) => {
      if (error || !data) return;
      const byName = new Map(data.map((b) => [(b.name || "").toLowerCase(), b]));
      // vaste bieren aanvullen met gemeten waarden (bijv. ABV) uit de brouwlog
      const merged = featured.map((f) => {
        const db = byName.get(f.name.toLowerCase());
        return db ? { ...f, abv: f.abv ?? db.abv, batch_no: f.batch_no ?? db.batch_no } : f;
      });
      const known = new Set(featured.map((b) => b.name.toLowerCase()));
      const extra = data.filter((b) => !known.has((b.name || "").toLowerCase()));
      el.innerHTML = merged.concat(extra).map(beerCard).join("");
    });
  }
})();
