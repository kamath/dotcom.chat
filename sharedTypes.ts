import { z } from "zod";

export const availableModelSchema = z.enum([
  "anthropic/claude-4-sonnet-20250514",
  "openai/gpt-4.1",
]);

export type AvailableModel = z.infer<typeof availableModelSchema>;
