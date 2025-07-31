"use client";

import { useChat } from "@ai-sdk/react";
import { MemoizedMarkdown } from "./memoized-markdown";
import { cn } from "@/lib/utils";
import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Square, FileJson, FileText, Copy, Download } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import type { Message } from "@ai-sdk/react";
import { useAtomValue } from "jotai";
import { toolsAtom } from "@/services/mcp/atoms";
import { pendingMessageConfigAtom } from "@/services/commands/atoms";
import type { Tool } from "ai";

export default function ChatCompletion() {
  const toolsData = useAtomValue(toolsAtom);
  const pendingMessageConfig = useAtomValue(pendingMessageConfigAtom);

  console.log("toolsData from atom:", toolsData);

  // Extract tools from the breakdown structure
  const tools = React.useMemo(() => {
    if (!toolsData?.breakdown) return {};

    // Flatten all tools from all servers into a single object
    const allTools: Record<string, Tool> = {};
    Object.values(toolsData.breakdown).forEach((serverTools) => {
      Object.entries(serverTools).forEach(([name, tool]) => {
        allTools[name] = tool;
      });
    });
    console.log("Extracted tools from toolsData:", allTools);
    return allTools;
  }, [toolsData]);

  console.log("Tools being passed to useChat:", tools);
  console.log("Tools keys:", Object.keys(tools));

  const { messages, append, setInput, input, status, stop } = useChat({
    api: "/api/chat",
    body: {
      pendingMessageConfig,
      tools: tools,
    },
    onToolCall: (arg) => {
      console.debug("TOOL CALL", arg);
      console.debug("Current messages:", messages);
      console.debug("Tool call details:", JSON.stringify(arg, null, 2));
    },
    onFinish: (arg) => {
      console.debug("FINISH", arg);
      console.debug("Final messages:", messages);
      setLoading(false);
    },
    onResponse: (arg) => {
      console.debug("RESPONSE", arg);
      console.debug("Response messages:", messages);
    },
    onError: (arg) => {
      console.debug("ERROR", arg);
      console.debug("Error messages:", messages);
      setLoading(false);
    },
  });
  const hasAppended = useRef(false);
  const [loading, setLoading] = useState(true);
  const [stoppable, setStoppable] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [showTranscriptModal, setShowTranscriptModal] = useState(false);
  const [transcriptContent, setTranscriptContent] = useState("");
  const [transcriptFormat, setTranscriptFormat] = useState<"json" | "markdown">(
    "json"
  );

  useEffect(() => {
    console.log("Messages updated:", messages);
  }, [messages]);

  const formatToJson = (msgs: Message[]): string => {
    return JSON.stringify(msgs, null, 2);
  };

  const formatToMarkdown = (msgs: Message[]): string => {
    return msgs
      .map((msg) => {
        let content = "";
        if (msg.content) {
          content = msg.content;
        } else if (msg.parts) {
          content = msg.parts
            .map((part) => {
              if (part.type === "text") return part.text;
              if (part.type === "tool-invocation") {
                return `*[Tool call: ${part.toolInvocation.toolName} (${
                  part.toolInvocation.state
                })]*\\nArgs: \`\`\`json\\n${JSON.stringify(
                  part.toolInvocation.args,
                  null,
                  2
                )}\\n\`\`\` ${
                  part.toolInvocation.state === "result"
                    ? `\\nResult: \`\`\`json\\n${JSON.stringify(
                        part.toolInvocation.result,
                        null,
                        2
                      )}\\n\`\`\``
                    : ""
                }`;
              }
              return "";
            })
            .join("\\n");
        }
        return `**${msg.role === "user" ? "User" : "Assistant"}**: ${content}`;
      })
      .join("\\n\\n---\\n\\n");
  };

  useEffect(() => {
    console.debug("STATUS", status);
    setLoading(messages.length === 0 || status !== "ready");
    setStoppable(
      messages[messages.length - 1]?.parts?.filter(
        (p) =>
          p.type === "tool-invocation" && p.toolInvocation.state !== "result"
      )?.length === 0
    );
  }, [status, messages]);

  useEffect(() => {
    if (!hasAppended.current) {
      hasAppended.current = true;
      setLoading(false);
    }
  }, [append]);

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
  }, [messages]);

  const downloadTranscript = () => {
    const mimeType =
      transcriptFormat === "json" ? "application/json" : "text/markdown";
    const filename =
      transcriptFormat === "json"
        ? "chat-transcript.json"
        : "chat-transcript.md";

    const blob = new Blob([transcriptContent], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-full w-full flex flex-col justify-between">
      <div className="w-full flex-grow overflow-auto">
        <ScrollArea ref={scrollAreaRef} className="h-full overflow-x-auto">
          <div ref={chatContainerRef} className="h-full pb-4">
            <div className="flex flex-col gap-4 pt-4">
              {messages?.map((message, index) => {
                console.log("Message:", index, message);
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
                    {message.parts
                      ? message.parts.map((part, partIndex) => {
                          if (part.type === "tool-invocation") {
                            const hasIframe =
                              part.toolInvocation.args?.hasIframe;
                            return (
                              <div
                                key={`tool-${message.id}-${partIndex}-${part.toolInvocation.toolName}`}
                                className="w-full space-x-2 px-4 py-4 rounded-lg bg-black/80 border border-white/30 overflow-x-auto"
                              >
                                <span
                                  className={cn(
                                    "font-bold",
                                    part.toolInvocation.state !== "result" &&
                                      "gradient-background-loading"
                                  )}
                                >
                                  {part.toolInvocation.toolName
                                    .split("_")
                                    .pop()}{" "}
                                  {hasIframe ? " (computer use agent)" : ""}
                                </span>
                                <div className="text-xs">
                                  {part.toolInvocation.args &&
                                    Object.entries(
                                      part.toolInvocation.args
                                    ).map(([key, value]) => {
                                      return (
                                        <span key={key}>{value as string}</span>
                                      );
                                    })}
                                </div>
                                <div className="text-xs">
                                  {part.toolInvocation.state === "result" ? (
                                    part.toolInvocation.result ? (
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
                                    ) : (
                                      <div className="text-muted-foreground mt-2">
                                        No result available
                                      </div>
                                    )
                                  ) : (
                                    <div className="text-muted-foreground mt-2">
                                      {part.toolInvocation.state}
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
                        })
                      : // Fallback for assistant messages without parts (during streaming)
                        message.content && (
                          <div
                            className="prose prose-invert max-w-none space-y-2 px-4 overflow-x-auto"
                            key={`${message.id}-content`}
                          >
                            <MemoizedMarkdown
                              id={message.id}
                              content={message.content.toString()}
                            />
                          </div>
                        )}
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
      {/* Transcript Export Buttons and Modal - Improved visibility */}
      {!loading && messages.length > 0 && (
        <Dialog
          open={showTranscriptModal}
          onOpenChange={setShowTranscriptModal}
        >
          <div className="flex justify-end gap-2 p-4 border-t border-white/10">
            <DialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="flex gap-2 items-center"
                onClick={() => {
                  setTranscriptFormat("json");
                  setTranscriptContent(formatToJson(messages));
                  setShowTranscriptModal(true);
                }}
              >
                <FileJson className="h-4 w-4" />
                <span>JSON</span>
              </Button>
            </DialogTrigger>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="flex gap-2 items-center"
                onClick={() => {
                  setTranscriptFormat("markdown");
                  setTranscriptContent(formatToMarkdown(messages));
                  setShowTranscriptModal(true);
                }}
              >
                <FileText className="h-4 w-4" />
                <span>Markdown</span>
              </Button>
            </DialogTrigger>
          </div>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>
                Chat Transcript (
                {transcriptFormat === "json" ? "JSON" : "Markdown"})
              </DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <Textarea
                readOnly
                value={transcriptContent}
                className="h-[400px] text-xs bg-black/10 dark:bg-white/5"
                placeholder="Transcript content will appear here..."
              />
            </div>
            <DialogFooter className="flex gap-2">
              <Button
                variant="outline"
                className="flex gap-2 items-center"
                onClick={() => {
                  navigator.clipboard.writeText(transcriptContent);
                }}
              >
                <Copy className="h-4 w-4" />
                <span>Copy</span>
              </Button>
              <Button
                className="flex gap-2 items-center"
                onClick={downloadTranscript}
              >
                <Download className="h-4 w-4" />
                <span>Download</span>
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
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
          {messages.length > 0 && (
            <Button
              variant="outline"
              className="flex gap-2 items-center"
              onClick={() => {
                setTranscriptFormat("json");
                setTranscriptContent(formatToJson(messages));
                setShowTranscriptModal(true);
              }}
            >
              <FileText className="h-4 w-4" />
              <span>Export</span>
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
