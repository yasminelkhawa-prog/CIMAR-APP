import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/i18n/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { FichePosteData, DEFAULT_FICHE_POSTE, CategorizedItem } from '@/types/fichePoste';
import { Plus, Trash2, Save, Pencil, ArrowLeft, Download } from 'lucide-react';
import { toast } from 'sonner';
import type { Json } from '@/integrations/supabase/types';
import { useAuth } from '@/hooks/useAuth';
import { exportFichePosteDocx } from '@/utils/documentExports';
import { FormAssistant } from '@/components/FormAssistant';
import { RequestSignatureDialog } from '@/components/RequestSignatureDialog';
import { fetchAcceptedSignatures } from '@/hooks/useSignatureRequests';
import { useDocumentLock } from '@/hooks/useDocumentLock';
import { Lock } from 'lucide-react';

interface ListItem {
  id: string;
  data: FichePosteData;
  created_at: string;
}

const normalizeCategorizedItems = (value: unknown, fallback: CategorizedItem[] = []): CategorizedItem[] => {
  if (!Array.isArray(value)) return fallback.map((item) => ({ ...item }));

  return value
    .filter((item): item is Partial<CategorizedItem> => !!item && typeof item === 'object')
    .map((item) => ({
      category: typeof item.category === 'string' ? item.category : '',
      details: typeof item.details === 'string' ? item.details : '',
    }));
};

