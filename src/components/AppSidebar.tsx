import {
  ClipboardList, FileText, Briefcase, CalendarCheck, Users, Settings2, Brain, UserCircle, Calendar
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import { useLanguage } from '@/i18n/LanguageContext';
import logoImg from '@/assets/logo-cimar.png';

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

  const renderItem = (id: SidebarSection, title: string, Icon: typeof ClipboardList) => (
    <SidebarMenuItem key={id}>
      <SidebarMenuButton
        onClick={() => onSectionChange(id)}
        isActive={activeSection === id}
        tooltip={title}
        className={
          activeSection === id
            ? 'bg-gradient-to-r from-primary to-[hsl(var(--primary-glow))] !text-white shadow-lg shadow-primary/30 hover:from-primary hover:to-[hsl(var(--primary-glow))] hover:!text-white rounded-xl h-10 font-medium'
            : '!text-white/85 hover:bg-white/10 hover:!text-white rounded-xl h-10 transition-colors'
        }
      >
        <Icon className="h-[18px] w-[18px]" />
        {!collapsed && <span>{title}</span>}
      </SidebarMenuButton>
    </SidebarMenuItem>
  );

  return (
    <Sidebar collapsible="icon" variant="floating" className="border-none">
      <SidebarHeader className="px-3 pt-4 pb-2">
        <div className="flex items-center gap-2.5 px-2">
          <img src={logoImg} alt="Ciments du Maroc" className="h-10 w-auto object-contain shrink-0" />
          {!collapsed && (
            <div className="leading-tight">
              <p className="text-sm font-bold text-white">CIMAR</p>
              <p className="text-[10px] text-white/60">HR Suite</p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2">
        <SidebarGroup>
          {!collapsed && (
            <SidebarGroupLabel className="text-white/40 uppercase tracking-[0.12em] text-[10px] px-3">
              Menu
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => renderItem(item.id, item.title, item.icon))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          {!collapsed && (
            <SidebarGroupLabel className="text-white/40 uppercase tracking-[0.12em] text-[10px] px-3">
              {t('configuration')}
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu>
              {renderItem('profile', 'Profile & Signature', UserCircle)}
              {renderItem('config', t('configuration'), Settings2)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

    </Sidebar>
  );
}
