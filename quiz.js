/* Quiz: Welke Moutman ben jij? Vragen staan in config.js onder "quiz". */
(function () {
  const cfg = window.MVM_CONFIG || {};
  const brewers = cfg.brewers || [];
  const quiz = cfg.quiz || { questions: [], results: [] };
  const host = document.getElementById("quiz");
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  let step = 0, scores = brewers.map(() => 0);

  function vraag() {
    const q = quiz.questions[step];
    const pct = Math.round((step / quiz.questions.length) * 100);
    host.innerHTML = `
      <div class="quiz-voortgang"><span>Vraag ${step + 1} van ${quiz.questions.length}</span><span class="balk"><span style="width:${pct}%"></span></span></div>
      <h2>${esc(q.q)}</h2>
      <div class="antwoorden">${q.a.map((t, i) => `<button type="button" class="antwoord" data-i="${i}"><b>${"ABCD"[i]}</b><span>${esc(t)}</span></button>`).join("")}</div>`;
    host.querySelectorAll(".antwoord").forEach((b) => b.addEventListener("click", () => {
      const i = Number(b.dataset.i);
      if (i < scores.length) scores[i] += 1;
      step += 1;
      step < quiz.questions.length ? vraag() : uitslag();
    }));
    const first = host.querySelector(".antwoord"); if (first && step > 0) first.focus();
  }

  function uitslag() {
    let best = 0;
    scores.forEach((s, i) => { if (s > scores[best]) best = i; });
    const b = brewers[best] || {};
    const tekst = (quiz.results || [])[best] || b.quote || "";
    const deeltekst = `Ik ben ${b.name}, ${String(b.role || "").toLowerCase()}! Welke Moutman ben jij? https://mannenvanmout.nl/quiz.html`;
    host.innerHTML = `
      <div class="uitslag">
        <img src="${esc(b.photo)}" alt="Portret van ${esc(b.name)}">
        <div>
          <div class="kicker">Jij bent…</div>
          <div class="naam">${esc(b.name)}</div>
          <div class="role">${esc(b.role)}</div>
          <p>${esc(tekst)}</p>
          <div class="knoppen">
            <a class="btn" href="https://wa.me/?text=${encodeURIComponent(deeltekst)}" target="_blank" rel="noopener">Deel in de appgroep</a>
            <button type="button" class="btn ghost" id="opnieuw">Opnieuw</button>
            <a class="btn ghost" href="index.html#brouwers">Bekijk alle kaarten</a>
          </div>
        </div>
      </div>`;
    document.getElementById("opnieuw").onclick = () => { step = 0; scores = brewers.map(() => 0); vraag(); };
  }

  if (!quiz.questions.length || !brewers.length) { host.innerHTML = "<p>De quiz wordt nog gebrouwen. Kom later terug!</p>"; return; }
  vraag();
})();
