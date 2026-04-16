import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { cvTexts, sessionId, targetPositions } = await req.json();

    if (!cvTexts || !Array.isArray(cvTexts) || cvTexts.length === 0) {
      return new Response(JSON.stringify({ error: "cvTexts array is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!targetPositions || !Array.isArray(targetPositions) || targetPositions.length === 0) {
      return new Response(JSON.stringify({ error: "targetPositions array is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const positionsList = targetPositions.join(", ");

    const SYSTEM_PROMPT = `Tu es un expert RH spécialisé dans l'analyse de CV. On recrute pour les postes suivants: ${positionsList}.

Pour chaque CV, tu dois:
1. Déterminer le poste le plus adapté UNIQUEMENT parmi: ${positionsList}. Si le candidat ne correspond à aucun de ces postes, utilise "Non pertinent".
2. Donner un score de matching sur 100 basé sur l'adéquation du profil avec le poste assigné
3. Lister les 3 compétences clés (hard skills)
4. Rédiger une synthèse de 20 mots max expliquant pourquoi ce candidat est pertinent pour ce poste
5. Extraire les informations détaillées du candidat: prénom, nom, email, téléphone, région/ville, établissement de formation, intitulé de formation, poste actuel, entreprise actuelle, date de début du poste actuel, nombre d'années d'expérience totale

Tu dois répondre UNIQUEMENT avec le JSON demandé, sans aucun texte autour.`;

    const results = [];

    for (const cv of cvTexts) {
      const { text, filePath } = cv;

      const userPrompt = `Analyse ce CV et classe-le pour l'un des postes suivants: ${positionsList}.

Retourne UNIQUEMENT un JSON avec ce format exact:
{
  "nom_candidat": "Prénom Nom",
  "email": "email@exemple.com",
  "poste_assigne": "un des postes listés ou Non pertinent",
  "matching_score": 85,
  "competences_cles": ["Compétence 1", "Compétence 2", "Compétence 3"],
  "synthese_ia": "Texte court ici",
  "candidate_details": {
    "prenom": "Prénom",
    "nom": "Nom",
    "region": "Ville ou région",
    "etablissement_formation": "Nom de l'école ou université",
    "formation": "Intitulé du diplôme/formation",
    "poste_actuel": "Intitulé du poste actuel",
    "entreprise_actuelle": "Nom de l'entreprise actuelle",
    "date_debut_poste": "MM/AAAA ou année",
    "annees_experience": "X ans",
    "telephone": "+212..."
  }
}

Si une information n'est pas trouvée dans le CV, laisse une chaîne vide "".

Contenu du CV:
${text}`;

      try {
        const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              { role: "user", content: userPrompt },
            ],
          }),
        });

        if (response.status === 429) {
          return new Response(JSON.stringify({ error: "Rate limits exceeded, please try again later.", partial_results: results }), {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (response.status === 402) {
          return new Response(JSON.stringify({ error: "Payment required, please add funds." }), {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        if (!response.ok) {
          console.error("AI error for CV:", filePath, await response.text());
          continue;
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || "";

        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          console.error("No JSON found in AI response for:", filePath);
          continue;
        }

        const parsed = JSON.parse(jsonMatch[0]);

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

        const { data: inserted, error } = await supabase.from("cv_analyses").insert(record).select().single();
        if (error) {
          console.error("DB insert error:", error);
        } else {
          results.push(inserted);
        }

        await new Promise(r => setTimeout(r, 500));
      } catch (e) {
        console.error("Error analyzing CV:", filePath, e);
      }
    }

    return new Response(JSON.stringify({ results, sessionId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-cv error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
