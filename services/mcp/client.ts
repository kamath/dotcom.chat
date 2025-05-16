import { Tool } from "ai";
import { getDefaultStore } from "jotai";
import {
  toolsAtom,
  isMcpLoadingAtom,
  errorAtom,
  breakdownAtom,
  isMcpConfigOpenAtom,
  serverConfigAtom,
} from "./atoms";

class MCPClient {
  private get state() {
    const store = getDefaultStore();
    return store;
  }
  private setTools(tools: Record<string, Record<string, Tool>>) {
    this.state.set(toolsAtom, tools);
  }
  private setIsLoading(isLoading: boolean) {
    this.state.set(isMcpLoadingAtom, isLoading);
  }
  private setError(error: string) {
    this.state.set(errorAtom, error);
  }
  private setBreakdown(breakdown: Record<string, Record<string, Tool>>) {
    this.state.set(breakdownAtom, breakdown);
  }
  private setIsOpen(isOpen: boolean) {
    this.state.set(isMcpConfigOpenAtom, isOpen);
  }
  private setServerConfig(serverConfig: Record<string, unknown>) {
    this.state.set(serverConfigAtom, serverConfig);
  }

  private get serverConfig() {
    return this.state.get(serverConfigAtom);
  }

  public parseServerConfig(mcpServersText: string) {
    try {
      const parsed = JSON.parse(mcpServersText);
      this.setServerConfig(parsed);
    } catch {
      this.setError("Invalid JSON");
    }
  }

  public async getTools(): Promise<void> {
    try {
      const response = await fetch("/api/tools");
      if (!response.ok) {
        throw new Error("Failed to fetch tools");
      }
      const data = await response.json();
      this.setTools({ breakdown: data.breakdown });
      this.setBreakdown(data.breakdown);
      this.setServerConfig(data.config || { mcpServers: {} });
    } catch (err) {
      this.setError(
        err instanceof Error ? err.message : "Failed to load tools"
      );
    } finally {
      this.setIsLoading(false);
    }
  }

  public async deleteTools(): Promise<void> {
    this.setTools({});
  }

  public async handleSave() {
    try {
      this.setIsLoading(true);
      await this.saveServerConfig();
      this.setIsOpen(false);
      await this.getTools();
    } catch (error) {
      console.error("Error saving server config:", error);
    } finally {
      this.setIsLoading(false);
    }
  }
  public async saveServerConfig() {
    try {
      const response = await fetch("/api/tools", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(this.serverConfig),
      });
      const data = await response.json();
      console.log("Tools saved:", data);
    } catch (error) {
      console.error("Error saving tools:", error);
      throw error;
    }
  }
}

const mcpClient = new MCPClient();
export default mcpClient;
