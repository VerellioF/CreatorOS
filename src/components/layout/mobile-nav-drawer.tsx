"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sparkles,
  X,
  LayoutDashboard,
  User,
  Compass,
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
  Receipt,
  Cpu,
  Settings,
  CreditCard,
  ShieldCheck,
  LifeBuoy,
  Captions,
  Film,
  Download,
  Bot,
  Coins,
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

interface MobileNavDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isSuperadmin?: boolean;
}

export function MobileNavDrawer({
  open,
  onOpenChange,
  isSuperadmin = false,
}: MobileNavDrawerProps) {
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

  // Prevent background scroll when drawer is open
  React.useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 md:hidden flex animate-in fade-in-0 duration-200">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={() => onOpenChange(false)}
      />

      {/* Slide-out Drawer */}
      <div className="relative w-72 max-w-[85vw] bg-sidebar border-r border-sidebar-border h-full flex flex-col z-10 shadow-2xl animate-in slide-in-from-left duration-200">
        {/* Brand Header */}
        <div className="flex h-14 items-center justify-between px-4 border-b border-sidebar-border">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-sm tracking-tight text-sidebar-foreground">
                CreatorOS <span className="text-primary font-extrabold">AI</span>
              </span>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                Menu Navigasi
              </span>
            </div>
          </div>

          <button
            onClick={() => onOpenChange(false)}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            aria-label="Tutup Menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation Sections */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
          {visibleNavSections.map((section) => (
            <div key={section.title} className="space-y-1">
              <h4 className="px-3 text-[11px] font-semibold text-muted-foreground/80 tracking-wider">
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
                        className="flex items-center justify-between rounded-md px-3 py-2 text-xs text-muted-foreground/50 cursor-not-allowed"
                      >
                        <div className="flex items-center gap-2.5">
                          <Icon className="h-4 w-4 opacity-40" />
                          <span>{item.title}</span>
                        </div>
                        <Badge variant="comingSoon" className="text-[9px] px-1.5 py-0">
                          Soon
                        </Badge>
                      </div>
                    );
                  }

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => onOpenChange(false)}
                      className={cn(
                        "flex items-center justify-between rounded-md px-3 py-2 text-xs font-medium transition-colors",
                        isActive
                          ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold"
                          : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                      )}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon className={cn("h-4 w-4", isActive ? "text-primary" : "text-muted-foreground")} />
                        <span>{item.title}</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-sidebar-border space-y-2">
          <div className="flex items-center justify-between px-1 text-[11px] text-muted-foreground">
            <Link
              href="/privacy"
              onClick={() => onOpenChange(false)}
              className="hover:text-primary transition-colors"
            >
              Privasi
            </Link>
            <span>•</span>
            <Link
              href="/terms"
              onClick={() => onOpenChange(false)}
              className="hover:text-primary transition-colors"
            >
              Ketentuan
            </Link>
            <span>•</span>
            <Link
              href="/support"
              onClick={() => onOpenChange(false)}
              className="hover:text-primary transition-colors"
            >
              Bantuan
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
