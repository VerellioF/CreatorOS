import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { WorkflowLauncherCard } from "@/features/agents/components/workflow-launcher-card";
import { WorkflowTimelineView } from "@/features/agents/components/workflow-timeline-view";
import { HumanApprovalDialog } from "@/features/agents/components/human-approval-dialog";
import { AgentLogViewer } from "@/features/agents/components/agent-log-viewer";

describe("Phase 5 UI — Agent Workspace Components", () => {
  it("renders WorkflowLauncherCard with workflow options and triggers onLaunch", () => {
    const handleLaunch = vi.fn();
    render(
      <WorkflowLauncherCard
        workflowType="workflow_a_research_to_storyboard"
        title="Workflow A: Research to Storyboard"
        description="End-to-end creator pipeline: Market Research -> Strategy Pillars -> Idea Generation -> Scriptwriting -> Visual Storyboard."
        estimatedCredits={5}
        steps={["Researcher", "Strategist", "Idea Generator", "Scriptwriter", "Storyboard"]}
        onLaunch={handleLaunch}
      />
    );

    expect(screen.getByText("Workflow A: Research to Storyboard")).toBeDefined();
    expect(screen.getByText(/5 Credits/i)).toBeDefined();
    expect(screen.getByText("Scriptwriter")).toBeDefined();

    const launchBtn = screen.getByRole("button", { name: /Mulai Workflow|Launch/i });
    fireEvent.click(launchBtn);
    expect(handleLaunch).toHaveBeenCalledWith("workflow_a_research_to_storyboard");
  });

  it("renders WorkflowTimelineView with step status and pause/cancel controls", () => {
    const handlePause = vi.fn();
    const handleCancel = vi.fn();
    const mockRun: any = {
      id: "run_123",
      title: "Content Production: Productivity",
      workflow_type: "workflow_a_research_to_storyboard",
      status: "running",
      current_step_index: 2,
      total_steps: 5,
    };
    const mockSteps: any[] = [
      { step_index: 0, agent_name: "researcher", status: "completed" },
      { step_index: 1, agent_name: "strategist", status: "completed" },
      { step_index: 2, agent_name: "idea_generator", status: "running" },
      { step_index: 3, agent_name: "scriptwriter", status: "pending", requires_approval: true },
      { step_index: 4, agent_name: "storyboard", status: "pending" },
    ];

    render(
      <WorkflowTimelineView
        workflow={mockRun}
        steps={mockSteps}
        onPause={handlePause}
        onCancel={handleCancel}
      />
    );

    expect(screen.getByText("Content Production: Productivity")).toBeDefined();
    expect(screen.getByText("idea_generator")).toBeDefined();
    expect(screen.getByText("scriptwriter")).toBeDefined();

    const cancelBtn = screen.getByRole("button", { name: /Batalkan|Cancel/i });
    fireEvent.click(cancelBtn);
    expect(handleCancel).toHaveBeenCalledWith("run_123");
  });

  it("renders HumanApprovalDialog with intermediate outputs and approval action", () => {
    const handleApprove = vi.fn();
    const handleReject = vi.fn();

    render(
      <HumanApprovalDialog
        isOpen={true}
        stepName="scriptwriter"
        stepIndex={3}
        outputPayload={{
          openingHook: "Ini rahasia creator sukses!",
          bodyContent: "Gunakan framework terstruktur untuk hasil maksimal.",
          closingCta: "Save video ini!",
        }}
        onApprove={handleApprove}
        onReject={handleReject}
      />
    );

    expect(screen.getByText("Human Approval Gate")).toBeDefined();
    expect(screen.getByText(/Persetujuan Hasil Agent/i)).toBeDefined();
    expect(screen.getByText("Ini rahasia creator sukses!")).toBeDefined();

    const approveBtn = screen.getByRole("button", { name: /Setujui & Lanjutkan|Approve/i });
    fireEvent.click(approveBtn);
    expect(handleApprove).toHaveBeenCalled();
  });

  it("renders AgentLogViewer with formatted logs and levels", () => {
    const mockLogs: any[] = [
      {
        id: "l1",
        log_level: "info",
        agent_name: "researcher",
        message: "Researching market trends for AI tools",
        created_at: new Date().toISOString(),
      },
      {
        id: "l2",
        log_level: "warn",
        agent_name: "researcher",
        message: "Retry attempt 1 for live evidence fetch",
        created_at: new Date().toISOString(),
      },
    ];

    render(<AgentLogViewer logs={mockLogs} />);

    expect(screen.getByText("Researching market trends for AI tools")).toBeDefined();
    expect(screen.getByText("Retry attempt 1 for live evidence fetch")).toBeDefined();
    expect(screen.getByText("INFO")).toBeDefined();
    expect(screen.getByText("WARN")).toBeDefined();
  });
});
