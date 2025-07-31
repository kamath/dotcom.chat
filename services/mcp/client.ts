import { Tool } from "ai";
import { getDefaultStore } from "jotai";
import {
  toolsAtom,
  isMcpLoadingAtom,
  errorAtom,
  breakdownAtom,
  isMcpConfigOpenAtom,
  mcpUrlsAtom,
  connectionStatusAtom,
  activeServerNamesAtom,
  connectingServersAtom,
  type McpConnectionStatus,
  type McpUrl,
} from "./atoms";
import { toolsService } from "./tools-service";

class MCPClient {
  private getToolsPromise: Promise<void> | null = null;

  private get state() {
    const store = getDefaultStore();
    return store;
  }
  private setTools(tools: { breakdown: Record<string, Record<string, Tool>> }) {
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
  private setConnectionStatus(status: McpConnectionStatus) {
    this.state.set(connectionStatusAtom, status);
  }
  private setActiveServers(servers: Set<string>) {
    this.state.set(activeServerNamesAtom, servers);
  }
  private setConnectingServers(servers: Set<string>) {
    this.state.set(connectingServersAtom, servers);
  }

  private get mcpUrls() {
    return this.state.get(mcpUrlsAtom);
  }

  private get activeServers() {
    return this.state.get(activeServerNamesAtom);
  }

  public async getTools(specificServers?: string[]): Promise<void> {
    // If there's already a getTools call in progress, return the existing promise
    if (this.getToolsPromise) {
      console.log("getTools already in progress, returning existing promise");
      return this.getToolsPromise;
    }

    // Create and store the promise
    this.getToolsPromise = this._performGetTools(specificServers);

    try {
      await this.getToolsPromise;
    } finally {
      // Clear the promise when done (whether success or failure)
      this.getToolsPromise = null;
    }
  }

  private async _performGetTools(specificServers?: string[]): Promise<void> {
    try {
      // Set loading state at the beginning
      this.setIsLoading(true);

      // Get current connection status
      const currentStatus = this.state.get(connectionStatusAtom);
      const updatedStatus: McpConnectionStatus = { ...currentStatus };

      // Track which servers we're targeting
      const targetServers =
        specificServers || this.mcpUrls?.map((url) => url.name) || [];
      const targetServerSet = new Set(targetServers);

      // Update connecting status only for servers being targeted
      this.mcpUrls?.forEach((url) => {
        if (targetServerSet.has(url.name)) {
          updatedStatus[url.name] = "connecting";
        }
      });
      this.setConnectionStatus(updatedStatus);
      this.setConnectingServers(targetServerSet);

      // Use the tools service directly instead of API call
      const { tools, breakdown } = await toolsService.getToolsWithBreakdown(
        this.mcpUrls || []
      );

      // The toolsAtom expects the breakdown structure
      this.setTools({ breakdown });
      this.setBreakdown(breakdown);

      // Update connection status based on results
      const finalStatus: McpConnectionStatus = { ...currentStatus };
      const activeServers = new Set<string>();

      this.mcpUrls?.forEach((url) => {
        if (breakdown[url.name]) {
          finalStatus[url.name] = "connected";
          activeServers.add(url.name);
        } else if (breakdown[`${url.name} (Failed)`]) {
          finalStatus[url.name] = "failed";
        } else {
          // Server was removed or not included
          delete finalStatus[url.name];
        }
      });

      this.setConnectionStatus(finalStatus);
      this.setActiveServers(activeServers);
      this.setConnectingServers(new Set());

      // Clear any previous errors on success
      this.setError("");
    } catch (err) {
      // Mark targeted servers as failed
      const currentStatus = this.state.get(connectionStatusAtom);
      const failedStatus: McpConnectionStatus = { ...currentStatus };
      const connectingServers = this.state.get(connectingServersAtom);

      connectingServers.forEach((serverName) => {
        failedStatus[serverName] = "failed";
      });

      this.setConnectionStatus(failedStatus);
      this.setConnectingServers(new Set());
      this.setError(
        err instanceof Error ? err.message : "Failed to load tools"
      );
    } finally {
      this.setIsLoading(false);
    }
  }

  public async deleteTools(): Promise<void> {
    this.setTools({ breakdown: {} });
  }

  public async handleSave() {
    try {
      this.setIsOpen(false);
      await this.getTools();
    } catch (error) {
      console.error("Error loading tools:", error);
    }
  }

  public async reconnectServer(serverName: string): Promise<void> {
    // Only reconnect the specific server
    await this.getTools([serverName]);
  }

  public async addServer(newUrl: McpUrl): Promise<void> {
    // Get current URLs and add the new one
    const currentUrls = this.mcpUrls || [];
    const updatedUrls = [...currentUrls, newUrl];

    // Update the atom with new URLs
    this.state.set(mcpUrlsAtom, updatedUrls);

    // Only connect to the new server
    await this.getTools([newUrl.name]);
  }

  public async removeServer(serverName: string): Promise<void> {
    // Get current URLs and remove the specified server
    const currentUrls = this.mcpUrls || [];
    const updatedUrls = currentUrls.filter((url) => url.name !== serverName);

    // Update the atom with new URLs
    this.state.set(mcpUrlsAtom, updatedUrls);

    // Update status to remove the server
    const currentStatus = this.state.get(connectionStatusAtom);
    const updatedStatus = { ...currentStatus };
    delete updatedStatus[serverName];
    this.setConnectionStatus(updatedStatus);

    // Update active servers
    const activeServers = this.state.get(activeServerNamesAtom);
    const updatedActiveServers = new Set(activeServers);
    updatedActiveServers.delete(serverName);
    this.setActiveServers(updatedActiveServers);

    // Trigger a refresh to update the breakdown (without reconnecting all servers)
    await this.getTools();
  }
}

const mcpClient = new MCPClient();
export default mcpClient;
