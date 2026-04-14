import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useLanguage } from '@/i18n/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Upload, FileText, Trash2, RefreshCw, Eye, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

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
}

const SCORE_COLORS: Record<string, string> = {
  high: 'bg-green-500',
  medium: 'bg-yellow-500',
  low: 'bg-red-500',
};

const DIRECT_TEXT_MIN_LENGTH = 24;
const READABLE_TEXT_MIN_LENGTH = 10;
const OCR_PAGE_LIMIT = 2;

const normalizeText = (value: string) => value.replace(/\s+/g, ' ').trim();

function getScoreColor(score: number) {
  if (score >= 75) return SCORE_COLORS.high;
  if (score >= 50) return SCORE_COLORS.medium;
  return SCORE_COLORS.low;
}

export function CvsRetenusForm() {
  const { t } = useLanguage();
  const [analyses, setAnalyses] = useState<CvAnalysis[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { loadAnalyses(); }, []);

  const loadAnalyses = async () => {
    const { data } = await supabase
      .from('cv_analyses')
      .select('*')
      .order('matching_score', { ascending: false });
    if (data) {
      setAnalyses(data.map(d => ({
        ...d,
        competences_cles: (d.competences_cles as string[]) || [],
      })));
    }
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

    if (!context) {
      throw new Error('Canvas context unavailable');
    }

    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);

    await page.render({ canvasContext: context, viewport }).promise;
    return canvas.toDataURL('image/png');
  };

  const extractTextFromPdfWithOcr = async (file: File): Promise<string> => {
    const tesseractModule = await import('tesseract.js');
    const createWorker = (tesseractModule as any).createWorker ?? (tesseractModule as any).default?.createWorker;

    if (!createWorker) {
      throw new Error('OCR worker unavailable');
    }

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
    } finally {
      await worker.terminate();
    }

    return normalizeText(ocrText);
  };

  const extractReadableCvText = async (file: File): Promise<string> => {
    const directText = await extractTextFromPdf(file);

    if (directText.length >= DIRECT_TEXT_MIN_LENGTH) {
      return directText;
    }

    const ocrText = await extractTextFromPdfWithOcr(file);
    return normalizeText([directText, ocrText].filter(Boolean).join(' '));
  };

  const handleUploadAndAnalyze = async (files: FileList) => {
    if (files.length === 0) return;

    setIsAnalyzing(true);
    setProgress({ current: 0, total: files.length });

    const sessionId = crypto.randomUUID();
    const cvTexts: { text: string; filePath: string }[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setProgress({ current: i + 1, total: files.length });

      try {
        const text = await extractReadableCvText(file);

        if (text.length < READABLE_TEXT_MIN_LENGTH) {
          toast.error(`${file.name}: unreadable PDF, try a clearer export or scanned copy`);
          continue;
        }

        const path = `${sessionId}/${file.name}`;
        const { error: uploadError } = await supabase.storage.from('cv-uploads').upload(path, file);

        if (uploadError) {
          throw uploadError;
        }

        cvTexts.push({ text, filePath: path });
      } catch (e) {
        console.error('Error processing file:', file.name, e);
        toast.error(`Unable to read ${file.name}`);
      }
    }

    if (cvTexts.length === 0) {
      setIsAnalyzing(false);
      toast.error('No readable CV found');
      return;
    }

    toast.info(`Analyse IA de ${cvTexts.length} CV en cours...`);

    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-cv`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ cvTexts, sessionId }),
        }
      );

      if (resp.status === 429) {
        toast.error('Limite de requêtes atteinte, réessayez plus tard');
      } else if (resp.status === 402) {
        toast.error('Crédits IA insuffisants');
      } else if (!resp.ok) {
        toast.error('Erreur lors de l\'analyse IA');
      } else {
        const data = await resp.json();
        toast.success(`${data.results?.length || 0} CV analysés avec succès !`);
        loadAnalyses();
      }
    } catch (e) {
      console.error('Analysis error:', e);
      toast.error('Erreur de connexion au service d\'analyse');
    }

    setIsAnalyzing(false);
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

  // Group analyses by poste
  const grouped = analyses.reduce<Record<string, CvAnalysis[]>>((acc, a) => {
    const key = a.poste_assigne || 'Autre';
    if (!acc[key]) acc[key] = [];
    acc[key].push(a);
    return acc;
  }, {});

  // Sort each group by score desc and take top 6
  Object.keys(grouped).forEach(key => {
    grouped[key].sort((a, b) => b.matching_score - a.matching_score);
    grouped[key] = grouped[key].slice(0, 6);
  });

  const posteColors: Record<string, string> = {
    DAF: 'bg-blue-100 text-blue-800 border-blue-300',
    RH: 'bg-purple-100 text-purple-800 border-purple-300',
    'Marketing/Digital': 'bg-pink-100 text-pink-800 border-pink-300',
    IT: 'bg-cyan-100 text-cyan-800 border-cyan-300',
    Finance: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    Juridique: 'bg-amber-100 text-amber-800 border-amber-300',
    Commercial: 'bg-orange-100 text-orange-800 border-orange-300',
    Audit: 'bg-indigo-100 text-indigo-800 border-indigo-300',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            {t('cvsRetenusTitle')} — Smart Selection
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {t('smartSelectionDesc')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {analyses.length > 0 && (
            <Button variant="outline" size="sm" onClick={handleDeleteAll}>
              <Trash2 className="h-4 w-4 mr-1" /> {t('clearAll')}
            </Button>
          )}
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={isAnalyzing}
            size="sm"
          >
            {isAnalyzing ? (
              <><RefreshCw className="h-4 w-4 mr-1 animate-spin" /> Analyse en cours...</>
            ) : (
              <><Upload className="h-4 w-4 mr-1" /> {t('uploadCVs')}</>
            )}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            multiple
            className="hidden"
            onChange={e => e.target.files && handleUploadAndAnalyze(e.target.files)}
          />
        </div>
      </div>

      {/* Progress bar */}
      {isAnalyzing && (
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <RefreshCw className="h-4 w-4 animate-spin text-primary" />
              <div className="flex-1">
                <p className="text-sm font-medium mb-1">
                  Traitement des CVs ({progress.current}/{progress.total})
                </p>
                <Progress value={(progress.current / Math.max(progress.total, 1)) * 100} />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {analyses.length === 0 && !isAnalyzing && (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium mb-2">{t('noCvsAnalyzed')}</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {t('noCvsAnalyzedDesc')}
            </p>
            <Button onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-4 w-4 mr-2" /> {t('uploadCVs')}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Kanban columns by poste */}
      {Object.keys(grouped).length > 0 && (
        <div className="grid gap-6">
          {Object.entries(grouped).map(([poste, candidates]) => (
            <Card key={poste}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Badge className={posteColors[poste] || 'bg-gray-100 text-gray-800 border-gray-300'} variant="outline">
                      {poste}
                    </Badge>
                    <span className="text-sm text-muted-foreground font-normal">
                      Top {candidates.length} candidat(s)
                    </span>
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {candidates.map((cv, index) => (
                    <Card key={cv.id} className="relative overflow-hidden border-l-4" style={{
                      borderLeftColor: cv.matching_score >= 75 ? '#22c55e' : cv.matching_score >= 50 ? '#eab308' : '#ef4444'
                    }}>
                      <CardContent className="p-4">
                        {/* Header: Name + Score */}
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <p className="font-semibold text-sm">{cv.nom_candidat}</p>
                            {cv.email && (
                              <p className="text-xs text-muted-foreground">{cv.email}</p>
                            )}
                          </div>
                          <div className={`flex items-center justify-center w-10 h-10 rounded-full text-white text-xs font-bold ${getScoreColor(cv.matching_score)}`}>
                            {cv.matching_score}%
                          </div>
                        </div>

                        {/* Rank badge */}
                        <Badge variant="outline" className="mb-2 text-xs">
                          #{index + 1}
                        </Badge>

                        {/* Competences chips */}
                        <div className="flex flex-wrap gap-1 mb-3">
                          {(cv.competences_cles || []).map((comp, i) => (
                            <Badge key={i} variant="secondary" className="text-xs px-2 py-0.5">
                              {comp}
                            </Badge>
                          ))}
                        </div>

                        {/* AI Insight */}
                        <p className="text-xs italic text-muted-foreground mb-3 line-clamp-2">
                          "{cv.synthese_ia}"
                        </p>

                        {/* Actions */}
                        <div className="flex items-center gap-2">
                          {cv.cv_file_path && (
                            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => handleViewCV(cv.cv_file_path)}>
                              <Eye className="h-3 w-3 mr-1" /> CV
                            </Button>
                          )}
                          <Button variant="ghost" size="sm" className="h-7 text-xs ml-auto" onClick={() => handleDeleteCard(cv.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
