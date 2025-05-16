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
  ListOrdered,
} from "lucide-react";
import { ToolCall } from "./tool-call";

interface ToolCallSequenceProps {
  toolInvocations: ToolInvocation[];
}

export function ToolCallSequence({ toolInvocations }: ToolCallSequenceProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Count completed and total tool calls
  const completedCalls = toolInvocations.filter(
    (t) => t.state === "result"
  ).length;
  const totalCalls = toolInvocations.length;

  // Check if all tool calls are complete
  const allComplete = completedCalls === totalCalls;
  // Check if any tool calls have errors
  const hasErrors = false; // Placeholder: ToolInvocation.state from "ai" does not have an 'error' state.
  // Check if any tool calls are still running (i.e., not in 'result' state yet)
  const isLoading = toolInvocations.some(
    (t) => t.state === "partial-call" || t.state === "call"
  );

  return (
    <div className="mt-3 border rounded-md overflow-hidden">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div className="flex items-center justify-between p-3 bg-background border-b">
          <div className="flex items-center gap-2">
            {isLoading && (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            )}
            {allComplete && !hasErrors && (
              <CheckCircle className="h-4 w-4 text-green-500" />
            )}
            {hasErrors && <AlertCircle className="h-4 w-4 text-red-500" />}
            <ListOrdered className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">Tool Call Sequence</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-muted-foreground/20">
              {completedCalls}/{totalCalls} complete
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
          <div className="divide-y">
            {toolInvocations.map((toolInvocation, index) => (
              <div key={toolInvocation.toolCallId} className="p-2">
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-muted text-xs font-medium">
                    {index + 1}
                  </div>
                  <span className="text-sm font-medium">
                    {toolInvocation.toolName}
                  </span>
                </div>
                <ToolCall toolInvocation={toolInvocation} />
              </div>
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
