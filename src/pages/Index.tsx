import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EvaluationFormView } from '@/components/EvaluationFormView';
import { EvaluationsList } from '@/components/EvaluationsList';
import { ConfigPanel } from '@/components/ConfigPanel';
import { ChatBot } from '@/components/ChatBot';
import { LanguageToggle } from '@/components/LanguageToggle';
import { useEvaluationStore } from '@/hooks/useEvaluationStore';
import { useLanguage } from '@/i18n/LanguageContext';
import { EvaluationForm } from '@/types/evaluation';
import { Plus, Settings2, FileText } from 'lucide-react';
import { toast } from 'sonner';
import logoImg from '@/assets/logo-cimar.png';

export default function Index() {
  const store = useEvaluationStore();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState('evaluations');
  const [showNewForm, setShowNewForm] = useState(false);
  const [viewingEvaluation, setViewingEvaluation] = useState<EvaluationForm | null>(null);
  const [editMode, setEditMode] = useState(false);

  const handleSave = (evaluation: Parameters<typeof store.saveEvaluation>[0]) => {
    store.saveEvaluation(evaluation);
    setShowNewForm(false);
    setViewingEvaluation(null);
    setEditMode(false);
    setActiveTab('evaluations');
    toast.success(t('evaluationSaved'));
  };

  const handleSelectEvaluation = (ev: EvaluationForm) => {
    setViewingEvaluation(ev);
    setEditMode(false);
    setActiveTab('view');
  };

  const handleBackToList = () => {
    setViewingEvaluation(null);
    setEditMode(false);
    setActiveTab('evaluations');
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img src={logoImg} alt="Ciments du Maroc" className="h-10 object-contain" />
            <div className="border-l border-border pl-4">
              <h1 className="text-base font-bold tracking-tight">{t('appTitle')}</h1>
              <p className="text-[11px] text-muted-foreground">{t('appSubtitle')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <LanguageToggle />
            <Button onClick={() => { setShowNewForm(true); setViewingEvaluation(null); setActiveTab('new'); }} size="sm">
              <Plus className="h-4 w-4 mr-1" /> {t('newEvaluation')}
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={v => { setActiveTab(v); if (v !== 'new') setShowNewForm(false); if (v !== 'view') { setViewingEvaluation(null); setEditMode(false); } }}>
          <TabsList className="mb-6">
            <TabsTrigger value="evaluations" className="gap-1.5">
              <FileText className="h-3.5 w-3.5" /> {t('evaluations')}
            </TabsTrigger>
            <TabsTrigger value="new" className="gap-1.5" onClick={() => setShowNewForm(true)}>
              <Plus className="h-3.5 w-3.5" /> {t('new')}
            </TabsTrigger>
            <TabsTrigger value="config" className="gap-1.5">
              <Settings2 className="h-3.5 w-3.5" /> {t('configuration')}
            </TabsTrigger>
            {viewingEvaluation && (
              <TabsTrigger value="view" className="gap-1.5 hidden">view</TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="evaluations">
            <EvaluationsList
              evaluations={store.evaluations}
              jobRoles={store.jobRoles}
              onDelete={id => {
                store.deleteEvaluation(id);
                toast.success(t('evaluationDeleted'));
              }}
              onSelect={handleSelectEvaluation}
            />
          </TabsContent>

          <TabsContent value="new">
            {showNewForm && (
              <EvaluationFormView
                jobRoles={store.jobRoles}
                onSave={handleSave}
              />
            )}
          </TabsContent>

          <TabsContent value="view">
            {viewingEvaluation && (
              <EvaluationFormView
                jobRoles={store.jobRoles}
                onSave={handleSave}
                existingEvaluation={viewingEvaluation}
                readOnly={!editMode}
                onEnableEdit={() => setEditMode(true)}
                onBack={handleBackToList}
              />
            )}
          </TabsContent>

          <TabsContent value="config">
            <ConfigPanel
              jobRoles={store.jobRoles}
              onUpdateRole={store.updateJobRole}
              onAddRole={store.addJobRole}
              onDeleteRole={store.deleteJobRole}
              onUpdateCategories={store.updateRoleCategories}
            />
          </TabsContent>
        </Tabs>
      </main>

      <ChatBot jobRoles={store.jobRoles} evaluations={store.evaluations} />
    </div>
  );
}
