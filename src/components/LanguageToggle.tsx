import { useLanguage } from '@/i18n/LanguageContext';
import { Button } from '@/components/ui/button';
import { Globe } from 'lucide-react';

export function LanguageToggle() {
  const { lang, setLang } = useLanguage();

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setLang(lang === 'en' ? 'fr' : 'en')}
      className="gap-1.5 text-xs"
    >
      <Globe className="h-3.5 w-3.5" />
      {lang === 'en' ? 'FR' : 'EN'}
    </Button>
  );
}
