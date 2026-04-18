import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/i18n/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { FicheEmbaucheData, DEFAULT_FICHE_EMBAUCHE, calculateSalary, DEFAULT_SITES } from '@/types/ficheEmbauche';
import { Plus, Trash2, Save, Pencil, ArrowLeft, Download, FileText } from 'lucide-react';
import { toast } from 'sonner';
import type { Json } from '@/integrations/supabase/types';
import { useAuth } from '@/hooks/useAuth';
import { exportFicheEmbaucheXlsx } from '@/utils/documentExports';
import { FormAssistant } from '@/components/FormAssistant';
import { RequestSignatureDialog } from '@/components/RequestSignatureDialog';
import { fetchAcceptedSignatures } from '@/hooks/useSignatureRequests';

interface ListItem {
  id: string;
  data: FicheEmbaucheData;
  created_at: string;
}

export function FicheEmbaucheForm() {
  const { t } = useLanguage();
  const { profile } = useAuth();
  const [items, setItems] = useState<ListItem[]>([]);
  const [selected, setSelected] = useState<ListItem | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [formData, setFormData] = useState<FicheEmbaucheData>(DEFAULT_FICHE_EMBAUCHE);

  // Auto-fill the signed-in user's name into the RH field AND interview panel if empty
  useEffect(() => {
    if (!profile?.full_name) return;
    setFormData(prev => {
      let next = prev;
      // Pre-fill first interviewer slot if it's empty
      if (next.interviewPanel?.length > 0 && !next.interviewPanel[0].name) {
        const panel = [...next.interviewPanel];
        panel[0] = { ...panel[0], name: profile.full_name };
        next = { ...next, interviewPanel: panel };
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.full_name, showNew, selected?.id]);

  useEffect(() => {
    loadItems();
  }, []);

  const handleDownload = async () => {
    try {
      const extras = selected
        ? (await fetchAcceptedSignatures('fiche_embauche', selected.id)).map(s => ({
            fullName: s.recipient_name, title: s.recipient_title, signatureUrl: s.signature_url, signedAt: s.responded_at,
          }))
        : [];
      await exportFicheEmbaucheXlsx(formData, {
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
    const { data } = await supabase.from('fiches_embauche').select('*').order('created_at', { ascending: false });
    if (data) setItems(data.map(d => ({ id: d.id, data: d.data as unknown as FicheEmbaucheData, created_at: d.created_at })));
  };

  const salary = useMemo(() => calculateSalary(formData), [formData]);

  const update = useCallback((partial: Partial<FicheEmbaucheData>) => {
    setFormData(prev => ({ ...prev, ...partial }));
  }, []);

  const handleSave = async () => {
    if (selected) {
      await supabase.from('fiches_embauche').update({ data: formData as unknown as Json }).eq('id', selected.id);
      setItems(prev => prev.map(i => i.id === selected.id ? { ...i, data: formData } : i));
    } else {
      const { data } = await supabase.from('fiches_embauche').insert({ data: formData as unknown as Json }).select().single();
      if (data) {
        setItems(prev => [{ id: data.id, data: formData, created_at: data.created_at }, ...prev]);
      }
    }
    setShowNew(false);
    setSelected(null);
    setEditMode(false);
    toast.success(t('evaluationSaved'));
    loadItems();
  };

  const handleDelete = async (id: string) => {
    await supabase.from('fiches_embauche').delete().eq('id', id);
    setItems(prev => prev.filter(i => i.id !== id));
    toast.success(t('deleted'));
  };

  const readOnly = selected && !editMode;

  // List view
  if (!showNew && !selected) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">{t('ficheEmbaucheTitle')}</h2>
          <Button onClick={() => { setShowNew(true); setFormData(DEFAULT_FICHE_EMBAUCHE); }} size="sm">
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
                    <p className="text-sm text-muted-foreground">{item.data.titrePoste} — {item.data.directionDepartement}</p>
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

  // Form view
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => { setShowNew(false); setSelected(null); setEditMode(false); }}>
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

      {/* Header: Validation */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">{t('ficheEmbaucheTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>{t('directionDemandeuse')}</Label>
              <Input value={formData.directionDemandeuseName} onChange={e => update({ directionDemandeuseName: e.target.value })} disabled={!!readOnly} />
            </div>
            <div>
              <Label>{t('directionRH')}</Label>
              <Input value={formData.directionRHName} onChange={e => update({ directionRHName: e.target.value })} disabled={!!readOnly} />
            </div>
            <div>
              <Label>{t('directionGenerale')}</Label>
              <Input value={formData.directionGeneraleName} onChange={e => update({ directionGeneraleName: e.target.value })} disabled={!!readOnly} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Fonction */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-lg">{t('poste')}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>{t('titrePoste')}</Label>
              <Input value={formData.titrePoste} onChange={e => update({ titrePoste: e.target.value })} disabled={!!readOnly} />
            </div>
            <div>
              <Label>{t('directionDepartement')}</Label>
              <Input value={formData.directionDepartement} onChange={e => update({ directionDepartement: e.target.value })} disabled={!!readOnly} />
            </div>
            <div>
              <Label>{t('rattachementHierarchique')}</Label>
              <Input value={formData.rattachementHierarchique} onChange={e => update({ rattachementHierarchique: e.target.value })} disabled={!!readOnly} />
            </div>
            <div>
              <Label>{t('motifRecrutement')}</Label>
              <Select value={formData.motifRecrutement} onValueChange={v => update({ motifRecrutement: v })} disabled={!!readOnly}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Remplacement">{t('replacement')}</SelectItem>
                  <SelectItem value="Création de poste">{t('newPosition')}</SelectItem>
                  <SelectItem value="Autre">{t('other')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Candidat */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-lg">{t('nomPrenom')}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Input value={formData.nomPrenom} onChange={e => update({ nomPrenom: e.target.value })} disabled={!!readOnly} placeholder={t('candidateNamePlaceholder')} />

          {/* Interview Panel */}
          <div>
            <Label className="mb-2 block">{t('entretienPar')}</Label>
            {formData.interviewPanel.map((p, i) => (
              <div key={i} className="flex gap-2 mb-2">
                <Input value={p.name} onChange={e => {
                  const panel = [...formData.interviewPanel];
                  panel[i] = { ...panel[i], name: e.target.value };
                  update({ interviewPanel: panel });
                }} placeholder="Nom" className="flex-1" disabled={!!readOnly} />
                <Select value={p.avis} onValueChange={v => {
                  const panel = [...formData.interviewPanel];
                  panel[i] = { ...panel[i], avis: v };
                  update({ interviewPanel: panel });
                }} disabled={!!readOnly}>
                  <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Avis favorable">{t('favorable')}</SelectItem>
                    <SelectItem value="Avis défavorable">{t('unfavorable')}</SelectItem>
                  </SelectContent>
                </Select>
                {!readOnly && formData.interviewPanel.length > 1 && (
                  <Button variant="ghost" size="icon" onClick={() => update({ interviewPanel: formData.interviewPanel.filter((_, j) => j !== i) })}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            {!readOnly && (
              <Button variant="outline" size="sm" onClick={() => update({ interviewPanel: [...formData.interviewPanel, { name: '', avis: 'Avis favorable' }] })}>
                <Plus className="h-4 w-4 mr-1" /> {t('add')}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Entrée en fonction */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-lg">Entrée en Fonction</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <Label>{t('dureePreavis')}</Label>
              <Input value={formData.dureePreavis} onChange={e => update({ dureePreavis: e.target.value })} disabled={!!readOnly} />
            </div>
            <div>
              <Label>{t('entreeEnvisagee')}</Label>
              <Input type="date" value={formData.entreeEnvisagee} onChange={e => update({ entreeEnvisagee: e.target.value })} disabled={!!readOnly} />
            </div>
            <div>
              <Label>{t('statut')}</Label>
              <Input value={formData.statut} onChange={e => update({ statut: e.target.value })} disabled={!!readOnly} />
            </div>
            <div>
              <Label>{t('typeContrat')}</Label>
              <Input value={formData.typeContrat} onChange={e => update({ typeContrat: e.target.value })} disabled={!!readOnly} />
            </div>
            <div>
              <Label>{t('dureePeriodeEssai')}</Label>
              <Input value={formData.dureePeriodeEssai} onChange={e => update({ dureePeriodeEssai: e.target.value })} disabled={!!readOnly} />
            </div>
            <div className="flex items-center gap-2 pt-6">
              <Checkbox checked={formData.voitureLieePoste} onCheckedChange={v => update({ voitureLieePoste: !!v })} disabled={!!readOnly} />
              <Label>{t('voitureLieePoste')}</Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* IK */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-lg">{t('indKilometriques')}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {formData.sites.map((site, i) => (
              <div key={site.name} className="flex items-center gap-2 p-2 rounded border">
                <Checkbox checked={site.selected} onCheckedChange={v => {
                  const sites = formData.sites.map((s, j) => j === i ? { ...s, selected: !!v } : { ...s, selected: false });
                  update({ sites });
                }} disabled={!!readOnly} />
                <span className="text-sm flex-1">{site.name}: {site.distance} {site.unit}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-4 mt-2">
            <span className="text-sm font-medium">IK Total: <Badge variant="secondary">{salary.ikTotal.toLocaleString()} Dhs</Badge></span>
          </div>
        </CardContent>
      </Card>

      {/* Situation Actuelle vs Offre */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-lg">{t('situationActuelle')}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {[
              { label: t('salaireBase'), key: 'salaireBaseActuel' as const },
              { label: 'Prime de chantier', key: 'primeChantierActuel' as const },
              { label: 'Indemnité de panier', key: 'indPanierActuel' as const },
              { label: t('indTransport'), key: 'indTransportActuel' as const },
              { label: t('netAPayer'), key: 'salaireNetActuel' as const },
            ].map(f => (
              <div key={f.key} className="flex items-center gap-2">
                <Label className="w-40 text-sm">{f.label}</Label>
                <Input type="number" value={formData[f.key] || ''} onChange={e => update({ [f.key]: parseFloat(e.target.value) || 0 })} disabled={!!readOnly} className="text-right" />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-lg">{t('offreCimar')}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {[
              { label: t('salaireBase'), key: 'salaireBase' as const },
              { label: t('primeLogement'), key: 'primeLogement' as const },
              { label: t('primeSite'), key: 'primeSite' as const },
              { label: t('indTransport'), key: 'indTransport' as const },
              { label: t('primeRepresentation'), key: 'primeRepresentation' as const },
            ].map(f => (
              <div key={f.key} className="flex items-center gap-2">
                <Label className="w-40 text-sm">{f.label}</Label>
                <Input type="number" value={formData[f.key] || ''} onChange={e => update({ [f.key]: parseFloat(e.target.value) || 0 })} disabled={!!readOnly} className="text-right" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Paramètres de calcul */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-lg">{t('calculSalaire')}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <Label>{t('tauxCIMR')}</Label>
              <Select value={String(formData.tauxCIMR)} onValueChange={v => update({ tauxCIMR: parseFloat(v) })} disabled={!!readOnly}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[3, 3.75, 4.5, 5.25, 6].map(r => (
                    <SelectItem key={r} value={String(r)}>{r}%</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t('nbPersonnesCharge')}</Label>
              <Input type="number" value={formData.nbPersonnesCharge} onChange={e => update({ nbPersonnesCharge: parseInt(e.target.value) || 0 })} disabled={!!readOnly} />
            </div>
            <div>
              <Label>{t('tauxAnciennete')}</Label>
              <Input type="number" value={formData.tauxAnciennete} onChange={e => update({ tauxAnciennete: parseFloat(e.target.value) || 0 })} disabled={!!readOnly} placeholder="%" />
            </div>
            <div>
              <Label>{t('mbo')}</Label>
              <Input type="number" value={formData.mbo || ''} onChange={e => update({ mbo: parseFloat(e.target.value) || 0 })} disabled={!!readOnly} />
            </div>
          </div>

          {/* Computed results */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <h4 className="text-sm font-semibold mb-3">Détail du Calcul</h4>
            {[
              { label: 'Revenu Brut Imposable', value: salary.montantRevenuBrutImposable },
              { label: t('fraisPro'), value: salary.fraisPro },
              { label: t('cnss'), value: salary.cnss },
              { label: t('cimr'), value: salary.cimr },
              { label: t('mutuelle'), value: salary.mutuelle },
              { label: t('salaireBrutImposable'), value: salary.salaireBrutImposable },
              { label: t('igrBrut'), value: salary.igrBrut },
              { label: t('chargesFamiliales'), value: salary.chargesFamiliales },
              { label: t('igrNet'), value: salary.igrNet },
            ].map(row => (
              <div key={row.label} className="flex justify-between text-sm">
                <span className="text-muted-foreground">{row.label}</span>
                <span className="font-mono">{row.value.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Dhs</span>
              </div>
            ))}
            <div className="border-t pt-2 mt-2">
              <div className="flex justify-between text-sm font-bold">
                <span>{t('netAPayer')}</span>
                <span className="text-primary">{salary.netAPayer.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Dhs</span>
              </div>
              <div className="flex justify-between text-sm font-bold">
                <span>{t('netMensuelPlusIK')}</span>
                <span className="text-primary">{salary.netMensuelPlusIK.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Dhs</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>{t('salaireAnnuelBrut')}</span>
                <span className="font-mono">{salary.salaireAnnuelBrut.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} Dhs</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Comparatif interne */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">{t('comparatifInterne')}</CardTitle>
            {!readOnly && (
              <Button variant="outline" size="sm" onClick={() => update({
                comparatifInterne: [...formData.comparatifInterne, { nom: '', poste: '', site: '', salaireBrut: 0, primeLogement: 0, primeSite: 0, primeRepresentation: 0, ancienneteCimar: '', experienceAvant: '' }]
              })}>
                <Plus className="h-4 w-4 mr-1" /> {t('add')}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {formData.comparatifInterne.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">{t('noRecords')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-1">{t('nom')}</th>
                    <th className="text-left py-2 px-1">{t('poste')}</th>
                    <th className="text-left py-2 px-1">Site</th>
                    <th className="text-right py-2 px-1">Brut</th>
                    <th className="text-right py-2 px-1">Logement</th>
                    <th className="text-right py-2 px-1">Site</th>
                    {!readOnly && <th className="w-8"></th>}
                  </tr>
                </thead>
                <tbody>
                  {formData.comparatifInterne.map((c, i) => (
                    <tr key={i} className="border-b">
                      <td className="py-1 px-1"><Input value={c.nom} onChange={e => { const arr = [...formData.comparatifInterne]; arr[i] = { ...arr[i], nom: e.target.value }; update({ comparatifInterne: arr }); }} disabled={!!readOnly} className="h-8" /></td>
                      <td className="py-1 px-1"><Input value={c.poste} onChange={e => { const arr = [...formData.comparatifInterne]; arr[i] = { ...arr[i], poste: e.target.value }; update({ comparatifInterne: arr }); }} disabled={!!readOnly} className="h-8" /></td>
                      <td className="py-1 px-1"><Input value={c.site} onChange={e => { const arr = [...formData.comparatifInterne]; arr[i] = { ...arr[i], site: e.target.value }; update({ comparatifInterne: arr }); }} disabled={!!readOnly} className="h-8" /></td>
                      <td className="py-1 px-1"><Input type="number" value={c.salaireBrut || ''} onChange={e => { const arr = [...formData.comparatifInterne]; arr[i] = { ...arr[i], salaireBrut: parseFloat(e.target.value) || 0 }; update({ comparatifInterne: arr }); }} disabled={!!readOnly} className="h-8 text-right" /></td>
                      <td className="py-1 px-1"><Input type="number" value={c.primeLogement || ''} onChange={e => { const arr = [...formData.comparatifInterne]; arr[i] = { ...arr[i], primeLogement: parseFloat(e.target.value) || 0 }; update({ comparatifInterne: arr }); }} disabled={!!readOnly} className="h-8 text-right" /></td>
                      <td className="py-1 px-1"><Input type="number" value={c.primeSite || ''} onChange={e => { const arr = [...formData.comparatifInterne]; arr[i] = { ...arr[i], primeSite: parseFloat(e.target.value) || 0 }; update({ comparatifInterne: arr }); }} disabled={!!readOnly} className="h-8 text-right" /></td>
                      {!readOnly && (
                        <td className="py-1 px-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => update({ comparatifInterne: formData.comparatifInterne.filter((_, j) => j !== i) })}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Save */}
      {!readOnly && (
        <div className="flex justify-end">
          <Button onClick={handleSave} size="lg">
            <Save className="h-4 w-4 mr-2" /> {t('save')}
          </Button>
        </div>
      )}

      <FormAssistant
        formType="fiche_embauche"
        currentData={formData}
        disabled={!!readOnly}
        onApply={(s) => {
          setFormData(prev => {
            const next: FicheEmbaucheData = { ...prev };
            const stringKeys: (keyof FicheEmbaucheData)[] = ['titrePoste','directionDepartement','rattachementHierarchique','motifRecrutement','nomPrenom','statut','typeContrat','dureePeriodeEssai','dureePreavis','entreeEnvisagee'];
            stringKeys.forEach(k => {
              const v = s[k as string];
              if (typeof v === 'string' && v.trim()) (next as any)[k] = v;
            });
            const numKeys: (keyof FicheEmbaucheData)[] = ['salaireBase','primeLogement','primeSite','indTransport','primeRepresentation','tauxCIMR','nbPersonnesCharge','mbo'];
            numKeys.forEach(k => {
              const v = s[k as string];
              if (typeof v === 'number' && !isNaN(v)) (next as any)[k] = v;
            });
            return next;
          });
        }}
      />
    </div>
  );
}
