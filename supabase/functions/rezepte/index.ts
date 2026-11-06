// Edge Function "rezepte": einzige Schnittstelle der App zur Datenbank.
// Schutz: gemeinsamer Familien-Zugangscode im Header "x-family-code"
// (Secret FAMILY_CODE). Deploy mit --no-verify-jwt.
import { createClient } from "npm:@supabase/supabase-js@2";

const db = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);
const FAMILY_CODE = Deno.env.get("FAMILY_CODE") ?? "";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-family-code",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

function safeEqual(a: string, b: string) {
  if (!b || a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

// ---------- Import aus Webseiten mit schema.org/Recipe (JSON-LD) ----------

function decode(s: string) {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// deno-lint-ignore no-explicit-any
function findRecipe(node: any): any | null {
  if (!node) return null;
  if (Array.isArray(node)) {
    for (const n of node) {
      const r = findRecipe(n);
      if (r) return r;
    }
    return null;
  }
  if (typeof node !== "object") return null;
  const t = node["@type"];
  if (t === "Recipe" || (Array.isArray(t) && t.includes("Recipe"))) return node;
  if (node["@graph"]) return findRecipe(node["@graph"]);
  return null;
}

// deno-lint-ignore no-explicit-any
function flattenSteps(x: any): string[] {
  if (!x) return [];
  if (typeof x === "string") return [decode(x)].filter(Boolean);
  if (Array.isArray(x)) return x.flatMap(flattenSteps);
  if (x.itemListElement) return flattenSteps(x.itemListElement);
  if (x.text) return [decode(String(x.text))].filter(Boolean);
  if (x.name) return [decode(String(x.name))].filter(Boolean);
  return [];
}

// deno-lint-ignore no-explicit-any
function firstImage(x: any): string {
  if (!x) return "";
  if (typeof x === "string") return x;
  if (Array.isArray(x)) return firstImage(x[0]);
  return typeof x.url === "string" ? x.url : "";
}

function isPublicHttps(u: URL) {
  if (u.protocol !== "https:") return false;
  const h = u.hostname;
  if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal")) return false;
  if (/^[\d.]+$/.test(h) || h.includes(":")) return false;
  return true;
}

async function importRecipe(urlStr: string) {
  let u: URL;
  try {
    u = new URL(urlStr);
  } catch {
    throw new Error("Das ist kein gültiger Link.");
  }
  if (!isPublicHttps(u)) throw new Error("Bitte einen öffentlichen https-Link angeben.");

  const res = await fetch(u, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; FamilienRezepte/1.0)",
      "Accept-Language": "de-DE,de;q=0.9",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Die Seite antwortet mit Fehler ${res.status}.`);
  const html = await res.text();

  const blocks = [
    ...html.matchAll(
      /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
    ),
  ].map((m) => m[1]);

  let r = null;
  for (const b of blocks) {
    try {
      r = findRecipe(JSON.parse(b.trim()));
      if (r) break;
    } catch { /* nächster Block */ }
  }
  if (!r) throw new Error("Auf dieser Seite habe ich kein Rezept gefunden.");

  const yieldRaw = Array.isArray(r.recipeYield) ? r.recipeYield[0] : r.recipeYield;
  const servings = Math.min(100, Math.max(1, parseInt(String(yieldRaw ?? "").match(/\d+/)?.[0] ?? "4", 10)));
  const kw = typeof r.keywords === "string" ? r.keywords.split(",") : (r.keywords ?? []);
  const tags = (Array.isArray(kw) ? kw : []).map((k: string) => decode(String(k))).filter(Boolean).slice(0, 8);

  return {
    title: decode(String(r.name ?? "Ohne Titel")).slice(0, 200),
    source_url: u.toString(),
    image_url: firstImage(r.image),
    servings,
    ingredients: (r.recipeIngredient ?? []).map((i: string) => decode(String(i))).filter(Boolean),
    steps: flattenSteps(r.recipeInstructions).join("\n\n"),
    tags,
    notes: "",
  };
}

// ---------- Eingaben prüfen ----------

// deno-lint-ignore no-explicit-any
function clean(input: any) {
  const str = (v: unknown, max: number) => String(v ?? "").slice(0, max);
  const arr = (v: unknown, n: number, max: number) =>
    (Array.isArray(v) ? v : []).map((x) => str(x, max).trim()).filter(Boolean).slice(0, n);
  const url = (v: unknown) => {
    const s = str(v, 1000).trim();
    return /^https:\/\//i.test(s) ? s : null;
  };
  const title = str(input.title, 200).trim();
  if (!title) throw new Error("Das Rezept braucht einen Titel.");
  return {
    title,
    source_url: url(input.source_url),
    image_url: url(input.image_url),
    servings: Math.min(100, Math.max(1, parseInt(String(input.servings), 10) || 4)),
    ingredients: arr(input.ingredients, 100, 200),
    steps: str(input.steps, 20000),
    tags: arr(input.tags, 12, 40),
    notes: str(input.notes, 5000),
  };
}

// ---------- Handler ----------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "Nur POST erlaubt." }, 405);

  if (!safeEqual(req.headers.get("x-family-code") ?? "", FAMILY_CODE)) {
    return json({ error: "Zugangscode falsch." }, 401);
  }

  try {
    const body = await req.json();
    switch (body.action) {
      case "list": {
        const { data, error } = await db
          .from("recipes").select("*").order("created_at", { ascending: false });
        if (error) throw error;
        return json({ recipes: data });
      }
      case "import": {
        return json({ recipe: await importRecipe(String(body.url ?? "")) });
      }
      case "save": {
        const fields = clean(body.recipe ?? {});
        if (body.recipe?.id) {
          const { data, error } = await db
            .from("recipes")
            .update({ ...fields, updated_at: new Date().toISOString() })
            .eq("id", body.recipe.id).select().single();
          if (error) throw error;
          return json({ recipe: data });
        }
        if (fields.source_url) {
          const { data: dup } = await db
            .from("recipes").select("*").eq("source_url", fields.source_url).maybeSingle();
          if (dup) return json({ recipe: dup, duplicate: true });
        }
        const { data, error } = await db.from("recipes").insert(fields).select().single();
        if (error) throw error;
        return json({ recipe: data });
      }
      case "delete": {
        const { error } = await db.from("recipes").delete().eq("id", String(body.id ?? ""));
        if (error) throw error;
        return json({ ok: true });
      }
      default:
        return json({ error: "Unbekannte Aktion." }, 400);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unbekannter Fehler.";
    return json({ error: msg }, 400);
  }
});
