"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  User,
  Compass,
  Bot,
  TrendingUp,
  Users2,
  Target,
  Lightbulb,
  FileText,
  Clapperboard,
  Image as ImageIcon,
  Video,
  Mic,
  Calendar,
  Send,
  BarChart3,
  Coins,
  Cpu,
  Receipt,
  Settings,
  Sparkles,
  Captions,
  Film,
  Download,
  CreditCard,
  ShieldCheck,
  LifeBuoy,
} from "lucide-react";
import { cn } from "@/lib/utils/utils";
import { Badge } from "@/components/ui/badge";

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  isReady: boolean;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    title: "WORKSPACE",
    items: [
      { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard, isReady: true },
      { title: "Creator Profile", href: "/creator-profile", icon: User, isReady: true },
      { title: "Niche Discovery", href: "/niche-discovery", icon: Compass, isReady: true },
      { title: "AI Assistant", href: "/ai-assistant", icon: Bot, isReady: true },
    ],
  },
  {
    title: "RESEARCH & STRATEGY",
    items: [
      { title: "Trend Research", href: "/trends", icon: TrendingUp, isReady: false },
      { title: "Competitor Research", href: "/competitors", icon: Users2, isReady: false },
      { title: "Content Strategy", href: "/strategy", icon: Target, isReady: true },
      { title: "Idea Generator", href: "/ideas", icon: Lightbulb, isReady: true },
    ],
  },
  {
    title: "CONTENT STUDIO",
    items: [
      { title: "Script Studio", href: "/studio/scripts", icon: FileText, isReady: true },
      { title: "Storyboard Studio", href: "/studio/storyboard", icon: Clapperboard, isReady: false },
      { title: "Image Studio", href: "/studio/images", icon: ImageIcon, isReady: false },
      { title: "Voice Studio", href: "/studio/voice", icon: Mic, isReady: false },
      { title: "Subtitle Studio", href: "/studio/subtitles", icon: Captions, isReady: false },
      { title: "Video Studio", href: "/studio/video", icon: Video, isReady: false },
      { title: "Timeline Editor", href: "/studio/timeline", icon: Film, isReady: false },
      { title: "Export Center", href: "/studio/export", icon: Download, isReady: false },
    ],
  },
  {
    title: "PUBLISHING & GROWTH",
    items: [
      { title: "Publishing Center", href: "/publish", icon: Send, isReady: false },
      { title: "Content Calendar", href: "/calendar", icon: Calendar, isReady: true },
      { title: "Analytics", href: "/analytics", icon: BarChart3, isReady: false },
      { title: "Monetization Hub", href: "/monetization", icon: Coins, isReady: false },
    ],
  },
  {
    title: "SYSTEM",
    items: [
      { title: "Agent Workspace", href: "/agents", icon: Cpu, isReady: false },
      { title: "Usage & Credits", href: "/usage", icon: Receipt, isReady: true },
      { title: "Billing & Plans", href: "/settings/billing", icon: CreditCard, isReady: false },
      { title: "Admin Console", href: "/admin", icon: ShieldCheck, isReady: true },
      { title: "Support Center", href: "/support", icon: LifeBuoy, isReady: true },
      { title: "Settings", href: "/settings", icon: Settings, isReady: true },
    ],
  },
];

export function Sidebar({
  className,
  isSuperadmin = false,
}: {
  className?: string;
  isSuperadmin?: boolean;
}) {
  const pathname = usePathname();

  // Filter out superadmin-only navigation items for regular users
  const visibleNavSections = React.useMemo(() => {
    return navSections.map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        if (item.href === "/admin" && !isSuperadmin) {
          return false;
        }
        return true;
      }),
    }));
  }, [isSuperadmin]);

  return (
    <aside className={cn("w-64 border-r border-border bg-sidebar flex-col shrink-0 select-none hidden md:flex", className)}>
      {/* Brand Header */}
      <div className="flex h-14 items-center gap-2.5 px-5 border-b border-sidebar-border">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="flex flex-col">
          <span className="font-bold text-sm tracking-tight text-sidebar-foreground">
            CreatorOS <span className="text-primary font-extrabold">AI</span>
          </span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
            Operating System
          </span>
        </div>
      </div>

      {/* Navigation Sections */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {visibleNavSections.map((section) => (
          <div key={section.title} className="space-y-1">
            <h4 className="px-3 text-[11px] font-bold text-muted-foreground/90 uppercase tracking-wider">
              {section.title}
            </h4>
            <div className="space-y-0.5 pt-1">
              {section.items.map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;

                if (!item.isReady) {
                  return (
                    <div
                      key={item.href}
                      className="flex items-center justify-between rounded-md px-3 py-1.5 text-xs text-muted-foreground/60 cursor-not-allowed group"
                      title={`${item.title} (Akan Hadir di Fase Berikutnya)`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon className="h-4 w-4 opacity-40 shrink-0" />
                        <span className="truncate">{item.title}</span>
                      </div>
                      <Badge variant="comingSoon" className="text-[9px] px-1.5 py-0 font-mono">
                        Soon
                      </Badge>
                    </div>
                  );
                }

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "group flex items-center justify-between rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-150",
                      isActive
                        ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold shadow-xs ring-1 ring-border/50"
                        : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                    )}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Icon
                        className={cn(
                          "h-4 w-4 shrink-0 transition-colors",
                          isActive
                            ? "text-primary"
                            : "text-muted-foreground group-hover:text-foreground"
                        )}
                      />
                      <span className="truncate">{item.title}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Footer Info */}
      <div className="p-3 border-t border-sidebar-border space-y-2">
        <div className="rounded-lg bg-card/60 p-2.5 border border-border/50 text-[11px] text-muted-foreground">
          <div className="font-semibold text-foreground mb-0.5">CreatorOS Public Beta</div>
          <p>Fitur Esensial Aktif • 20 Kredit Gratis</p>
        </div>
        <div className="flex items-center justify-between px-1 text-[10px] text-muted-foreground">
          <Link href="/privacy" className="hover:text-primary transition-colors">
            Privasi
          </Link>
          <span>•</span>
          <Link href="/terms" className="hover:text-primary transition-colors">
            Ketentuan
          </Link>
          <span>•</span>
          <Link href="/support" className="hover:text-primary transition-colors">
            Bantuan
          </Link>
        </div>
      </div>
    </aside>
  );
}
