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
// OAuth session management removed - now handled server-side

class MCPClient {
  private getToolsPromise: Promise<void> | null = null;

  private get state() {
    const store = getDefaultStore();
    return store;
  }
  private setTools(tools: Record<string, Record<string, Tool>>) {
    this.state.set(toolsAtom, { breakdown: tools });
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

  private sessionId: string | null = null;
  private sessionPromise: Promise<string> | null = null;

  private async getSessionId(): Promise<string> {
    // If we already have a session ID, return it
    if (this.sessionId) {
      return this.sessionId;
    }

    // If we're already fetching a session, wait for it
    if (this.sessionPromise) {
      return this.sessionPromise;
    }

    // Fetch session from server
    this.sessionPromise = fetch('/api/mcp/session')
      .then(res => res.json())
      .then(data => {
        this.sessionId = data.sessionId;
        return data.sessionId;
      })
      .catch(err => {
        console.error('[MCPClient] Failed to get session:', err);
        throw err;
      })
      .finally(() => {
        this.sessionPromise = null;
      });

    return this.sessionPromise;
  }

  private async _performGetTools(specificServers?: string[]): Promise<void> {
    try {
      console.log('[MCPClient] Starting getTools', { specificServers });
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

      // Fetch tools from the new API route
      console.log('[MCPClient] Calling /api/chat/tools');
      const urlsToConnect = specificServers
        ? (this.mcpUrls || []).filter(url => targetServerSet.has(url.name))
        : (this.mcpUrls || []);
      
      const response = await fetch('/api/chat/tools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls: urlsToConnect }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to fetch tools: ${response.statusText}`);
      }

      const { breakdown, errors, authRequired } = await response.json();
      
      console.log('[MCPClient] Got response from /api/chat/tools', {
        breakdown,
        errors,
        authRequired
      });
      
      // Log connection errors for debugging
      if (errors && Object.keys(errors).length > 0) {
        console.error('[MCPClient] Connection errors:', errors);
      }

      // When reconnecting specific servers, merge with existing breakdown
      let finalBreakdown = breakdown;
      if (specificServers) {
        const currentBreakdown = this.state.get(breakdownAtom);
        finalBreakdown = { ...currentBreakdown };
        
        // Update with new breakdown data
        Object.entries(breakdown).forEach(([key, value]) => {
          finalBreakdown[key] = value;
        });
        
        // Remove any failed entries for successfully reconnected servers
        specificServers.forEach(serverName => {
          if (breakdown[serverName]) {
            delete finalBreakdown[`${serverName} (Failed)`];
          }
        });
      }
      
      // Add error information to breakdown for failed servers
      if (errors && Object.keys(errors).length > 0) {
        Object.entries(errors).forEach(([serverName]) => {
          // Add failed entry
          finalBreakdown[`${serverName} (Failed)`] = {};
        });
      }
      
      // The toolsAtom expects the breakdown structure
      console.log('[MCPClient] Setting final breakdown:', finalBreakdown);
      this.setTools(finalBreakdown);
      this.setBreakdown(finalBreakdown);

      // Handle servers that require authentication
      if (authRequired && authRequired.length > 0) {
        console.log('[MCPClient] Servers require authentication:', authRequired.map((s: McpUrl) => s.name));
        
        // Clear the promise since we're going to initiate OAuth
        this.getToolsPromise = null;
        
        for (const server of authRequired) {
          // Always initiate OAuth flow when server requires auth
          // The stored session might be expired or invalid
          console.log(`[MCPClient] Initiating OAuth for ${server.name}`);
          await this.initiateOAuthFlow(server);
        }
        
        // After OAuth flows complete, refetch tools for servers that may have succeeded
        console.log('[MCPClient] OAuth flows complete, refetching tools via API');
        const response = await fetch('/api/chat/tools', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ urls: this.mcpUrls || [] }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          // Don't throw here, just log and let the status update handle it
          console.error('[MCPClient] Error refetching tools after OAuth:', errorData.error);
        } else {
          const { breakdown: newBreakdown } = await response.json();
          finalBreakdown = { ...finalBreakdown, ...newBreakdown };
        }
        
        console.log('[MCPClient] Updated breakdown after OAuth:', finalBreakdown);
        this.setTools({ breakdown: finalBreakdown });
        this.setBreakdown(finalBreakdown);
      }

      // Update connection status based on results
      const finalStatus: McpConnectionStatus = { ...currentStatus };
      const activeServers = new Set<string>();

      console.log('[MCPClient] Updating connection status based on breakdown:', {
        urls: this.mcpUrls?.map(u => u.name),
        breakdownKeys: Object.keys(finalBreakdown),
        targetServers: Array.from(targetServerSet)
      });

      this.mcpUrls?.forEach((url) => {
        if (finalBreakdown[url.name]) {
          console.log(`[MCPClient] ${url.name} has tools, marking as connected`);
          finalStatus[url.name] = "connected";
          activeServers.add(url.name);
        } else if (finalBreakdown[`${url.name} (Failed)`]) {
          console.log(`[MCPClient] ${url.name} has failed entry, marking as failed`);
          finalStatus[url.name] = "failed";
        } else if (targetServerSet.has(url.name)) {
          // Only mark as removed if we were actually trying to connect to it
          console.log(`[MCPClient] ${url.name} was targeted but has no breakdown, removing status`);
          delete finalStatus[url.name];
        }
      });

      console.log('[MCPClient] Final connection status:', finalStatus);
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

    // OAuth sessions are now managed server-side

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

  private oauthAttempts = new Map<string, number>();
  private oauthWindows = new Map<string, Window | null>();

  private async initiateOAuthFlow(server: McpUrl): Promise<void> {
    try {
      // Check if we've already attempted OAuth for this server recently
      const attempts = this.oauthAttempts.get(server.name) || 0;
      if (attempts >= 3) {
        console.error(`[MCPClient] Too many OAuth attempts for ${server.name}, stopping`);
        this.setError(`Too many authentication attempts for ${server.name}. Please try again later.`);
        // Reset attempts after 30 seconds
        setTimeout(() => this.oauthAttempts.delete(server.name), 30000);
        return;
      }
      this.oauthAttempts.set(server.name, attempts + 1);
      
      // Clear any existing promise since we're starting a new flow
      this.getToolsPromise = null;
      
      // The callback URL should point to our OAuth callback API
      const callbackUrl = `${window.location.origin}/api/mcp/auth/callback`;
      
      // Call the connect API to get the OAuth URL
      console.log('[MCPClient] Calling /api/mcp/auth/connect for', server.url);
      const response = await fetch('/api/mcp/auth/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          serverUrl: server.url,
          callbackUrl
        }),
      });

      console.log('[MCPClient] Connect API response:', response.status);
      
      const data = await response.json();
      console.log('[MCPClient] Connect API data:', data);
      
      if (!response.ok && response.status !== 401) {
        throw new Error(data.error || `Connect API failed with status ${response.status}`);
      }

      if ((response.status === 401 || data.requiresAuth) && data.authUrl) {
        // Check if we already have an OAuth window open for this server
        const existingWindow = this.oauthWindows.get(server.name);
        if (existingWindow && !existingWindow.closed) {
          console.log(`[MCPClient] OAuth window already open for ${server.name}, focusing it`);
          existingWindow.focus();
          return;
        }
        
        // Open OAuth URL in a new window
        console.log(`[MCPClient] Opening OAuth window for ${server.name}`);
        const authWindow = window.open(data.authUrl, 'mcp-oauth', 'width=600,height=700');
        this.oauthWindows.set(server.name, authWindow);
        
        // Listen for the OAuth callback
        const handleMessage = async (event: MessageEvent) => {
          if (event.origin !== window.location.origin) return;
          
          if (event.data.type === 'oauth-success') {
            window.removeEventListener('message', handleMessage);
            authWindow?.close();
            this.oauthWindows.delete(server.name);
            
            // OAuth succeeded, now we need to fetch tools for this server
            console.log('[MCPClient] OAuth success for', server.name);
            // Reset OAuth attempts counter on success
            this.oauthAttempts.delete(server.name);
            
            // Update the session ID if provided
            if (event.data.sessionId && this.sessionId !== event.data.sessionId) {
              console.log('[MCPClient] Updating session ID from OAuth callback');
              this.sessionId = event.data.sessionId;
            }
            
            // Clear any existing promise and fetch tools for this specific server
            this.getToolsPromise = null;
            await this.getTools([server.name]);
          } else if (event.data.type === 'oauth-error') {
            window.removeEventListener('message', handleMessage);
            authWindow?.close();
            this.oauthWindows.delete(server.name);
            
            this.setError(`OAuth failed for ${server.name}: ${event.data.error}`);
          }
        };

        window.addEventListener('message', handleMessage);

        // Also check if window was closed without completing auth
        const checkClosed = setInterval(() => {
          if (authWindow?.closed) {
            clearInterval(checkClosed);
            window.removeEventListener('message', handleMessage);
            this.oauthWindows.delete(server.name);
            console.log(`[MCPClient] OAuth window closed for ${server.name}`);
          }
        }, 1000);
      } else if (data.success) {
        // Connection succeeded without OAuth
        console.log('[MCPClient] Connection succeeded for', server.name);
        console.log('[MCPClient] Session ID from connect:', data.sessionId);
        
        // Reset OAuth attempts counter on success
        this.oauthAttempts.delete(server.name);
        
        // Ensure we're using the same session ID
        if (data.sessionId && this.sessionId !== data.sessionId) {
          console.log('[MCPClient] Updating session ID from', this.sessionId, 'to', data.sessionId);
          this.sessionId = data.sessionId;
        }
        
        // OAuth succeeded immediately - the main getTools flow will continue
        // and fetch tools now that we have a valid session
        console.log('[MCPClient] OAuth success for', server.name, '- continuing main flow');
      } else {
        this.setError(`Failed to connect to ${server.name}: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('OAuth flow error:', error);
      this.setError(`Failed to initiate OAuth for ${server.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

const mcpClient = new MCPClient();
export default mcpClient;
