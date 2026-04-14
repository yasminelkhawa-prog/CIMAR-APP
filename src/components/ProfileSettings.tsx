import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLanguage } from '@/i18n/LanguageContext';
import { toast } from 'sonner';
import { SignatureManager } from './SignatureManager';
import { User, Save } from 'lucide-react';

export function ProfileSettings() {
  const { t } = useLanguage();
  const { user, profile, refreshProfile } = useAuth();
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    await supabase.from('profiles').update({ full_name: fullName }).eq('user_id', user.id);
    await refreshProfile();
    toast.success(t('profileUpdated'));
    setSaving(false);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold flex items-center gap-2">
        <User className="h-5 w-5 text-primary" /> {t('myProfile')}
      </h2>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('personalInfo')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={user?.email || ''} disabled />
            </div>
            <div className="space-y-2">
              <Label>{t('nomPrenom')}</Label>
              <Input value={fullName} onChange={e => setFullName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{t('titleLabel')}</Label>
              <Input value={profile?.title || ''} disabled className="bg-muted" />
              <p className="text-xs text-muted-foreground">{t('titleSetByAdmin')}</p>
            </div>
          </div>
          <Button onClick={handleSave} disabled={saving} className="gap-1">
            <Save className="h-4 w-4" /> {t('save')}
          </Button>
        </CardContent>
      </Card>

      <SignatureManager />
    </div>
  );
}
