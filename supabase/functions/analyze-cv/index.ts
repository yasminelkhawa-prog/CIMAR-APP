import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const AI_REQUEST_TIMEOUT_MS = 60_000;
const MAX_AI_ATTEMPTS = 2;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { cvTexts, sessionId, targetPositions } = await req.json();

    if (!cvTexts || !Array.isArray(cvTexts) || cvTexts.length === 0) {
      return new Response(JSON.stringify({ error: "cvTexts array is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!targetPositions || !Array.isArray(targetPositions) || targetPositions.length === 0) {
      return new Response(JSON.stringify({ error: "targetPositions array is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const positionsList = targetPositions.join(", ");

    const SYSTEM_PROMPT = `Tu es un expert RH spécialisé dans l'analyse de CV. Postes recherchés: ${positionsList}.

IMPORTANT - Le texte du CV peut contenir des erreurs OCR (0 vs O, 1 vs I/l, etc.). Corrige intelligemment.

Pour chaque CV:
1. Détermine le poste le plus adapté UNIQUEMENT parmi: ${positionsList}. Sinon utilise "Non pertinent".
2. Score de matching sur 100.
3. 3 compétences clés.
4. Synthèse de 20 mots max.
5. Détails: prénom, nom, email, téléphone, région, établissement, formation, poste actuel, entreprise, date début, années d'expérience.

Réponds UNIQUEMENT en JSON, sans texte autour.`;

    // Analyze a single CV with retries
    const analyzeOne = async (cv: { text: string; filePath: string }, attempt = 1): Promise<any | null> => {
      const { text, filePath } = cv;
      const userPrompt = `Analyse ce CV pour: ${positionsList}.

Retourne UNIQUEMENT un JSON:
{
  "nom_candidat": "Prénom Nom",
  "email": "email@exemple.com",
  "poste_assigne": "un des postes ou Non pertinent",
  "matching_score": 85,
  "competences_cles": ["C1", "C2", "C3"],
  "synthese_ia": "Texte court",
  "candidate_details": {
    "prenom": "", "nom": "", "region": "", "etablissement_formation": "",
    "formation": "", "poste_actuel": "", "entreprise_actuelle": "",
    "date_debut_poste": "", "annees_experience": "", "telephone": ""
  }
}

Si info absente, mets "".

CV:
${text.substring(0, 8000)}`;

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), AI_REQUEST_TIMEOUT_MS);

        const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          signal: controller.signal,
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              { role: "user", content: userPrompt },
            ],
          }),
        });
        clearTimeout(timeout);

        if (response.status === 429 || response.status === 503 || response.status === 408 || response.status === 504 || response.status === 524) {
          if (attempt < MAX_AI_ATTEMPTS) {
            await sleep(2000 * attempt);
            return analyzeOne(cv, attempt + 1);
          }
          console.error(`Rate-limited after retries: ${filePath}`);
          return null;
        }

        if (!response.ok) {
          const body = await response.text().catch(() => "");
          console.error(`AI HTTP ${response.status} for ${filePath}: ${body.substring(0, 200)}`);
          if (attempt < MAX_AI_ATTEMPTS && response.status >= 500) {
            await sleep(1500 * attempt);
            return analyzeOne(cv, attempt + 1);
          }
          return null;
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || "";
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          console.error(`No JSON in AI response for ${filePath}`);
          if (attempt < MAX_AI_ATTEMPTS) return analyzeOne(cv, attempt + 1);
          return null;
        }

        let parsed: any;
        try {
          parsed = JSON.parse(jsonMatch[0]);
        } catch {
          console.error(`JSON parse failed for ${filePath}`);
          if (attempt < MAX_AI_ATTEMPTS) return analyzeOne(cv, attempt + 1);
          return null;
        }

        const record = {
          session_id: sessionId,
          nom_candidat: parsed.nom_candidat || "Inconnu",
          email: parsed.email || "",
          poste_assigne: parsed.poste_assigne || "Non pertinent",
          matching_score: Math.min(100, Math.max(0, parsed.matching_score || 0)),
          competences_cles: parsed.competences_cles || [],
          synthese_ia: parsed.synthese_ia || "",
          cv_file_path: filePath || "",
          cv_raw_text: text.substring(0, 5000),
          candidate_details: parsed.candidate_details || {},
        };

        const { data: inserted, error } = await supabase
          .from("cv_analyses").insert(record).select().single();
        if (error) {
          console.error(`DB insert error for ${filePath}:`, error.message);
          return null;
        }
        return inserted;
      } catch (e: any) {
        console.error(`Error analyzing ${filePath} (attempt ${attempt}):`, e?.message || e);
        if (attempt < MAX_AI_ATTEMPTS) {
          await sleep(2000 * attempt);
          return analyzeOne(cv, attempt + 1);
        }
        return null;
      }
    };

    const results: any[] = [];
    const failed: string[] = [];

    // Smaller batches for stability — 3 concurrent calls
    const BATCH_SIZE = 3;
    for (let i = 0; i < cvTexts.length; i += BATCH_SIZE) {
      const batch = cvTexts.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(batch.map((cv) => analyzeOne(cv)));
      batchResults.forEach((r, idx) => {
        if (r) results.push(r);
        else failed.push(batch[idx].filePath);
      });
      // Small delay between batches to avoid rate limits
      if (i + BATCH_SIZE < cvTexts.length) await sleep(500);
    }

    console.log(`Analyzed ${results.length}/${cvTexts.length} CVs. Failed: ${failed.length}`);

    return new Response(
      JSON.stringify({ results, sessionId, total: cvTexts.length, failed }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("analyze-cv error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
