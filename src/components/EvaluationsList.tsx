import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EvaluationForm, JobRoleConfig } from '@/types/evaluation';
import { Trash2, FileText, CheckCircle2, XCircle } from 'lucide-react';
import { useLanguage } from '@/i18n/LanguageContext';

interface Props {
  evaluations: EvaluationForm[];
  jobRoles: JobRoleConfig[];
  onDelete: (id: string) => void;
}

export function EvaluationsList({ evaluations, jobRoles, onDelete }: Props) {
  const { t } = useLanguage();

  if (evaluations.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <FileText className="h-12 w-12 mx-auto mb-3 opacity-40" />
        <p className="text-lg font-medium">{t('noEvaluations')}</p>
        <p className="text-sm">{t('noEvaluationsDesc')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 max-w-4xl mx-auto">
      {evaluations.map(ev => {
        const role = jobRoles.find(r => r.id === ev.jobRoleConfigId);

        let totalScore = 0;
        let maxScore = 0;
        if (role) {
          role.categories.forEach(cat => {
            cat.criteria.forEach(crit => {
              const s = ev.scores.find(sc => sc.criterionId === crit.id)?.score || 0;
              totalScore += s * crit.weight;
              maxScore += role.scaleMax * crit.weight;
            });
          });
        }
        const pct = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;

        return (
          <Card key={ev.id} className="hover:shadow-md transition-shadow">
            <CardContent className="py-4 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-semibold text-sm">
                    {ev.candidateName || t('unknownCandidate')}
                  </p>
                  <Badge variant="outline" className="text-[10px]">
                    {role?.name || t('unknownRole')}
                  </Badge>
                  <Badge variant={ev.candidateSource === 'internal' ? 'secondary' : 'outline'} className="text-[10px]">
                    {ev.candidateSource === 'internal' ? t('internal') : t('external')}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {new Date(ev.date).toLocaleDateString()} · {ev.interviewerName || t('noInterviewer')} · {ev.location || t('noLocation')}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className={`text-xl font-bold ${pct >= 75 ? 'text-success' : pct >= 50 ? 'text-warning' : 'text-destructive'}`}>
                  {pct}%
                </p>
                <p className="text-[10px] text-muted-foreground">{totalScore}/{maxScore}</p>
              </div>
              <div className="shrink-0">
                {ev.decision === 'favorable' && <CheckCircle2 className="h-5 w-5 text-success" />}
                {ev.decision === 'unfavorable' && <XCircle className="h-5 w-5 text-destructive" />}
                {!ev.decision && <span className="text-xs text-muted-foreground">{t('pending')}</span>}
              </div>
              <Button variant="ghost" size="icon" className="text-destructive shrink-0" onClick={() => onDelete(ev.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
