import {
  ClipboardList, FileText, Briefcase, CalendarCheck, Users, Settings2, Brain, UserCircle, Calendar, Sparkles
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
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
            ? 'bg-gradient-to-r from-primary to-[hsl(var(--primary-glow))] !text-primary-foreground shadow-lg shadow-primary/30 hover:from-primary hover:to-[hsl(var(--primary-glow))] hover:!text-primary-foreground rounded-xl h-10 font-medium'
            : 'text-foreground/70 hover:bg-accent hover:text-foreground rounded-xl h-10 transition-colors'
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
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-[hsl(var(--primary-glow))] shadow-md shadow-primary/30">
            <img src={logoImg} alt="CIMAR" className="h-6 w-6 object-contain brightness-0 invert" />
          </span>
          {!collapsed && (
            <div className="leading-tight">
              <p className="text-sm font-bold gradient-text-primary">CIMAR</p>
              <p className="text-[10px] text-muted-foreground">HR Suite</p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2">
        <SidebarGroup>
          {!collapsed && (
            <SidebarGroupLabel className="text-foreground/40 uppercase tracking-[0.12em] text-[10px] px-3">
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
            <SidebarGroupLabel className="text-foreground/40 uppercase tracking-[0.12em] text-[10px] px-3">
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

      {!collapsed && (
        <SidebarFooter className="p-3">
          <div className="relative overflow-hidden rounded-2xl p-4 bg-gradient-to-br from-[hsl(158_45%_12%)] to-[hsl(150_55%_22%)] text-white shadow-xl">
            <div className="absolute inset-0 dotted-bg-on-primary opacity-60" />
            <div className="relative">
              <div className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-white/15 backdrop-blur mb-2">
                <Sparkles className="h-4 w-4" />
              </div>
              <p className="text-sm font-semibold leading-tight">Assistant IA</p>
              <p className="text-[11px] text-white/70 mt-0.5 mb-2.5">
                Disponible sur chaque module
              </p>
              <div className="text-[10px] uppercase tracking-wider text-white/60">
                Powered by Lovable AI
              </div>
            </div>
          </div>
        </SidebarFooter>
      )}
    </Sidebar>
  );
}