const normalizeFichePosteData = (value: unknown): FichePosteData => {
  const source = value && typeof value === 'object' ? (value as Partial<FichePosteData>) : {};

  return {
    ...DEFAULT_FICHE_POSTE,
    ...source,
    poste: typeof source.poste === 'string' ? source.poste : DEFAULT_FICHE_POSTE.poste,
    date: typeof source.date === 'string' ? source.date : DEFAULT_FICHE_POSTE.date,
    rattachementHierarchique: typeof source.rattachementHierarchique === 'string' ? source.rattachementHierarchique : DEFAULT_FICHE_POSTE.rattachementHierarchique,
    rattachementFonctionnel: typeof source.rattachementFonctionnel === 'string' ? source.rattachementFonctionnel : DEFAULT_FICHE_POSTE.rattachementFonctionnel,
    supervise: typeof source.supervise === 'string' ? source.supervise : DEFAULT_FICHE_POSTE.supervise,
    nombreSubordonnees: typeof source.nombreSubordonnees === 'string' ? source.nombreSubordonnees : DEFAULT_FICHE_POSTE.nombreSubordonnees,
    perimetre: typeof source.perimetre === 'string' ? source.perimetre : DEFAULT_FICHE_POSTE.perimetre,
    niveauHierarchique: typeof source.niveauHierarchique === 'string' ? source.niveauHierarchique : DEFAULT_FICHE_POSTE.niveauHierarchique,
    mission: typeof source.mission === 'string' ? source.mission : DEFAULT_FICHE_POSTE.mission,
    rolesResponsabilites: normalizeCategorizedItems(source.rolesResponsabilites, DEFAULT_FICHE_POSTE.rolesResponsabilites),
    competences: normalizeCategorizedItems(source.competences, DEFAULT_FICHE_POSTE.competences),
    profil: normalizeCategorizedItems(source.profil, DEFAULT_FICHE_POSTE.profil),
  };
};

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
      const extras = selected
        ? (await fetchAcceptedSignatures('fiche_poste', selected.id)).map(s => ({
            fullName: s.recipient_name, title: s.recipient_title, signatureUrl: s.signature_url, signedAt: s.responded_at,
          }))
        : [];
      await exportFichePosteDocx(formData, {
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
    const { data } = await supabase.from('fiches_poste').select('*').order('created_at', { ascending: false });
    if (data) {
      setItems(data.map(d => ({
        id: d.id,
        data: normalizeFichePosteData(d.data),
        created_at: d.created_at,
      })));
    }
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

  const { locked } = useDocumentLock('fiche_poste', selected?.id ?? null);
  const readOnly = (selected && !editMode) || locked;

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
              <Card key={item.id} className="cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => { setSelected(item); setFormData(normalizeFichePosteData(item.data)); setEditMode(false); }}>
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

  const updateCatItem = (key: 'rolesResponsabilites' | 'competences' | 'profil', index: number, field: 'category' | 'details', value: string) => {
    const arr = [...formData[key]];
    arr[index] = { ...arr[index], [field]: value };
    update({ [key]: arr });
  };

  const addCatItem = (key: 'rolesResponsabilites' | 'competences' | 'profil') => {
    update({ [key]: [...formData[key], { category: '', details: '' }] });
  };

  const removeCatItem = (key: 'rolesResponsabilites' | 'competences' | 'profil', index: number) => {
    update({ [key]: formData[key].filter((_, i) => i !== index) });
  };

  const sectionLabels: Record<'rolesResponsabilites' | 'competences' | 'profil', { title: string; catLabel: string; detailsLabel: string }> = {
    rolesResponsabilites: { title: 'Rôles et responsabilités', catLabel: 'Catégorie', detailsLabel: 'Responsabilités détaillées' },
    competences: { title: 'Compétences', catLabel: 'Type de compétence', detailsLabel: 'Détails' },
    profil: { title: 'Profil du poste', catLabel: 'Critère', detailsLabel: 'Exigence' },
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => { setShowNew(false); setSelected(null); }}>
          <ArrowLeft className="h-4 w-4 mr-1" /> {t('backToList')}
        </Button>
        <div className="flex gap-2 items-start">
          <Button onClick={handleDownload} size="sm" variant="outline">
            <Download className="h-4 w-4 mr-1" /> Télécharger
          </Button>
          {selected && (
            <RequestSignatureDialog docType="fiche_poste" docId={selected.id} docTitle={formData.poste || 'Fiche de poste'} />
          )}
          {locked && (
            <Badge variant="secondary" className="gap-1 self-center">
              <Lock className="h-3 w-3" /> Verrouillé
            </Badge>
          )}
          {readOnly && !locked && (
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
        <CardHeader className="pb-3"><CardTitle className="text-lg">2. Mission</CardTitle></CardHeader>
        <CardContent>
          <Textarea value={formData.mission} onChange={e => update({ mission: e.target.value })} rows={4} disabled={!!readOnly} />
        </CardContent>
      </Card>

      {(['rolesResponsabilites', 'competences', 'profil'] as const).map((key, idx) => {
        const labels = sectionLabels[key];
        return (
          <Card key={key}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{idx + 3}. {labels.title}</CardTitle>
                {!readOnly && (
                  <Button variant="outline" size="sm" onClick={() => addCatItem(key)}>
                    <Plus className="h-4 w-4 mr-1" /> {t('add')}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {formData[key].map((item, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-start border rounded-md p-3">
                  <div className="col-span-4">
                    <Label className="text-xs">{labels.catLabel}</Label>
                    <Input
                      value={item.category}
                      onChange={e => updateCatItem(key, i, 'category', e.target.value)}
                      disabled={!!readOnly}
                    />
                  </div>
                  <div className="col-span-7">
                    <Label className="text-xs">{labels.detailsLabel}</Label>
                    <Textarea
                      value={item.details}
                      onChange={e => updateCatItem(key, i, 'details', e.target.value)}
                      disabled={!!readOnly}
                      rows={3}
                    />
                  </div>
                  <div className="col-span-1 flex items-end justify-end h-full">
                    {!readOnly && formData[key].length > 1 && (
                      <Button variant="ghost" size="icon" onClick={() => removeCatItem(key, i)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        );
      })}

      {!readOnly && (
        <div className="flex justify-end">
          <Button onClick={handleSave} size="lg">
            <Save className="h-4 w-4 mr-2" /> {t('save')}
          </Button>
        </div>
      )}

      <FormAssistant
        formType="fiche_poste"
        currentData={formData}
        disabled={!!readOnly}
        onApply={(s) => {
          setFormData(prev => {
            const next: FichePosteData = { ...prev };
            const scalarKeys: (keyof FichePosteData)[] = ['poste','rattachementHierarchique','rattachementFonctionnel','supervise','nombreSubordonnees','perimetre','niveauHierarchique','mission'];
            scalarKeys.forEach(k => {
              const v = s[k as string];
              if (typeof v === 'string' && v.trim()) (next as any)[k] = v;
            });
            (['rolesResponsabilites','competences','profil'] as const).forEach(k => {
              const v = s[k];
              if (Array.isArray(v) && v.length > 0) {
                const items = v as CategorizedItem[];
                const isEmpty = prev[k].every(it => !it.category && !it.details);
                next[k] = isEmpty ? items : [...prev[k], ...items];
              }
            });
            return next;
          });
        }}
      />
    </div>
  );
}
