"use client";

import React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, ArrowRight, Coins } from "lucide-react";
import type { WorkflowType } from "@/lib/supabase/types";

export interface WorkflowLauncherCardProps {
  workflowType: WorkflowType;
  title: string;
  description: string;
  estimatedCredits: number;
  steps: string[];
  onLaunch: (workflowType: WorkflowType) => void;
  isLoading?: boolean;
}

export function WorkflowLauncherCard({
  workflowType,
  title,
  description,
  estimatedCredits,
  steps,
  onLaunch,
  isLoading = false,
}: WorkflowLauncherCardProps) {
  return (
    <Card className="flex flex-col justify-between hover:border-primary/50 transition-colors">
      <CardHeader>
        <div className="flex items-center justify-between gap-2 mb-2">
          <Badge variant="outline" className="flex items-center gap-1 font-mono text-xs">
            <Coins className="h-3 w-3 text-amber-500" />
            {estimatedCredits} Credits
          </Badge>
          <Sparkles className="h-4 w-4 text-primary" />
        </div>
        <CardTitle className="text-lg font-semibold">{title}</CardTitle>
        <CardDescription className="text-sm line-clamp-3">{description}</CardDescription>
      </CardHeader>

      <CardContent>
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Tahapan Agent:</p>
          <div className="flex flex-wrap items-center gap-1.5">
            {steps.map((step, idx) => (
              <React.Fragment key={step}>
                <span className="text-xs px-2 py-0.5 rounded-md bg-muted text-foreground font-mono">
                  {step}
                </span>
                {idx < steps.length - 1 && (
                  <span className="text-muted-foreground text-xs">→</span>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      </CardContent>

      <CardFooter className="pt-2">
        <Button
          onClick={() => onLaunch(workflowType)}
          disabled={isLoading}
          className="w-full gap-2"
        >
          <span>Mulai Workflow</span>
          <ArrowRight className="h-4 w-4" />
        </Button>
      </CardFooter>
    </Card>
  );
}
