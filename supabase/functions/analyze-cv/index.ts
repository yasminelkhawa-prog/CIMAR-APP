import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are a precise ATS CV parser. Return ONLY a valid minified JSON object — no markdown, no prose, no explanations.

STRICT RULES — read carefully:
1. Extract ONLY information that LITERALLY appears in the CV text. Never invent, never paraphrase fictional content, never hallucinate.
2. If a field is missing or unclear in the CV, return an empty string "" (or 0 for numbers, [] for arrays). DO NOT guess.
3. "current_position": this is the candidate's REAL current job title as written in the CV. If the candidate is a student / "étudiant" / "stagiaire" / "en formation" with no job, write exactly "Étudiant" (or "Stagiaire" if the CV says so). Never write filler like "they are looking for...", never write a sentence — only a short job title (2–6 words max).
4. "current_company": the actual company name where they currently work, or "" if student/unemployed.
5. "best_matching_position": you MUST pick exactly ONE item VERBATIM from the provided AVAILABLE TARGET POSITIONS list. Never invent a new title, never combine two, never modify the wording. If nothing fits well, still pick the closest one from the list.
6. "matching_score_estimate": integer 0–100 reflecting how well the candidate fits the chosen target position based on skills, experience and education.
7. "red_flags_or_gaps": ONE short factual sentence (max 25 words) about missing requirements. No fluff.
8. "2_quick_interview_questions": exactly 2 short, specific interview questions tailored to this candidate's CV.

