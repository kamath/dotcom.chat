import { streamText } from "ai";
import { resolveModel } from "../apiUtils";
import { createMcpTools } from "../mcp-tool-handler";
import { getServerMcpManager } from "@/lib/server-mcp-manager";

export async function POST(req: Request) {
  const body = await req.json();
  console.log("Full request body:", body);
  console.log("Body keys:", Object.keys(body));
  
  const { messages, pendingMessageConfig, tools, mcpUrls } = body;

  console.log("Received pendingMessageConfig:", pendingMessageConfig);
  console.log("Received tools:", tools);
  console.log("Tools type:", typeof tools);
  console.log("Tools keys:", tools ? Object.keys(tools) : "tools is null/undefined");

  // Create a unique request ID for this chat session
  const requestId = crypto.randomUUID();
  
  // Initialize MCP manager with the URLs
  const mcpManager = await getServerMcpManager(requestId, mcpUrls || []);
  
  // Convert MCP tool descriptions to AI SDK tools
  const aiTools = createMcpTools(tools, mcpManager);
  
  const result = streamText({
    model: resolveModel(pendingMessageConfig.modelName),
    tools: aiTools,
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
    //   console.debug("FINISHED", message);
      // Log the usage data to verify it's being captured
    //   console.debug("USAGE DATA:", message.usage);
      // Note: We no longer need to close clients as connections are persistent
    },
    experimental_telemetry: {
      isEnabled: true,
    },
  });
  return result.toDataStreamResponse();
}
