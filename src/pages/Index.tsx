import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EvaluationFormView } from '@/components/EvaluationFormView';
import { EvaluationsList } from '@/components/EvaluationsList';
import { ConfigPanel } from '@/components/ConfigPanel';
import { useEvaluationStore } from '@/hooks/useEvaluationStore';
import { Plus, ClipboardList, Settings2, FileText } from 'lucide-react';
import { toast } from 'sonner';

export default function Index() {
  const store = useEvaluationStore();
  const [activeTab, setActiveTab] = useState('evaluations');
  const [showNewForm, setShowNewForm] = useState(false);

  const handleSave = (evaluation: Parameters<typeof store.saveEvaluation>[0]) => {
    store.saveEvaluation(evaluation);
    setShowNewForm(false);
    setActiveTab('evaluations');
    toast.success('Evaluation saved successfully');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <ClipboardList className="h-4 w-4 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight">Numa — Interview Evaluation</h1>
              <p className="text-[11px] text-muted-foreground">Smart interview assessment grid with auto-scoring</p>
            </div>
          </div>
          <Button onClick={() => { setShowNewForm(true); setActiveTab('new'); }} size="sm">
            <Plus className="h-4 w-4 mr-1" /> New Evaluation
          </Button>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-5xl mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={v => { setActiveTab(v); if (v !== 'new') setShowNewForm(false); }}>
          <TabsList className="mb-6">
            <TabsTrigger value="evaluations" className="gap-1.5">
              <FileText className="h-3.5 w-3.5" /> Evaluations
            </TabsTrigger>
            <TabsTrigger value="new" className="gap-1.5" onClick={() => setShowNewForm(true)}>
              <Plus className="h-3.5 w-3.5" /> New
            </TabsTrigger>
            <TabsTrigger value="config" className="gap-1.5">
              <Settings2 className="h-3.5 w-3.5" /> Configuration
            </TabsTrigger>
          </TabsList>

          <TabsContent value="evaluations">
            <EvaluationsList
              evaluations={store.evaluations}
              candidates={store.candidates}
              jobRoles={store.jobRoles}
              onDelete={id => {
                store.deleteEvaluation(id);
                toast.success('Evaluation deleted');
              }}
            />
          </TabsContent>

          <TabsContent value="new">
            {showNewForm && (
              <EvaluationFormView
                candidates={store.candidates}
                jobRoles={store.jobRoles}
                onSave={handleSave}
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
    </div>
  );
}
