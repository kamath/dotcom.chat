// Re-export a browser-scoped singleton for use in the client runtime only.
import { McpConnectionManager } from "@/lib/mcp-connection-core";
export const mcpConnectionManager = new McpConnectionManager();
