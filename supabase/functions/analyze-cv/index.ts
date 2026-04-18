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
  jobDescriptions: z.array(z.object({
    position: z.string().trim().min(1),
    description: z.string().trim().min(1),
  })).optional().default([]),
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

function extractJsonFromResponse(raw: string): Record<string, unknown> {
  let cleaned = raw
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .trim();

  if (!cleaned.startsWith("{")) {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start !== -1 && end > start) cleaned = cleaned.slice(start, end + 1);
  }

  const tryParse = (value: string) => JSON.parse(value) as Record<string, unknown>;

  try {
    return tryParse(cleaned);
  } catch {
    const repaired = cleaned
      .replace(/,\s*}/g, "}")
      .replace(/,\s*]/g, "]")
      .replace(/\u00a0/g, " ");
    return tryParse(repaired);
  }
}

function isLikelyTruncatedResponse(payload: any, rawContent: string): boolean {
  const finishReason = payload?.choices?.[0]?.finish_reason ?? payload?.stop_reason;
  if (finishReason === "length" || finishReason === "max_tokens") return true;
  const text = rawContent.trim();
  const openBraces = (text.match(/{/g) || []).length;
  const closeBraces = (text.match(/}/g) || []).length;
  const openBrackets = (text.match(/\[/g) || []).length;
  const closeBrackets = (text.match(/\]/g) || []).length;
  return openBraces !== closeBraces || openBrackets !== closeBrackets;
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
  if (typeof value === "string") {
    const normalized = value.replace(/\s+/g, "").replace(/,/g, ".").replace(/[^0-9.\-]/g, "");
    const parsed = Number(normalized);
    if (Number.isFinite(parsed)) return Math.min(100, Math.max(0, Math.round(parsed)));
  }
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

const STOP_WORDS = new Set([
  "de", "du", "des", "le", "la", "les", "un", "une", "et", "en", "the", "of", "and", "for", "with",
  "ingenieur", "engineer", "manager", "responsable", "chef", "junior", "senior", "specialiste",
  "specialist", "agent", "assistant", "officer", "operateur", "technicien", "technician",
]);

function tokenizePosition(position: string): string[] {
  return normalizeForCompare(position)
    .split(" ")
    .filter((word) => word.length >= 3 && !STOP_WORDS.has(word));
}

function tokenizeText(value: string): string[] {
  return normalizeForCompare(value)
    .split(" ")
    .filter((word) => word.length >= 3 && !STOP_WORDS.has(word));
}

function scoreTokensAgainstText(tokens: string[], rawText: string, weights?: Map<string, number>): number {
  const text = normalizeForCompare(rawText);
  if (tokens.length === 0) return 0;
  const uniqueTokens = Array.from(new Set(tokens));
  const totalWeight = uniqueTokens.reduce((sum, token) => sum + (weights?.get(token) ?? 1), 0);
  if (totalWeight <= 0) return 0;
  const matchedWeight = uniqueTokens.reduce((sum, token) => sum + (text.includes(token) ? (weights?.get(token) ?? 1) : 0), 0);
  const ratio = matchedWeight / totalWeight;
  if (ratio >= 0.9) return 95;
  if (ratio >= 0.75) return 88;
  if (ratio >= 0.6) return 80;
  if (ratio >= 0.45) return 68;
  if (ratio >= 0.3) return 54;
  if (ratio > 0) return 35;
  return 0;
}

function scorePositionAgainstText(position: string, rawText: string): number {
  return scoreTokensAgainstText(tokenizePosition(position), rawText);
}

function buildJobDescriptionWeights(description: string): Map<string, number> {
  const weights = new Map<string, number>();
  for (const token of tokenizeText(description)) {
    weights.set(token, (weights.get(token) ?? 0) + 1.6);
  }
  return weights;
}

function scorePositionWithJobDescription(position: string, rawText: string, jobDescription?: string): number {
  const positionTokens = tokenizePosition(position);
  if (!jobDescription) return scoreTokensAgainstText(positionTokens, rawText);

  const descriptionWeights = buildJobDescriptionWeights(jobDescription);
  const descriptionTokens = Array.from(descriptionWeights.keys());
  const positionScore = scoreTokensAgainstText(positionTokens, rawText);
  const descriptionScore = scoreTokensAgainstText(descriptionTokens, rawText, descriptionWeights);

  if (descriptionTokens.length === 0) return positionScore;
  return Math.round(positionScore * 0.45 + descriptionScore * 0.55);
}

function pickBestPositionByHeuristic(
  targetPositions: string[],
  rawText: string,
  jobDescriptions: Map<string, string>
): { position: string; score: number } {
  let best = { position: targetPositions[0] || "", score: -1 };
  for (const p of targetPositions) {
    const s = scorePositionWithJobDescription(p, rawText, jobDescriptions.get(p));
    if (s > best.score) best = { position: p, score: s };
  }
  return best;
}

function normalizeMatchingScore(
  rawScore: unknown,
  assignedPosition: string,
  rawText: string,
  jobDescriptions: Map<string, string>
): number {
  const aiScore = normalizeScore(rawScore);
  const heuristicScore = scorePositionWithJobDescription(assignedPosition, rawText, jobDescriptions.get(assignedPosition));
  if (heuristicScore >= 80 && aiScore < 45) return heuristicScore;
  if (heuristicScore >= 60 && aiScore < 30) return heuristicScore;
  if (heuristicScore >= 45 && aiScore < 20) return heuristicScore;
  if (heuristicScore === 0 && aiScore > 90) return 70;
  if (heuristicScore > 0 && aiScore < 25) return Math.max(25, heuristicScore);
  return Math.max(aiScore, heuristicScore);
}

function buildLowScoreComment(score: number, rawText: string, assignedPosition: string, aiComment: string): string {
  if (score >= 20) return aiComment;
  const currentRole = inferCurrentPosition(rawText, "");
  const education = /formation|ecole|école|universit|bachelor|master|licence|dut|ingenieur|ingénieur/i.test(rawText)
    ? "Formation visible mais correspondance métier faible."
    : "Correspondance métier faible avec le poste cible.";
  if (currentRole) {
    return `Score faible: profil plutôt orienté ${currentRole} que ${assignedPosition}. ${education}`.slice(0, 300);
  }
  return (`Score faible: ${education} Mots-clés du poste peu présents dans le CV.`).slice(0, 300);
}

function validateExtraction(parsed: Record<string, unknown>, sourceText: string): { valid: boolean; needsReview: boolean; reason?: string } {
  const normalizedSource = normalizeForCompare(sourceText).replace(/\s+/g, "");
  const candidateName = pickStr(parsed.candidate_name, 120);
  if (candidateName) {
    const normalizedName = normalizeForCompare(candidateName).replace(/\s+/g, "");
    if (normalizedName && normalizedName.length >= 5 && !normalizedSource.includes(normalizedName)) {
      return { valid: false, needsReview: false, reason: "Candidate name not found in source text" };
    }
  }
  return { valid: true, needsReview: false };
}

async function callAi(cvText: string, targetPositions: string[], jobDescriptions: Map<string, string>): Promise<Record<string, unknown>> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

  const positionsList = targetPositions.map((p, i) => {
    const jd = jobDescriptions.get(p);
    return `${i + 1}. ${p}${jd ? `\n   JOB DESCRIPTION: ${jd.slice(0, 1200)}` : ""}`;
  }).join("\n");
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
        max_tokens: 1200,
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
  if (isLikelyTruncatedResponse(payload, rawContent)) {
    throw new Error("AI response was truncated");
  }

  const parsed = extractJsonFromResponse(rawContent);
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

function mapAnalysisToRecord(
  parsed: Record<string, unknown>,
  sessionId: string,
  filePath: string,
  rawText: string,
  targetPositions: string[],
  jobDescriptions: Map<string, string>
) {
  const validation = validateExtraction(parsed, rawText);
  const detectedName = extractNameFromText(rawText);
  const safeParsedName = validation.valid ? pickStr(parsed.candidate_name) : "";
  const candidateName = safeParsedName || detectedName || "Inconnu";
  const nameParts = candidateName.split(/\s+/).filter(Boolean);
  const firstName = pickStr(parsed.first_name) || nameParts[0] || "";
  const lastName = pickStr(parsed.last_name) || nameParts.slice(1).join(" ");
  const skills = normalizeStringArray(parsed.top_3_skills, 3);
  const quickQuestions = normalizeStringArray(parsed["2_quick_interview_questions"], 2);
  const aiAssigned = pickAssignedPosition(parsed, targetPositions);
  const heuristicBest = pickBestPositionByHeuristic(targetPositions, rawText, jobDescriptions);
  const aiAssignedHeuristic = scorePositionWithJobDescription(aiAssigned, rawText, jobDescriptions.get(aiAssigned));
  const assignedPosition = (heuristicBest.score >= 72 && heuristicBest.score - aiAssignedHeuristic >= 20)
    ? heuristicBest.position
    : aiAssigned;
  const now = new Date().toISOString();
  const normalizedCurrentPosition = inferCurrentPosition(rawText, pickStr(parsed.current_position, 200));
  const normalizedEmail = pickStr(parsed.email, 150) || extractEmail(rawText);
  const normalizedPhone = pickStr(parsed.phone, 50) || extractPhone(rawText);
  const normalizedScore = normalizeMatchingScore(parsed.matching_score_estimate, assignedPosition, rawText, jobDescriptions);
  const aiComment = pickStr(parsed.red_flags_or_gaps, 300);
  const finalComment = buildLowScoreComment(normalizedScore, rawText, assignedPosition, aiComment || validation.reason || "");

  return {
    session_id: sessionId,
    nom_candidat: candidateName,
    email: normalizedEmail,
    poste_assigne: assignedPosition,
    matching_score: normalizedScore,
    competences_cles: skills,
    synthese_ia: finalComment,
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

    const { cvTexts, targetPositions, jobDescriptions } = parsedRequest.data;
    const sessionId = parsedRequest.data.sessionId ?? crypto.randomUUID();
    const jobDescriptionMap = new Map(
      jobDescriptions.map((item) => [item.position.trim(), compactWhitespace(item.description)])
    );

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Backend database credentials are not configured");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const results = [];

    for (const cv of cvTexts) {
      const aiResult = await callAi(cv.text, targetPositions, jobDescriptionMap);
      const record = mapAnalysisToRecord(aiResult, sessionId, cv.filePath || "", cv.text, targetPositions, jobDescriptionMap);
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
