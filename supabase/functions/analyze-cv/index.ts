import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = 'You are an ultra-fast ATS data parser. You must return ONLY a valid, minified JSON object. Do not include markdown or conversational text. Use this exact structure: { "candidate_name": "", "years_of_experience": 0, "top_3_skills": [], "matching_score_estimate": 0, "red_flags_or_gaps": "", "2_quick_interview_questions": [] }';
const AI_TIMEOUT_MS = 15_000;
const AI_MAX_TOKENS = 300;
const AI_MODEL = "google/gemini-2.5-flash";
const CV_TEXT_LIMIT = 4000;

const RequestSchema = z.object({
  cvTexts: z.array(z.object({
    text: z.string().min(1),
    filePath: z.string().optional().default(""),
  })).min(1),
  sessionId: z.string().uuid().optional(),
  targetPositions: z.array(z.string().trim().min(1)).min(1),
});

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getMessageContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object" && "text" in item && typeof item.text === "string") {
          return item.text;
        }
        return "";
      })
      .join("");
  }
  return "";
}

function normalizeStringArray(value: unknown, limit: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, limit);
}

function normalizeScore(value: unknown): number {
  const score = Number(value);
  if (!Number.isFinite(score)) return 0;
  return Math.min(100, Math.max(0, Math.round(score)));
}

function normalizeYears(value: unknown): string {
  if (value === null || value === undefined || value === "") return "";
  const years = Number(value);
  if (!Number.isFinite(years)) return "";
  return String(Math.max(0, Math.round(years)));
}

async function callAi(cvText: string, targetPositions: string[]): Promise<Record<string, unknown>> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

  const userPrompt = `Input Text to Analyze: [INSERT PLAIN TEXT CV HERE] ${cvText.slice(0, CV_TEXT_LIMIT)} [INSERT JOB REQUIREMENT SUMMARY HERE] ${targetPositions.join(", ")}`;

  let response: Response;
  try {
    response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      signal: AbortSignal.timeout(AI_TIMEOUT_MS),
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: AI_MODEL,
        temperature: 0,
        max_tokens: AI_MAX_TOKENS,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
      }),
    });
  } catch (error) {
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
      throw new Error("AI request timed out after 15 seconds");
    }
    throw error;
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`AI request failed with status ${response.status}${errorText ? `: ${errorText.slice(0, 200)}` : ""}`);
  }

  const payload = await response.json();
  const rawContent = getMessageContent(payload?.choices?.[0]?.message?.content);
  if (!rawContent) throw new Error("AI returned an empty response");

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawContent);
  } catch {
    throw new Error("AI returned invalid JSON");
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("AI returned an unexpected JSON structure");
  }

  return parsed as Record<string, unknown>;
}

function mapAnalysisToRecord(parsed: Record<string, unknown>, sessionId: string, filePath: string, rawText: string, targetPositions: string[]) {
  const candidateName = typeof parsed.candidate_name === "string" && parsed.candidate_name.trim()
    ? parsed.candidate_name.trim()
    : "Inconnu";
  const nameParts = candidateName.split(/\s+/).filter(Boolean);
  const skills = normalizeStringArray(parsed.top_3_skills, 3);
  const quickQuestions = normalizeStringArray(parsed["2_quick_interview_questions"], 2);
  const now = new Date().toISOString();

  return {
    session_id: sessionId,
    nom_candidat: candidateName,
    email: "",
    poste_assigne: targetPositions.join(", "),
    matching_score: normalizeScore(parsed.matching_score_estimate),
    competences_cles: skills,
    synthese_ia: typeof parsed.red_flags_or_gaps === "string" ? parsed.red_flags_or_gaps.trim().slice(0, 300) : "",
    cv_file_path: filePath,
    cv_raw_text: rawText.slice(0, 5000),
    candidate_details: {
      prenom: nameParts[0] || "",
      nom: nameParts.slice(1).join(" "),
      region: "",
      etablissement_formation: "",
      formation: "",
      poste_actuel: "",
      entreprise_actuelle: "",
      date_debut_poste: "",
      annees_experience: normalizeYears(parsed.years_of_experience),
      telephone: "",
      quick_interview_questions: quickQuestions,
    },
    status: "completed",
    started_at: now,
    completed_at: now,
    error_message: null,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const requestJson = await req.json().catch(() => null);
    const parsedRequest = RequestSchema.safeParse(requestJson);
    if (!parsedRequest.success) {
      return jsonResponse({ error: "Invalid request payload", details: parsedRequest.error.flatten() }, 400);
    }

    const { cvTexts, targetPositions } = parsedRequest.data;
    const sessionId = parsedRequest.data.sessionId ?? crypto.randomUUID();

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Backend database credentials are not configured");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const results = [];

    for (const cv of cvTexts) {
      const aiResult = await callAi(cv.text, targetPositions);
      const record = mapAnalysisToRecord(aiResult, sessionId, cv.filePath || "", cv.text, targetPositions);
      const { data, error } = await supabase.from("cv_analyses").insert(record).select().single();
      if (error) {
        throw new Error(`Database insert failed: ${error.message}`);
      }
      results.push(data);
    }

    return jsonResponse({ results, sessionId, total: results.length, failed: [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message.includes("timed out") ? 500 : 500;
    console.error("analyze-cv error:", message);
    return jsonResponse({ error: message }, status);
  }
});
