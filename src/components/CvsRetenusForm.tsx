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
  Mail, Phone, Trophy, Award, TrendingUp, User as UserIcon, Crown, ArrowLeft,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import * as pdfjsLib from 'pdfjs-dist';
import * as XLSX from 'xlsx';
import { cvAnalysisRunner, type RunnerState } from '@/lib/cvAnalysisRunner';
import { FormAssistant } from '@/components/FormAssistant';

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
const OCR_PAGE_LIMIT = 6; // reduced from 10 to keep browser-side OCR responsive
const OCR_FILE_TIMEOUT_MS = 90_000; // hard cap per scanned file so the queue can't hang forever
const FILE_PROCESS_TIMEOUT_MS = 120_000;
const STORAGE_UPLOAD_TIMEOUT_MS = 30_000;

const normalizeText = (value: string) => value.replace(/\s+/g, ' ').trim();

/** Run a promise with a hard timeout. Rejects with a clear error if exceeded. */
function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`Timeout (${Math.round(ms / 1000)}s) — ${label}`)), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }).catch((e) => { clearTimeout(t); reject(e); });
  });
}

const buildLimitedAnalysisFallback = (fileName: string, text: string, reason?: string) => (
  `[CV scanné non lisible automatiquement] Nom du fichier: ${fileName}. ` +
  `Raison: ${reason || 'Texte insuffisant ou extraction interrompue'}. ` +
  `Texte extrait: ${text || '(vide)'}`
);

