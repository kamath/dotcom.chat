"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

export default function OAuthCallbackPage() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const success = searchParams.get("success");
    const serverUrl = searchParams.get("serverUrl");
    const sessionId = searchParams.get("sessionId");
    const error = searchParams.get("error");

    if (error) {
      // Handle error
      if (window.opener) {
        window.opener.postMessage({ type: "oauth-error", error }, "*");
        window.close();
      }
      return;
    }

    if (success === "true" && serverUrl && sessionId) {
      // OAuth was successful
      if (window.opener) {
        window.opener.postMessage(
          {
            type: "oauth-success",
            serverUrl,
            sessionId,
          },
          "*"
        );
        window.close();
      }
    } else {
      // Something went wrong
      if (window.opener) {
        window.opener.postMessage(
          { type: "oauth-error", error: "OAuth flow incomplete" },
          "*"
        );
        window.close();
      }
    }
  }, [searchParams]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">Authorization Received</h1>
        <p className="text-muted-foreground">Completing authorization...</p>
      </div>
    </div>
  );
}
