import { Tool, tool } from "ai";
import { experimental_createMCPClient as createMCPClient } from "ai";
import { z } from "zod";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

interface McpUrl {
  id: string;
  name: string;
  url: string;
}

const tools: Record<string, Tool> = {
  dummyTool: tool({
    description: "Dummy tool for demo purposes and testing.",
    parameters: z.object({
      location: z
        .string()
        .describe("The city and state, e.g. San Francisco, CA"),
    }),
    execute: async ({ location }) => {
      // Mock weather data
      const conditions = ["Sunny", "Cloudy", "Rainy", "Snowy", "Partly Cloudy"];
      const temperature = Math.floor(Math.random() * 35) + 40; // 40-75°F
      const humidity = Math.floor(Math.random() * 50) + 30; // 30-80%

      return {
        location,
        temperature,
        condition: conditions[Math.floor(Math.random() * conditions.length)],
        humidity,
        timestamp: new Date().toISOString(),
      };
    },
  }),
};

export const getTools = async (mcpUrls: McpUrl[] = []) => {
  try {
    // Flatten all MCP tools into one big object
    const mcpTools: Record<string, Tool> = {};
    const mcpBreakdown: Record<string, Record<string, Tool>> = {};

    const closeClients = await Promise.all(
      mcpUrls.map(async (urlConfig) => {
        console.log("Connecting to MCP server:", urlConfig.name, urlConfig.url);
        try {
          const mcpClient = await createMCPClient({
            transport: new StreamableHTTPClientTransport(
              new URL(urlConfig.url)
            ),
          });

          const toolsFromServer = await mcpClient.tools();
          console.log(
            `Successfully connected to ${urlConfig.name}, got ${
              Object.keys(toolsFromServer).length
            } tools`
          );

          Object.assign(mcpTools, toolsFromServer);
          mcpBreakdown[urlConfig.name] = toolsFromServer;

          // Return an async function that closes this client
          return async () => {
            await mcpClient.close();
          };
        } catch (error) {
          console.error(
            `Failed to connect to MCP server ${urlConfig.name}:`,
            error
          );

          // Add a failed connection entry to the breakdown for UI feedback
          mcpBreakdown[`${urlConfig.name} (Failed)`] = {};

          // Return a no-op function for failed connections
          return async () => {};
        }
      })
    );

    return {
      tools: {
        ...mcpTools,
        ...tools,
      },
      breakdown: mcpBreakdown,
      closeClients: async () => {
        await Promise.all(closeClients.map((closeClient) => closeClient()));
      },
    };
  } catch (error) {
    console.error("Error initializing MCP clients:", error);
    // Fallback to just the local tools if MCP clients fail
    return {
      tools,
      breakdown: {},
      closeClients: async () => {},
    };
  }
};