function getScoreTone(score: number) {
  if (score >= 75) return { ring: 'ring-emerald-200', text: 'text-emerald-700', bg: 'bg-emerald-400', soft: 'bg-emerald-50', border: 'border-emerald-200', label: 'Excellent' };
  if (score >= 50) return { ring: 'ring-amber-200', text: 'text-amber-700', bg: 'bg-amber-400', soft: 'bg-amber-50', border: 'border-amber-200', label: 'Bon' };
  return { ring: 'ring-rose-200', text: 'text-rose-700', bg: 'bg-rose-400', soft: 'bg-rose-50', border: 'border-rose-200', label: 'Faible' };
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
  const uploadTargetsRef = useRef<string[] | null>(null);
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
      const ocrText = await withTimeout(extractTextFromImage(file), OCR_FILE_TIMEOUT_MS, `OCR ${file.name}`);
      return cleanupOcrText(ocrText);
    }
    // Try direct text extraction first (fast path for digital PDFs)
    let directText = '';
    try { directText = await extractTextFromPdf(file); } catch (e) { console.warn('PDF text extract failed', file.name, e); }
    if (directText.length >= DIRECT_TEXT_MIN_LENGTH) return directText;
    // Scanned PDF → OCR with hard timeout
    let ocrText = '';
    try {
      ocrText = await withTimeout(extractTextFromPdfWithOcr(file), OCR_FILE_TIMEOUT_MS, `OCR ${file.name}`);
    } catch (e) {
      console.warn('OCR failed/timed out for', file.name, e);
    }
    return cleanupOcrText(normalizeText([directText, ocrText].filter(Boolean).join(' ')));
  };

  const openUploadPicker = (positions?: string[]) => {
    uploadTargetsRef.current = positions?.length ? positions : null;
    fileInputRef.current?.click();
  };

  const handleUploadAndAnalyze = async (files: FileList, forcedTargetPositions?: string[]) => {
    const positions = forcedTargetPositions?.length ? forcedTargetPositions : targetPositions;
    if (files.length === 0) return;
    if (positions.length === 0) {
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
    const skipped: string[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setExtractProgress({ current: i + 1, total: files.length, name: file.name });
        cvAnalysisRunner.setExtractionProgress(i + 1, files.length, file.name);
        try {
          const path = `${sessionId}/${crypto.randomUUID()}/${file.name}`;
          let text = '';
          let extractionReason = '';

          try {
            text = await withTimeout(
              extractReadableCvText(file),
              FILE_PROCESS_TIMEOUT_MS,
              `lecture ${file.name}`,
            );
          } catch (e) {
            extractionReason = e instanceof Error ? e.message : 'Extraction impossible';
            console.error('Extraction failed for file:', file.name, e);
          }

          const { error: uploadError } = await withTimeout(
            supabase.storage.from('cv-uploads').upload(path, file),
            STORAGE_UPLOAD_TIMEOUT_MS,
            `upload ${file.name}`,
          );
          if (uploadError) throw uploadError;

          const cleanedText = normalizeText(text);
          if (cleanedText.length < READABLE_TEXT_MIN_LENGTH || extractionReason) {
            skipped.push(file.name);
            cvTexts.push({
              text: buildLimitedAnalysisFallback(file.name, cleanedText, extractionReason),
              filePath: path,
            });
            toast.warning(
              extractionReason
                ? `${file.name}: extraction interrompue — analyse limitée`
                : `${file.name}: peu lisible — analyse limitée`
            );
          } else {
            cvTexts.push({ text: cleanedText, filePath: path });
          }
        } catch (e) {
          console.error('Error processing file:', file.name, e);
          toast.error(`Impossible de traiter ${file.name}`);
        }
      }
    } finally {
      // Always release the extracting flag, even on uncaught errors
      setIsExtracting(false);
    }

    if (cvTexts.length === 0) {
      toast.error('Aucun CV lisible. Vérifiez la qualité des fichiers.');
      // Reset runner so user is not stuck in "En cours..."
      cvAnalysisRunner.reset();
      return;
    }
    if (skipped.length > 0) {
      toast.info(`${skipped.length} CV envoyé(s) en analyse limitée (OCR échoué).`);
    }

    toast.info(
      positions.length === 1
        ? `Analyse IA de ${cvTexts.length} CV pour « ${positions[0]} » en cours...`
        : `Analyse IA de ${cvTexts.length} CV en cours... Vous pouvez naviguer librement.`
    );

    // Fire and forget — runner is a singleton so it survives unmount
    cvAnalysisRunner.run({
      cvTexts,
      sessionId,
      targetPositions: positions,
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

  const getCvUrl = async (filePath: string) => {
    if (!filePath) {
      toast.error('Aucun fichier CV stocké pour ce candidat');
      return null;
    }
    // Try a signed URL first (works for both public & private buckets, and properly encodes paths with spaces/special chars)
    const { data: signed, error: signedErr } = await supabase
      .storage
      .from('cv-uploads')
      .createSignedUrl(filePath, 3600);

    let url = signed?.signedUrl;

    if (!url) {
      // Fallback: build a public URL with each path segment properly encoded
      const { data: pub } = supabase.storage.from('cv-uploads').getPublicUrl(filePath);
      if (pub?.publicUrl) {
        const marker = '/object/public/cv-uploads/';
        const idx = pub.publicUrl.indexOf(marker);
        if (idx >= 0) {
          const base = pub.publicUrl.slice(0, idx + marker.length);
          const path = pub.publicUrl.slice(idx + marker.length);
          url = base + path.split('/').map(encodeURIComponent).join('/');
        } else {
          url = pub.publicUrl;
        }
      }
    }

    if (!url) {
      console.error('CV file URL error:', signedErr);
      toast.error("Impossible d'accéder au CV");
      return null;
    }

    return url;
  };

  const buildCandidateFileName = (cv: CvAnalysis) => {
    const rawName = [cv.candidate_details?.prenom, cv.candidate_details?.nom]
      .filter(Boolean)
      .join(' ')
      || cv.nom_candidat
      || 'candidat';
    const safeName = rawName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .toLowerCase();
    const extension = cv.cv_file_path?.split('.').pop()?.trim() || 'pdf';
    return `${safeName || 'candidat'}_cv.${extension}`;
  };

  const handleViewCV = async (filePath: string) => {
    try {
      const url = await getCvUrl(filePath);
      if (!url) return;
      const a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e) {
      console.error('CV view exception:', e);
      toast.error("Erreur lors de l'ouverture du CV");
    }
  };

  const handleDownloadCV = async (cv: CvAnalysis) => {
    if (!cv.cv_file_path) {
      toast.error('Aucun fichier CV stocké pour ce candidat');
      return;
    }
    try {
      const url = await getCvUrl(cv.cv_file_path);
      if (!url) return;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Download failed (${response.status})`);
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = buildCandidateFileName(cv);
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
      toast.success('CV téléchargé');
    } catch (e) {
      console.error('CV download exception:', e);
      toast.error('Erreur lors du téléchargement du CV');
    }
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

  // Soft pastel palette — matching reference swatches (rose, peach, sky, mint, lavender...)
  // `icon` = darker pastel for icon backgrounds; `chip` = soft tint for badges; cards stay white.
  const pastelPalette = [
    { icon: 'bg-rose-200', iconText: 'text-rose-700', chip: 'bg-rose-100', text: 'text-rose-700', border: 'border-rose-200', accent: 'bg-rose-300' },
    { icon: 'bg-orange-200', iconText: 'text-orange-700', chip: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200', accent: 'bg-orange-300' },
    { icon: 'bg-blue-200', iconText: 'text-blue-700', chip: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200', accent: 'bg-blue-300' },
    { icon: 'bg-green-200', iconText: 'text-green-700', chip: 'bg-green-100', text: 'text-green-700', border: 'border-green-200', accent: 'bg-green-300' },
    { icon: 'bg-teal-200', iconText: 'text-teal-700', chip: 'bg-teal-100', text: 'text-teal-700', border: 'border-teal-200', accent: 'bg-teal-300' },
    { icon: 'bg-slate-200', iconText: 'text-slate-700', chip: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200', accent: 'bg-slate-300' },
    { icon: 'bg-indigo-200', iconText: 'text-indigo-700', chip: 'bg-indigo-100', text: 'text-indigo-700', border: 'border-indigo-200', accent: 'bg-indigo-300' },
    { icon: 'bg-purple-200', iconText: 'text-purple-700', chip: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-200', accent: 'bg-purple-300' },
    { icon: 'bg-emerald-200', iconText: 'text-emerald-700', chip: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200', accent: 'bg-emerald-300' },
  ];
  const paletteFor = (poste: string) => {
    let hash = 0;
    for (let i = 0; i < poste.length; i++) hash = (hash * 31 + poste.charCodeAt(i)) & 0xffffffff;
    return pastelPalette[Math.abs(hash) % pastelPalette.length];
  };

  const showRunningBar = isExtracting || runnerState.isAnalyzing;

  // ============================================================
  // SUB-PAGE: Detail view for a selected poste (full page, not modal)
  // ============================================================
  if (openPoste && grouped[openPoste]) {
    const candidates = grouped[openPoste];
    const palette = paletteFor(openPoste);
    return (
      <div className="space-y-5">
        {/* Sticky-ish header with back button */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <Button variant="ghost" size="sm" onClick={() => setOpenPoste(null)} className="gap-1">
              <ArrowLeft className="h-4 w-4" /> Retour
            </Button>
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Poste</p>
              <h2 className="text-xl font-bold truncate" title={openPoste}>{openPoste}</h2>
              <p className="text-xs text-muted-foreground">
                {candidates.length} candidat(s) — classés par score
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => openUploadPicker([openPoste])}>
              <Upload className="h-4 w-4 mr-1" /> Ajouter CV
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleDownloadPosteReport(openPoste, candidates)}>
              <Download className="h-4 w-4 mr-1" /> Export Excel
            </Button>
          </div>
        </div>

        <div className={`h-1.5 rounded-full ${palette.accent}`} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {candidates.map((cv, index) => {
            const tone = getScoreTone(cv.matching_score);
            return (
              <div
                key={cv.id}
                className={`group relative overflow-hidden rounded-2xl border ${palette.border} bg-white shadow-[0_4px_20px_rgb(0,0,0,0.04)] hover:shadow-[0_10px_30px_rgb(0,0,0,0.08)] transition-all duration-300 hover:-translate-y-0.5`}
              >
                <div className={`absolute top-0 left-0 right-0 h-1 ${palette.accent}`} />

                {/* Rank badge */}
                <div className="absolute top-3 right-3 z-10">
                  <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                    index === 0 ? 'bg-amber-100 text-amber-800 border-amber-200'
                    : index === 1 ? 'bg-slate-100 text-slate-700 border-slate-200'
                    : index === 2 ? 'bg-orange-100 text-orange-800 border-orange-200'
                    : 'bg-white text-muted-foreground border-slate-200'
                  }`}>
                    {index === 0 ? <Crown className="h-2.5 w-2.5" /> : index < 3 ? <Trophy className="h-2.5 w-2.5" /> : null}
                    #{index + 1}
                  </div>
                </div>

                <div className="relative p-5">
                  <div className="flex items-start gap-3 mb-4">
                    <div className={`flex-shrink-0 w-14 h-14 rounded-2xl ${palette.icon} flex items-center justify-center ${palette.iconText} text-base font-bold shadow-sm ring-2 ring-white`}>
                      {getInitials(cv.candidate_details?.prenom, cv.candidate_details?.nom, cv.nom_candidat)}
                    </div>
                    <div className="min-w-0 flex-1 pr-12">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-0.5">
                        Prénom & Nom
                      </p>
                      <p className="font-bold text-base leading-tight truncate">
                        {cv.candidate_details?.prenom || ''}{' '}
                        {cv.candidate_details?.nom || cv.nom_candidat}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mb-4 flex-wrap">
                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${tone.soft} ${tone.text} border ${tone.border} text-xs font-bold`}>
                      <Sparkles className="h-3 w-3" />
                      {cv.matching_score}% — {tone.label}
                    </div>
                    <div className={`px-2.5 py-1 rounded-full ${palette.chip} border ${palette.border} text-[10px] font-semibold ${palette.text} uppercase tracking-wide`}>
                      {openPoste}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
                    <GlassDetail icon={Briefcase} label="Poste actuel" value={cv.candidate_details?.poste_actuel} palette={palette} />
                    <GlassDetail icon={Building2} label="Entreprise actuelle" value={cv.candidate_details?.entreprise_actuelle} palette={palette} />
                    <GlassDetail icon={Calendar} label="Début poste actuel" value={cv.candidate_details?.date_debut_poste} palette={palette} />
                    <GlassDetail icon={Clock} label="Années d'expérience" value={cv.candidate_details?.annees_experience} palette={palette} />
                    <GlassDetail icon={GraduationCap} label="Établissement formation" value={cv.candidate_details?.etablissement_formation} palette={palette} />
                    <GlassDetail icon={Award} label="Formation" value={cv.candidate_details?.formation} palette={palette} />
                    <GlassDetail icon={Mail} label="Adresse e-mail" value={cv.email} palette={palette} />
                    <GlassDetail icon={Phone} label="Téléphone" value={cv.candidate_details?.telephone} palette={palette} />
                  </div>

                  {(cv.competences_cles || []).length > 0 && (
                    <div className="mb-3">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-1.5">
                        Compétences clés
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {cv.competences_cles.map((comp, i) => (
                          <span
                            key={i}
                            className={`text-[11px] px-2.5 py-1 rounded-full ${palette.chip} ${palette.text} border ${palette.border} font-medium`}
                          >
                            {comp}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {cv.synthese_ia && (
                    <div className={`p-3 rounded-xl ${palette.chip} border ${palette.border} mb-3`}>
                      <div className="flex items-start gap-2">
                        <Sparkles className={`h-3.5 w-3.5 ${palette.text} flex-shrink-0 mt-0.5`} />
                        <p className="text-xs italic leading-relaxed text-foreground/80">{cv.synthese_ia}</p>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
                    {cv.cv_file_path && (
                      <>
                        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => handleViewCV(cv.cv_file_path)}>
                          <Eye className="h-3 w-3 mr-1" /> Voir CV
                        </Button>
                        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => handleDownloadCV(cv)}>
                          <Download className="h-3 w-3 mr-1" /> Télécharger CV
                        </Button>
                      </>
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
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

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
            onClick={() => openUploadPicker()}
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
            onChange={e => {
              const files = e.target.files;
              const forcedPositions = uploadTargetsRef.current ?? undefined;
              uploadTargetsRef.current = null;
              if (files) handleUploadAndAnalyze(files, forcedPositions);
              e.currentTarget.value = '';
            }}
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
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => {
                  cvAnalysisRunner.reset();
                  setIsExtracting(false);
                  setExtractProgress({ current: 0, total: 0, name: '' });
                  toast.info('Analyse annulée');
                }}
                title="Annuler l'analyse en cours"
              >
                <X className="h-4 w-4 mr-1" /> Annuler
              </Button>
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
              <Button onClick={() => openUploadPicker()}>
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
            const palette = paletteFor(poste);
            return (
              <button
                key={poste}
                type="button"
                onClick={() => setOpenPoste(poste)}
                className={`group relative overflow-hidden text-left rounded-2xl border ${palette.border} bg-white cursor-pointer hover:shadow-lg transition-all duration-300 hover:-translate-y-1`}
              >
                <div className={`absolute top-0 left-0 right-0 h-1.5 ${palette.accent}`} />

                <div className="relative p-5 space-y-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className={`text-[11px] uppercase tracking-wider ${palette.text} font-semibold mb-1`}>
                        Poste
                      </p>
                      <h3 className="font-bold text-base truncate text-foreground" title={poste}>{poste}</h3>
                    </div>
                    <ChevronRight className={`h-5 w-5 ${palette.text} opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all flex-shrink-0 mt-1`} />
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div className={`rounded-xl bg-white p-2 text-center border ${palette.border}`}>
                      <Users className={`h-3.5 w-3.5 mx-auto ${palette.text} mb-1`} />
                      <p className="text-base font-bold text-foreground">{candidates.length}</p>
                      <p className="text-[10px] text-muted-foreground uppercase">CVs</p>
                    </div>
                    <div className={`rounded-xl bg-white p-2 text-center border ${palette.border}`}>
                      <Trophy className={`h-3.5 w-3.5 mx-auto ${tone.text} mb-1`} />
                      <p className={`text-base font-bold ${tone.text}`}>{topScore}%</p>
                      <p className="text-[10px] text-muted-foreground uppercase">Top</p>
                    </div>
                    <div className={`rounded-xl bg-white p-2 text-center border ${palette.border}`}>
                      <TrendingUp className={`h-3.5 w-3.5 mx-auto ${palette.text} mb-1`} />
                      <p className="text-base font-bold text-foreground">{avgScore}%</p>
                      <p className="text-[10px] text-muted-foreground uppercase">Moy.</p>
                    </div>
                  </div>

                  {top && (
                    <div className={`flex items-center gap-3 p-2.5 rounded-xl border ${palette.border} bg-white`}>
                      <div className={`flex-shrink-0 w-9 h-9 rounded-full ${palette.icon} flex items-center justify-center ${palette.iconText} text-xs font-bold ring-2 ring-white`}>
                        {getInitials(top.candidate_details?.prenom, top.candidate_details?.nom, top.nom_candidat)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1">
                          <Award className={`h-3 w-3 ${tone.text} flex-shrink-0`} />
                          <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
                            Meilleur candidat
                          </p>
                        </div>
                        <p className="text-sm font-semibold truncate text-foreground">
                          {top.candidate_details?.prenom || ''}{' '}
                          {top.candidate_details?.nom || top.nom_candidat}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Detail dialog */}
      {/* Detail page is rendered above as an early-return view, not a dialog */}
      <FormAssistant
        formType="cvs_retenus"
        currentData={{
          openPoste,
          totalCandidates: analyses.length,
          candidates: analyses.slice(0, 30).map(a => ({
            nom: a.nom_candidat,
            poste: a.poste_assigne,
            score: a.matching_score,
            competences: a.competences_cles,
            synthese: a.synthese_ia,
          })),
        }}
        quickPrompts={[
          'Compare les 3 meilleurs candidats',
          'Génère 5 questions techniques pour le top candidat',
          'Identifie les soft skills dominants',
          'Quels candidats relancer en priorité ?',
        ]}
      />
    </div>
  );
}

function GlassDetail({
  icon: Icon,
  label,
  value,
  palette,
}: {
  icon: any;
  label: string;
  value?: string;
  palette: { icon: string; iconText: string; border: string };
}) {
  const hasValue = !!(value && value.trim());
  return (
    <div className={`flex items-start gap-2 p-2 rounded-lg bg-white border ${palette.border} min-w-0`}>
      <div className={`flex-shrink-0 w-6 h-6 rounded-md ${palette.icon} flex items-center justify-center`}>
        <Icon className={`h-3 w-3 ${palette.iconText}`} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold leading-tight">
          {label}
        </p>
        <p
          className={`text-xs font-medium truncate ${hasValue ? 'text-foreground' : 'text-muted-foreground/60 italic'}`}
          title={hasValue ? value : 'Non renseigné'}
        >
          {hasValue ? value : '—'}
        </p>
      </div>
    </div>
  );
}

