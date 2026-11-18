/* Publieke site: brouwers + bierlijst */
(function () {
  const cfg = window.MVM_CONFIG || {};
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  document.getElementById("year").textContent = new Date().getFullYear();

  // logo: helemaal naar boven, zonder #-rommel in de adresbalk
  const top = document.getElementById("naarBoven");
  if (top) top.addEventListener("click", (e) => {
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: "smooth" });
    history.replaceState(null, "", location.pathname + location.search);
  });

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
    const ph = !b.image ? `<div class="ph">${hop}</div>`
      : b.labelFull
        ? `<button type="button" class="ph etiket" data-label="${esc(b.labelFull)}" data-name="${esc(b.name)}" aria-label="Bekijk het hele etiket van ${esc(b.name)}">
             <img src="${esc(b.image)}" alt="Etiket van ${esc(b.name)}" loading="lazy"><span class="zoom">Bekijk het hele etiket</span></button>`
        : `<div class="ph etiket"><img src="${esc(b.image)}" alt="Etiket van ${esc(b.name)}" loading="lazy"></div>`;
    return `<article class="beer">${ph}<div class="body">
      <h3>${esc(b.name)}</h3>
      <div class="meta">${abv}<span>${esc(b.style || "")}</span>${b.batch_no ? `<span>Batch ${esc(b.batch_no)}</span>` : ""}</div>
      ${b.description ? `<p>${esc(b.description)}</p>` : ""}
    </div></article>`;
  };
  const el = document.getElementById("beers");
  // etiket vergroten (voor- en achterkant)
  const box = document.createElement("dialog");
  box.className = "etiket-box";
  box.innerHTML = `<button type="button" class="sluit" aria-label="Sluiten">×</button><img alt=""><p></p>`;
  document.body.appendChild(box);
  box.addEventListener("click", (e) => { if (e.target === box || e.target.classList.contains("sluit")) box.close(); });
  el.addEventListener("click", (e) => {
    const t = e.target.closest("[data-label]"); if (!t) return;
    const img = box.querySelector("img");
    img.src = t.dataset.label; img.alt = "Voor- en achteretiket van " + t.dataset.name;
    box.querySelector("p").textContent = t.dataset.name;
    box.showModal();
  });
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
