import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScoreButton } from './ScoreButton';
import { Candidate, JobRoleConfig, EvaluationForm, CriterionScore } from '@/types/evaluation';
import { Save, CheckCircle2, XCircle, User, Briefcase, Mail, Building2 } from 'lucide-react';

interface Props {
  candidates: Candidate[];
  jobRoles: JobRoleConfig[];
  onSave: (evaluation: EvaluationForm) => void;
  existingEvaluation?: EvaluationForm;
}

export function EvaluationFormView({ candidates, jobRoles, onSave, existingEvaluation }: Props) {
  const [selectedCandidateId, setSelectedCandidateId] = useState(existingEvaluation?.candidateId || '');
  const [selectedRoleId, setSelectedRoleId] = useState(existingEvaluation?.jobRoleConfigId || jobRoles[0]?.id || '');
  const [interviewerName, setInterviewerName] = useState(existingEvaluation?.interviewerName || '');
  const [date, setDate] = useState(existingEvaluation?.date || new Date().toISOString().split('T')[0]);
  const [location, setLocation] = useState(existingEvaluation?.location || '');
  const [recruitmentReason, setRecruitmentReason] = useState<'replacement' | 'creation' | 'other'>(existingEvaluation?.recruitmentReason || 'replacement');
  const [recruitmentType, setRecruitmentType] = useState<'budgeted' | 'non-budgeted'>(existingEvaluation?.recruitmentType || 'budgeted');
  const [scores, setScores] = useState<CriterionScore[]>(existingEvaluation?.scores || []);
  const [comments, setComments] = useState(existingEvaluation?.comments || '');
  const [decision, setDecision] = useState<'favorable' | 'unfavorable' | null>(existingEvaluation?.decision || null);

  const selectedCandidate = candidates.find(c => c.id === selectedCandidateId);
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
    if (!selectedCandidateId || !selectedRoleId) return;
    const evaluation: EvaluationForm = {
      id: existingEvaluation?.id || crypto.randomUUID(),
      candidateId: selectedCandidateId,
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
      {/* Candidate Selection */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            Candidate Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Select Candidate (from ATS)</Label>
              <Select value={selectedCandidateId} onValueChange={setSelectedCandidateId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a candidate..." />
                </SelectTrigger>
                <SelectContent>
                  {candidates.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.firstName} {c.lastName} — {c.jobTitle}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Job Role Configuration</Label>
              <Select value={selectedRoleId} onValueChange={setSelectedRoleId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select role..." />
                </SelectTrigger>
                <SelectContent>
                  {jobRoles.map(r => (
                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {selectedCandidate && (
            <div className="rounded-lg bg-primary/5 border border-primary/20 p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-[11px] text-muted-foreground">Name</p>
                  <p className="text-sm font-medium">{selectedCandidate.firstName} {selectedCandidate.lastName}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-[11px] text-muted-foreground">Position</p>
                  <p className="text-sm font-medium">{selectedCandidate.jobTitle}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-[11px] text-muted-foreground">Department</p>
                  <p className="text-sm font-medium">{selectedCandidate.department}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-[11px] text-muted-foreground">Email</p>
                  <p className="text-sm font-medium">{selectedCandidate.email}</p>
                </div>
              </div>
              <div>
                <Badge variant="outline">{selectedCandidate.status}</Badge>
                <Badge variant="secondary" className="ml-2">{selectedCandidate.source}</Badge>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label>Interviewer</Label>
              <Input value={interviewerName} onChange={e => setInterviewerName(e.target.value)} placeholder="Your name" />
            </div>
            <div>
              <Label>Date</Label>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <div>
              <Label>Location</Label>
              <Input value={location} onChange={e => setLocation(e.target.value)} placeholder="Office / Remote" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Reason</Label>
                <Select value={recruitmentReason} onValueChange={v => setRecruitmentReason(v as typeof recruitmentReason)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="replacement">Replacement</SelectItem>
                    <SelectItem value="creation">New Position</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Type</Label>
                <Select value={recruitmentType} onValueChange={v => setRecruitmentType(v as typeof recruitmentType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="budgeted">Budgeted</SelectItem>
                    <SelectItem value="non-budgeted">Non-Budgeted</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Scoring Grid */}
      {selectedRole && (
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Evaluation Grid</CardTitle>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Weighted Score</p>
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
                      <span className="text-sm font-medium">
                        {catScore.score}/{catScore.max}
                      </span>
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
                          <ScoreButton
                            key={v}
                            value={v}
                            selected={getScore(crit.id) === v}
                            onClick={() => setScore(crit.id, v)}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}

            {/* Category Summary */}
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <h4 className="text-sm font-semibold mb-3">Score Breakdown</h4>
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

      {/* Comments & Decision */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">Recruiter's Assessment</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>General Comments</Label>
            <Textarea
              value={comments}
              onChange={e => setComments(e.target.value)}
              placeholder="Enter your overall assessment of the candidate..."
              rows={4}
            />
          </div>
          <div>
            <Label className="mb-2 block">Final Decision</Label>
            <div className="flex gap-3">
              <Button
                type="button"
                variant={decision === 'favorable' ? 'default' : 'outline'}
                className={decision === 'favorable' ? 'bg-success hover:bg-success/90' : ''}
                onClick={() => setDecision('favorable')}
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Favorable
              </Button>
              <Button
                type="button"
                variant={decision === 'unfavorable' ? 'default' : 'outline'}
                className={decision === 'unfavorable' ? 'bg-destructive hover:bg-destructive/90' : ''}
                onClick={() => setDecision('unfavorable')}
              >
                <XCircle className="h-4 w-4 mr-2" />
                Unfavorable
              </Button>
            </div>
          </div>
          <div className="flex justify-end pt-4">
            <Button onClick={handleSave} disabled={!selectedCandidateId} size="lg">
              <Save className="h-4 w-4 mr-2" />
              Save Evaluation
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
