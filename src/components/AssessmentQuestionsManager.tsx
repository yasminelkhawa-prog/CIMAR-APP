import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plus, Save, Trash2, GripVertical, Loader2, Settings2 } from 'lucide-react';

interface Question {
  id: string;
  trait: string;
  text: string;
  reversed: boolean;
  sort_order: number;
  is_active: boolean;
}

const TRAITS = [
  { value: 'openness', label: 'Ouverture', color: 'bg-blue-100 text-blue-800' },
  { value: 'conscientiousness', label: 'Conscienciosité', color: 'bg-green-100 text-green-800' },
  { value: 'extraversion', label: 'Extraversion', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'agreeableness', label: 'Agréabilité', color: 'bg-purple-100 text-purple-800' },
  { value: 'neuroticism', label: 'Névrosisme', color: 'bg-red-100 text-red-800' },
];

export function AssessmentQuestionsManager() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newQuestion, setNewQuestion] = useState({ trait: 'openness', text: '', reversed: false });
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => { loadQuestions(); }, []);

  const loadQuestions = async () => {
    const { data } = await supabase
      .from('assessment_questions')
      .select('*')
      .order('sort_order');
    if (data) setQuestions(data as Question[]);
    setLoading(false);
  };

  const addQuestion = async () => {
    if (!newQuestion.text.trim()) return;
    setSaving(true);
    const maxOrder = questions.length > 0 ? Math.max(...questions.map(q => q.sort_order)) : 0;
    const { error } = await supabase.from('assessment_questions').insert({
      trait: newQuestion.trait,
      text: newQuestion.text.trim(),
      reversed: newQuestion.reversed,
      sort_order: maxOrder + 1,
    });
    if (error) toast.error(error.message);
    else {
      toast.success('Question ajoutée');
      setNewQuestion({ trait: 'openness', text: '', reversed: false });
      setShowAdd(false);
      loadQuestions();
    }
    setSaving(false);
  };

  const updateQuestion = async (id: string, updates: Partial<Question>) => {
    const { error } = await supabase.from('assessment_questions').update(updates).eq('id', id);
    if (error) toast.error(error.message);
    else {
      setQuestions(prev => prev.map(q => q.id === id ? { ...q, ...updates } : q));
      toast.success('Mis à jour');
    }
  };

  const deleteQuestion = async (id: string) => {
    const { error } = await supabase.from('assessment_questions').delete().eq('id', id);
    if (error) toast.error(error.message);
    else {
      toast.success('Supprimée');
      loadQuestions();
    }
  };

  const traitInfo = (trait: string) => TRAITS.find(t => t.value === trait) || TRAITS[0];

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Settings2 className="h-5 w-5" /> Questions du Test Psychométrique
        </h3>
        <Button size="sm" onClick={() => setShowAdd(true)}>
          <Plus className="h-4 w-4 mr-1" /> Ajouter
        </Button>
      </div>

      {showAdd && (
        <Card className="border-dashed border-primary/50">
          <CardContent className="py-4 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <Label>Trait OCEAN</Label>
                <Select value={newQuestion.trait} onValueChange={v => setNewQuestion(p => ({ ...p, trait: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TRAITS.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2">
                <Label>Texte de la question</Label>
                <Input
                  value={newQuestion.text}
                  onChange={e => setNewQuestion(p => ({ ...p, text: e.target.value }))}
                  placeholder="Ex: Je suis curieux(se)..."
                />
              </div>
              <div className="flex items-end gap-2">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={newQuestion.reversed}
                    onCheckedChange={v => setNewQuestion(p => ({ ...p, reversed: v }))}
                  />
                  <Label className="text-xs">Inversée</Label>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={addQuestion} disabled={saving || !newQuestion.text.trim()} size="sm">
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                Enregistrer
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowAdd(false)}>Annuler</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {questions.map((q, i) => {
          const trait = traitInfo(q.trait);
          return (
            <Card key={q.id} className={`transition-opacity ${!q.is_active ? 'opacity-50' : ''}`}>
              <CardContent className="py-3 px-4">
                <div className="flex items-start gap-3">
                  <span className="text-xs text-muted-foreground font-mono mt-1">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className={trait.color} variant="secondary">{trait.label}</Badge>
                      {q.reversed && <Badge variant="outline" className="text-[10px]">Inversée</Badge>}
                      {!q.is_active && <Badge variant="outline" className="text-[10px] text-destructive">Désactivée</Badge>}
                    </div>
                    <Input
                      value={q.text}
                      onChange={e => setQuestions(prev => prev.map(x => x.id === q.id ? { ...x, text: e.target.value } : x))}
                      onBlur={() => updateQuestion(q.id, { text: q.text })}
                      className="border-0 p-0 h-auto text-sm focus-visible:ring-0 bg-transparent"
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <Switch
                      checked={q.is_active}
                      onCheckedChange={v => updateQuestion(q.id, { is_active: v })}
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive h-8 w-8 p-0"
                      onClick={() => deleteQuestion(q.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground text-center">
        {questions.filter(q => q.is_active).length} questions actives sur {questions.length} au total
      </p>
    </div>
  );
}
