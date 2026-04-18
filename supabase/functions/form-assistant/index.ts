import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// System prompts per form type — focused on helping HR fill the grid
const SYSTEM_PROMPTS: Record<string, string> = {
  fiche_poste: `Tu es un assistant RH expert pour Ciments du Maroc (CIMAR), groupe Heidelberg Materials (cimenterie au Maroc).
Tu aides à remplir une "Fiche de Poste" (job description). Pour chaque demande:
- Propose des contenus concrets, professionnels et adaptés au secteur cimentier/industriel marocain.
- Pour les rôles & responsabilités, compétences (hard/soft skills) et profil (formation, expérience, langues): propose des items structurés et exhaustifs.
- Quand l'utilisateur demande explicitement de remplir/suggérer des champs, APPELLE l'outil "suggest_fiche_poste_fields" avec uniquement les champs pertinents.
- Sinon réponds en français de manière concise (markdown).`,

  fiche_embauche: `Tu es un assistant RH expert pour Ciments du Maroc (CIMAR). Tu aides à remplir une "Fiche d'Embauche" (hiring form) marocaine avec calculs de salaire, primes (logement, site, représentation), CIMR, IGR, etc.
- Suggère des valeurs cohérentes avec les pratiques RH marocaines et le statut Cadre/Non-Cadre.
- Quand l'utilisateur demande de remplir des champs, APPELLE "suggest_fiche_embauche_fields" avec uniquement les champs concernés.
- Sinon réponds en français, concis.`,

  plan_integration: `Tu es un assistant RH pour Ciments du Maroc (CIMAR). Tu aides à construire un "Plan d'Intégration" pour un nouvel arrivant ou une réaffectation.
- Propose un planning d'intégration réaliste sur 1-4 semaines avec dates, horaires (ex: "09h00-10h30"), directions/services CIMAR (DRH, Direction Technique, DAF, HSE, Production, Maintenance, Achats, Juridique, IT/Workday, etc.), responsables et objectifs précis.
- Inclut formations obligatoires (Sécurité, Workday, Code éthique, etc.).
- Quand l'utilisateur demande de remplir, APPELLE "suggest_plan_integration_fields".
- Sinon réponds en français, concis.`,

  cvs_retenus: `Tu es un assistant RH pour Ciments du Maroc (CIMAR). Tu aides à analyser et organiser une liste de CVs retenus pour un poste.
- Aide à comparer les profils, identifier les top candidats, formuler des questions d'entretien.
- Réponds en français, concis, en markdown.`,
};

