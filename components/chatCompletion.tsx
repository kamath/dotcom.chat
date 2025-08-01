"use client";

import { useChat } from "@ai-sdk/react";
import { MemoizedMarkdown } from "./memoized-markdown";
import { TranscriptDialog } from "./transcript-dialog";
import { cn } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Square } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { useAtomValue } from "jotai";
import { mcpUrlsAtom } from "@/services/mcp/atoms";

type MessagePart = {
  type: string;
  text?: string;
  toolInvocation?: {
    toolName: string;
    state: string;
    args?: Record<string, unknown>;
  };
};

export default function ChatCompletion() {
  const mcpUrls = useAtomValue(mcpUrlsAtom);

  const { messages, append, setInput, input, status, stop } = useChat({
    api: "/api/chat",
    body: {
      mcpUrls: mcpUrls,
    },
    onToolCall: (arg) => {
      console.debug("TOOL CALL", arg, messages);
    },
    onFinish: (arg) => {
      console.debug("FINISH", arg, messages);
      setLoading(false);
    },
    onResponse: (arg) => {
      console.debug("RESPONSE", arg, messages);
    },
    onError: (arg) => {
      console.debug("ERROR", arg, messages);
      setLoading(false);
    },
  });
  const hasAppended = useRef(false);
  const [loading, setLoading] = useState(true);
  const [messageParts, setMessageParts] = useState<MessagePart[]>([]);
  const [stoppable, setStoppable] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    console.debug("STATUS", status);
    setLoading(messages.length === 0 || status !== "ready");
    setStoppable(
      messages[messages.length - 1]?.parts?.filter(
        (p) =>
          p.type === "tool-invocation" && p.toolInvocation.state !== "result"
      ).length === 0
    );
  }, [status, messages]);

  useEffect(() => {
    if (!hasAppended.current) {
      hasAppended.current = true;
      setLoading(false);
    }
  }, [append]);

  useEffect(() => {
    // Update messageParts when messages change
    const parts = messages.flatMap((message) =>
      message.parts ? message.parts : []
    );
    setMessageParts(parts);
  }, [messages]);

  useEffect(() => {
    // Scroll to bottom when messageParts changes
    if (scrollAreaRef.current) {
      const viewport = scrollAreaRef.current.querySelector(
        "[data-radix-scroll-area-viewport]"
      );
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    }
  }, [messageParts]);

  return (
    <div className="h-full w-full flex flex-col justify-between">
      <div className="w-full flex-grow overflow-auto">
        <ScrollArea ref={scrollAreaRef} className="h-full overflow-x-auto">
          <div ref={chatContainerRef} className="h-full pb-4">
            <div className="flex flex-col gap-4 pt-4">
              {messages?.map((message, index) => {
                if (message.role === "user") {
                  return (
                    <div className="px-4" key={message.id}>
                      <div className="w-full p-4 rounded-lg bg-gradient-to-br from-[#635943]/30 to-[#ffdc83]/10">
                        <p className="text-md font-bold font-ppsupply">
                          {message.content.toString()}
                        </p>
                      </div>
                    </div>
                  );
                }
                return (
                  <div
                    key={`${message.id}-${index}`}
                    className="flex flex-col gap-4 px-4"
                  >
                    {message.parts.map((part, partIndex) => {
                      if (part.type === "tool-invocation") {
                        const hasIframe = part.toolInvocation.args?.hasIframe;
                        return (
                          <div
                            key={`part-${message.id}-${partIndex}`}
                            className="w-full space-x-2 px-4 py-4 rounded-lg bg-black/80 border border-white/30 overflow-x-auto"
                          >
                            <span
                              className={cn(
                                "font-bold",
                                part.toolInvocation.state !== "result" &&
                                  "gradient-background-loading"
                              )}
                            >
                              {part.toolInvocation.toolName.split("_").pop()}{" "}
                              {hasIframe ? " (computer use agent)" : ""}
                            </span>
                            <div className="text-xs">
                              {part.toolInvocation.args &&
                                Object.entries(part.toolInvocation.args).map(
                                  ([key, value]) => {
                                    return (
                                      <span key={key}>{value as string}</span>
                                    );
                                  }
                                )}
                            </div>
                            <div className="text-xs">
                              {part.toolInvocation.state === "result" &&
                                part.toolInvocation.result && (
                                  <div className="flex flex-col gap-2 mt-2">
                                    {part.toolInvocation.toolName ===
                                      "screenshot" ||
                                    part.toolInvocation.toolName ===
                                      "stagehand_act" ? (
                                      <div className="mt-2">
                                        <Image
                                          src={`data:image/png;base64,${part.toolInvocation.result}`}
                                          alt="Screenshot"
                                          width={300}
                                          height={300}
                                          className="max-w-full rounded-lg border border-white/20"
                                        />
                                      </div>
                                    ) : (
                                      <MemoizedMarkdown
                                        id={message.id}
                                        content={part.toolInvocation.result.toString()}
                                      />
                                    )}
                                  </div>
                                )}
                            </div>
                          </div>
                        );
                      } else if (part.type === "text") {
                        return (
                          <div
                            className="prose prose-invert max-w-none space-y-2 px-4 overflow-x-auto"
                            key={`${message.id}-${partIndex}`}
                          >
                            <MemoizedMarkdown
                              id={message.id}
                              content={part.text.toString()}
                            />
                          </div>
                        );
                      }
                    })}
                    {message.annotations?.map((annotation, annotationIndex) => {
                      if (
                        typeof annotation === "object" &&
                        annotation !== null &&
                        "structuredResult" in annotation
                      ) {
                        return (
                          <div
                            key={`annotation-${message.id}-${annotationIndex}`}
                            className="w-full rounded-lg px-4 py-2 bg-black/30 border border-white/30 overflow-auto flex flex-col gap-2"
                          >
                            <h1 className="font-bold text-lg">Final Result</h1>
                            <pre className="text-xs overflow-x-auto">
                              {JSON.stringify(
                                annotation.structuredResult,
                                null,
                                2
                              )}
                            </pre>
                          </div>
                        );
                      }
                      return <></>;
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </ScrollArea>
      </div>
      {/* Transcript Export Dialog */}
      <TranscriptDialog messages={messages} loading={loading} />
      {/* Loading Indicator OR Input Field */}
      {loading ? (
        <div className="flex gap-2 justify-between items-center px-4 pb-4">
          {(stoppable || messages.length === 0) && (
            <button className="flex gap-2 items-center text-md font-bold uppercase gradient-background-loading text-md">
              Loading...
            </button>
          )}
          {stoppable && (
            <div
              className="flex gap-2 items-center border border-white/30 rounded-lg px-3 py-1 bg-black/30"
              onClick={() => stop()}
            >
              <Square className="w-2 h-2 text-transparent bg-white/70" />
              <span className="text-md">Stop</span>
            </div>
          )}
        </div>
      ) : (
        /* Chat Input Field when not loading */
        <div className="flex gap-2 p-4">
          <Input
            value={input}
            onChange={(event) => {
              setInput(event.target.value);
            }}
            placeholder="Ask a follow up question..."
            className="w-full rounded-lg px-4 py-2 bg-black/30 border border-white/30"
            onKeyDown={async (event) => {
              if (event.key === "Enter") {
                if (input.trim()) {
                  append({ content: input, role: "user" });
                  setInput("");
                }
              }
            }}
          />
        </div>
      )}
    </div>
  );
}
