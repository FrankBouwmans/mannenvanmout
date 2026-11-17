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
  supabaseUrl: "",          // bijv. "https://abcdefgh.supabase.co"
  supabaseAnonKey: "",      // bijv. "eyJhbGciOi..." of "sb_publishable_..."

  /* --- 2. De brouwers ----------------------------------------------------
     Volgorde = volgorde op het etiket (van links naar rechts).
     Vul de namen in en pas de rollen/teksten gerust aan. */
  brewers: [
    {
      name: "Marco K",
      role: "De Receptengoeroe",
      photo: "assets/brouwer1.jpg",
      quote: "Heeft voor elk bier een spreadsheet. En voor elke spreadsheet een bier."
    },
    {
      name: "Tom K",
      role: "De Roerganger",
      photo: "assets/brouwer2.jpg",
      quote: "Niemand roert de maisch zoals hij. Zegt hij zelf."
    },
    {
      name: "Marco S",
      role: "De Kwaliteitscontroleur",
      photo: "assets/brouwer3.jpg",
      quote: "Proeft elke batch. Meerdere keren. Voor de zekerheid."
    },
    {
      name: "Frank B",
      role: "De Hopfluisteraar",
      photo: "assets/brouwer4.jpg",
      quote: "Ruikt één keer aan een hopbel en noemt het alfazuur. Zegt hij."
    }
  ],

  /* --- 3. Vaste bieren op de homepage ------------------------------------
     Deze staan er altijd. Bieren die je in het inloggedeelte op
     "publiek tonen" zet, komen er automatisch bij. */
  featuredBeers: [
    {
      name: "Moutmakkers Blond",
      style: "Klassiek Belgisch blond",
      abv: 6.9,
      image: "assets/fles-blond.jpg",
      description: "Fris en rond, goudblond van kleur en zacht moutig. Vol van smaak en gevaarlijk doordrinkbaar."
    },
    {
      name: "Gouden Broeder Tripel",
      style: "Belgische tripel",
      abv: null,             // vul in zodra gemeten, bijv. 8.5
      image: "assets/etiket-tripel.jpg",
      description: "Een karaktervolle tripel, goud van kleur. Volmoutig, kruidig en met een verfijnde bitterheid."
    }
  ]
};
