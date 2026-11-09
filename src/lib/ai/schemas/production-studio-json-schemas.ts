import type { JsonSchemaObject } from "@/lib/ai/types";

export const AI_STORYBOARD_BREAKDOWN_JSON_SCHEMA: JsonSchemaObject = {
  type: "object",
  description:
    "Breakdown storyboard per scene yang mengonversi naskah menjadi arahan visual, tipe shot, voiceover, subtitle, durasi, dan transisi.",
  properties: {
    title: { type: "string" },
    visualTheme: { type: "string" },
    overviewConcept: { type: "string" },
    scenes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          sceneNumber: { type: "integer" },
          durationSeconds: { type: "integer" },
          shotType: {
            type: "string",
            enum: [
              "close_up",
              "medium",
              "wide",
              "over_shoulder",
              "aerial",
              "pov",
            ],
          },
          shotDescription: { type: "string" },
          visualDirection: { type: "string" },
          voiceoverText: { type: "string" },
          subtitleText: { type: "string" },
          transitionSuggestion: {
            type: "string",
            enum: ["cut", "fade", "dissolve", "wipe", "zoom_in"],
          },
        },
        required: [
          "sceneNumber",
          "durationSeconds",
          "shotType",
          "shotDescription",
          "visualDirection",
          "voiceoverText",
          "subtitleText",
          "transitionSuggestion",
        ],
      },
    },
  },
  required: ["title", "visualTheme", "overviewConcept", "scenes"],
};
