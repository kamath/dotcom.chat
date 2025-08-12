import { streamText } from "ai";
import { getToolsForUrls } from "@/lib/mcp-connection-core";
import type { McpUrl } from "@/types/mcp";
import { resolveModel } from "../apiUtils";

export async function POST(req: Request) {
  const { messages, pendingMessageConfig, mcpUrls } = await req.json();

  console.log("Received pendingMessageConfig:", pendingMessageConfig);
  console.log("Received mcpUrls:", mcpUrls);

  // Server-owned ephemeral utilities per request (stateless between requests)
  const tools = await getToolsForUrls((mcpUrls || []) as McpUrl[]);

  console.log("TOOLS", tools);

  const result = streamText({
    model: resolveModel(pendingMessageConfig.modelName),
    tools,
    toolCallStreaming: true,
    system:
      "You are a helpful assistant that can browse the web. You are given a prompt and you may need to browse the web to find the answer. You may not need to browse the web at all; you may already know the answer.",
    messages,
    maxSteps: 10,
    abortSignal: req.signal,
    onStepFinish: () => {
      console.debug("STEP FINISHED");
    },
    onError: (error) => {
      console.debug("ERROR", error);
      throw error;
    },
    onFinish: async (message) => {
      console.debug("FINISHED", message);
      // Log the usage data to verify it's being captured
      console.debug("USAGE DATA:", message.usage);
      // Note: We no longer need to close clients as connections are persistent
    },
    experimental_telemetry: {
      isEnabled: true,
    },
  });
  return result.toDataStreamResponse();
}
