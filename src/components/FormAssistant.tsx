import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Bot, User, X, Send, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';

export type FormType = 'fiche_poste' | 'fiche_embauche' | 'plan_integration' | 'cvs_retenus';

type Suggestions = Record<string, unknown>;

interface Message {
  role: 'user' | 'assistant';
  content: string;
  suggestions?: Suggestions | null;
  applied?: boolean;
}

interface Props {
  formType: FormType;
  currentData: unknown;
  onApply: (suggestions: Suggestions) => void;
  disabled?: boolean;
}

const TITLES: Record<FormType, string> = {
  fiche_poste: 'Assistant Fiche de Poste',
  fiche_embauche: 'Assistant Fiche d\'Embauche',
  plan_integration: 'Assistant Plan d\'Intégration',
  cvs_retenus: 'Assistant CVs Retenus',
};

const PLACEHOLDERS: Record<FormType, string> = {
  fiche_poste: 'Ex: Propose une mission et 5 responsabilités pour un Chef de Projet Maintenance...',
  fiche_embauche: 'Ex: Suggère un salaire et primes pour un Cadre Production avec 5 ans d\'expérience...',
  plan_integration: 'Ex: Génère un planning d\'intégration de 2 semaines pour un nouvel ingénieur process...',
  cvs_retenus: 'Ex: Quels sont les meilleurs profils pour ce poste ?',
};

export function FormAssistant({ formType, currentData, onApply, disabled }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    const userMsg: Message = { role: 'user', content: input.trim() };
    setMessages((p) => [...p, userMsg]);
    setInput('');
    setIsLoading(true);

    const history = [...messages, userMsg].map((m) => ({ role: m.role, content: m.content }));

    try {
      const { data, error } = await supabase.functions.invoke('form-assistant', {
        body: { messages: history, formType, currentData },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setMessages((p) => [
        ...p,
        {
          role: 'assistant',
          content: data?.text || 'Voici une suggestion.',
          suggestions: data?.suggestions || null,
        },
      ]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erreur inconnue';
      toast.error(msg);
      setMessages((p) => [...p, { role: 'assistant', content: `❌ ${msg}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  const applyAt = (idx: number) => {
    const msg = messages[idx];
    if (!msg.suggestions) return;
    onApply(msg.suggestions);
    setMessages((p) => p.map((m, i) => (i === idx ? { ...m, applied: true } : m)));
    toast.success('Suggestions appliquées au formulaire');
  };

  if (!isOpen) {
    return (
      <Button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 h-14 rounded-full shadow-lg z-50 gap-2 px-5"
        size="lg"
      >
        <Sparkles className="h-5 w-5" />
        <span className="hidden sm:inline">Assistant IA</span>
      </Button>
    );
  }

  return (
    <Card className="fixed bottom-6 right-6 w-[min(420px,calc(100vw-2rem))] h-[min(600px,calc(100vh-3rem))] shadow-2xl z-50 flex flex-col">
      <CardHeader className="pb-2 flex flex-row items-center justify-between shrink-0 border-b">
        <CardTitle className="text-sm flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          {TITLES[formType]}
        </CardTitle>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setIsOpen(false)}>
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col p-3 min-h-0">
        <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-3 mb-3 pr-1">
          {messages.length === 0 && (
            <div className="text-center text-muted-foreground text-xs py-8 space-y-2">
              <Sparkles className="h-8 w-8 mx-auto opacity-40" />
              <p>Demandez à l'IA de vous aider à remplir ce formulaire.</p>
              <p className="text-[11px] italic">{PLACEHOLDERS[formType]}</p>
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'assistant' && <Bot className="h-5 w-5 text-primary shrink-0 mt-1" />}
              <div className={`rounded-lg px-3 py-2 text-sm max-w-[85%] ${
                msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'
              }`}>
                {msg.role === 'assistant' ? (
                  <div className="prose prose-sm max-w-none dark:prose-invert [&_p]:m-0 [&_ul]:my-1 [&_li]:my-0">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                ) : msg.content}

                {msg.suggestions && (
                  <div className="mt-2 pt-2 border-t border-border/50 space-y-2">
                    <div className="flex flex-wrap gap-1">
                      {Object.keys(msg.suggestions).map((k) => (
                        <Badge key={k} variant="secondary" className="text-[10px]">{k}</Badge>
                      ))}
                    </div>
                    {!disabled && (
                      <Button
                        size="sm"
                        className="w-full h-7 text-xs"
                        onClick={() => applyAt(i)}
                        disabled={msg.applied}
                        variant={msg.applied ? 'secondary' : 'default'}
                      >
                        {msg.applied ? (
                          <><Check className="h-3 w-3 mr-1" /> Appliqué</>
                        ) : (
                          <><Sparkles className="h-3 w-3 mr-1" /> Appliquer au formulaire</>
                        )}
                      </Button>
                    )}
                  </div>
                )}
              </div>
              {msg.role === 'user' && <User className="h-5 w-5 text-muted-foreground shrink-0 mt-1" />}
            </div>
          ))}
          {isLoading && (
            <div className="flex gap-2">
              <Bot className="h-5 w-5 text-primary shrink-0 mt-1" />
              <div className="bg-muted rounded-lg px-3 py-2 text-sm">
                <span className="animate-pulse">...</span>
              </div>
            </div>
          )}
        </div>
        <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex gap-2 shrink-0">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Posez une question ou demandez une suggestion..."
            disabled={isLoading}
            className="text-sm"
          />
          <Button type="submit" size="icon" disabled={isLoading || !input.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
