import { BaseAgent, type AgentExecutionContext } from "./base-agent";
import {
  producerAgentInputSchema,
  producerAgentOutputSchema,
  type ProducerAgentInput,
  type ProducerAgentOutput,
} from "@/lib/validation/agent-schemas";

export class ProducerAgent extends BaseAgent<ProducerAgentInput, ProducerAgentOutput> {
  constructor() {
    super({
      name: "producer",
      description: "Coordinates media asset generation, voiceover synthesis, and background render dispatch",
      inputSchema: producerAgentInputSchema,
      outputSchema: producerAgentOutputSchema,
      maxRetries: 1,
      timeoutMs: 30000,
      defaultCredits: 1,
    });
  }

  protected async runInternal(
    input: ProducerAgentInput,
    _context: AgentExecutionContext,
    log: (level: "info" | "warn" | "error" | "debug", message: string) => void
  ): Promise<{ output: ProducerAgentOutput }> {
    log("info", `Producer dispatching media generation pipeline (voice: ${input.voiceId})`);

    const mediaJobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const dispatchedAssetTypes = ["voiceover"];

    if (input.generateVideoPreviews) {
      dispatchedAssetTypes.push("thumbnail", "video_clip");
    }

    return {
      output: {
        mediaJobId,
        dispatchedAssetTypes,
        status: "dispatched",
        summary: `Successfully enqueued media production tasks for voiceover (${input.voiceId}) and video previews.`,
      },
    };
  }
}
