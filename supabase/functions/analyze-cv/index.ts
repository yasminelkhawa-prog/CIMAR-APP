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

    const SYSTEM_PROMPT = `Role: You are an ultra-efficient, lightning-fast ATS (Applicant Tracking System) data parser. Your only job is to extract and analyze key information from the provided text.

Strict Constraints (CRITICAL):

Speed over depth: Do not over-analyze. Extract the obvious facts.

No conversational text: Do not say "Here is the analysis" or "Based on the CV".

Output Format: You MUST return ONLY a valid, minified JSON object. Absolutely no markdown formatting or text outside the JSON brackets.

Word Limits: Keep all summary text under 50 words.

Required JSON Structure: { "candidate_name": "Name or null", "years_of_experience": "Integer or null", "top_3_skills": ["Skill 1", "Skill 2", "Skill 3"], "matching_score_estimate": "Integer between 0-100", "red_flags_or_gaps": "Brief 1-sentence summary of any missing critical requirements or null", "2_quick_interview_questions": ["Question 1", "Question 2"] }

Input Text to Analyze: [INSERT PLAIN TEXT CV HERE] [INSERT JOB REQUIREMENT SUMMARY HERE]`;

    // Analyze a single CV with retries
    const analyzeOne = async (cv: { text: string; filePath: string }, attempt = 1): Promise<any | null> => {
      const { text, filePath } = cv;
      const userPrompt = `Input Text to Analyze:
[INSERT PLAIN TEXT CV HERE]
${text.substring(0, 4000)}

[INSERT JOB REQUIREMENT SUMMARY HERE]
${positionsList}`;

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
            temperature: 0,
            max_tokens: 300,
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

        const candidateName = typeof parsed.candidate_name === "string" && parsed.candidate_name.trim()
          ? parsed.candidate_name.trim()
          : "Inconnu";
        const nameParts = candidateName.split(/\s+/).filter(Boolean);
        const quickInterviewQuestions = Array.isArray(parsed["2_quick_interview_questions"])
          ? parsed["2_quick_interview_questions"].filter((question: unknown) => typeof question === "string" && question.trim()).slice(0, 2)
          : [];
        const topSkills = Array.isArray(parsed.top_3_skills)
          ? parsed.top_3_skills.filter((skill: unknown) => typeof skill === "string" && skill.trim()).slice(0, 3)
          : [];
        const yearsOfExperience = parsed.years_of_experience == null ? "" : String(parsed.years_of_experience);
        const redFlagsOrGaps = typeof parsed.red_flags_or_gaps === "string" ? parsed.red_flags_or_gaps.trim() : "";
        const matchingScore = Number(parsed.matching_score_estimate);

        const record = {
          session_id: sessionId,
          nom_candidat: candidateName,
          email: "",
          poste_assigne: positionsList,
          matching_score: Number.isFinite(matchingScore) ? Math.min(100, Math.max(0, matchingScore)) : 0,
          competences_cles: topSkills,
          synthese_ia: redFlagsOrGaps || (quickInterviewQuestions[0] || ""),
          cv_file_path: filePath || "",
          cv_raw_text: text.substring(0, 5000),
          candidate_details: {
            prenom: nameParts[0] || "",
            nom: nameParts.slice(1).join(" "),
            region: "",
            etablissement_formation: "",
            formation: "",
            poste_actuel: "",
            entreprise_actuelle: "",
            date_debut_poste: "",
            annees_experience: yearsOfExperience,
            telephone: "",
            quick_interview_questions: quickInterviewQuestions,
          },
          status: "completed",
          started_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
          error_message: null,
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
