import { z } from "zod";

export const availableModelSchema = z.enum([
  "anthropic/claude-4-sonnet-latest",
  "openai/gpt-4.1",
]);

export type AvailableModel = z.infer<typeof availableModelSchema>;
