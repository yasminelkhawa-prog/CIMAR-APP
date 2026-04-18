import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/i18n/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { FichePosteData, DEFAULT_FICHE_POSTE } from '@/types/fichePoste';
import { Plus, Trash2, Save, Pencil, ArrowLeft, Download } from 'lucide-react';
import { toast } from 'sonner';
import type { Json } from '@/integrations/supabase/types';
import { useAuth } from '@/hooks/useAuth';
import { exportFichePosteDocx } from '@/utils/documentExports';

interface ListItem {
  id: string;
  data: FichePosteData;
  created_at: string;
}

export function FichePosteForm() {
  const { t } = useLanguage();
  const { profile } = useAuth();
  const [items, setItems] = useState<ListItem[]>([]);
  const [selected, setSelected] = useState<ListItem | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [formData, setFormData] = useState<FichePosteData>(DEFAULT_FICHE_POSTE);

  useEffect(() => { loadItems(); }, []);

  const handleDownload = async () => {
    try {
      await exportFichePosteDocx(formData, {
        fullName: profile?.full_name,
        title: profile?.title,
        signatureUrl: profile?.signature_url,
      });
      toast.success('Document téléchargé');
    } catch (e) {
      console.error(e);
      toast.error('Erreur lors du téléchargement');
    }
  };

  const loadItems = async () => {
    const { data } = await supabase.from('fiches_poste').select('*').order('created_at', { ascending: false });
    if (data) setItems(data.map(d => ({ id: d.id, data: d.data as unknown as FichePosteData, created_at: d.created_at })));
  };

  const update = useCallback((partial: Partial<FichePosteData>) => {
    setFormData(prev => ({ ...prev, ...partial }));
  }, []);

  const handleSave = async () => {
    if (selected) {
      await supabase.from('fiches_poste').update({ data: formData as unknown as Json }).eq('id', selected.id);
    } else {
      await supabase.from('fiches_poste').insert({ data: formData as unknown as Json });
    }
    setShowNew(false); setSelected(null); setEditMode(false);
    toast.success(t('evaluationSaved'));
    loadItems();
  };

  const handleDelete = async (id: string) => {
    await supabase.from('fiches_poste').delete().eq('id', id);
    setItems(prev => prev.filter(i => i.id !== id));
    toast.success(t('deleted'));
  };

  const readOnly = selected && !editMode;

  if (!showNew && !selected) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">{t('fichePosteTitle')}</h2>
          <Button onClick={() => { setShowNew(true); setFormData(DEFAULT_FICHE_POSTE); }} size="sm">
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
                    <p className="font-medium">{item.data.poste || t('unknownRole')}</p>
                    <p className="text-sm text-muted-foreground">{item.data.rattachementHierarchique}</p>
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

  const updateList = (key: 'rolesResponsabilites' | 'competences' | 'profil', index: number, value: string) => {
    const arr = [...formData[key]];
    arr[index] = value;
    update({ [key]: arr });
  };

  const addToList = (key: 'rolesResponsabilites' | 'competences' | 'profil') => {
    update({ [key]: [...formData[key], ''] });
  };

  const removeFromList = (key: 'rolesResponsabilites' | 'competences' | 'profil', index: number) => {
    update({ [key]: formData[key].filter((_, i) => i !== index) });
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => { setShowNew(false); setSelected(null); }}>
          <ArrowLeft className="h-4 w-4 mr-1" /> {t('backToList')}
        </Button>
        <div className="flex gap-2">
          <Button onClick={handleDownload} size="sm" variant="outline">
            <Download className="h-4 w-4 mr-1" /> Télécharger
          </Button>
          {readOnly && (
            <Button onClick={() => setEditMode(true)} size="sm" variant="outline">
              <Pencil className="h-4 w-4 mr-1" /> {t('modify')}
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-lg">1. {t('candidateInfo')}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><Label>{t('poste')}</Label><Input value={formData.poste} onChange={e => update({ poste: e.target.value })} disabled={!!readOnly} /></div>
            <div><Label>{t('date')}</Label><Input type="date" value={formData.date} onChange={e => update({ date: e.target.value })} disabled={!!readOnly} /></div>
            <div><Label>{t('rattachementHierarchique')}</Label><Input value={formData.rattachementHierarchique} onChange={e => update({ rattachementHierarchique: e.target.value })} disabled={!!readOnly} /></div>
            <div><Label>{t('rattachementFonctionnel')}</Label><Input value={formData.rattachementFonctionnel} onChange={e => update({ rattachementFonctionnel: e.target.value })} disabled={!!readOnly} /></div>
            <div><Label>{t('supervise')}</Label><Input value={formData.supervise} onChange={e => update({ supervise: e.target.value })} disabled={!!readOnly} /></div>
            <div><Label>{t('nombreSubordonnees')}</Label><Input value={formData.nombreSubordonnees} onChange={e => update({ nombreSubordonnees: e.target.value })} disabled={!!readOnly} /></div>
            <div><Label>{t('perimetre')}</Label><Input value={formData.perimetre} onChange={e => update({ perimetre: e.target.value })} disabled={!!readOnly} /></div>
            <div><Label>{t('niveauHierarchique')}</Label><Input value={formData.niveauHierarchique} onChange={e => update({ niveauHierarchique: e.target.value })} disabled={!!readOnly} /></div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-lg">2. {t('mission')}</CardTitle></CardHeader>
        <CardContent>
          <Textarea value={formData.mission} onChange={e => update({ mission: e.target.value })} rows={4} disabled={!!readOnly} />
        </CardContent>
      </Card>

      {(['rolesResponsabilites', 'competences', 'profil'] as const).map((key, idx) => (
        <Card key={key}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">{idx + 3}. {t(key)}</CardTitle>
              {!readOnly && (
                <Button variant="outline" size="sm" onClick={() => addToList(key)}>
                  <Plus className="h-4 w-4 mr-1" /> {t('add')}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {formData[key].map((item, i) => (
              <div key={i} className="flex gap-2">
                <Input value={item} onChange={e => updateList(key, i, e.target.value)} disabled={!!readOnly} />
                {!readOnly && formData[key].length > 1 && (
                  <Button variant="ghost" size="icon" onClick={() => removeFromList(key, i)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      ))}

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
