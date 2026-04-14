import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Tu es un expert en psychométrie et en évaluation de personnalité Big Five (OCEAN). Tu analyses les scores bruts OCEAN d'un candidat et tu fournis:

1. Un "Profil de Synthèse" — un nom archétypal en 3-4 mots (ex: "Le Pilier Opérationnel", "L'Innovateur Méthodique", "Le Leader Empathique")
2. Un résumé de personnalité en 2-3 phrases
3. Un Job Matching: analyse de l'adéquation entre le profil psychologique et le poste visé
4. 3 points forts comportementaux
5. 3 zones de vigilance comportementale

Réponds UNIQUEMENT en JSON avec ce format exact:
{
  "profile_name": "Le Pilier Opérationnel",
  "summary": "Description en 2-3 phrases...",
  "job_match": "Analyse d'adéquation au poste...",
  "strengths": ["Force 1", "Force 2", "Force 3"],
  "watch_areas": ["Vigilance 1", "Vigilance 2", "Vigilance 3"]
}`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { scores, candidate_name, job_role } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const prompt = `Analyse les scores OCEAN suivants pour ${candidate_name}, candidat au poste de ${job_role || 'non spécifié'}:

- Ouverture (O): ${scores.openness}%
- Conscienciosité (C): ${scores.conscientiousness}%
- Extraversion (E): ${scores.extraversion}%
- Agréabilité (A): ${scores.agreeableness}%
- Névrosisme (N): ${scores.neuroticism}%

Fournis ton analyse complète en JSON.`;

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
          { role: "user", content: prompt },
        ],
      }),
    });

    if (response.status === 429) {
      return new Response(JSON.stringify({ error: "Limite de requêtes atteinte, réessayez plus tard." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (response.status === 402) {
      return new Response(JSON.stringify({ error: "Crédits insuffisants." }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!response.ok) throw new Error(`AI error: ${response.status}`);

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in AI response");

    const analysis = JSON.parse(jsonMatch[0]);

    return new Response(JSON.stringify({ analysis }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-ocean error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
