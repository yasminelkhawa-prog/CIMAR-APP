import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/i18n/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { CvsRetenusData, CvRetenu, DEFAULT_CVS_RETENUS } from '@/types/cvsRetenus';
import { Plus, Trash2, Save, Pencil, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import type { Json } from '@/integrations/supabase/types';

interface ListItem {
  id: string;
  data: CvsRetenusData;
  created_at: string;
}

export function CvsRetenusForm() {
  const { t } = useLanguage();
  const [items, setItems] = useState<ListItem[]>([]);
  const [selected, setSelected] = useState<ListItem | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [formData, setFormData] = useState<CvsRetenusData>(DEFAULT_CVS_RETENUS);

  useEffect(() => { loadItems(); }, []);

  const loadItems = async () => {
    const { data } = await supabase.from('cvs_retenus').select('*').order('created_at', { ascending: false });
    if (data) setItems(data.map(d => ({ id: d.id, data: d.data as unknown as CvsRetenusData, created_at: d.created_at })));
  };

  const update = useCallback((partial: Partial<CvsRetenusData>) => {
    setFormData(prev => ({ ...prev, ...partial }));
  }, []);

  const handleSave = async () => {
    if (selected) {
      await supabase.from('cvs_retenus').update({ data: formData as unknown as Json }).eq('id', selected.id);
    } else {
      await supabase.from('cvs_retenus').insert({ data: formData as unknown as Json });
    }
    setShowNew(false); setSelected(null); setEditMode(false);
    toast.success(t('evaluationSaved'));
    loadItems();
  };

  const handleDelete = async (id: string) => {
    await supabase.from('cvs_retenus').delete().eq('id', id);
    setItems(prev => prev.filter(i => i.id !== id));
    toast.success(t('deleted'));
  };

  const readOnly = selected && !editMode;

  if (!showNew && !selected) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">{t('cvsRetenusTitle')}</h2>
          <Button onClick={() => { setShowNew(true); setFormData(DEFAULT_CVS_RETENUS); }} size="sm">
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
                    <p className="font-medium">{item.data.posteVise || t('unknownRole')}</p>
                    <p className="text-sm text-muted-foreground">{item.data.candidates.length} candidat(s)</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{new Date(item.created_at).toLocaleDateString()}</Badge>
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

  const updateCandidate = (index: number, partial: Partial<CvRetenu>) => {
    const candidates = formData.candidates.map((c, i) => i === index ? { ...c, ...partial } : c);
    update({ candidates });
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => { setShowNew(false); setSelected(null); }}>
          <ArrowLeft className="h-4 w-4 mr-1" /> {t('backToList')}
        </Button>
        {readOnly && (
          <Button onClick={() => setEditMode(true)} size="sm" variant="outline">
            <Pencil className="h-4 w-4 mr-1" /> {t('modify')}
          </Button>
        )}
      </div>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-lg">{t('cvsRetenusTitle')}</CardTitle></CardHeader>
        <CardContent>
          <div className="mb-4">
            <Label>{t('posteVise')}</Label>
            <Input value={formData.posteVise} onChange={e => update({ posteVise: e.target.value })} disabled={!!readOnly} className="max-w-md" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Candidats</CardTitle>
            {!readOnly && (
              <Button variant="outline" size="sm" onClick={() => update({
                candidates: [...formData.candidates, { id: crypto.randomUUID(), prenom: '', nom: '', posteActuel: '', entrepriseActuelle: '', dateDebutPoste: '', etablissementFormation: '', anneesExperience: '' }]
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
                  <th className="text-left py-2 px-1">{t('prenom')}</th>
                  <th className="text-left py-2 px-1">{t('nom')}</th>
                  <th className="text-left py-2 px-1">{t('posteActuel')}</th>
                  <th className="text-left py-2 px-1">{t('entrepriseActuelle')}</th>
                  <th className="text-left py-2 px-1">{t('dateDebutPoste')}</th>
                  <th className="text-left py-2 px-1">{t('etablissementFormation')}</th>
                  <th className="text-left py-2 px-1">{t('anneesExperience')}</th>
                  {!readOnly && <th className="w-8"></th>}
                </tr>
              </thead>
              <tbody>
                {formData.candidates.map((c, i) => (
                  <tr key={c.id} className="border-b">
                    <td className="py-1 px-1"><Input value={c.prenom} onChange={e => updateCandidate(i, { prenom: e.target.value })} disabled={!!readOnly} className="h-8" /></td>
                    <td className="py-1 px-1"><Input value={c.nom} onChange={e => updateCandidate(i, { nom: e.target.value })} disabled={!!readOnly} className="h-8" /></td>
                    <td className="py-1 px-1"><Input value={c.posteActuel} onChange={e => updateCandidate(i, { posteActuel: e.target.value })} disabled={!!readOnly} className="h-8" /></td>
                    <td className="py-1 px-1"><Input value={c.entrepriseActuelle} onChange={e => updateCandidate(i, { entrepriseActuelle: e.target.value })} disabled={!!readOnly} className="h-8" /></td>
                    <td className="py-1 px-1"><Input value={c.dateDebutPoste} onChange={e => updateCandidate(i, { dateDebutPoste: e.target.value })} disabled={!!readOnly} className="h-8" /></td>
                    <td className="py-1 px-1"><Input value={c.etablissementFormation} onChange={e => updateCandidate(i, { etablissementFormation: e.target.value })} disabled={!!readOnly} className="h-8" /></td>
                    <td className="py-1 px-1"><Input value={c.anneesExperience} onChange={e => updateCandidate(i, { anneesExperience: e.target.value })} disabled={!!readOnly} className="h-8" /></td>
                    {!readOnly && (
                      <td className="py-1 px-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => update({ candidates: formData.candidates.filter((_, j) => j !== i) })}>
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

      {!readOnly && (
        <div className="flex justify-end">
          <Button onClick={handleSave} size="lg">
            <Save className="h-4 w-4 mr-2" /> {t('save')}
          </Button>
        </div>
      )}
    </div>
  );
}
