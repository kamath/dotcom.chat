import { Tool, tool } from "ai";
import { experimental_createMCPClient as createMCPClient } from "ai";
import {
  StdioConfig,
  Experimental_StdioMCPTransport as StdioMCPTransport,
} from "ai/mcp-stdio";
import { readFile } from "fs/promises";
import { join } from "path";

import { z } from "zod";

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

export const getTools = async () => {
  try {
    /**
     * Not ideal, but we're basically starting/stopping STDIO processes
     * for every tool call.
     */
    // Read mcptools.json if it exists, otherwise initialize an empty object
    const MCP_TOOLS_FILEPATH = join(process.cwd(), "mcptools.json");

    let mcpToolsJson: { mcpServers: Record<string, StdioConfig> } = {
      mcpServers: {},
    };
    try {
      const fileContent = await readFile(MCP_TOOLS_FILEPATH, "utf8");
      mcpToolsJson = JSON.parse(fileContent);
    } catch {
      // File does not exist or is invalid, initialize as empty object
      mcpToolsJson = { mcpServers: {} };
    }

    // Flatten all MCP tools into one big object
    const mcpTools: Record<string, Tool> = {};
    const mcpBreakdown: Record<string, Record<string, Tool>> = {};

    if (!mcpToolsJson.mcpServers) {
      mcpToolsJson.mcpServers = {};
    }
    const closeClients = await Promise.all(
      Object.entries(mcpToolsJson.mcpServers).map(
        async ([serverName, server]) => {
          console.log("SERVER", server);
          const mcpClient = await createMCPClient({
            transport: new StdioMCPTransport(server),
          });

          const toolsFromServer = await mcpClient.tools();
          Object.assign(mcpTools, toolsFromServer);
          mcpBreakdown[serverName] = toolsFromServer;
          // Return an async function that closes this client
          return async () => {
            await mcpClient.close();
          };
        }
      )
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
    console.error("Error initializing MCP client:", error);
    // Fallback to just the local tools if MCP client fails
    return {
      tools,
      closeClients: async () => {},
    };
  }
};
