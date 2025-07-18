import { streamText } from "ai";
import { getTools } from "@/lib/tools";
import { mcpConnectionManager } from "@/lib/mcp-connection-manager";
import { resolveModel } from "../apiUtils";

export async function POST(req: Request) {
  const { messages, pendingMessageConfig, mcpUrls } = await req.json();

  console.log("Received pendingMessageConfig:", pendingMessageConfig);
  console.log("Received mcpUrls:", mcpUrls);

  // Get tools from the connection manager (which maintains persistent connections)
  const { tools: mcpTools, breakdown } =
    await mcpConnectionManager.updateConnections(mcpUrls || []);

  // Get local tools
  const { tools: localTools } = await getTools([]);

  // Combine all tools
  const tools = { ...mcpTools, ...localTools };

  console.log("TOOLS", tools);
  console.log("BREAKDOWN", breakdown);

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
