"use client";

import * as React from "react";
import Link from "next/link";
import {
  Bot,
  Dna,
  Gauge,
  Calendar,
  Sparkles,
  Compass,
  Activity,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { OnboardingInterviewPanel } from "./onboarding-interview-panel";
import { CreatorDnaEditor } from "./creator-dna-editor";
import { AssessmentAndMonetizationPanel } from "./assessment-and-monetization-panel";
import { Roadmap30DaysPanel } from "./roadmap-30-days-panel";
import type { WorkspaceCreatorContext } from "@/lib/ai/context-builder";
import type { WorkspaceUsageOverview } from "@/services/usage-billing-service";

interface CreatorIntelligenceHubProps {
  context: WorkspaceCreatorContext;
  usage: WorkspaceUsageOverview;
  canEdit: boolean;
  aiConfigured: boolean;
  activeProviderLabel: string;
  fallbackCreatorName: string;
}

type HubTab = "interview" | "dna" | "assessment" | "roadmap";

export function CreatorIntelligenceHub({
  context,
  usage,
  canEdit,
  aiConfigured,
  activeProviderLabel,
  fallbackCreatorName,
}: CreatorIntelligenceHubProps) {
  const [activeTab, setActiveTab] = React.useState<HubTab>(
    context.creatorDna ? "dna" : "interview"
  );

  return (
    <div className="space-y-6">
      {/* AI Telemetry & Credit Ledger Summary Bar (Acceptance Criterion #8) */}
      <div className="rounded-xl border border-border bg-card/70 p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5 font-semibold text-foreground">
            <Sparkles className="h-4 w-4 text-primary" />
            <span>
              Saldo Kredit: {usage.balance} / {usage.monthlyAllowance}
            </span>
          </div>
          <span className="text-muted-foreground">•</span>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Activity className="h-3.5 w-3.5" />
            <span>
              Token Tercatat: {usage.totalTokensUsedRecent.toLocaleString("id-ID")} tok
            </span>
          </div>
          <span className="text-muted-foreground">•</span>
          <span className="text-muted-foreground">
            Est. Biaya AI: ${usage.totalCostUsdRecent.toFixed(4)} USD
          </span>
          <Badge variant="outline" className="text-[10px]">
            Engine: {activeProviderLabel}
          </Badge>
        </div>

        <Link href="/niche-discovery">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs">
            <Compass className="h-3.5 w-3.5 text-primary" />
            <span>Buka Niche Discovery</span>
          </Button>
        </Link>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap border-b border-border gap-1">
        {(
          [
            {
              id: "interview",
              label: "1. Wawancara Adaptif",
              Icon: Bot,
              ready: Boolean(context.coreAnswers),
            },
            {
              id: "dna",
              label: "2. Creator DNA & Persona",
              Icon: Dna,
              ready: Boolean(context.creatorDna),
            },
            {
              id: "assessment",
              label: "3. Evaluasi & Monetisasi",
              Icon: Gauge,
              ready: Boolean(context.creatorAssessment),
            },
            {
              id: "roadmap",
              label: "4. Roadmap 30 Hari",
              Icon: Calendar,
              ready: context.roadmap30Days.length > 0,
            },
          ] as const
        ).map(({ id, label, Icon, ready }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            <span>{label}</span>
            {ready && (
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            )}
          </button>
        ))}
      </div>

      {activeTab === "interview" && (
        <OnboardingInterviewPanel
          workspaceId={context.workspaceId}
          initialCreatorMode={context.creatorMode}
          canEdit={canEdit}
          aiConfigured={aiConfigured}
          initialCoreAnswers={context.coreAnswers}
          initialAdaptiveQuestions={context.adaptiveQuestions}
          initialAdaptiveAnswers={context.adaptiveAnswers}
          onSynthesisComplete={() => setActiveTab("dna")}
        />
      )}

      {activeTab === "dna" && (
        <CreatorDnaEditor
          workspaceId={context.workspaceId}
          canEdit={canEdit}
          initialDna={context.creatorDna}
          initialPersona={context.audiencePersona}
          fallbackName={fallbackCreatorName}
        />
      )}

      {activeTab === "assessment" && (
        <AssessmentAndMonetizationPanel
          assessment={context.creatorAssessment}
          monetization={context.monetizationRecommendations}
        />
      )}

      {activeTab === "roadmap" && (
        <Roadmap30DaysPanel
          workspaceId={context.workspaceId}
          canEdit={canEdit}
          initialRoadmap={context.roadmap30Days}
        />
      )}
    </div>
  );
}
