import { useState } from 'react';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar, SidebarSection } from '@/components/AppSidebar';
import { EvaluationFormView } from '@/components/EvaluationFormView';
import { EvaluationsList } from '@/components/EvaluationsList';
import { ConfigPanel } from '@/components/ConfigPanel';
import { FicheEmbaucheForm } from '@/components/FicheEmbaucheForm';
import { FichePosteForm } from '@/components/FichePosteForm';
import { PlanIntegrationForm } from '@/components/PlanIntegrationForm';
import { CvsRetenusForm } from '@/components/CvsRetenusForm';
import { BigFiveAssessment } from '@/components/BigFiveAssessment';
import { ChatBot } from '@/components/ChatBot';
import { LanguageToggle } from '@/components/LanguageToggle';
import { NotificationsBell } from '@/components/NotificationsBell';
import { ProfileSettings } from '@/components/ProfileSettings';
import { useAuth } from '@/hooks/useAuth';
import { LogOut } from 'lucide-react';
import { useEvaluationStore } from '@/hooks/useEvaluationStore';
import { useLanguage } from '@/i18n/LanguageContext';
import { EvaluationForm } from '@/types/evaluation';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import logoImg from '@/assets/logo-cimar.png';

export default function Index() {
  const store = useEvaluationStore();
  const { t } = useLanguage();
  const [activeSection, setActiveSection] = useState<SidebarSection>('evaluations');
  const [showNewEval, setShowNewEval] = useState(false);
  const [viewingEvaluation, setViewingEvaluation] = useState<EvaluationForm | null>(null);
  const [editMode, setEditMode] = useState(false);
  const { user, profile, signOut } = useAuth();
  const defaultInterviewer = profile?.full_name || user?.email || '';

  const handleSave = (evaluation: Parameters<typeof store.saveEvaluation>[0]) => {
    store.saveEvaluation(evaluation);
    setShowNewEval(false);
    setViewingEvaluation(null);
    setEditMode(false);
    toast.success(t('evaluationSaved'));
  };

  const handleSelectEvaluation = (ev: EvaluationForm) => {
    setViewingEvaluation(ev);
    setEditMode(false);
  };

  const handleBackToList = () => {
    setViewingEvaluation(null);
    setEditMode(false);
    setShowNewEval(false);
  };

  const renderEvaluations = () => {
    if (showNewEval) {
      return (
        <EvaluationFormView
          jobRoles={store.jobRoles}
          onSave={handleSave}
          defaultInterviewer={defaultInterviewer}
        />
      );
    }
    if (viewingEvaluation) {
      return (
        <EvaluationFormView
          jobRoles={store.jobRoles}
          onSave={handleSave}
          existingEvaluation={viewingEvaluation}
          readOnly={!editMode}
          onEnableEdit={() => setEditMode(true)}
          onBack={handleBackToList}
          defaultInterviewer={defaultInterviewer}
        />
      );
    }
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">{t('evaluations')}</h2>
          <Button onClick={() => setShowNewEval(true)} size="sm">
            <Plus className="h-4 w-4 mr-1" /> {t('newEvaluation')}
          </Button>
        </div>
        <EvaluationsList
          evaluations={store.evaluations}
          jobRoles={store.jobRoles}
          onDelete={id => {
            store.deleteEvaluation(id);
            toast.success(t('evaluationDeleted'));
          }}
          onSelect={handleSelectEvaluation}
        />
      </div>
    );
  };

  const renderContent = () => {
    switch (activeSection) {
      case 'evaluations':
        return renderEvaluations();
      case 'fiche-embauche':
        return <FicheEmbaucheForm />;
      case 'fiche-poste':
        return <FichePosteForm />;
      case 'plan-integration':
        return <PlanIntegrationForm />;
      case 'cvs-retenus':
        return <CvsRetenusForm />;
      case 'big-five':
        return <BigFiveAssessment />;
      case 'profile':
        return <ProfileSettings />;
      case 'config':
        return (
          <ConfigPanel
            jobRoles={store.jobRoles}
            onUpdateRole={store.updateJobRole}
            onAddRole={store.addJobRole}
            onDeleteRole={store.deleteJobRole}
            onUpdateCategories={store.updateRoleCategories}
          />
        );
      default:
        return null;
    }
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar activeSection={activeSection} onSectionChange={s => { setActiveSection(s); setShowNewEval(false); setViewingEvaluation(null); setEditMode(false); }} />

        <div className="flex-1 flex flex-col">
          <header className="border-b bg-card sticky top-0 z-10">
            <div className="px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <SidebarTrigger />
                <img src={logoImg} alt="Ciments du Maroc" className="h-8 object-contain" />
                <div className="border-l border-border pl-3 hidden md:block">
                  <h1 className="text-sm font-bold tracking-tight">{t('appTitle')}</h1>
                  <p className="text-[10px] text-muted-foreground">{t('appSubtitle')}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground hidden sm:inline">{user?.email}</span>
                <NotificationsBell />
                <LanguageToggle />
                <Button size="sm" variant="ghost" onClick={signOut} className="gap-1">
                  <LogOut className="h-4 w-4" /> <span className="hidden sm:inline">Sign out</span>
                </Button>
              </div>
            </div>
          </header>

          <main className="flex-1 p-6 max-w-5xl mx-auto w-full">
            {renderContent()}
          </main>
        </div>
      </div>

      <ChatBot jobRoles={store.jobRoles} evaluations={store.evaluations} />
    </SidebarProvider>
  );
}
