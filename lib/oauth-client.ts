import { URL } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import {
  OAuthClientInformation,
  OAuthClientInformationFull,
  OAuthClientMetadata,
  OAuthTokens,
} from "@modelcontextprotocol/sdk/shared/auth.js";
import {
  CallToolRequest,
  ListToolsRequest,
  CallToolResultSchema,
  ListToolsResultSchema,
  ListToolsResult,
  CallToolResult,
} from "@modelcontextprotocol/sdk/types.js";
import {
  OAuthClientProvider,
  UnauthorizedError,
} from "@modelcontextprotocol/sdk/client/auth.js";

class InMemoryOAuthClientProvider implements OAuthClientProvider {
  private _clientInformation?: OAuthClientInformationFull;
  private _tokens?: OAuthTokens;
  private _codeVerifier?: string;

  constructor(
    private readonly _redirectUrl: string | URL,
    private readonly _clientMetadata: OAuthClientMetadata,
    onRedirect?: (url: URL) => void,
    initialTokens?: OAuthTokens,
    initialClientInfo?: OAuthClientInformationFull
  ) {
    this._onRedirect =
      onRedirect ||
      ((url) => {
        console.log(`Redirect to: ${url.toString()}`);
      });
    this._tokens = initialTokens;
    this._clientInformation = initialClientInfo;
  }

  private _onRedirect: (url: URL) => void;

  get redirectUrl(): string | URL {
    return this._redirectUrl;
  }

  get clientMetadata(): OAuthClientMetadata {
    return this._clientMetadata;
  }

  clientInformation(): OAuthClientInformation | undefined {
    return this._clientInformation;
  }

  saveClientInformation(clientInformation: OAuthClientInformationFull): void {
    this._clientInformation = clientInformation;
  }

  tokens(): OAuthTokens | undefined {
    return this._tokens;
  }

  saveTokens(tokens: OAuthTokens): void {
    this._tokens = tokens;
  }

  redirectToAuthorization(authorizationUrl: URL): void {
    this._onRedirect(authorizationUrl);
  }

  saveCodeVerifier(codeVerifier: string): void {
    this._codeVerifier = codeVerifier;
  }

  codeVerifier(): string {
    if (!this._codeVerifier) {
      throw new Error("No code verifier saved");
    }
    return this._codeVerifier;
  }
}

export class MCPOAuthClient {
  private client: Client | null = null;
  private oauthProvider: InMemoryOAuthClientProvider | null = null;

  constructor(
    private serverUrl: string,
    private callbackUrl: string,
    private onRedirect: (url: string) => void,
    private initialTokens?: OAuthTokens,
    private initialClientInfo?: OAuthClientInformationFull
  ) {}
  
  getTokens(): OAuthTokens | undefined {
    return this.oauthProvider?.tokens();
  }

  getClientInfo(): OAuthClientInformation | undefined {
    return this.oauthProvider?.clientInformation();
  }

  async connect(): Promise<void> {
    const clientMetadata: OAuthClientMetadata = {
      client_name: "Next.js MCP OAuth Client",
      redirect_uris: [this.callbackUrl],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "client_secret_post",
      scope: "mcp:tools",
    };

    this.oauthProvider = new InMemoryOAuthClientProvider(
      this.callbackUrl,
      clientMetadata,
      (redirectUrl: URL) => {
        this.onRedirect(redirectUrl.toString());
      },
      this.initialTokens,
      this.initialClientInfo
    );

    this.client = new Client(
      {
        name: "dotcom.chat",
        version: "1.0.0",
      },
      { capabilities: {} }
    );

    await this.attemptConnection();
  }

  private async attemptConnection(): Promise<void> {
    if (!this.client || !this.oauthProvider) {
      throw new Error("Client not initialized");
    }

    const baseUrl = new URL(this.serverUrl);
    const transport = new StreamableHTTPClientTransport(baseUrl, {
      authProvider: this.oauthProvider,
    });

    try {
      await this.client.connect(transport);
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        throw new Error("OAuth authorization required");
      } else {
        throw error;
      }
    }
  }

  async exchangeCodeForTokens(authCode: string): Promise<void> {
    if (!this.client || !this.oauthProvider) {
      throw new Error("Client not initialized");
    }

    const baseUrl = new URL(this.serverUrl);
    const transport = new StreamableHTTPClientTransport(baseUrl, {
      authProvider: this.oauthProvider,
    });

    await transport.finishAuth(authCode);
    await this.client.connect(transport);
  }

  async finishAuth(authCode: string): Promise<void> {
    // Alias for backward compatibility
    return this.exchangeCodeForTokens(authCode);
  }

  async ensureConnected(): Promise<void> {
    // If we don't have a client or provider, initialize them
    if (!this.client || !this.oauthProvider) {
      await this.connect();
      return;
    }
    
    // Always try to reconnect if we have tokens to ensure fresh connection
    const tokens = this.oauthProvider?.tokens();
    if (tokens) {
      console.log("Reconnecting with OAuth tokens...");
      await this.attemptConnection();
    } else {
      // If no tokens, try initial connection which will trigger OAuth if needed
      await this.attemptConnection();
    }
  }

  async listTools(): Promise<ListToolsResult> {
    await this.ensureConnected();
    
    if (!this.client) {
      throw new Error("Not connected to server");
    }

    const request: ListToolsRequest = {
      method: "tools/list",
      params: {},
    };

    return await this.client.request(request, ListToolsResultSchema);
  }

  async callTool(
    toolName: string,
    toolArgs: Record<string, unknown>
  ): Promise<CallToolResult> {
    await this.ensureConnected();
    
    if (!this.client) {
      throw new Error("Not connected to server");
    }

    const request: CallToolRequest = {
      method: "tools/call",
      params: {
        name: toolName,
        arguments: toolArgs,
      },
    };

    return await this.client.request(request, CallToolResultSchema);
  }

  disconnect(): void {
    this.client = null;
    this.oauthProvider = null;
  }
}