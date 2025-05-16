import { AvailableModel } from "@/sharedTypes";
import { anthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";
import { LanguageModelV1 } from "ai";

export function resolveModel(modelName: AvailableModel): LanguageModelV1 {
  const [provider, ...modelParts] = modelName.split("/");
  const model = modelParts.join("/");
  switch (provider) {
    case "google":
      return google(model);
    case "anthropic":
      return anthropic(model);
    case "openai":
      return openai(model);
    default:
      throw new Error(`Unknown model provider: ${provider}`);
  }
}
