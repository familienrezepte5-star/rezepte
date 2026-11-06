# Familienrezepte: Einrichtung

Inhalt:
- `supabase/schema.sql`: Tabelle für die Rezepte
- `supabase/functions/rezepte/index.ts`: Schnittstelle mit Zugangscode und Chefkoch-Import
- `index.html` und `manifest.webmanifest`: die App

## 1. Supabase (privates Projekt)
1. Im privaten Supabase-Konto ein Projekt anlegen (Region Frankfurt).
2. SQL Editor: Inhalt von `schema.sql` einfügen und ausführen.
3. Edge Functions: neue Funktion `rezepte` anlegen, Inhalt von `index.ts` einfügen und deployen.
   In den Funktionseinstellungen "Verify JWT" ausschalten (der Zugangscode übernimmt den Schutz).
4. Edge Functions, Secrets: `FAMILY_CODE` mit dem gewünschten Zugangscode anlegen.
   Mindestens 8 Zeichen, nicht der Name eines Familienmitglieds.

## 2. App
1. In `index.html` oben die Zeile `const API = ...` auf die Adresse der Funktion setzen:
   `https://xmirwnrhcngrlnxhkfay.supabase.co/functions/v1/rezepte`
2. `index.html` und `manifest.webmanifest` bei einem statischen Hoster ablegen
   (z. B. Cloudflare Pages, GitHub Pages oder Netlify). Supabase selbst liefert keine Webseiten aus.
3. Adresse an die Familie schicken, auf dem Handy "Zum Home-Bildschirm" wählen, Zugangscode eingeben.

## Grenzen
- "Zu Bring" funktioniert für Rezepte mit Original-Link (Chefkoch usw.). Bring liest die Zutaten
  selbst von der Originalseite. Selbst geschriebene Rezepte lassen sich nur als Text kopieren.
- Jedes Rezept wird einzeln an Bring geschickt, gleiche Zutaten werden nicht zusammengerechnet.
- Der Zugangscode schützt die Rezepte, ersetzt aber keine Einzelkonten.
