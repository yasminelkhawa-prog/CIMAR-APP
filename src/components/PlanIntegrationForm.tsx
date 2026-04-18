import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useLanguage } from '@/i18n/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { PlanIntegrationData, DEFAULT_PLAN_INTEGRATION, IntegrationEntry } from '@/types/planIntegration';
import { Plus, Trash2, Save, Pencil, ArrowLeft, Download, Lock } from 'lucide-react';
import { toast } from 'sonner';
import type { Json } from '@/integrations/supabase/types';
import { useAuth } from '@/hooks/useAuth';
import { exportPlanIntegrationDocx } from '@/utils/documentExports';
import { FormAssistant } from '@/components/FormAssistant';
import { RequestSignatureDialog } from '@/components/RequestSignatureDialog';
import { fetchAcceptedSignatures } from '@/hooks/useSignatureRequests';
import { useDocumentLock } from '@/hooks/useDocumentLock';

interface ListItem {
  id: string;
  data: PlanIntegrationData;
  created_at: string;
}

export function PlanIntegrationForm() {
  const { t } = useLanguage();
  const { profile } = useAuth();
  const [items, setItems] = useState<ListItem[]>([]);
  const [selected, setSelected] = useState<ListItem | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [formData, setFormData] = useState<PlanIntegrationData>(DEFAULT_PLAN_INTEGRATION);

  // Auto-fill signed-in user as default visa for entries
  useEffect(() => {
    if (!profile?.full_name) return;
    setFormData(prev => {
      const entries = prev.entries.map(e =>
        e.visaResponsable ? e : { ...e, visaResponsable: profile.full_name }
      );
      return { ...prev, entries };
    });
  }, [profile?.full_name, showNew, selected?.id]);

  useEffect(() => { loadItems(); }, []);

  const handleDownload = async () => {
    try {
      const extras = selected
        ? (await fetchAcceptedSignatures('plan_integration', selected.id)).map(s => ({
            fullName: s.recipient_name, title: s.recipient_title, signatureUrl: s.signature_url, signedAt: s.responded_at,
          }))
        : [];
      await exportPlanIntegrationDocx(formData, {
        fullName: profile?.full_name,
        title: profile?.title,
        signatureUrl: profile?.signature_url,
      }, extras);
      toast.success('Document téléchargé');
    } catch (e) {
      console.error(e);
      toast.error('Erreur lors du téléchargement');
    }
  };

  const loadItems = async () => {
    const { data } = await supabase.from('plans_integration').select('*').order('created_at', { ascending: false });
    if (data) setItems(data.map(d => ({ id: d.id, data: d.data as unknown as PlanIntegrationData, created_at: d.created_at })));
  };

  const update = useCallback((partial: Partial<PlanIntegrationData>) => {
    setFormData(prev => ({ ...prev, ...partial }));
  }, []);

  const handleSave = async () => {
    if (selected) {
      await supabase.from('plans_integration').update({ data: formData as unknown as Json }).eq('id', selected.id);
    } else {
      await supabase.from('plans_integration').insert({ data: formData as unknown as Json });
    }
    setShowNew(false); setSelected(null); setEditMode(false);
    toast.success(t('evaluationSaved'));
    loadItems();
  };

  const handleDelete = async (id: string) => {
    await supabase.from('plans_integration').delete().eq('id', id);
    setItems(prev => prev.filter(i => i.id !== id));
    toast.success(t('deleted'));
  };

  const readOnly = selected && !editMode;

  if (!showNew && !selected) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">{t('planIntegrationTitle')}</h2>
          <Button onClick={() => { setShowNew(true); setFormData(DEFAULT_PLAN_INTEGRATION); }} size="sm">
            <Plus className="h-4 w-4 mr-1" /> {t('new')}
          </Button>
        </div>
        {items.length === 0 ? (
          <Card><CardContent className="py-8 text-center text-muted-foreground">{t('noRecords')}</CardContent></Card>
        ) : (
          <div className="grid gap-3">
            {items.map(item => (
              <Card key={item.id} className="cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => { setSelected(item); setFormData(item.data); setEditMode(false); }}>
                <CardContent className="py-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium">{item.data.nomPrenom || t('unknownCandidate')}</p>
                    <p className="text-sm text-muted-foreground">{item.data.posteOccuper}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={item.data.type === 'nouvelle_recrue' ? 'default' : 'secondary'}>
                      {item.data.type === 'nouvelle_recrue' ? t('nouvelleRecrue') : t('reaffectation')}
                    </Badge>
                    <Button variant="ghost" size="icon" onClick={e => { e.stopPropagation(); handleDelete(item.id); }}>
                      <Trash2 className="h-4 w-4" />
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

  const updateEntry = (index: number, partial: Partial<IntegrationEntry>) => {
    const entries = formData.entries.map((e, i) => i === index ? { ...e, ...partial } : e);
    update({ entries });
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => { setShowNew(false); setSelected(null); }}>
          <ArrowLeft className="h-4 w-4 mr-1" /> {t('backToList')}
        </Button>
        <div className="flex gap-2 items-start">
          <Button onClick={handleDownload} size="sm" variant="outline">
            <Download className="h-4 w-4 mr-1" /> Télécharger
          </Button>
          {selected && (
            <RequestSignatureDialog docType="plan_integration" docId={selected.id} docTitle={formData.nomPrenom || "Plan d'intégration"} />
          )}
          {readOnly && (
            <Button onClick={() => setEditMode(true)} size="sm" variant="outline">
              <Pencil className="h-4 w-4 mr-1" /> {t('modify')}
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-lg">{t('planIntegrationTitle')}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div><Label>{t('nomPrenom')}</Label><Input value={formData.nomPrenom} onChange={e => update({ nomPrenom: e.target.value })} disabled={!!readOnly} /></div>
            <div><Label>{t('dateEmbauche')}</Label><Input type="date" value={formData.dateEmbauche} onChange={e => update({ dateEmbauche: e.target.value })} disabled={!!readOnly} /></div>
            <div><Label>{t('posteOccuper')}</Label><Input value={formData.posteOccuper} onChange={e => update({ posteOccuper: e.target.value })} disabled={!!readOnly} /></div>
          </div>
          <div>
            <Label className="mb-2 block">{t('type')}</Label>
            <RadioGroup value={formData.type} onValueChange={v => update({ type: v as 'nouvelle_recrue' | 'reaffectation' })} disabled={!!readOnly} className="flex gap-4">
              <div className="flex items-center gap-2">
                <RadioGroupItem value="nouvelle_recrue" id="nr" />
                <Label htmlFor="nr">{t('nouvelleRecrue')}</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="reaffectation" id="ra" />
                <Label htmlFor="ra">{t('reaffectation')}</Label>
              </div>
            </RadioGroup>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Planning</CardTitle>
            {!readOnly && (
              <Button variant="outline" size="sm" onClick={() => update({
                entries: [...formData.entries, { id: crypto.randomUUID(), activityType: 'planning', date: '', horaire: '', direction: '', responsable: '', objectifs: '', visaResponsable: '', visaRecrue: '' }]
              })}>
                <Plus className="h-4 w-4 mr-1" /> {t('add')}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-1 w-28">Type</th>
                  <th className="text-left py-2 px-1">{t('date')}</th>
                  <th className="text-left py-2 px-1">{t('horaire')}</th>
                  <th className="text-left py-2 px-1">{t('direction')}</th>
                  <th className="text-left py-2 px-1">{t('responsable')}</th>
                  <th className="text-left py-2 px-1">{t('objectifs')}</th>
                  {!readOnly && <th className="w-8"></th>}
                </tr>
              </thead>
              <tbody>
                {formData.entries.map((entry, i) => (
                  <tr key={entry.id} className={`border-b ${entry.activityType === 'formation' ? 'bg-accent/30' : ''}`}>
                    <td className="py-1 px-1">
                      <Select
                        value={entry.activityType || 'planning'}
                        onValueChange={(v) => updateEntry(i, { activityType: v as 'planning' | 'formation' })}
                        disabled={!!readOnly}
                      >
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="planning">Planning</SelectItem>
                          <SelectItem value="formation">Formation</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="py-1 px-1"><Input type="date" value={entry.date} onChange={e => updateEntry(i, { date: e.target.value })} disabled={!!readOnly} className="h-8" /></td>
                    <td className="py-1 px-1"><Input value={entry.horaire} onChange={e => updateEntry(i, { horaire: e.target.value })} disabled={!!readOnly} className="h-8" placeholder="09h00-10h00" /></td>
                    <td className="py-1 px-1"><Input value={entry.direction} onChange={e => updateEntry(i, { direction: e.target.value })} disabled={!!readOnly} className="h-8" /></td>
                    <td className="py-1 px-1"><Input value={entry.responsable} onChange={e => updateEntry(i, { responsable: e.target.value })} disabled={!!readOnly} className="h-8" /></td>
                    <td className="py-1 px-1"><Input value={entry.objectifs} onChange={e => updateEntry(i, { objectifs: e.target.value })} disabled={!!readOnly} className="h-8" /></td>
                    {!readOnly && (
                      <td className="py-1 px-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => update({ entries: formData.entries.filter((_, j) => j !== i) })}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-lg">{t('formations')}</CardTitle></CardHeader>
        <CardContent>
          <Textarea value={formData.formations} onChange={e => update({ formations: e.target.value })} rows={3} disabled={!!readOnly} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-lg">{t('avisHierarchie')}</CardTitle></CardHeader>
        <CardContent>
          <Textarea value={formData.avisHierarchie} onChange={e => update({ avisHierarchie: e.target.value })} rows={3} disabled={!!readOnly} />
        </CardContent>
      </Card>

      {!readOnly && (
        <div className="flex justify-end">
          <Button onClick={handleSave} size="lg">
            <Save className="h-4 w-4 mr-2" /> {t('save')}
          </Button>
        </div>
      )}

      <FormAssistant
        formType="plan_integration"
        currentData={formData}
        disabled={!!readOnly}
        onApply={(s) => {
          setFormData(prev => {
            const next: PlanIntegrationData = { ...prev };
            if (typeof s.posteOccuper === 'string' && s.posteOccuper.trim()) next.posteOccuper = s.posteOccuper;
            if (s.type === 'nouvelle_recrue' || s.type === 'reaffectation') next.type = s.type;
            if (typeof s.formations === 'string' && s.formations.trim()) {
              next.formations = prev.formations ? `${prev.formations}\n${s.formations}` : s.formations;
            }
            if (typeof s.avisHierarchie === 'string' && s.avisHierarchie.trim()) next.avisHierarchie = s.avisHierarchie;
            if (typeof s.appreciation === 'string' && s.appreciation.trim()) next.appreciation = s.appreciation;
            if (Array.isArray(s.entries) && s.entries.length > 0) {
              const newEntries: IntegrationEntry[] = (s.entries as Array<Partial<IntegrationEntry>>).map(e => ({
                id: crypto.randomUUID(),
                activityType: (e.activityType === 'formation' ? 'formation' : 'planning'),
                date: e.date || '',
                horaire: e.horaire || '',
                direction: e.direction || '',
                responsable: e.responsable || '',
                objectifs: e.objectifs || '',
                visaResponsable: '',
                visaRecrue: '',
              }));
              const isEmpty = prev.entries.every(e => !e.direction && !e.responsable && !e.objectifs);
              next.entries = isEmpty ? newEntries : [...prev.entries, ...newEntries];
            }
            return next;
          });
        }}
      />
    </div>
  );
}
