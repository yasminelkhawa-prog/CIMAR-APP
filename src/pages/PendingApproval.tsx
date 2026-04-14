import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Clock, LogOut } from 'lucide-react';
import { useLanguage } from '@/i18n/LanguageContext';
import logoImg from '@/assets/logo-cimar.png';

export default function PendingApproval() {
  const { signOut, user } = useAuth();
  const { t } = useLanguage();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader className="space-y-3">
          <img src={logoImg} alt="Ciments du Maroc" className="h-12 mx-auto object-contain" />
          <CardTitle className="flex items-center justify-center gap-2">
            <Clock className="h-5 w-5 text-amber-500" />
            {t('pendingApproval')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground text-sm">
            {t('pendingApprovalDesc')}
          </p>
          <p className="text-xs text-muted-foreground">{user?.email}</p>
          <Button variant="outline" onClick={signOut} className="gap-2">
            <LogOut className="h-4 w-4" /> {t('logout')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
