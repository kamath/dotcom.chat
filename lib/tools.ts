import { Tool } from "ai";
import { experimental_createMCPClient as createMCPClient } from "ai";
import { readFile } from "fs/promises";
import { join } from "path";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

interface McpUrl {
  id: string;
  name: string;
  url: string;
}

const tools: Record<string, Tool> = {};

export const getTools = async () => {
  try {
    // Read mcpurls.json if it exists, otherwise initialize an empty array
    const MCP_URLS_FILEPATH = join(process.cwd(), "mcpurls.json");

    let mcpUrls: McpUrl[] = [];
    try {
      const fileContent = await readFile(MCP_URLS_FILEPATH, "utf8");
      const parsed = JSON.parse(fileContent);
      mcpUrls = parsed.mcpUrls || [];
    } catch {
      // File does not exist or is invalid, initialize as empty array
      mcpUrls = [];
    }

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
