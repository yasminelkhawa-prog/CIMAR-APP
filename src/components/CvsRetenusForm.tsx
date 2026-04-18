import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { useLanguage } from '@/i18n/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import {
  Upload, FileText, Trash2, RefreshCw, Eye, Sparkles, Download, Plus, X, Users,
  ChevronRight, MapPin, GraduationCap, Briefcase, Building2, Calendar, Clock,
  Mail, Phone, Trophy, Award, TrendingUp, User as UserIcon,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import * as pdfjsLib from 'pdfjs-dist';
import * as XLSX from 'xlsx';
import { cvAnalysisRunner, type RunnerState } from '@/lib/cvAnalysisRunner';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

interface CandidateDetails {
  prenom?: string;
  nom?: string;
  region?: string;
  etablissement_formation?: string;
  formation?: string;
  poste_actuel?: string;
  entreprise_actuelle?: string;
  date_debut_poste?: string;
  annees_experience?: string;
  telephone?: string;
}

interface CvAnalysis {
  id: string;
  session_id: string;
  nom_candidat: string;
  email: string;
  poste_assigne: string;
  matching_score: number;
  competences_cles: string[];
  synthese_ia: string;
  cv_file_path: string;
  created_at: string;
  candidate_details: CandidateDetails;
}

const DIRECT_TEXT_MIN_LENGTH = 24;
const READABLE_TEXT_MIN_LENGTH = 10;
const OCR_PAGE_LIMIT = 2;

const normalizeText = (value: string) => value.replace(/\s+/g, ' ').trim();

function getScoreTone(score: number) {
  if (score >= 75) return { ring: 'ring-emerald-500/40', text: 'text-emerald-600', bg: 'bg-emerald-500', soft: 'bg-emerald-50 dark:bg-emerald-950/30', border: 'border-emerald-500', label: 'Excellent' };
  if (score >= 50) return { ring: 'ring-amber-500/40', text: 'text-amber-600', bg: 'bg-amber-500', soft: 'bg-amber-50 dark:bg-amber-950/30', border: 'border-amber-500', label: 'Bon' };
  return { ring: 'ring-rose-500/40', text: 'text-rose-600', bg: 'bg-rose-500', soft: 'bg-rose-50 dark:bg-rose-950/30', border: 'border-rose-500', label: 'Faible' };
}

function getInitials(prenom?: string, nom?: string, fallback = '') {
  const p = (prenom || '').trim();
  const n = (nom || '').trim();
  if (p || n) return `${p[0] || ''}${n[0] || ''}`.toUpperCase();
  const parts = fallback.trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || '?';
}

function buildExportRows(poste: string, candidates: CvAnalysis[]) {
  return candidates.map((cv) => ({
    'Poste': poste,
    'Prénom': cv.candidate_details?.prenom || (cv.nom_candidat || '').split(' ')[0] || '',
    'Nom': cv.candidate_details?.nom || (cv.nom_candidat || '').split(' ').slice(1).join(' ') || '',
    'Région': cv.candidate_details?.region || '',
    'Établissement de formation': cv.candidate_details?.etablissement_formation || '',
    'Formation': cv.candidate_details?.formation || '',
    'Poste actuel': cv.candidate_details?.poste_actuel || '',
    'Entreprise actuelle': cv.candidate_details?.entreprise_actuelle || '',
    'Date début poste': cv.candidate_details?.date_debut_poste || '',
    'Nbr années expérience': cv.candidate_details?.annees_experience || '',
    'Email': cv.email || '',
    'Téléphone': cv.candidate_details?.telephone || '',
    'Score (%)': cv.matching_score,
    'Compétences clés': (cv.competences_cles || []).join(', '),
    'Synthèse IA': cv.synthese_ia,
  }));
}

const EXPORT_COL_WIDTHS = [
  { wch: 25 }, { wch: 15 }, { wch: 20 }, { wch: 15 }, { wch: 25 },
  { wch: 25 }, { wch: 25 }, { wch: 25 }, { wch: 12 }, { wch: 10 },
  { wch: 30 }, { wch: 15 }, { wch: 8 }, { wch: 40 }, { wch: 50 },
];

