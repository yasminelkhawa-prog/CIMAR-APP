import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Send, Bot, User, MessageSquare, X } from 'lucide-react';
import { useLanguage } from '@/i18n/LanguageContext';
import { JobRoleConfig, EvaluationForm } from '@/types/evaluation';
import ReactMarkdown from 'react-markdown';

type Message = { role: 'user' | 'assistant'; content: string };

interface Props {
  jobRoles: JobRoleConfig[];
  evaluations: EvaluationForm[];
}

export function ChatBot({ jobRoles, evaluations }: Props) {
  const { t, lang } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const buildContext = () => {
    const rolesInfo = jobRoles.map(r => {
      const criteria = r.categories.flatMap(c => c.criteria.map(cr => `${cr.name} (weight: ${cr.weight}): ${cr.description}`));
      return `Role: ${r.name}\nCriteria:\n${criteria.join('\n')}`;
    }).join('\n\n');

    const evalsSummary = evaluations.length > 0
      ? evaluations.map(e => {
          const role = jobRoles.find(r => r.id === e.jobRoleConfigId);
          let total = 0, max = 0;
          role?.categories.forEach(cat => cat.criteria.forEach(crit => {
            const s = e.scores.find(sc => sc.criterionId === crit.id)?.score || 0;
            total += s * crit.weight;
            max += (role.scaleMax) * crit.weight;
          }));
          const pct = max > 0 ? Math.round((total / max) * 100) : 0;
          return `${e.candidateName} (${role?.name || 'unknown'}): ${pct}% - ${e.decision || 'pending'}`;
        }).join('\n')
      : 'No evaluations yet.';

    return `You are an AI recruitment assistant for Ciments du Maroc (Heidelberg Materials). You help recruiters with:
- Understanding evaluation criteria and scoring guidelines
- Suggesting interview questions tailored to job roles
- Providing scoring recommendations based on candidate responses
- Analyzing evaluation patterns and identifying top candidates
- Best practices for structured interviews

Available evaluation grids:
${rolesInfo}

Current evaluations:
${evalsSummary}

Respond in ${lang === 'fr' ? 'French' : 'English'}. Be concise and actionable.`;
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    const userMsg: Message = { role: 'user', content: input.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    const allMessages = [...messages, userMsg];

    try {
      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
      const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
        body: JSON.stringify({
          messages: allMessages,
          systemPrompt: buildContext(),
        }),
      });

      if (!resp.ok || !resp.body) throw new Error('Failed to connect');

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let assistantContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIdx: number;
        while ((newlineIdx = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, newlineIdx);
          buffer = buffer.slice(newlineIdx + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              assistantContent += content;
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === 'assistant') {
                  return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantContent } : m);
                }
                return [...prev, { role: 'assistant', content: assistantContent }];
              });
            }
          } catch { /* partial JSON */ }
        }
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: lang === 'fr' ? 'Désolé, une erreur s\'est produite. Veuillez réessayer.' : 'Sorry, an error occurred. Please try again.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) {
    return (
      <Button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full z-50 ai-launcher-glow
          bg-gradient-to-br from-primary to-[hsl(265_80%_55%)] text-primary-foreground
          hover:scale-105 transition-transform"
        size="icon"
      >
        <MessageSquare className="h-6 w-6" />
      </Button>
    );
  }

  return (
    <Card className="fixed bottom-6 right-6 w-96 h-[500px] z-50 flex flex-col glass-card ring-glow-primary">
      <CardHeader className="pb-2 flex flex-row items-center justify-between shrink-0">
        <CardTitle className="text-sm flex items-center gap-2">
          <Bot className="h-4 w-4 text-primary" />
          {t('chatbot')}
        </CardTitle>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setIsOpen(false)}>
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col p-3 pt-0 min-h-0">
        <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-3 mb-3 pr-1">
          {messages.length === 0 && (
            <div className="text-center text-muted-foreground text-xs py-8">
              <Bot className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p>{lang === 'fr' ? 'Posez-moi des questions sur les évaluations, les critères ou les techniques d\'entretien !' : 'Ask me about evaluations, criteria, or interview techniques!'}</p>
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'assistant' && <Bot className="h-5 w-5 text-primary shrink-0 mt-1" />}
              <div className={`rounded-lg px-3 py-2 text-sm max-w-[80%] ${
                msg.role === 'user' 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-muted text-foreground'
              }`}>
                {msg.role === 'assistant' ? (
                  <div className="prose prose-sm max-w-none dark:prose-invert [&_p]:m-0 [&_ul]:my-1 [&_li]:my-0">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                ) : msg.content}
              </div>
              {msg.role === 'user' && <User className="h-5 w-5 text-muted-foreground shrink-0 mt-1" />}
            </div>
          ))}
          {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
            <div className="flex gap-2">
              <Bot className="h-5 w-5 text-primary shrink-0 mt-1" />
              <div className="bg-muted rounded-lg px-3 py-2 text-sm">
                <span className="animate-pulse">...</span>
              </div>
            </div>
          )}
        </div>
        <form onSubmit={e => { e.preventDefault(); handleSend(); }} className="flex gap-2 shrink-0">
          <Input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={t('chatbotPlaceholder')}
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
