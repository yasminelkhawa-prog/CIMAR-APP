import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Loader2, Brain, CheckCircle2 } from 'lucide-react';
import logoImg from '@/assets/logo-cimar.png';

interface OceanScores {
  openness: number;
  conscientiousness: number;
  extraversion: number;
  agreeableness: number;
  neuroticism: number;
}

interface Question {
  id: string;
  trait: string;
  text: string;
  reversed: boolean;
  sort_order: number;
}

const SCALE_LABELS = ['Pas du tout d\'accord', 'Pas d\'accord', 'Neutre', 'D\'accord', 'Tout à fait d\'accord'];

export default function AssessmentPage() {
  const { token } = useParams<{ token: string }>();
  const [assessment, setAssessment] = useState<any>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState<number[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!token) return;
    supabase.from('assessments').select('*').eq('uuid_token', token).single()
      .then(({ data, error }) => {
        if (error || !data) { setNotFound(true); }
        else if (data.status !== 'pending') { setSubmitted(true); setAssessment(data); }
        else { setAssessment(data); }
        setLoading(false);
      });
  }, [token]);

  const calculateScores = (): OceanScores => {
    const traitScores: Record<string, number[]> = {
      openness: [], conscientiousness: [], extraversion: [], agreeableness: [], neuroticism: [],
    };
    QUESTIONS.forEach((q, i) => {
      const raw = answers[i];
      const val = q.reversed ? (6 - raw) : raw;
      traitScores[q.trait].push(val);
    });
    const toPercent = (arr: number[]) => Math.round((arr.reduce((a, b) => a + b, 0) / (arr.length * 5)) * 100);
    return {
      openness: toPercent(traitScores.openness),
      conscientiousness: toPercent(traitScores.conscientiousness),
      extraversion: toPercent(traitScores.extraversion),
      agreeableness: toPercent(traitScores.agreeableness),
      neuroticism: toPercent(traitScores.neuroticism),
    };
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    const scores = calculateScores();
    const { error } = await supabase.from('assessments').update({
      ocean_scores: scores as any,
      status: 'completed',
      completed_at: new Date().toISOString(),
    }).eq('uuid_token', token);

    if (error) { console.error(error); }
    setSubmitted(true);
    setSubmitting(false);
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );

  if (notFound) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
      <Card className="max-w-md"><CardContent className="py-12 text-center">
        <p className="text-lg font-medium">Lien invalide ou expiré</p>
        <p className="text-sm text-muted-foreground mt-2">Ce lien d'évaluation n'existe pas.</p>
      </CardContent></Card>
    </div>
  );

  if (submitted) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
      <Card className="max-w-md"><CardContent className="py-12 text-center">
        <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
        <p className="text-lg font-medium">Merci !</p>
        <p className="text-sm text-muted-foreground mt-2">Votre évaluation a été enregistrée avec succès. L'équipe RH analysera vos résultats.</p>
      </CardContent></Card>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center">
          <img src={logoImg} alt="Ciments du Maroc" className="h-10 mx-auto mb-4" />
          <h1 className="text-2xl font-bold flex items-center justify-center gap-2">
            <Brain className="h-6 w-6" /> Évaluation de Personnalité
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Bonjour {assessment.candidate_name}, veuillez répondre honnêtement à chaque question.
          </p>
        </div>

        {QUESTIONS.map((q, i) => (
          <Card key={i} className="shadow-sm">
            <CardContent className="py-4">
              <p className="text-sm font-medium mb-4">{i + 1}. {q.text}</p>
              <div className="px-2">
                <Slider
                  value={[answers[i]]}
                  onValueChange={([v]) => {
                    const next = [...answers];
                    next[i] = v;
                    setAnswers(next);
                  }}
                  min={1} max={5} step={1}
                  className="w-full"
                />
                <div className="flex justify-between mt-2">
                  {SCALE_LABELS.map((label, li) => (
                    <span key={li} className={`text-[10px] text-center ${answers[i] === li + 1 ? 'text-primary font-bold' : 'text-muted-foreground'}`}
                      style={{ width: '20%' }}>
                      {label}
                    </span>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        <div className="text-center pb-8">
          <Button size="lg" onClick={handleSubmit} disabled={submitting}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
            Soumettre mes réponses
          </Button>
        </div>
      </div>
    </div>
  );
}
