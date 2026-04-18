import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';

import { useLanguage } from '@/i18n/LanguageContext';
import { toast } from 'sonner';
import { Plus, Send, Eye, Loader2, Brain, ExternalLink, Trash2, Settings2 } from 'lucide-react';
import { BigFiveRadarChart } from './BigFiveRadarChart';
import { AssessmentQuestionsManager } from './AssessmentQuestionsManager';

interface Assessment {
  id: string;
  uuid_token: string;
  candidate_name: string;
  candidate_email: string;
  job_role: string;
  ocean_scores: OceanScores | null;
  ai_analysis: AiAnalysis | null;
  status: 'pending' | 'completed' | 'analyzed';
  completed_at: string | null;
  created_at: string;
}

interface OceanScores {
  openness: number;
  conscientiousness: number;
  extraversion: number;
  agreeableness: number;
  neuroticism: number;
}

interface AiAnalysis {
  profile_name: string;
  summary: string;
  job_match: string;
  strengths: string[];
  watch_areas: string[];
}

export function BigFiveAssessment() {
  
  const { t } = useLanguage();
  const [showConfig, setShowConfig] = useState(false);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState('');
  const [creating, setCreating] = useState(false);
  const [selectedAssessment, setSelectedAssessment] = useState<Assessment | null>(null);
  const [analyzing, setAnalyzing] = useState<string | null>(null);

  useEffect(() => {
    loadAssessments();
    const channel = supabase
      .channel('assessments-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'assessments' }, () => {
        loadAssessments();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const loadAssessments = async () => {
    const { data } = await supabase
      .from('assessments')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) {
      setAssessments(data.map(a => ({
        ...a,
        ocean_scores: a.ocean_scores as unknown as OceanScores | null,
        ai_analysis: a.ai_analysis as unknown as AiAnalysis | null,
        status: a.status as 'pending' | 'completed' | 'analyzed',
      })));
    }
    setLoading(false);
  };

  const createAssessment = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    const { error } = await supabase.from('assessments').insert({
      candidate_name: newName.trim(),
      candidate_email: newEmail.trim(),
      job_role: newRole.trim(),
      created_by: null,
    });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Lien d\'évaluation créé');
      setNewName(''); setNewEmail(''); setNewRole('');
      setShowNew(false);
      loadAssessments();
    }
    setCreating(false);
  };

  const deleteAssessment = async (id: string) => {
    await supabase.from('assessments').delete().eq('id', id);
    toast.success('Supprimé');
    if (selectedAssessment?.id === id) setSelectedAssessment(null);
    loadAssessments();
  };

  const analyzeWithAI = async (assessment: Assessment) => {
    if (!assessment.ocean_scores) return;
    setAnalyzing(assessment.id);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-ocean', {
        body: {
          scores: assessment.ocean_scores,
          candidate_name: assessment.candidate_name,
          job_role: assessment.job_role,
        },
      });
      if (error) throw error;
      await supabase.from('assessments').update({
        ai_analysis: data.analysis,
        status: 'analyzed',
      }).eq('id', assessment.id);
      toast.success('Analyse IA terminée');
      loadAssessments();
    } catch (e: any) {
      toast.error(e.message || 'Erreur IA');
    }
    setAnalyzing(null);
  };

  const getAssessmentLink = (token: string) =>
    `${window.location.origin}/assessment/${token}`;

  const copyLink = (token: string) => {
    navigator.clipboard.writeText(getAssessmentLink(token));
    toast.success('Lien copié !');
  };

  const statusColor = (s: string) => {
    if (s === 'pending') return 'bg-yellow-100 text-yellow-800';
    if (s === 'completed') return 'bg-blue-100 text-blue-800';
    return 'bg-green-100 text-green-800';
  };

  const statusLabel = (s: string) => {
    if (s === 'pending') return 'En attente';
    if (s === 'completed') return 'Complété';
    return 'Analysé par IA';
  };

  if (selectedAssessment) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => setSelectedAssessment(null)}>
          ← Retour
        </Button>
        <BigFiveResultView
          assessment={selectedAssessment}
          onAnalyze={() => analyzeWithAI(selectedAssessment)}
          analyzing={analyzing === selectedAssessment.id}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl gradient-primary text-primary-foreground shadow-lg shadow-primary/30">
            <Brain className="h-5 w-5" />
          </span>
          <span className="gradient-text-primary">Évaluation Big Five (OCEAN)</span>
        </h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowConfig(!showConfig)} className="backdrop-blur-sm bg-card/60 lift-on-hover">
            <Settings2 className="h-4 w-4 mr-1" /> Questions
          </Button>
          <Button onClick={() => setShowNew(true)} size="sm" className="gradient-primary text-primary-foreground shadow-md shadow-primary/30 lift-on-hover">
            <Plus className="h-4 w-4 mr-1" /> Nouveau Test
          </Button>
        </div>
      </div>

      {showConfig && <AssessmentQuestionsManager />}

      {showNew && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Créer un lien d'évaluation</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label>Nom du candidat</Label>
                <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Nom complet" />
              </div>
              <div>
                <Label>Email</Label>
                <Input value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="candidat@email.com" type="email" />
              </div>
              <div>
                <Label>Poste visé</Label>
                <Input value={newRole} onChange={e => setNewRole(e.target.value)} placeholder="ex: Ingénieur Process" />
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={createAssessment} disabled={creating || !newName.trim()}>
                {creating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
                Générer le lien
              </Button>
              <Button variant="outline" onClick={() => setShowNew(false)}>Annuler</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : assessments.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Brain className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Aucune évaluation psychométrique</p>
            <p className="text-sm">Créez un lien pour évaluer la personnalité d'un candidat.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {assessments.map(a => (
            <Card key={a.id} className="glass-card glass-card-hover cursor-pointer"
              onClick={() => a.status !== 'pending' ? setSelectedAssessment(a) : null}>
              <CardContent className="py-3 px-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-[hsl(var(--primary-glow)/0.18)]">
                    <Brain className="h-4 w-4 text-primary" />
                  </span>
                  <div>
                    <p className="font-medium text-sm">{a.candidate_name}</p>
                    <p className="text-xs text-muted-foreground">{a.job_role || 'Poste non défini'} • {new Date(a.created_at).toLocaleDateString('fr')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={statusColor(a.status)}>{statusLabel(a.status)}</Badge>
                  {a.status === 'pending' && (
                    <Button size="sm" variant="outline" onClick={e => { e.stopPropagation(); copyLink(a.uuid_token); }}>
                      <ExternalLink className="h-3 w-3 mr-1" /> Copier lien
                    </Button>
                  )}
                  {a.status === 'completed' && (
                    <Button size="sm" variant="default" onClick={e => { e.stopPropagation(); analyzeWithAI(a); }}
                      disabled={analyzing === a.id}
                      className="bg-gradient-to-r from-primary to-[hsl(265_80%_55%)] shadow-md shadow-primary/30">
                      {analyzing === a.id ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Brain className="h-3 w-3 mr-1" />}
                      Analyser
                    </Button>
                  )}
                  {a.status !== 'pending' && (
                    <Button size="sm" variant="ghost" onClick={e => { e.stopPropagation(); setSelectedAssessment(a); }}>
                      <Eye className="h-3 w-3" />
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={e => { e.stopPropagation(); deleteAssessment(a.id); }}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function BigFiveResultView({ assessment, onAnalyze, analyzing }: { assessment: Assessment; onAnalyze: () => void; analyzing: boolean }) {
  const scores = assessment.ocean_scores;
  const analysis = assessment.ai_analysis;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Radar Chart Card - Glassmorphism */}
      <Card className="bg-gradient-to-br from-primary/5 to-primary/10 backdrop-blur-xl border border-white/20 shadow-xl">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Brain className="h-4 w-4" /> Psychological Insight
          </CardTitle>
          <p className="text-xs text-muted-foreground">{assessment.candidate_name} — {assessment.job_role}</p>
        </CardHeader>
        <CardContent>
          {scores ? (
            <BigFiveRadarChart scores={scores} />
          ) : (
            <p className="text-sm text-muted-foreground">Scores non disponibles</p>
          )}
        </CardContent>
      </Card>

      {/* AI Analysis Card */}
      <Card className="bg-gradient-to-br from-accent/5 to-accent/10 backdrop-blur-xl border border-white/20 shadow-xl">
        <CardHeader>
          <CardTitle className="text-sm">Analyse IA</CardTitle>
        </CardHeader>
        <CardContent>
          {analysis ? (
            <div className="space-y-3">
              <div>
                <Badge className="bg-primary/20 text-primary mb-1">{analysis.profile_name}</Badge>
                <p className="text-sm">{analysis.summary}</p>
              </div>
              <div>
                <p className="text-xs font-semibold mb-1">Job Matching</p>
                <p className="text-xs text-muted-foreground">{analysis.job_match}</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-xs font-semibold text-green-600 mb-1">Points forts</p>
                  {analysis.strengths?.map((s, i) => (
                    <p key={i} className="text-xs">✅ {s}</p>
                  ))}
                </div>
                <div>
                  <p className="text-xs font-semibold text-amber-600 mb-1">Zones de vigilance</p>
                  {analysis.watch_areas?.map((w, i) => (
                    <p key={i} className="text-xs">⚠️ {w}</p>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground mb-3">L'analyse IA n'a pas encore été effectuée.</p>
              <Button onClick={onAnalyze} disabled={analyzing || !scores}>
                {analyzing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Brain className="h-4 w-4 mr-1" />}
                Lancer l'analyse IA
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Raw Scores */}
      {scores && (
        <Card className="md:col-span-2">
          <CardHeader><CardTitle className="text-sm">Scores Bruts OCEAN</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-5 gap-3">
              {[
                { key: 'openness', label: 'Ouverture', color: 'bg-blue-500' },
                { key: 'conscientiousness', label: 'Conscienciosité', color: 'bg-green-500' },
                { key: 'extraversion', label: 'Extraversion', color: 'bg-yellow-500' },
                { key: 'agreeableness', label: 'Agréabilité', color: 'bg-purple-500' },
                { key: 'neuroticism', label: 'Névrosisme', color: 'bg-red-500' },
              ].map(trait => (
                <div key={trait.key} className="text-center">
                  <div className="text-2xl font-bold">{(scores as any)[trait.key]}%</div>
                  <div className={`h-1.5 rounded-full ${trait.color} mt-1`} style={{ width: `${(scores as any)[trait.key]}%` }} />
                  <p className="text-xs mt-1 text-muted-foreground">{trait.label}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
