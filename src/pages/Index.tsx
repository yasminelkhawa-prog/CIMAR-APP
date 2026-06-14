import { CvsRetenusForm } from '@/components/CvsRetenusForm';
import { LanguageToggle } from '@/components/LanguageToggle';
import { useLanguage } from '@/i18n/LanguageContext';
import logoImg from '@/assets/logo-cimar.png';

export default function Index() {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen w-full gradient-bg">
      <header className="glass-header sticky top-0 z-10 mx-3 mt-3 rounded-2xl">
        <div className="px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logoImg} alt="Ciments du Maroc" className="h-9 w-auto object-contain" />
            <div className="hidden md:block">
              <h1 className="text-sm font-bold tracking-tight gradient-text-primary">{t('appTitle')}</h1>
              <p className="text-[10px] text-muted-foreground">{t('cvsRetenus')}</p>
            </div>
          </div>
          <LanguageToggle />
        </div>
      </header>

      <main className="p-6 max-w-6xl mx-auto w-full">
        <CvsRetenusForm />
      </main>
    </div>
  );
}
