export interface OAuthClientOptions {
  authorizationEndpoint: string;
  tokenEndpoint: string;
  clientId: string;
  redirectUri?: string;
  scope?: string;
}

export class OAuthClient {
  private options: OAuthClientOptions;

  constructor(options: OAuthClientOptions) {
    this.options = {
      ...options,
      redirectUri:
        options.redirectUri ?? (process.env.CALLBACK_URL as string | undefined),
    };
  }

  public getAuthorizationUrl(
    state?: string,
    additionalParams?: Record<string, string>
  ): string {
    const params = new URLSearchParams({
      response_type: "code",
      client_id: this.options.clientId,
      redirect_uri: this.options.redirectUri || "",
    });

    if (this.options.scope) params.set("scope", this.options.scope);
    if (state) params.set("state", state);
    if (additionalParams) {
      for (const [k, v] of Object.entries(additionalParams)) {
        if (v !== undefined && v !== null) params.set(k, String(v));
      }
    }

    return `${this.options.authorizationEndpoint}?${params.toString()}`;
  }

  public async exchangeCodeForToken(
    code: string,
    codeVerifier?: string
  ): Promise<unknown> {
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: this.options.clientId,
      redirect_uri: this.options.redirectUri || "",
    });
    if (codeVerifier) body.set("code_verifier", codeVerifier);

    const res = await fetch(this.options.tokenEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    if (!res.ok) {
      throw new Error(`Token exchange failed with status ${res.status}`);
    }
    return res.json();
  }

  public withAuthHeaders(
    init: RequestInit = {},
    accessToken?: string
  ): RequestInit {
    const headers = new Headers(init.headers || {});
    if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
    return { ...init, headers };
  }
}

