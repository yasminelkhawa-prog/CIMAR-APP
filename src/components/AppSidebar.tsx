import {
  ClipboardList, FileText, Briefcase, CalendarCheck, Users, Settings2, Brain, UserCircle, Calendar
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

export type SidebarSection =
  | 'evaluations'
  | 'fiche-embauche'
  | 'fiche-poste'
  | 'plan-integration'
  | 'cvs-retenus'
  | 'big-five'
  | 'calendar'
  | 'master-calendar'
  | 'profile'
  | 'config';

interface Props {
  activeSection: SidebarSection;
  onSectionChange: (section: SidebarSection) => void;
}

export function AppSidebar({ activeSection, onSectionChange }: Props) {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const { t } = useLanguage();

  const items = [
    { id: 'evaluations' as SidebarSection, title: t('evaluationGrid'), icon: ClipboardList },
    { id: 'fiche-embauche' as SidebarSection, title: t('ficheEmbauche'), icon: FileText },
    { id: 'fiche-poste' as SidebarSection, title: t('fichePoste'), icon: Briefcase },
    { id: 'plan-integration' as SidebarSection, title: t('planIntegration'), icon: CalendarCheck },
    { id: 'cvs-retenus' as SidebarSection, title: t('cvsRetenus'), icon: Users },
    { id: 'big-five' as SidebarSection, title: 'Big Five (OCEAN)', icon: Brain },
    { id: 'calendar' as SidebarSection, title: 'Calendrier', icon: Calendar },
    { id: 'master-calendar' as SidebarSection, title: "Calendrier d'Intégration", icon: CalendarCheck },
  ];

  return (
    <Sidebar collapsible="icon" className="glass-sidebar border-r border-sidebar-border/60">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/70 uppercase tracking-wider text-[10px]">
            {t('appTitle').split('—')[0].trim()}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton
                    onClick={() => onSectionChange(item.id)}
                    isActive={activeSection === item.id}
                    tooltip={item.title}
                    className={
                      activeSection === item.id
                        ? 'bg-gradient-to-r from-sidebar-primary/25 via-sidebar-primary/10 to-transparent text-sidebar-primary-foreground shadow-[inset_2px_0_0_hsl(var(--sidebar-primary))] hover:from-sidebar-primary/30'
                        : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground transition-colors'
                    }
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
          <SidebarGroupLabel className="text-sidebar-foreground/70 uppercase tracking-wider text-[10px]">
            {t('configuration')}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => onSectionChange('profile')}
                  isActive={activeSection === 'profile'}
                  tooltip="Profile"
                  className={
                    activeSection === 'profile'
                      ? 'bg-gradient-to-r from-sidebar-primary/25 via-sidebar-primary/10 to-transparent text-sidebar-primary-foreground shadow-[inset_2px_0_0_hsl(var(--sidebar-primary))]'
                      : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground'
                  }
                >
                  <UserCircle className="h-4 w-4" />
                  {!collapsed && <span>Profile & Signature</span>}
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => onSectionChange('config')}
                  isActive={activeSection === 'config'}
                  tooltip={t('configuration')}
                  className={
                    activeSection === 'config'
                      ? 'bg-gradient-to-r from-sidebar-primary/25 via-sidebar-primary/10 to-transparent text-sidebar-primary-foreground shadow-[inset_2px_0_0_hsl(var(--sidebar-primary))]'
                      : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground'
                  }
                >
                  <Settings2 className="h-4 w-4" />
                  {!collapsed && <span>{t('configuration')}</span>}
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
