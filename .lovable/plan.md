

## Plan

### 1. Strict Template Fidelity for Document Exports

Replace the code-generated exports with **template-based fill-ins** using the user's actual files in `src/assets/templates/`. This guarantees pixel-perfect format.

**Approach per template:**
- **Fiche d'Embauche (`.xlsx`)**: Load `fiche_embauche_template.xlsx` with **ExcelJS** (`workbook.xlsx.load(arrayBuffer)`). Walk every cell, replace `{{placeholder}}` tokens with form data. Embed user signature image via `wb.addImage` + `ws.addImage` anchored on the existing "Signature" cell. Preserves all merged cells, formulas, column widths, fonts, borders.
- **Fiche de Poste (`.docx`)** & **Plan d'Intégration (`.docx`)**: Use the **`docxtemplater`** library (small, browser-friendly) to load the `.docx` template and replace `{placeholders}` with form data. Use the `docxtemplater-image-module-free` (or inline base64 image swap) to inject the signature image. All original styling (fonts, margins, table layout, landscape orientation) is preserved because we never rebuild the document.
- Templates need to be authored once with placeholders like `{nom_candidat}`, `{poste}`, `{date}`, `{signature}`, `{full_name}`, `{title}`, etc. Since the current templates are the originals, we will:
  1. Open each template, insert the placeholders at the correct cells/locations (no layout change).
  2. Save back to `src/assets/templates/`.
- Auto-fill from `useAuth().profile`:
  - `full_name` → all "Reçu par", "Préparé par", "Direction RH", "Visa Responsable" name fields.
  - `title` → all "Fonction" / role label fields next to the name.
  - `signature_url` → embedded as image at every signature placeholder.
- Candidate `nom_candidat` propagated to all "Nom du candidat / Nouvelle recrue / Nom et prénom" fields in every doc.

**Files to change:**
- Rewrite `src/utils/documentExports.ts` to use the template-fill pattern.
- Update the three template files in `src/assets/templates/` with placeholder tokens.
- Add deps: `docxtemplater`, `pizzip`, `docxtemplater-image-module-free`.
- No changes needed to `FicheEmbaucheForm.tsx` / `FichePosteForm.tsx` / `PlanIntegrationForm.tsx` — same `exportXxx(data, signer)` signatures.

### 2. CV Analysis — Guarantee 100% Processing

Current state already has a singleton background runner with sequential per-CV calls + 3 retry attempts in the edge function. Remaining issues:
- Client-side OCR (tesseract) is slow on scanned PDFs and capped at 2 pages → some files yield empty text and are dropped before analysis.
- Edge function 45s timeout occasionally trips on large CVs.

**Improvements:**
- **Lift OCR page cap** from 2 → all pages, but do OCR pages in parallel (worker pool of 2) and cache.
- **Pre-flight tracking**: Persist every uploaded CV into a new `cv_analyses` row immediately with status `pending` (so it's always visible and never silently lost), then update with results.
- **Edge function**: Increase per-CV timeout to 90s, raise retry attempts to 4 with exponential backoff, and on final failure still insert a `failed` placeholder row so the UI shows it (with a "Retry this CV" button).
- **Runner**: After main pass, automatically retry failed CVs once before declaring done. Keep the existing global `Retry failed` button as manual fallback.
- **Concurrency**: Keep sequential per-CV calls (already chosen for live progress) — reliability is the priority over speed.

**Files to change:**
- `supabase/functions/analyze-cv/index.ts` — longer timeout, more retries, always insert a row even on hard fail.
- `src/lib/cvAnalysisRunner.ts` — auto-retry pass once, then settle.
- `src/components/CvsRetenusForm.tsx` — increase OCR page limit, parallel OCR.
- DB migration: add `status` column (`pending` | `done` | `failed`) and `failure_reason` to `cv_analyses`.

### 3. UI: Single Global Ranking + "Top Match" Highlight

Currently grouped per poste with a card-per-poste then a dialog. User now wants:
- A **single flat list** of ALL analyzed CVs, ranked descending by `matching_score`, no filtering.
- Top candidates clearly distinguished with a **modern visual treatment**:
  - **Top 1**: full glassmorphism card with animated purple/violet aura border, "🏆 Top Match" badge, slightly larger.
  - **Top 2-3**: subtle gradient ring (silver / bronze) + "Top Pick" badge.
  - **Rest**: clean standard cards.
- Keep the per-poste grouped overview as a secondary tab so existing workflow isn't lost.

**Files to change:**
- `src/components/CvsRetenusForm.tsx`:
  - Add Tabs: **"Classement global"** (default) and **"Par poste"**.
  - In the global tab, render `analyses` (already sorted by `matching_score desc` from `loadAnalyses`) as a single grid using a new `CandidateCard` with rank-aware styling.
  - Top-1 card: `border-2 border-violet-500/60 shadow-[0_0_40px_-10px_rgb(139,92,246)] bg-gradient-to-br from-violet-50/80 to-white dark:from-violet-950/30 backdrop-blur` + animated outer ring.
  - Add a `<TopMatchBadge />` with crown icon for ranks 1-3.

### Technical summary

| Area | Lib / Approach | Risk |
|---|---|---|
| DOCX templating | `docxtemplater` + `pizzip` (browser-safe) | Low — well-established |
| DOCX signature image | `docxtemplater-image-module-free` | Low |
| XLSX templating | Existing `exceljs` `.xlsx.load()` + cell walk | Low |
| Edge function reliability | retries + always-insert row | Low |
| DB | non-breaking column adds | Low |

### Out of scope (not requested)
- Re-uploading CVs after refresh (failed list is in-memory only).
- Bulk re-analysis of historical sessions.

