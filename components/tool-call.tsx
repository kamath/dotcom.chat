"use client";

import { useState } from "react";
import type { ToolInvocation } from "ai";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Loader2,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  AlertCircle,
} from "lucide-react";

interface ToolCallProps {
  toolInvocation: ToolInvocation;
}

export function ToolCall({ toolInvocation }: ToolCallProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { toolName, state, args } = toolInvocation;

  const isLoading = state === "partial-call" || state === "call";
  const isResultState = state === "result";

  const hasExplicitErrorState = false;

  let statusText = "Pending...";
  if (isLoading) {
    statusText = "Loading...";
  } else if (isResultState) {
    statusText = hasExplicitErrorState ? "Error" : "Complete";
  }

  return (
    <div className="mt-3 border rounded-md overflow-hidden">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div className="flex items-center justify-between p-3 bg-background border-b">
          <div className="flex items-center gap-2">
            {isLoading && (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            )}
            {isResultState && !hasExplicitErrorState && (
              <CheckCircle className="h-4 w-4 text-green-500" />
            )}
            {isResultState && hasExplicitErrorState && (
              <AlertCircle className="h-4 w-4 text-red-500" />
            )}
            <span className="font-medium">{toolName}</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-muted-foreground/20">
              {statusText}
            </span>
          </div>

          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm">
              {isOpen ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </CollapsibleTrigger>
        </div>

        <CollapsibleContent>
          <div className="p-3 bg-muted/50 border-b">
            <h4 className="text-sm font-medium mb-1">Arguments</h4>
            <pre className="text-xs bg-background p-2 rounded overflow-x-auto">
              {JSON.stringify(args, null, 2)}
            </pre>
          </div>

          {isResultState && (
            <div className="p-3 bg-background">
              <h4 className="text-sm font-medium mb-1">
                {hasExplicitErrorState ? "Error Details" : "Result"}
              </h4>
              <pre className="text-xs bg-muted/50 p-2 rounded overflow-x-auto">
                {JSON.stringify(toolInvocation.result, null, 2)}
              </pre>
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
