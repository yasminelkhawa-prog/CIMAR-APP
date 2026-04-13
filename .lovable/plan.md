

## Plan: Sidebar Navigation + Interactive HR Document Forms

### What we're building

Transform the app from a tab-based layout to a **sidebar navigation** with 4 main menu items (matching the uploaded documents), plus the existing evaluation grid. Each document becomes an interactive form that users can fill in, view in read-only mode, and download as the original file format (XLSX/DOCX) with their data populated.

### Menu items (sidebar)

1. **Grille d'Évaluation** — existing evaluation grid (current functionality)
2. **Fiche d'Embauche** — hiring validation form (from the XLSX)
3. **Fiche de Poste** — job description form (from the DOCX)
4. **Plan d'Intégration** — onboarding integration plan (from the DOCX)
5. **CVs Retenus** — shortlisted candidates tracker (from the XLSX)

Plus existing **Configuration** section.

### Architecture

**Layout change**: Replace the current tab-based `Index.tsx` with a `SidebarProvider` layout using the existing Shadcn sidebar component. Each menu item routes to a sub-view within the same page (state-based, not routes — keeping it simple like current tabs).

**For each document form:**

#### 1. Fiche d'Embauche (Hiring Form)
- Interactive form with all fields from the XLSX: candidate info, position details, salary structure, interview panel, internal comparisons
- **Salary calculation formulas preserved**:
  - Frais professionnels = min(25% × salaire brut imposable, 2916.67)
  - CNSS = min(4.48% × salaire brut, 6000 plafond)
  - CIMR = taux × salaire brut (taux configurable: 3%, 3.75%, 4.5%, 5.25%, 6%)
  - Mutuelle = 3.41% × salaire brut
  - Salaire brut imposable = Revenu brut - Frais pro - CNSS - CIMR - Retraite - Mutuelle
  - IGR calculated using the 2010 barème (progressive tax brackets)
  - Net à payer = Salaire brut imposable - IGR net
  - IK (Indemnités kilométriques) = site distance × rate × jours
- Download generates an XLSX matching the original layout with formulas

#### 2. Fiche de Poste (Job Description)
- Form fields: poste, rattachement hiérarchique/fonctionnel, supervise, périmètre, niveau hiérarchique, mission, rôles & responsabilités, compétences, profil
- Download as DOCX with CIMAR branding

#### 3. Plan d'Intégration (Onboarding Plan)
- Form: employee name, hire date, position, type (nouvelle recrue / réaffectation)
- Dynamic table for schedule entries: date/time, direction/département, responsable, objectifs, visa fields
- Sections for "Formations", "Avis de la hiérarchie", "Appréciation"
- Download as DOCX

#### 4. CVs Retenus (Shortlisted CVs)
- Table/list form: prénom, nom, poste actuel, entreprise, date début, établissement formation, années d'expérience
- Add/remove candidates
- Download as XLSX

### Database

New tables needed:
- `fiches_embauche` — stores hiring form data as JSON
- `fiches_poste` — stores job descriptions
- `plans_integration` — stores onboarding plans  
- `cvs_retenus` — stores shortlisted candidate lists

Each table: `id`, `data` (jsonb), `created_at`, `updated_at`, with RLS disabled (public-facing HR tool, no auth yet).

### Files to create/modify

1. **`src/pages/Index.tsx`** — Replace tabs with SidebarProvider layout
2. **`src/components/AppSidebar.tsx`** — New sidebar with 5 menu items + config
3. **`src/components/FicheEmbaucheForm.tsx`** — Hiring validation form with salary calc
4. **`src/components/FichePosteForm.tsx`** — Job description form
5. **`src/components/PlanIntegrationForm.tsx`** — Onboarding plan form
6. **`src/components/CvsRetenusForm.tsx`** — Shortlisted CVs table form
7. **`src/utils/ficheEmbaucheExport.ts`** — XLSX export with formulas
8. **`src/utils/fichePosteExport.ts`** — DOCX export
9. **`src/utils/planIntegrationExport.ts`** — DOCX export
10. **`src/utils/cvsRetenusExport.ts`** — XLSX export
11. **`src/i18n/translations.ts`** — Add translation keys for all new sections
12. **Migration** — Create the 4 new tables

### View/Edit pattern

Same as evaluation grid: forms open in **read-only mode** by default. User must click **"Modifier"** to enable editing. Each form has list view → detail view → edit mode.

### Export approach

- XLSX exports: Use `xlsx` (SheetJS) library — client-side generation preserving formulas
- DOCX exports: Use `docx` library — client-side generation with CIMAR branding (logo, green headers)

### Key salary formulas (Fiche d'Embauche)

All calculations happen live in the form and are also embedded as Excel formulas in the export:

```
Salaire brut imposable = Salaire base + Primes imposables
Frais pro = MIN(Brut imposable × 25%, 2916.67)
CNSS = MIN(Brut × 4.48%, 268.80)  [plafond 6000]
CIMR = Brut × taux CIMR
Mutuelle = Brut × 3.41%
Base imposable = Brut imposable - Frais pro - CNSS - CIMR - Mutuelle
IGR = barème progressif (6 tranches)
Charges familiales = 41.66 × nb personnes à charge
IGR Net = IGR Brut - Charges familiales
Net à payer = Brut imposable - CNSS - CIMR - Mutuelle - IGR Net
```

