# Grainfather & Brewfather koppelen

Alles hieronder zit achter de inlog van de brouwlog (**Brouwlog → ⇩ Importeren**).

## 1. Database uitbreiden (1 minuut, eenmalig)
Supabase → **SQL Editor** → *New query* → plak `supabase/migrations/002_integraties.sql` → **Run**.

Daarna werkt **importeren via een bestand** meteen:
- **Grainfather:** exporteer het recept als BeerXML (`.xml`).
- **Brewfather:** exporteer een recept of batch als BeerXML of *Brewfather JSON*. Een batch-JSON neemt ook gemeten OG/FG en de metingen mee.

## 2. Brewfather live (5 minuten, optioneel)
Hiermee haal je batches rechtstreeks op, inclusief alle metingen (ook van een iSpindel, Tilt of RAPT Pill). Met **↻ Sync met Brewfather** werk je een batch later bij.

1. **Brewfather-sleutel maken:** Brewfather → *Settings* → *API* → **Generate API key**. Vink alleen **Read Batches** en **Read Recipes** aan. Noteer de **User ID** en de **API key**. (Mogelijk heb je hiervoor Brewfather Premium nodig.)
2. **Functie plaatsen:** Supabase → **Edge Functions** → *Deploy a new function* → *Via Editor*.
   Naam: `brewfather`. Plak de inhoud van `supabase/functions/brewfather/index.ts` → **Deploy**. Laat *Verify JWT* aan.
3. **Sleutel opslaan:** Supabase → **Edge Functions** → **Secrets** → voeg toe:
   - `BF_USER_ID` = je Brewfather User ID
   - `BF_API_KEY` = je Brewfather API key
4. Brouwlog → **⇩ Importeren** → **Batches ophalen**.

De Brewfather-sleutel staat alleen in Supabase, niet in de website. De functie kan alleen lezen en werkt alleen voor ingelogde leden.

## Goed om te weten
- Grainfather heeft geen openbare koppeling (API). Daarom gaat dat via een BeerXML-bestand.
- Brewfather staat maximaal 500 verzoeken per uur toe. Dat is ruim voldoende.
- Hop bij *dryhop* wordt in dagen opgeslagen; overige hop in minuten.
- Kleuren (EBC) uit BeerXML worden omgerekend vanuit Lovibond/SRM; controleer ze na de eerste import even.
