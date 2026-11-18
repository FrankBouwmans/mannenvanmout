/* Leeftijdscheck: één keer per bezoeker (browser onthoudt "ja") */
(function () {
  const KEY = "mvm-18plus";
  try { if (localStorage.getItem(KEY) === "ja") return; } catch (e) { /* geen opslag: gewoon vragen */ }

  const el = document.createElement("div");
  el.className = "leeftijd";
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-modal", "true");
  el.setAttribute("aria-labelledby", "leeftijd-titel");
  const vraag = `
    <img src="/assets/hop.svg" alt="">
    <h2 id="leeftijd-titel">Ho, even checken!</h2>
    <p>Ben je 18 jaar of ouder?</p>
    <div class="knoppen">
      <button type="button" class="btn" data-ja>Ja, schenk maar in</button>
      <button type="button" class="btn ghost" data-nee>Nee, ik kom voor de limonade</button>
    </div>`;
  const limonade = `
    <img src="/assets/hop.svg" alt="">
    <h2 id="leeftijd-titel">Helemaal goed!</h2>
    <p>Kom over een paar jaar terug, dan staat er een glas voor je klaar. Tot die tijd: limonade. Met prik, dat dan weer wel.</p>
    <div class="knoppen"><button type="button" class="btn ghost" data-terug>Oeps, verkeerde knop</button></div>`;
  const voet = `<p class="klein">Geniet, maar drink met mate · <b>NIX18</b></p>`;
  const box = document.createElement("div");
  box.className = "leeftijd-box";
  el.appendChild(box);

  function toon(html) {
    box.innerHTML = html + voet;
    const ja = box.querySelector("[data-ja]"), nee = box.querySelector("[data-nee]"), terug = box.querySelector("[data-terug]");
    if (ja) ja.onclick = () => {
      try { localStorage.setItem(KEY, "ja"); } catch (e) {}
      el.remove(); document.body.classList.remove("dicht");
    };
    if (nee) nee.onclick = () => toon(limonade);
    if (terug) terug.onclick = () => toon(vraag);
    const first = box.querySelector("button"); if (first) first.focus();
  }
  document.body.appendChild(el);
  document.body.classList.add("dicht");
  toon(vraag);
})();
