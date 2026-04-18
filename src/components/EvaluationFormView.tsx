import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScoreButton } from './ScoreButton';
import { JobRoleConfig, EvaluationForm, CriterionScore } from '@/types/evaluation';
import { Save, CheckCircle2, XCircle, User, Pencil, ArrowLeft, Lock } from 'lucide-react';
import { useLanguage } from '@/i18n/LanguageContext';
import { RequestSignatureDialog } from '@/components/RequestSignatureDialog';
import { useDocumentLock } from '@/hooks/useDocumentLock';

interface Props {
  jobRoles: JobRoleConfig[];
  onSave: (evaluation: EvaluationForm) => void;
  existingEvaluation?: EvaluationForm;
  readOnly?: boolean;
  onEnableEdit?: () => void;
  onBack?: () => void;
  defaultInterviewer?: string;
}

export function EvaluationFormView({ jobRoles, onSave, existingEvaluation, readOnly: readOnlyProp = false, onEnableEdit, onBack, defaultInterviewer }: Props) {
  const { t } = useLanguage();
  const { locked } = useDocumentLock('evaluation', existingEvaluation?.id ?? null);
  const readOnly = readOnlyProp || locked;
  const [candidateName, setCandidateName] = useState(existingEvaluation?.candidateName || '');
  const [candidateSource, setCandidateSource] = useState<'internal' | 'external'>(existingEvaluation?.candidateSource || 'external');
  const [selectedRoleId, setSelectedRoleId] = useState(existingEvaluation?.jobRoleConfigId || jobRoles[0]?.id || '');
  const [interviewerName, setInterviewerName] = useState(existingEvaluation?.interviewerName || defaultInterviewer || '');
  const [date, setDate] = useState(existingEvaluation?.date || new Date().toISOString().split('T')[0]);
  const [location, setLocation] = useState(existingEvaluation?.location || '');
  const [recruitmentReason, setRecruitmentReason] = useState<'replacement' | 'creation' | 'other'>(existingEvaluation?.recruitmentReason || 'replacement');
  const [recruitmentType, setRecruitmentType] = useState<'budgeted' | 'non-budgeted'>(existingEvaluation?.recruitmentType || 'budgeted');
  const [scores, setScores] = useState<CriterionScore[]>(existingEvaluation?.scores || []);
  const [comments, setComments] = useState(existingEvaluation?.comments || '');
  const [decision, setDecision] = useState<'favorable' | 'unfavorable' | null>(existingEvaluation?.decision || null);

  const selectedRole = jobRoles.find(r => r.id === selectedRoleId);

  const getScore = (criterionId: string) => scores.find(s => s.criterionId === criterionId)?.score || 0;

  const setScore = (criterionId: string, score: number) => {
    setScores(prev => {
      const exists = prev.findIndex(s => s.criterionId === criterionId);
      if (exists >= 0) {
        return prev.map(s => s.criterionId === criterionId ? { ...s, score } : s);
      }
      return [...prev, { criterionId, score }];
    });
  };

  const { totalWeightedScore, maxPossibleScore, percentage, categoryScores } = useMemo(() => {
    if (!selectedRole) return { totalWeightedScore: 0, maxPossibleScore: 0, percentage: 0, categoryScores: [] };

    let total = 0;
    let maxTotal = 0;
    const catScores = selectedRole.categories.map(cat => {
      let catTotal = 0;
      let catMax = 0;
      cat.criteria.forEach(crit => {
        const s = getScore(crit.id);
        catTotal += s * crit.weight;
        catMax += selectedRole.scaleMax * crit.weight;
      });
      total += catTotal;
      maxTotal += catMax;
      return { categoryId: cat.id, name: cat.name, score: catTotal, max: catMax };
    });

    return {
      totalWeightedScore: total,
      maxPossibleScore: maxTotal,
      percentage: maxTotal > 0 ? Math.round((total / maxTotal) * 100) : 0,
      categoryScores: catScores,
    };
  }, [scores, selectedRole]);

  const getPercentageColor = (pct: number) => {
    if (pct >= 75) return 'text-success';
    if (pct >= 50) return 'text-warning';
    return 'text-destructive';
  };

  const handleSave = () => {
    if (!candidateName.trim() || !selectedRoleId) return;
    const evaluation: EvaluationForm = {
      id: existingEvaluation?.id || crypto.randomUUID(),
      candidateName: candidateName.trim(),
      candidateSource,
      jobRoleConfigId: selectedRoleId,
      interviewerName,
      date,
      location,
      recruitmentReason,
      recruitmentType,
      scores,
      comments,
      decision,
      createdAt: existingEvaluation?.createdAt || new Date().toISOString(),
    };
    onSave(evaluation);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Top bar with back, signature request and modify buttons */}
      {existingEvaluation && (
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-1" /> {t('backToList')}
          </Button>
          <div className="flex items-center gap-2">
            {locked && (
              <Badge variant="secondary" className="gap-1">
                <Lock className="h-3 w-3" /> Verrouillé (signé)
              </Badge>
            )}
            <RequestSignatureDialog
              docType="evaluation"
              docId={existingEvaluation.id}
              docTitle={existingEvaluation.candidateName || 'Évaluation'}
            />
            {readOnlyProp && !locked && (
              <Button onClick={onEnableEdit} size="sm" variant="outline">
                <Pencil className="h-4 w-4 mr-1" /> {t('modify')}
              </Button>
            )}
          </div>
        </div>
      )}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            {t('candidateInfo')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>{t('candidateName')}</Label>
              <Input value={candidateName} onChange={e => setCandidateName(e.target.value)} placeholder={t('candidateNamePlaceholder')} disabled={readOnly} />
            </div>
            <div>
              <Label>{t('candidateSource')}</Label>
              <Select value={candidateSource} onValueChange={v => setCandidateSource(v as 'internal' | 'external')} disabled={readOnly}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="internal">{t('internal')}</SelectItem>
                  <SelectItem value="external">{t('external')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t('jobRoleConfig')}</Label>
              <Select value={selectedRoleId} onValueChange={setSelectedRoleId} disabled={readOnly}>
                <SelectTrigger>
                  <SelectValue placeholder={t('selectRole')} />
                </SelectTrigger>
                <SelectContent>
                  {jobRoles.map(r => (
                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label>{t('interviewer')}</Label>
              <Input value={interviewerName} onChange={e => setInterviewerName(e.target.value)} placeholder={t('interviewerPlaceholder')} disabled={readOnly} />
            </div>
            <div>
              <Label>{t('date')}</Label>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} disabled={readOnly} />
            </div>
            <div>
              <Label>{t('location')}</Label>
              <Select value={location} onValueChange={setLocation} disabled={readOnly}>
                <SelectTrigger><SelectValue placeholder={t('locationPlaceholder')} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Sur site">Sur site</SelectItem>
                  <SelectItem value="Bureau">Bureau</SelectItem>
                  <SelectItem value="Télétravail">Télétravail</SelectItem>
                  <SelectItem value="Hybride">Hybride</SelectItem>
                  <SelectItem value="Visioconférence">Visioconférence</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>{t('reason')}</Label>
                <Select value={recruitmentReason} onValueChange={v => setRecruitmentReason(v as typeof recruitmentReason)} disabled={readOnly}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="replacement">{t('replacement')}</SelectItem>
                    <SelectItem value="creation">{t('newPosition')}</SelectItem>
                    <SelectItem value="other">{t('other')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t('type')}</Label>
                <Select value={recruitmentType} onValueChange={v => setRecruitmentType(v as typeof recruitmentType)} disabled={readOnly}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="budgeted">{t('budgeted')}</SelectItem>
                    <SelectItem value="non-budgeted">{t('nonBudgeted')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {selectedRole && (
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">{t('evaluationGrid')}</CardTitle>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">{t('weightedScore')}</p>
                  <p className={`text-2xl font-bold ${getPercentageColor(percentage)}`}>
                    {totalWeightedScore}/{maxPossibleScore}
                  </p>
                </div>
                <div className={`text-3xl font-black ${getPercentageColor(percentage)}`}>
                  {percentage}%
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {selectedRole.categories.map(cat => {
              const catScore = categoryScores.find(cs => cs.categoryId === cat.id);
              return (
                <div key={cat.id} className="space-y-3">
                  <div className="flex items-center justify-between border-b pb-2">
                    <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">{cat.name}</h3>
                    {catScore && (
                      <span className="text-sm font-medium">{catScore.score}/{catScore.max}</span>
                    )}
                  </div>
                  {cat.criteria.map(crit => (
                    <div key={crit.id} className="flex items-center gap-4 py-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium">{crit.name}</p>
                          {crit.weight > 1 && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">×{crit.weight}</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">{crit.description}</p>
                      </div>
                      <div className="flex gap-1.5">
                        {[1, 2, 3, 4].map(v => (
                          <ScoreButton key={v} value={v} selected={getScore(crit.id) === v} onClick={() => !readOnly && setScore(crit.id, v)} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}

            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <h4 className="text-sm font-semibold mb-3">{t('scoreBreakdown')}</h4>
              {categoryScores.map(cs => {
                const pct = cs.max > 0 ? Math.round((cs.score / cs.max) * 100) : 0;
                return (
                  <div key={cs.categoryId} className="flex items-center gap-3">
                    <span className="text-sm min-w-[120px]">{cs.name}</span>
                    <div className="flex-1 h-2 bg-border rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${pct >= 75 ? 'bg-success' : pct >= 50 ? 'bg-warning' : 'bg-destructive'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium min-w-[60px] text-right">{cs.score}/{cs.max}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">{t('recruiterAssessment')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>{t('generalComments')}</Label>
            <Textarea value={comments} onChange={e => setComments(e.target.value)} placeholder={t('commentsPlaceholder')} rows={4} disabled={readOnly} />
          </div>
          <div>
            <Label className="mb-2 block">{t('finalDecision')}</Label>
            <div className="flex gap-3">
               <Button
                 type="button"
                 variant={decision === 'favorable' ? 'default' : 'outline'}
                 className={decision === 'favorable' ? 'bg-success hover:bg-success/90' : ''}
                 onClick={() => !readOnly && setDecision('favorable')}
                 disabled={readOnly}
               >
                 <CheckCircle2 className="h-4 w-4 mr-2" />
                 {t('favorable')}
               </Button>
               <Button
                 type="button"
                 variant={decision === 'unfavorable' ? 'default' : 'outline'}
                 className={decision === 'unfavorable' ? 'bg-destructive hover:bg-destructive/90' : ''}
                 onClick={() => !readOnly && setDecision('unfavorable')}
                 disabled={readOnly}
               >
                 <XCircle className="h-4 w-4 mr-2" />
                 {t('unfavorable')}
               </Button>
            </div>
          </div>
          {!readOnly && (
            <div className="flex justify-end pt-4">
              <Button onClick={handleSave} disabled={!candidateName.trim()} size="lg">
                <Save className="h-4 w-4 mr-2" />
                {t('saveEvaluation')}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
