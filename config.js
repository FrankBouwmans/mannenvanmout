/* ==========================================================================
   MANNEN VAN MOUT – instellingen
   Dit is het enige bestand dat je hoeft aan te passen.
   ========================================================================== */

window.MVM_CONFIG = {

  /* --- 1. Supabase (login + database) ------------------------------------
     Te vinden in Supabase: Project Settings → API (of "Connect").
     De "anon / publishable" sleutel mag gewoon openbaar in de website staan;
     de beveiliging zit in de database-regels (schema.sql).
     Zolang deze leeg zijn werkt de publieke site gewoon, alleen het
     inloggedeelte niet. */
  // LET OP: verander je ooit van Supabase-project, pas dan ook het adres aan in de
  // "Content-Security-Policy"-regel bovenin index.html, quiz.html, 404.html en app.html.
  supabaseUrl: "https://eujyabceagfxvtxluzai.supabase.co",
  supabaseAnonKey: "sb_publishable_pTbWSeeaV-Y4YOVc6ESHdw_pBUVKply",      // bijv. "eyJhbGciOi..." of "sb_publishable_..."

  /* --- Ketels ------------------------------------------------------------
     Kies je per brouwsel in de brouwlog. Bij meerdere ketels registreer je
     de SG-waarden per ketel. */
  kettles: ["Brewmonk", "Grainfather"],

  /* --- 2. De brouwers ----------------------------------------------------
     Volgorde = volgorde op het etiket (van links naar rechts).
     Vul de namen in en pas de rollen/teksten gerust aan. */
  brewers: [
    {
      name: "Marco K",
      role: "De Roerganger",
      photo: "assets/brouwer1.jpg?v=2",
      quote: "Niemand roert de maisch zoals hij. Zegt hij zelf.",
      code: "A1",
      stats: [["Moutdraaier", 10], ["Roerkracht", 9], ["Technicus", 8]],   // [eigenschap, score 0-10]
      power: "Roert negentig minuten zonder één keer te klagen."
    },
    {
      name: "Tom K",
      role: "De Receptengoeroe",
      photo: "assets/brouwer2.jpg?v=2",
      quote: "Heeft voor elk bier een spreadsheet. En voor elke spreadsheet een bier.",
      code: "A2",
      stats: [["Brouwmeester", 10], ["Vergistexpert", 9], ["Meetkundige", 8]],   // [eigenschap, score 0-10]
      power: "Weet het alcoholpercentage al voordat de ketel aan staat."
    },
    {
      name: "Marco S",
      role: "De Kwaliteitscontroleur",
      photo: "assets/brouwer3.jpg?v=2",
      quote: "Proeft elke batch. Meerdere keren. Voor de zekerheid.",
      code: "A3",
      stats: [["Proefcapaciteit", 10], ["Afwegingexpert", 9], ["Neus", 8]],   // [eigenschap, score 0-10]
      power: "Keurt elk glas. Daarna nog een keer."
    },
    {
      name: "Frank B",
      role: "De Hopfluisteraar",
      photo: "assets/brouwer4.jpg?v=2",
      quote: "Ruikt één keer aan een hopbel en noemt het alfazuur. Zegt hij.",
      code: "A4",
      stats: [["Brouwervaring", 10], ["Hopsnuiver", 9], ["Verklaarder", 8]],   // [eigenschap, score 0-10]
      power: "Bracht de tweede ketel mee en verdubbelde zo de brouwerij."
    }
  ],

  /* --- 4. Quiz "Welke Moutman ben jij?" (quiz.html) ----------------------
     Bij elk antwoord staat "voor": de naam van de brouwer (precies zoals
     hierboven bij brewers) die een punt krijgt. Meerdere mag ook:
     voor: ["Marco S", "Frank B"]. De antwoorden worden op het scherm
     gehusseld; de brouwer met de meeste punten is de uitslag.
     "results" = de tekst bij de uitslag, per brouwer. */
  quiz: {
    results: {
      "Marco K": "Geen maisch zonder jouw spierkracht. Jij praat niet over brouwen, jij roert.",
      "Tom K": "Bij jou klopt alles tot op de derde decimaal. Jij hebt het recept al drie keer nagerekend voordat de rest wakker is.",
      "Marco S": "Geen bier verlaat de tuin zonder jouw goedkeuring. En die geef je pas na het tweede glas.",
      "Frank B": "Jij ruikt de hop al voordat de zak open is. Bij twijfel: meer hop."
    },
    questions: [
      { q: "Het is brouwdag. Wat doe jij als eerste?",
        a: [
          { t: "Mouwen opstropen en de roerspaan pakken", voor: "Marco K" },
          { t: "Het recept nog één keer narekenen", voor: "Tom K" },
          { t: "Alvast een glas klaarzetten, om te testen", voor: "Marco S" },
          { t: "Met je neus in de hopzak", voor: "Frank B" }
        ] },
      { q: "Wat is jouw favoriete gereedschap?",
        a: [
          { t: "De roerspaan", voor: "Marco K" },
          { t: "De Grainfather app", voor: "Tom K" },
          { t: "Het proefglas", voor: "Marco S" },
          { t: "De refractometer", voor: "Frank B" }
        ] },
      { q: "Er gaat iets mis tijdens het brouwen. Jij…",
        a: [
          { t: "…roert gewoon wat harder", voor: "Marco K" },
          { t: "…zoekt de oorzaak in de cijfers", voor: "Tom K" },
          { t: "…proeft of het nog te redden is", voor: "Marco S" },
          { t: "…analyseert en verzint een logisch klinkend verhaal", voor: "Frank B" }
        ] },
      { q: "Wat neem je mee naar een verjaardag?",
        a: [
          { t: "Spierpijn van de vorige brouwdag", voor: "Marco K" },
          { t: "Een eerlijke mening over het bier", voor: "Tom K" },
          { t: "Een uitgeprint recept", voor: "Marco S" },
          { t: "Een zakje hop, als cadeau", voor: "Frank B" }
        ] },
      { q: "Jouw ideale bier is…",
        a: [
          { t: "…eerlijk zwoegwerk", voor: "Marco K" },
          { t: "…precies zoals het recept zegt", voor: "Tom K" },
          { t: "…perfect in balans", voor: "Marco S" },
          { t: "…zo hoppig dat je ogen tranen", voor: "Frank B" }
        ] }
    ]
  },

  /* --- 3. Vaste bieren op de homepage ------------------------------------
     Deze staan er altijd. Bieren die je in het inloggedeelte op
     "publiek tonen" zet, komen er automatisch bij. */
  featuredBeers: [
    {
      name: "Moutmakkers Blond",
      style: "Klassiek Belgisch blond",
      abv: 6.9,
      image: "assets/etiket-blond.jpg",
      labelFull: "assets/etiket-blond-volledig.jpg",   // voor- en achteretiket (vergroten)
      description: "Fris en rond, goudblond van kleur en zacht moutig. Vol van smaak en gevaarlijk doordrinkbaar."
    },
    {
      name: "Gouden Broeder Tripel",
      style: "Belgische tripel",
      abv: null,             // vul in zodra gemeten, bijv. 8.5
      image: "assets/etiket-tripel-voor.jpg?v=2",
      labelFull: "assets/etiket-tripel-volledig.jpg?v=2",
      description: "Een karaktervolle tripel, goud van kleur. Volmoutig, kruidig en met een verfijnde bitterheid."
    }
  ]
};