Return EXACTLY this structure:
{"candidate_name":"","first_name":"","last_name":"","email":"","phone":"","education_institution":"","education_field":"","current_position":"","current_company":"","current_position_start_date":"","years_of_experience":0,"top_3_skills":[],"matching_score_estimate":0,"best_matching_position":"","red_flags_or_gaps":"","2_quick_interview_questions":["",""]}`;
const AI_TIMEOUT_MS = 30_000;
const AI_MAX_TOKENS = 800;
const AI_MODEL = "google/gemini-2.5-flash";
const CV_TEXT_LIMIT = 8000;

const KNOWN_STUDENT_MARKERS = [
  "étudiant",
  "etudiant",
  "student",
  "stagiaire",
  "intern",
  "pfe",
  "stage de fin",
  "dut",
  "licence",
  "bachelor",
  "master",
];

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

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function compactWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeForCompare(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isLikelyStudent(cvText: string): boolean {
  const normalized = normalizeForCompare(cvText);
  return KNOWN_STUDENT_MARKERS.some((marker) => normalized.includes(normalizeForCompare(marker)));
}

function extractEmail(rawText: string): string {
  const match = rawText.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match?.[0]?.trim() ?? "";
}

function extractPhone(rawText: string): string {
  const match = rawText.match(/(?:\+?\d[\d\s().-]{7,}\d)/);
  return match?.[0]?.replace(/\s+/g, " ").trim() ?? "";
}

function extractNameFromText(rawText: string): string {
  const compact = compactWhitespace(rawText);
  const lines = compact
    .split(/(?<=[a-zA-Z])\s(?=[A-ZÀ-Ÿ][a-zà-ÿ]+\s+[A-ZÀ-Ÿ][A-ZÀ-Ÿa-zà-ÿ'-]{1,})/)
    .flatMap((line) => line.split(/[\n\r]+/))
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 8);

  for (const line of lines) {
    if (/@|http|www\.|profil|objectif|contact|comp[eé]tences|exp[eé]rience|formation/i.test(line)) continue;
    const match = line.match(/\b([A-ZÀ-Ÿ][A-ZÀ-Ÿ' -]{1,}|[A-ZÀ-Ÿ][a-zà-ÿ' -]{1,})\s+([A-ZÀ-Ÿ][A-ZÀ-Ÿ' -]{1,}|[A-ZÀ-Ÿ][a-zà-ÿ' -]{1,})\b/);
    if (match) {
      const candidate = compactWhitespace(match[0]).slice(0, 80);
      if (candidate.split(" ").length >= 2) return candidate;
    }
  }
  return "";
}

function inferCurrentPosition(rawText: string, aiValue: string): string {
  const ai = compactWhitespace(aiValue);
  if (ai && !/they are|looking for|searching for|recherche/i.test(ai)) return ai;
  if (isLikelyStudent(rawText)) {
    const normalized = normalizeForCompare(rawText);
    return normalized.includes("stagiaire") ? "Stagiaire" : "Étudiant";
  }
  return "";
}

function scorePositionAgainstText(position: string, rawText: string): number {
  const positionWords = normalizeForCompare(position).split(" ").filter((word) => word.length >= 3);
  const text = normalizeForCompare(rawText);
  if (positionWords.length === 0) return 0;
  const hits = positionWords.filter((word) => text.includes(word)).length;
  const ratio = hits / positionWords.length;
  if (ratio >= 1) return 92;
  if (ratio >= 0.66) return 78;
  if (ratio >= 0.4) return 60;
  if (ratio > 0) return 35;
  return 0;
}

function normalizeMatchingScore(rawScore: unknown, assignedPosition: string, rawText: string): number {
  const aiScore = normalizeScore(rawScore);
  const heuristicScore = scorePositionAgainstText(assignedPosition, rawText);
  if (heuristicScore >= 78 && aiScore < 30) return heuristicScore;
  if (heuristicScore >= 60 && aiScore < 20) return Math.max(aiScore, heuristicScore);
  if (heuristicScore === 0 && aiScore > 95) return 95;
  return Math.max(aiScore, heuristicScore);
}

async function callAi(cvText: string, targetPositions: string[]): Promise<Record<string, unknown>> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

  const positionsList = targetPositions.map((p, i) => `${i + 1}. ${p}`).join("\n");
  const userPrompt = `AVAILABLE TARGET POSITIONS (pick exactly ONE, verbatim, for "best_matching_position"):\n${positionsList}\n\nCV TEXT:\n${cvText.slice(0, CV_TEXT_LIMIT)}`;

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

function pickStr(value: unknown, max = 200): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

function pickAssignedPosition(parsed: Record<string, unknown>, targetPositions: string[]): string {
  const candidate = pickStr(parsed.best_matching_position);
  if (!candidate) return targetPositions[0] || "";
  // Exact match (case-insensitive)
  const exact = targetPositions.find((p) => p.toLowerCase() === candidate.toLowerCase());
  if (exact) return exact;
  // Fuzzy: longest target position contained in candidate or vice-versa
  const fuzzy = targetPositions.find(
    (p) =>
      candidate.toLowerCase().includes(p.toLowerCase()) ||
      p.toLowerCase().includes(candidate.toLowerCase()),
  );
  return fuzzy || targetPositions[0] || candidate;
}

function mapAnalysisToRecord(parsed: Record<string, unknown>, sessionId: string, filePath: string, rawText: string, targetPositions: string[]) {
  const detectedName = extractNameFromText(rawText);
  const candidateName = pickStr(parsed.candidate_name) || detectedName || "Inconnu";
  const nameParts = candidateName.split(/\s+/).filter(Boolean);
  const firstName = pickStr(parsed.first_name) || nameParts[0] || "";
  const lastName = pickStr(parsed.last_name) || nameParts.slice(1).join(" ");
  const skills = normalizeStringArray(parsed.top_3_skills, 3);
  const quickQuestions = normalizeStringArray(parsed["2_quick_interview_questions"], 2);
  const assignedPosition = pickAssignedPosition(parsed, targetPositions);
  const now = new Date().toISOString();
  const normalizedCurrentPosition = inferCurrentPosition(rawText, pickStr(parsed.current_position, 200));
  const normalizedEmail = pickStr(parsed.email, 150) || extractEmail(rawText);
  const normalizedPhone = pickStr(parsed.phone, 50) || extractPhone(rawText);
  const normalizedScore = normalizeMatchingScore(parsed.matching_score_estimate, assignedPosition, rawText);

  return {
    session_id: sessionId,
    nom_candidat: candidateName,
    email: normalizedEmail,
    poste_assigne: assignedPosition,
    matching_score: normalizedScore,
    competences_cles: skills,
    synthese_ia: pickStr(parsed.red_flags_or_gaps, 300),
    cv_file_path: filePath,
    cv_raw_text: rawText.slice(0, 5000),
    candidate_details: {
      prenom: firstName,
      nom: lastName,
      region: "",
      etablissement_formation: pickStr(parsed.education_institution, 200),
      formation: pickStr(parsed.education_field, 200),
       poste_actuel: normalizedCurrentPosition,
      entreprise_actuelle: pickStr(parsed.current_company, 200),
      date_debut_poste: pickStr(parsed.current_position_start_date, 50),
      annees_experience: normalizeYears(parsed.years_of_experience),
       telephone: normalizedPhone,
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
