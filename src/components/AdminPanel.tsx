import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useLanguage } from '@/i18n/LanguageContext';
import { toast } from 'sonner';
import { Check, X, Shield, UserCheck, UserX } from 'lucide-react';

interface UserProfile {
  id: string;
  user_id: string;
  full_name: string;
  title: string;
  is_approved: boolean;
  created_at: string;
  email?: string;
  roles: string[];
}

export function AdminPanel() {
  const { t } = useLanguage();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [editingTitle, setEditingTitle] = useState<Record<string, string>>({});

  const loadUsers = async () => {
    const { data: profiles } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    if (!profiles) return;

    const { data: roles } = await supabase.from('user_roles').select('*');

    const enriched = profiles.map(p => ({
      ...p,
      roles: (roles || []).filter(r => r.user_id === p.user_id).map(r => r.role),
    }));

    setUsers(enriched);
  };

  useEffect(() => { loadUsers(); }, []);

  const handleApprove = async (userId: string, approve: boolean) => {
    await supabase.from('profiles').update({ is_approved: approve }).eq('user_id', userId);
    toast.success(approve ? t('userApproved') : t('userRejected'));
    loadUsers();
  };

  const handleUpdateTitle = async (userId: string, title: string) => {
    await supabase.from('profiles').update({ title }).eq('user_id', userId);
    toast.success(t('titleUpdated'));
    setEditingTitle(prev => { const n = { ...prev }; delete n[userId]; return n; });
    loadUsers();
  };

  const handleToggleAdmin = async (userId: string, currentlyAdmin: boolean) => {
    if (currentlyAdmin) {
      await supabase.from('user_roles').delete().eq('user_id', userId).eq('role', 'admin');
    } else {
      await supabase.from('user_roles').insert({ user_id: userId, role: 'admin' });
    }
    toast.success(currentlyAdmin ? t('adminRemoved') : t('adminAdded'));
    loadUsers();
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold flex items-center gap-2">
        <Shield className="h-5 w-5 text-primary" />
        {t('userManagement')}
      </h2>

      <div className="grid gap-3">
        {users.map(user => {
          const isAdmin = user.roles.includes('admin');
          const isEditing = editingTitle[user.user_id] !== undefined;

          return (
            <Card key={user.id}>
              <CardContent className="p-4 flex items-center gap-4 flex-wrap">
                <div className="flex-1 min-w-[200px]">
                  <p className="font-medium">{user.full_name}</p>
                  {isEditing ? (
                    <div className="flex items-center gap-2 mt-1">
                      <Input
                        value={editingTitle[user.user_id]}
                        onChange={e => setEditingTitle(prev => ({ ...prev, [user.user_id]: e.target.value }))}
                        placeholder={t('titlePlaceholder')}
                        className="h-7 text-sm"
                      />
                      <Button size="sm" variant="ghost" className="h-7"
                        onClick={() => handleUpdateTitle(user.user_id, editingTitle[user.user_id])}>
                        <Check className="h-3 w-3" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7"
                        onClick={() => setEditingTitle(prev => { const n = { ...prev }; delete n[user.user_id]; return n; })}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground cursor-pointer hover:underline"
                      onClick={() => setEditingTitle(prev => ({ ...prev, [user.user_id]: user.title }))}>
                      {user.title || t('clickToSetTitle')}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {isAdmin && (
                    <Badge variant="default" className="text-xs">Admin</Badge>
                  )}
                  <Badge variant={user.is_approved ? 'default' : 'secondary'} className="text-xs">
                    {user.is_approved ? t('approved') : t('pendingLabel')}
                  </Badge>

                  {!user.is_approved ? (
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                      onClick={() => handleApprove(user.user_id, true)}>
                      <UserCheck className="h-3 w-3" /> {t('approve')}
                    </Button>
                  ) : (
                    <Button size="sm" variant="ghost" className="h-7 text-xs gap-1"
                      onClick={() => handleApprove(user.user_id, false)}>
                      <UserX className="h-3 w-3" /> {t('revoke')}
                    </Button>
                  )}

                  <Button size="sm" variant={isAdmin ? 'destructive' : 'outline'} className="h-7 text-xs gap-1"
                    onClick={() => handleToggleAdmin(user.user_id, isAdmin)}>
                    <Shield className="h-3 w-3" />
                    {isAdmin ? t('removeAdmin') : t('makeAdmin')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
