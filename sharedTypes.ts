import { z } from "zod";

export const availableModelSchema = z.enum([
  "google/gemini-2.0-flash",
  "anthropic/claude-3-7-sonnet-latest",
  "openai/gpt-4.1",
]);

export type AvailableModel = z.infer<typeof availableModelSchema>;