export function CvsRetenusForm() {
  const { t } = useLanguage();
  const [analyses, setAnalyses] = useState<CvAnalysis[]>([]);
  const [runnerState, setRunnerState] = useState<RunnerState>(cvAnalysisRunner.getState());
  const [extractProgress, setExtractProgress] = useState({ current: 0, total: 0, name: '' });
  const [isExtracting, setIsExtracting] = useState(false);
  const [targetPositions, setTargetPositions] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('cv-target-positions') || '[]'); } catch { return []; }
  });
  const [newPosition, setNewPosition] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [openPoste, setOpenPoste] = useState<string | null>(null);

  useEffect(() => { loadAnalyses(); }, []);

  // Subscribe to background runner so progress survives navigation
  useEffect(() => {
    const unsub = cvAnalysisRunner.subscribe(setRunnerState);
    return () => { unsub(); };
  }, []);

  // When analysis finishes, auto-refresh list
  useEffect(() => {
    if (runnerState.stage === 'done') loadAnalyses();
  }, [runnerState.stage]);

  // Persist target positions
  useEffect(() => {
    localStorage.setItem('cv-target-positions', JSON.stringify(targetPositions));
  }, [targetPositions]);

  const loadAnalyses = async () => {
    const { data } = await supabase
      .from('cv_analyses')
      .select('*')
      .order('matching_score', { ascending: false });
    if (data) {
      setAnalyses(data.map(d => ({
        ...d,
        competences_cles: (d.competences_cles as string[]) || [],
        candidate_details: (d.candidate_details as unknown as CandidateDetails) || {},
      })));
    }
  };

  const addPosition = () => {
    const pos = newPosition.trim();
    if (pos && !targetPositions.includes(pos)) {
      setTargetPositions(prev => [...prev, pos]);
      setNewPosition('');
    }
  };

  const removePosition = (index: number) => {
    setTargetPositions(prev => prev.filter((_, i) => i !== index));
  };

  const extractTextFromPdf = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let text = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map((item: any) => item.str || '').join(' ') + '\n';
    }
    return normalizeText(text);
  };

  const renderPdfPageToImage = async (page: any) => {
    const viewport = page.getViewport({ scale: 1.5 });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas context unavailable');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    await page.render({ canvasContext: context, viewport }).promise;
    return canvas.toDataURL('image/png');
  };

  const extractTextFromPdfWithOcr = async (file: File): Promise<string> => {
    const tesseractModule = await import('tesseract.js');
    const createWorker = (tesseractModule as any).createWorker ?? (tesseractModule as any).default?.createWorker;
    if (!createWorker) throw new Error('OCR worker unavailable');
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const worker = await createWorker('eng+fra');
    let ocrText = '';
    try {
      for (let i = 1; i <= Math.min(pdf.numPages, OCR_PAGE_LIMIT); i++) {
        const page = await pdf.getPage(i);
        const imageDataUrl = await renderPdfPageToImage(page);
        const result = await worker.recognize(imageDataUrl);
        ocrText += ` ${result.data.text || ''}`;
      }
    } finally { await worker.terminate(); }
    return normalizeText(ocrText);
  };

  const extractTextFromWord = async (file: File): Promise<string> => {
    const mammoth = await import('mammoth');
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return normalizeText(result.value);
  };

  const extractTextFromImage = async (file: File): Promise<string> => {
    const tesseractModule = await import('tesseract.js');
    const createWorker = (tesseractModule as any).createWorker ?? (tesseractModule as any).default?.createWorker;
    if (!createWorker) throw new Error('OCR worker unavailable');
    const worker = await createWorker('eng+fra');
    let ocrText = '';
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const result = await worker.recognize(dataUrl);
      ocrText = result.data.text || '';
    } finally { await worker.terminate(); }
    return normalizeText(ocrText);
  };

  const cleanupOcrText = (raw: string): string => {
    let text = raw;
    text = text.replace(/[\u2018\u2019\u201A\u2032]/g, "'")
               .replace(/[\u201C\u201D\u201E\u2033]/g, '"')
               .replace(/[\u2013\u2014\u2212]/g, '-');
    text = text.replace(/(\w)[|`](\w)/g, '$1l$2');
    text = text.replace(/([A-Za-z0-9._%+-]+)\s*@\s*([A-Za-z0-9.-]+)\s*\.\s*([A-Za-z]{2,})/g, '$1@$2.$3');
    text = text.replace(/([A-Za-z0-9._%+-]+)0([A-Za-z0-9.-]+\.[A-Za-z]{2,})/g, (m, a, b) => `${a}@${b}`);
    text = text.replace(/(\+?\d[\d\s().-]{7,}\d)/g, (match) =>
      match.replace(/[Oo]/g, '0').replace(/[Il|]/g, '1')
    );
    text = text.replace(/\b[A-Z0-9]{2,}\b/g, (word) => {
      if (/^\d+$/.test(word)) return word;
      return word.replace(/0/g, 'O').replace(/1/g, 'I');
    });
    return text.replace(/\s+/g, ' ').trim();
  };

  const extractReadableCvText = async (file: File): Promise<string> => {
    const name = file.name.toLowerCase();
    const isWord = name.endsWith('.docx') || name.endsWith('.doc');
    const isImage = file.type.startsWith('image/') ||
      /\.(jpe?g|png|webp|bmp|tiff?|heic)$/i.test(name);
    if (isWord) return await extractTextFromWord(file);
    if (isImage) {
      const ocrText = await extractTextFromImage(file);
      return cleanupOcrText(ocrText);
    }
    const directText = await extractTextFromPdf(file);
    if (directText.length >= DIRECT_TEXT_MIN_LENGTH) return directText;
    const ocrText = await extractTextFromPdfWithOcr(file);
    return cleanupOcrText(normalizeText([directText, ocrText].filter(Boolean).join(' ')));
  };

  const handleUploadAndAnalyze = async (files: FileList) => {
    if (files.length === 0) return;
    if (targetPositions.length === 0) {
      toast.error(t('addPositionsFirst'));
      return;
    }
    if (cvAnalysisRunner.isRunning()) {
      toast.error('Une analyse est déjà en cours');
      return;
    }
    setIsExtracting(true);
    setExtractProgress({ current: 0, total: files.length, name: '' });
    const sessionId = crypto.randomUUID();
    const cvTexts: { text: string; filePath: string }[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setExtractProgress({ current: i + 1, total: files.length, name: file.name });
      cvAnalysisRunner.setExtractionProgress(i + 1, files.length, file.name);
      try {
        const text = await extractReadableCvText(file);
        if (text.length < READABLE_TEXT_MIN_LENGTH) {
          toast.error(`${file.name}: unreadable file`);
          continue;
        }
        const path = `${sessionId}/${file.name}`;
        const { error: uploadError } = await supabase.storage.from('cv-uploads').upload(path, file);
        if (uploadError) throw uploadError;
        cvTexts.push({ text, filePath: path });
      } catch (e) {
        console.error('Error processing file:', file.name, e);
        toast.error(`Unable to read ${file.name}`);
      }
    }
    setIsExtracting(false);

    if (cvTexts.length === 0) {
      toast.error('No readable CV found');
      return;
    }

    toast.info(`Analyse IA de ${cvTexts.length} CV en cours... Vous pouvez naviguer librement.`);

    // Fire and forget — runner is a singleton so it survives unmount
    cvAnalysisRunner.run({
      cvTexts,
      sessionId,
      targetPositions,
      onError: (msg) => toast.error(msg),
      onSuccess: (count, total, failed) => {
        if (failed > 0) {
          toast.warning(`${count}/${total} CV analysés. ${failed} échec(s) — relancez si nécessaire.`);
        } else {
          toast.success(`${count} CV analysés avec succès !`);
        }
        loadAnalyses();
      },
    });
  };

  const handleDeleteAll = async () => {
    await supabase.from('cv_analyses').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    setAnalyses([]);
    toast.success(t('deleted'));
  };

  const handleDeleteCard = async (id: string) => {
    await supabase.from('cv_analyses').delete().eq('id', id);
    setAnalyses(prev => prev.filter(a => a.id !== id));
  };

  const handleViewCV = async (filePath: string) => {
    const { data } = supabase.storage.from('cv-uploads').getPublicUrl(filePath);
    if (data?.publicUrl) window.open(data.publicUrl, '_blank');
  };

  const handleDownloadReport = () => {
    const wb = XLSX.utils.book_new();
    Object.entries(grouped).forEach(([poste, candidates]) => {
      const ws = XLSX.utils.json_to_sheet(buildExportRows(poste, candidates));
      ws['!cols'] = EXPORT_COL_WIDTHS;
      XLSX.utils.book_append_sheet(wb, ws, poste.substring(0, 31));
    });
    const summaryData = Object.entries(grouped).flatMap(([poste, candidates]) =>
      candidates.map((cv, i) => ({
        'Poste': poste,
        'Rang': i + 1,
        'Prénom': cv.candidate_details?.prenom || (cv.nom_candidat || '').split(' ')[0] || '',
        'Nom': cv.candidate_details?.nom || (cv.nom_candidat || '').split(' ').slice(1).join(' ') || '',
        'Score (%)': cv.matching_score,
        'Région': cv.candidate_details?.region || '',
        'Formation': cv.candidate_details?.formation || '',
        'Poste actuel': cv.candidate_details?.poste_actuel || '',
        'Entreprise': cv.candidate_details?.entreprise_actuelle || '',
        'Expérience': cv.candidate_details?.annees_experience || '',
        'Email': cv.email || '',
        'Téléphone': cv.candidate_details?.telephone || '',
      }))
    );
    const summaryWs = XLSX.utils.json_to_sheet(summaryData);
    summaryWs['!cols'] = [
      { wch: 25 }, { wch: 6 }, { wch: 15 }, { wch: 20 }, { wch: 8 },
      { wch: 15 }, { wch: 25 }, { wch: 25 }, { wch: 25 }, { wch: 10 },
      { wch: 30 }, { wch: 15 },
    ];
    XLSX.utils.book_append_sheet(wb, summaryWs, 'Comparatif Global');
    XLSX.writeFile(wb, `rapport_preselection_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success(t('downloadReport'));
  };

  const handleDownloadPosteReport = (poste: string, candidates: CvAnalysis[]) => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(buildExportRows(poste, candidates));
    ws['!cols'] = EXPORT_COL_WIDTHS;
    XLSX.utils.book_append_sheet(wb, ws, poste.substring(0, 31));
    const safe = poste.replace(/[^a-z0-9]/gi, '_').substring(0, 40);
    XLSX.writeFile(wb, `${safe}_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success(`Export "${poste}" téléchargé`);
  };

  const grouped = analyses.reduce<Record<string, CvAnalysis[]>>((acc, a) => {
    const key = a.poste_assigne || 'Autre';
    if (!acc[key]) acc[key] = [];
    acc[key].push(a);
    return acc;
  }, {});

  // Sort all candidates per poste by score; show ALL (no cap)
  Object.keys(grouped).forEach(key => {
    grouped[key].sort((a, b) => b.matching_score - a.matching_score);
  });

  const posteAccents: Record<string, string> = {
    DAF: 'from-blue-500 to-blue-600',
    RH: 'from-purple-500 to-purple-600',
    'Marketing/Digital': 'from-pink-500 to-pink-600',
    IT: 'from-cyan-500 to-cyan-600',
    Finance: 'from-emerald-500 to-emerald-600',
    Juridique: 'from-amber-500 to-amber-600',
    Commercial: 'from-orange-500 to-orange-600',
    Audit: 'from-indigo-500 to-indigo-600',
  };
  const accentFor = (poste: string) => posteAccents[poste] || 'from-slate-500 to-slate-600';

  const showRunningBar = isExtracting || runnerState.isAnalyzing;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            {t('cvsRetenusTitle')} — Smart Selection
          </h2>
          <p className="text-sm text-muted-foreground mt-1">{t('smartSelectionDesc')}</p>
        </div>
        <div className="flex items-center gap-2">
          {!runnerState.isAnalyzing && runnerState.failed.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                toast.info(`Relance de ${runnerState.failed.length} CV en échec...`);
                cvAnalysisRunner.retryFailed({
                  onError: (msg) => toast.error(msg),
                  onSuccess: (count, total, failed) => {
                    if (failed > 0) toast.warning(`${count}/${total} relancés. ${failed} échec(s) restant(s).`);
                    else toast.success(`${count} CV relancés avec succès !`);
                    loadAnalyses();
                  },
                });
              }}
            >
              <RefreshCw className="h-4 w-4 mr-1" /> Relancer {runnerState.failed.length} échec(s)
            </Button>
          )}
          {analyses.length > 0 && (
            <>
              <Button variant="outline" size="sm" onClick={handleDownloadReport}>
                <Download className="h-4 w-4 mr-1" /> {t('downloadReport')}
              </Button>
              <Button variant="outline" size="sm" onClick={handleDeleteAll}>
                <Trash2 className="h-4 w-4 mr-1" /> {t('clearAll')}
              </Button>
            </>
          )}
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={showRunningBar || targetPositions.length === 0}
            size="sm"
          >
            {showRunningBar ? (
              <><RefreshCw className="h-4 w-4 mr-1 animate-spin" /> En cours...</>
            ) : (
              <><Upload className="h-4 w-4 mr-1" /> {t('uploadCVs')}</>
            )}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.doc,image/*,.jpg,.jpeg,.png,.webp,.bmp,.tif,.tiff,.heic"
            multiple
            className="hidden"
            onChange={e => e.target.files && handleUploadAndAnalyze(e.target.files)}
          />
        </div>
      </div>

      {/* Target Positions Input */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">{t('targetPositionsTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 mb-3">
            <Input
              value={newPosition}
              onChange={e => setNewPosition(e.target.value)}
              placeholder={t('targetPositionPlaceholder')}
              className="flex-1"
              onKeyDown={e => e.key === 'Enter' && addPosition()}
            />
            <Button size="sm" onClick={addPosition} disabled={!newPosition.trim()}>
              <Plus className="h-4 w-4 mr-1" /> {t('add')}
            </Button>
          </div>
          {targetPositions.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">{t('noPositionsDefined')}</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {targetPositions.map((pos, i) => (
                <Badge key={i} variant="secondary" className="text-sm px-3 py-1 flex items-center gap-1">
                  {pos}
                  <button onClick={() => removePosition(i)} className="ml-1 hover:text-destructive">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {showRunningBar && (
        <Card className="border-primary/40 bg-primary/5">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <RefreshCw className="h-4 w-4 animate-spin text-primary" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium mb-1 truncate">
                  {isExtracting
                    ? `Extraction de texte (${extractProgress.current}/${extractProgress.total})${extractProgress.name ? ` — ${extractProgress.name}` : ''}`
                    : `Analyse IA ${runnerState.current}/${runnerState.total}${runnerState.currentName ? ` — ${runnerState.currentName}` : ''}`}
                </p>
                <Progress
                  value={
                    isExtracting
                      ? (extractProgress.current / Math.max(extractProgress.total, 1)) * 100
                      : (runnerState.current / Math.max(runnerState.total, 1)) * 100
                  }
                />
                {!isExtracting && (
                  <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                    <span>L'analyse continue en arrière-plan — vous pouvez naviguer librement.</span>
                    {runnerState.failed.length > 0 && (
                      <span className="text-amber-600 font-medium">
                        {runnerState.failed.length} échec(s) jusqu'ici
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {analyses.length === 0 && !showRunningBar && (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium mb-2">{t('noCvsAnalyzed')}</h3>
            <p className="text-sm text-muted-foreground mb-4">{t('noCvsAnalyzedDesc')}</p>
            {targetPositions.length > 0 && (
              <Button onClick={() => fileInputRef.current?.click()}>
                <Upload className="h-4 w-4 mr-2" /> {t('uploadCVs')}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {Object.keys(grouped).length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Object.entries(grouped).map(([poste, candidates]) => {
            const avgScore = Math.round(
              candidates.reduce((s, c) => s + c.matching_score, 0) / candidates.length
            );
            const topScore = candidates[0]?.matching_score || 0;
            const tone = getScoreTone(topScore);
            const top = candidates[0];
            const accent = accentFor(poste);
            return (
              <Card
                key={poste}
                className="group relative overflow-hidden cursor-pointer hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border-border/60"
                onClick={() => setOpenPoste(poste)}
              >
                {/* Decorative accent bar */}
                <div className={`absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r ${accent}`} />
                {/* Decorative blob */}
                <div className={`absolute -top-16 -right-16 w-40 h-40 rounded-full bg-gradient-to-br ${accent} opacity-10 blur-2xl group-hover:opacity-20 transition-opacity`} />

                <CardHeader className="pb-2 pt-5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">
                        Poste
                      </p>
                      <h3 className="font-bold text-base truncate" title={poste}>{poste}</h3>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all flex-shrink-0 mt-1" />
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Stats row */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-lg bg-muted/50 p-2 text-center">
                      <Users className="h-3.5 w-3.5 mx-auto text-muted-foreground mb-1" />
                      <p className="text-base font-bold">{candidates.length}</p>
                      <p className="text-[10px] text-muted-foreground uppercase">CVs</p>
                    </div>
                    <div className={`rounded-lg ${tone.soft} p-2 text-center`}>
                      <Trophy className={`h-3.5 w-3.5 mx-auto ${tone.text} mb-1`} />
                      <p className={`text-base font-bold ${tone.text}`}>{topScore}%</p>
                      <p className="text-[10px] text-muted-foreground uppercase">Top</p>
                    </div>
                    <div className="rounded-lg bg-muted/50 p-2 text-center">
                      <TrendingUp className="h-3.5 w-3.5 mx-auto text-muted-foreground mb-1" />
                      <p className="text-base font-bold">{avgScore}%</p>
                      <p className="text-[10px] text-muted-foreground uppercase">Moy.</p>
                    </div>
                  </div>

                  {/* Top candidate preview */}
                  {top && (
                    <div className="flex items-center gap-3 p-2.5 rounded-lg border border-border/60 bg-card">
                      <div className={`flex-shrink-0 w-9 h-9 rounded-full bg-gradient-to-br ${accent} flex items-center justify-center text-white text-xs font-bold shadow-sm`}>
                        {getInitials(top.candidate_details?.prenom, top.candidate_details?.nom, top.nom_candidat)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1">
                          <Award className={`h-3 w-3 ${tone.text} flex-shrink-0`} />
                          <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
                            Meilleur candidat
                          </p>
                        </div>
                        <p className="text-sm font-semibold truncate">
                          {top.candidate_details?.prenom || ''}{' '}
                          {top.candidate_details?.nom || top.nom_candidat}
                        </p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Detail dialog */}
      <Dialog open={!!openPoste} onOpenChange={(o) => !o && setOpenPoste(null)}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-start justify-between gap-4 pr-6">
              <div className="min-w-0 flex-1">
                <div className={`inline-block h-1 w-12 rounded-full bg-gradient-to-r ${openPoste ? accentFor(openPoste) : ''} mb-2`} />
                <DialogTitle className="text-xl">{openPoste}</DialogTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {openPoste ? grouped[openPoste]?.length || 0 : 0} candidat(s) — Insights détaillés
                </p>
              </div>
              {openPoste && grouped[openPoste]?.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDownloadPosteReport(openPoste, grouped[openPoste])}
                >
                  <Download className="h-4 w-4 mr-1" /> Export Excel
                </Button>
              )}
            </div>
          </DialogHeader>
          {openPoste && grouped[openPoste] && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
              {grouped[openPoste].map((cv, index) => {
                const tone = getScoreTone(cv.matching_score);
                const accent = accentFor(openPoste);
                return (
                  <Card
                    key={cv.id}
                    className={`relative overflow-hidden border-2 hover:shadow-md transition-shadow ${tone.border}/30`}
                  >
                    {/* Rank badge */}
                    <div className="absolute top-3 left-3 z-10">
                      <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        index === 0 ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200'
                        : index === 1 ? 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                        : index === 2 ? 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-200'
                        : 'bg-muted text-muted-foreground'
                      }`}>
                        {index < 3 && <Trophy className="h-2.5 w-2.5" />} #{index + 1}
                      </div>
                    </div>

                    <CardContent className="p-5 pt-10">
                      {/* Header with avatar + score */}
                      <div className="flex items-start gap-3 mb-4">
                        <div className={`flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-br ${accent} flex items-center justify-center text-white text-sm font-bold shadow-md`}>
                          {getInitials(cv.candidate_details?.prenom, cv.candidate_details?.nom, cv.nom_candidat)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-sm truncate">
                            {cv.candidate_details?.prenom || ''}{' '}
                            {cv.candidate_details?.nom || cv.nom_candidat}
                          </p>
                          <div className="flex flex-col gap-0.5 mt-0.5">
                            {cv.email && (
                              <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                <Mail className="h-3 w-3 flex-shrink-0" />
                                <span className="truncate">{cv.email}</span>
                              </div>
                            )}
                            {cv.candidate_details?.telephone && (
                              <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                <Phone className="h-3 w-3 flex-shrink-0" />
                                <span className="truncate">{cv.candidate_details.telephone}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        {/* Score ring */}
                        <div className={`flex-shrink-0 flex flex-col items-center justify-center w-14 h-14 rounded-full ${tone.bg} text-white shadow-md ring-4 ${tone.ring}`}>
                          <span className="text-base font-bold leading-none">{cv.matching_score}</span>
                          <span className="text-[9px] opacity-90">{tone.label}</span>
                        </div>
                      </div>

                      {/* Detail grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3 text-xs">
                        {cv.candidate_details?.region && (
                          <DetailRow icon={MapPin} label="Région" value={cv.candidate_details.region} />
                        )}
                        {cv.candidate_details?.annees_experience && (
                          <DetailRow icon={Clock} label="Expérience" value={cv.candidate_details.annees_experience} />
                        )}
                        {cv.candidate_details?.formation && (
                          <DetailRow icon={GraduationCap} label="Formation" value={cv.candidate_details.formation} />
                        )}
                        {cv.candidate_details?.etablissement_formation && (
                          <DetailRow icon={Building2} label="École" value={cv.candidate_details.etablissement_formation} />
                        )}
                        {cv.candidate_details?.poste_actuel && (
                          <DetailRow icon={Briefcase} label="Poste actuel" value={cv.candidate_details.poste_actuel} />
                        )}
                        {cv.candidate_details?.entreprise_actuelle && (
                          <DetailRow icon={Building2} label="Entreprise" value={cv.candidate_details.entreprise_actuelle} />
                        )}
                        {cv.candidate_details?.date_debut_poste && (
                          <DetailRow icon={Calendar} label="Depuis" value={cv.candidate_details.date_debut_poste} />
                        )}
                      </div>

                      {/* Skills */}
                      {(cv.competences_cles || []).length > 0 && (
                        <div className="mb-3">
                          <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-1.5">
                            Compétences clés
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {cv.competences_cles.map((comp, i) => (
                              <Badge key={i} variant="secondary" className="text-[11px] px-2 py-0.5 font-normal">
                                {comp}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* AI synthesis */}
                      {cv.synthese_ia && (
                        <div className={`p-2.5 rounded-lg ${tone.soft} border-l-2 ${tone.border} mb-3`}>
                          <div className="flex items-start gap-1.5">
                            <Sparkles className={`h-3 w-3 ${tone.text} flex-shrink-0 mt-0.5`} />
                            <p className="text-xs italic leading-relaxed">{cv.synthese_ia}</p>
                          </div>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex items-center gap-2 pt-2 border-t">
                        {cv.cv_file_path && (
                          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => handleViewCV(cv.cv_file_path)}>
                            <Eye className="h-3 w-3 mr-1" /> Voir CV
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs ml-auto text-muted-foreground hover:text-destructive"
                          onClick={() => handleDeleteCard(cv.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DetailRow({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-start gap-1.5 min-w-0">
      <Icon className="h-3 w-3 text-muted-foreground flex-shrink-0 mt-0.5" />
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">{label}</p>
        <p className="text-xs font-medium truncate" title={value}>{value}</p>
      </div>
    </div>
  );
}