// Tool schemas — strict JSON schemas the AI must respect when proposing field values
const TOOLS: Record<string, any[]> = {
  fiche_poste: [
    {
      type: "function",
      function: {
        name: "suggest_fiche_poste_fields",
        description:
          "Propose des valeurs pour un ou plusieurs champs de la Fiche de Poste. Ne renseigner QUE les champs pertinents à la demande.",
        parameters: {
          type: "object",
          properties: {
            poste: { type: "string" },
            rattachementHierarchique: { type: "string" },
            rattachementFonctionnel: { type: "string" },
            supervise: { type: "string" },
            nombreSubordonnees: { type: "string" },
            perimetre: { type: "string" },
            niveauHierarchique: { type: "string" },
            mission: { type: "string", description: "Mission principale du poste, 2-4 phrases." },
            rolesResponsabilites: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  category: { type: "string" },
                  details: { type: "string" },
                },
                required: ["category", "details"],
                additionalProperties: false,
              },
            },
            competences: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  category: { type: "string" },
                  details: { type: "string" },
                },
                required: ["category", "details"],
                additionalProperties: false,
              },
            },
            profil: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  category: { type: "string" },
                  details: { type: "string" },
                },
                required: ["category", "details"],
                additionalProperties: false,
              },
            },
            explanation: { type: "string", description: "Brève explication des suggestions (1-2 phrases)." },
          },
          additionalProperties: false,
        },
      },
    },
  ],
  fiche_embauche: [
    {
      type: "function",
      function: {
        name: "suggest_fiche_embauche_fields",
        description: "Propose des valeurs pour la Fiche d'Embauche. Ne renseigner que les champs pertinents.",
        parameters: {
          type: "object",
          properties: {
            titrePoste: { type: "string" },
            directionDepartement: { type: "string" },
            rattachementHierarchique: { type: "string" },
            motifRecrutement: { type: "string" },
            nomPrenom: { type: "string" },
            statut: { type: "string", description: "Cadre / Non-cadre" },
            typeContrat: { type: "string" },
            dureePeriodeEssai: { type: "string" },
            dureePreavis: { type: "string" },
            entreeEnvisagee: { type: "string", description: "Date au format YYYY-MM-DD" },
            salaireBase: { type: "number" },
            primeLogement: { type: "number" },
            primeSite: { type: "number" },
            indTransport: { type: "number" },
            primeRepresentation: { type: "number" },
            tauxCIMR: { type: "number", enum: [3, 3.75, 4.5, 5.25, 6] },
            nbPersonnesCharge: { type: "number" },
            mbo: { type: "number" },
            explanation: { type: "string" },
          },
          additionalProperties: false,
        },
      },
    },
  ],
  plan_integration: [
    {
      type: "function",
      function: {
        name: "suggest_plan_integration_fields",
        description: "Propose un planning d'intégration. Ne renseigner que les champs pertinents.",
        parameters: {
          type: "object",
          properties: {
            posteOccuper: { type: "string" },
            type: { type: "string", enum: ["nouvelle_recrue", "reaffectation"] },
            entries: {
              type: "array",
              description: "Étapes du planning d'intégration",
              items: {
                type: "object",
                properties: {
                  activityType: { type: "string", enum: ["planning", "formation"], description: "planning = visite/réunion ; formation = session de formation" },
                  date: { type: "string", description: "YYYY-MM-DD" },
                  horaire: { type: "string", description: "ex: 09h00-10h30" },
                  direction: { type: "string" },
                  responsable: { type: "string" },
                  objectifs: { type: "string" },
                },
                required: ["activityType", "direction", "responsable", "objectifs"],
                additionalProperties: false,
              },
            },
            formations: { type: "string", description: "Liste des formations obligatoires" },
            avisHierarchie: { type: "string" },
            appreciation: { type: "string" },
            explanation: { type: "string" },
          },
          additionalProperties: false,
        },
      },
    },
  ],
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, formType, currentData } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const baseSystem = SYSTEM_PROMPTS[formType] || SYSTEM_PROMPTS.fiche_poste;
    const contextSystem = currentData
      ? `${baseSystem}\n\nÉtat actuel du formulaire (JSON):\n${JSON.stringify(currentData, null, 2)}`
      : baseSystem;

    const tools = TOOLS[formType];

    const body: any = {
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: contextSystem },
        ...messages,
      ],
    };
    if (tools) {
      body.tools = tools;
      body.tool_choice = "auto";
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requêtes atteinte. Réessayez dans un instant." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Crédits Lovable AI épuisés. Ajoutez des crédits dans votre workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await response.json();
    const choice = result.choices?.[0];
    const message = choice?.message;

    let suggestions: Record<string, unknown> | null = null;
    let text = message?.content || "";

    const toolCall = message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      try {
        const args = JSON.parse(toolCall.function.arguments);
        const { explanation, ...fields } = args;
        suggestions = fields;
        if (!text && explanation) text = explanation;
        if (!text) text = "Voici les suggestions générées. Cliquez sur **Appliquer** pour les insérer dans le formulaire.";
      } catch (e) {
        console.error("Failed to parse tool args:", e);
      }
    }

    return new Response(
      JSON.stringify({ text, suggestions }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("form-assistant error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
