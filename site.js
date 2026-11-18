/* Publieke site: brouwers + bierlijst */
(function () {
  const cfg = window.MVM_CONFIG || {};
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  document.getElementById("year").textContent = new Date().getFullYear();

  // Brouwers: kwartetkaarten (klik = omdraaien)
  const crew = document.getElementById("crew");
  crew.innerHTML = (cfg.brewers || []).map((b, i) => `
    <button type="button" class="kaart" aria-pressed="false" aria-label="Kwartetkaart van ${esc(b.name)}, klik om om te draaien">
      <span class="kaart-in">
        <span class="kaart-voor">
          <span class="kaart-kop"><small>Mannen van Mout</small></span>
          <img src="${esc(b.photo)}" alt="" loading="lazy">
          <span class="role">${esc(b.role)}</span>
          <span class="naam">${esc(b.name)}</span>
          <span class="quote">“${esc(b.quote)}”</span>
          <span class="tip">Klik voor stats</span>
        </span>
        <span class="kaart-achter">
          <span class="kaart-kop"><small>${esc(b.name)}</small></span>
          ${(b.stats || []).map(([l, v]) => `
            <span class="kstat"><span class="kstat-l"><span>${esc(l)}</span><span>${Number(v)}/10</span></span>
            <span class="balk"><span style="width:${Math.max(0, Math.min(10, Number(v))) * 10}%"></span></span></span>`).join("")}
          ${b.power ? `<span class="kracht"><small>Superkracht</small>${esc(b.power)}</span>` : ""}
        </span>
      </span>
    </button>`).join("");
  crew.querySelectorAll(".kaart").forEach((k) => k.addEventListener("click", () => {
    const on = k.classList.toggle("om");
    k.setAttribute("aria-pressed", on ? "true" : "false");
  }));

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
