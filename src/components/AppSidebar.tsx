import {
  ClipboardList, FileText, Briefcase, CalendarCheck, Users, Settings2, Shield, User, LogOut
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import { useLanguage } from '@/i18n/LanguageContext';
import { useAuth } from '@/hooks/useAuth';

export type SidebarSection =
  | 'evaluations'
  | 'fiche-embauche'
  | 'fiche-poste'
  | 'plan-integration'
  | 'cvs-retenus'
  | 'config'
  | 'admin'
  | 'profile';

interface Props {
  activeSection: SidebarSection;
  onSectionChange: (section: SidebarSection) => void;
}

export function AppSidebar({ activeSection, onSectionChange }: Props) {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const { t } = useLanguage();
  const { isAdmin, signOut, profile } = useAuth();

  const items = [
    { id: 'evaluations' as SidebarSection, title: t('evaluationGrid'), icon: ClipboardList },
    { id: 'fiche-embauche' as SidebarSection, title: t('ficheEmbauche'), icon: FileText },
    { id: 'fiche-poste' as SidebarSection, title: t('fichePoste'), icon: Briefcase },
    { id: 'plan-integration' as SidebarSection, title: t('planIntegration'), icon: CalendarCheck },
    { id: 'cvs-retenus' as SidebarSection, title: t('cvsRetenus'), icon: Users },
  ];

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{t('appTitle').split('—')[0].trim()}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton
                    onClick={() => onSectionChange(item.id)}
                    isActive={activeSection === item.id}
                    tooltip={item.title}
                  >
                    <item.icon className="h-4 w-4" />
                    {!collapsed && <span>{item.title}</span>}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>{t('configuration')}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => onSectionChange('config')}
                  isActive={activeSection === 'config'}
                  tooltip={t('configuration')}
                >
                  <Settings2 className="h-4 w-4" />
                  {!collapsed && <span>{t('configuration')}</span>}
                </SidebarMenuButton>
              </SidebarMenuItem>
              {isAdmin && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={() => onSectionChange('admin')}
                    isActive={activeSection === 'admin'}
                    tooltip={t('userManagement')}
                  >
                    <Shield className="h-4 w-4" />
                    {!collapsed && <span>{t('userManagement')}</span>}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => onSectionChange('profile')}
                  isActive={activeSection === 'profile'}
                  tooltip={t('myProfile')}
                >
                  <User className="h-4 w-4" />
                  {!collapsed && <span>{profile?.full_name || t('myProfile')}</span>}
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={signOut} tooltip={t('logout')}>
                  <LogOut className="h-4 w-4" />
                  {!collapsed && <span>{t('logout')}</span>}
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
