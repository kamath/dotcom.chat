"use client";

import type React from "react";
import { Message, useChat } from "@ai-sdk/react";
import { ChatMessage } from "@/components/message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Send, Square } from "lucide-react";
import { LoadingMessage } from "@/components/loading-message";
import { useEffect, useCallback, useRef } from "react";
// ShadCN Sidebar components - Assuming this is the correct path
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarGroup,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { useAtom, useAtomValue, useSetAtom } from "jotai/react";
import {
  commitHeadAtom,
  commitsAtom,
  commitThreadAtom,
  currentCommitChildrenAtom,
  currentCommitChildrenIndexMapAtom,
  fullCommitListAtom,
  isLoadingAtom,
  lastUserCommitAtom,
} from "@/services/gitchat/atoms";
import {
  cmdkOpenAtom,
  dialogOpenAtom,
  pendingMessageConfigAtom,
} from "@/services/commands/atoms";
import { Export } from "@/components/export";
import { Badge } from "@/components/ui/badge";
import { CmdK } from "@/components/cmdk";
import gitChat from "@/services/gitchat/client";
import type { GitChat, Commit } from "@/services/gitchat/client";
import { ToolsSidebar } from "@/components/tools-sidebar";
import Keybinding from "@/components/keybinding";
import { cn } from "@/lib/utils";
import { ServerConfigDialog } from "@/components/server-config-dialog";
import { breakdownAtom, isMcpConfigOpenAtom } from "@/services/mcp/atoms";

// Function to format date into a pretty relative time
const formatRelativeTime = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) {
    return `${diffInSeconds}s`;
  } else if (diffInSeconds < 3600) {
    return `${Math.floor(diffInSeconds / 60)}m`;
  } else if (diffInSeconds < 86400) {
    return `${Math.floor(diffInSeconds / 3600)}h`;
  } else {
    return `${Math.floor(diffInSeconds / 86400)}d`;
  }
};

export default function ChatPage() {
  // Ref for the scroll viewport
  const scrollAreaRef = useRef<HTMLDivElement | null>(null);
  // Ref for the input field
  const inputRef = useRef<HTMLInputElement | null>(null);

  // GitChat instance
  const chatRef = useRef<GitChat>(null);
  useEffect(() => {
    if (!chatRef.current) {
      chatRef.current = gitChat;
    }
  }, []);

  // Atoms
  const commitHead = useAtomValue(commitHeadAtom);
  const commits = useAtomValue(commitsAtom);
  const commitThread = useAtomValue(commitThreadAtom);
  const fullCommitList = useAtomValue(fullCommitListAtom);
  const pendingMessageConfig = useAtomValue(pendingMessageConfigAtom);
  const currentCommitChildren = useAtomValue(currentCommitChildrenAtom);
  const currentCommitChildrenIndexMap = useAtomValue(
    currentCommitChildrenIndexMapAtom
  );
  const lastUserCommit = useAtomValue(lastUserCommitAtom);
  const [isLoading, setIsLoading] = useAtom(isLoadingAtom);
  const [cmdkOpen, setCmdkOpen] = useAtom(cmdkOpenAtom);
  const setDialogOpen = useSetAtom(dialogOpenAtom);
  const setMcpConfigOpen = useSetAtom(isMcpConfigOpenAtom);
  const breakdown = useAtomValue(breakdownAtom);

  useEffect(() => {
    if (breakdown) {
      console.log("Breakdown:", breakdown);
    }
  }, [breakdown]);

  const messageFinishCallback = useCallback(
    (assistantMessage: Message) => {
      console.debug("FINISH - AI Message:", assistantMessage);
      if (chatRef.current && assistantMessage.role === "assistant") {
        // The 'commitHead' atom at this point should be the ID of the user's message
        // that initiated this turn, because we set it at the end of onSubmit.
        // To ensure we get the latest value and avoid stale closures,
        // read directly from the store. By the time onFinish is called,
        // onSubmit should have updated commitHeadAtom to the user's message ID.
        const parentOfAssistantMessage = chatRef.current?.commitHead;

        const aiCommit: Commit = {
          id: assistantMessage.id,
          message: assistantMessage.content,
          author:
            assistantMessage.role === "assistant"
              ? pendingMessageConfig.modelName
              : "user",
          date: (assistantMessage.createdAt ?? new Date()).toISOString(),
          metadata: { message: assistantMessage },
          parentId: parentOfAssistantMessage ?? undefined, // Parent is the user commit
        };
        chatRef.current?.addCommit(aiCommit, true);
        chatRef.current?.setCommitHead(aiCommit.id); // Update global commit head to this new AI commit
        setIsLoading(false);
      }
    },
    [pendingMessageConfig.modelName, setIsLoading]
  );

  const { messages, status, input, setInput, setMessages, append, stop } =
    useChat({
      id: commitHead ?? undefined,
      body: {
        pendingMessageConfig,
      },
      onToolCall: (arg) => {
        console.debug("TOOL CALL", arg);
      },
      onFinish: messageFinishCallback,
      onResponse: (arg) => {
        console.debug("RESPONSE", arg);
      },
      onError: (arg) => {
        console.debug("ERROR", arg);
      },
    });

  useEffect(() => {
    if (status === "submitted" || status === "streaming") {
      setIsLoading(true);
    } else {
      setIsLoading(false);
    }
  }, [status, setIsLoading]);

  const onSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (input.trim()) {
        setIsLoading(true);
        const message: Message = {
          id: crypto.randomUUID(),
          content: input,
          role: "user",
          createdAt: new Date(),
        };
        const commit: Commit = {
          id: message.id,
          message: message.content,
          author: message.role,
          date:
            message.createdAt instanceof Date
              ? message.createdAt.toISOString()
              : new Date().toISOString(),
          metadata: {
            message,
          },
          parentId: chatRef.current?.commitHead,
        };
        setInput("");
        chatRef.current?.addCommit(commit, true);
        chatRef.current?.setCommitHead(commit.id);
        append(commit.metadata.message);
      }
    },
    [input, setInput, append, setIsLoading]
  );

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    const viewport = scrollAreaRef.current?.querySelector(
      "[data-radix-scroll-area-viewport]"
    );
    if (viewport) {
      viewport.scrollTop = viewport.scrollHeight;
    }
  }, [messages]);

  // Set the messages to the commit thread when the commit thread changes
  useEffect(() => {
    setMessages(commitThread.map((c) => c.metadata.message));
  }, [commitThread, setMessages]);

  // Effect to focus input on Tab key press
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        inputRef.current?.blur();
      }
      // If the input is focused, don't do anything
      if (document.activeElement === inputRef.current) return;
      if (event.key === "Tab" || event.key === "i") {
        event.preventDefault();
        inputRef.current?.focus();
      }

      if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setCmdkOpen((open) => !open);
      }

      // If there's a message streaming, pause all key presses below this
      if (isLoading || cmdkOpen) return;
      console.log("event.key", event.key, isLoading, cmdkOpen);

      // Clear the chat (start a new thread)
      if (event.key === "c") {
        event.preventDefault();
        chatRef.current?.clearCommits();
      }

      // Configure MCP
      if (event.key === "m") {
        event.preventDefault();
        setMcpConfigOpen(true);
      }

      // Configure Exports
      if (event.key === "e") {
        event.preventDefault();
        setDialogOpen(true);
      }

      if (commitHead) {
        const commit = commits[commitHead];
        // Go to the last user commit
        if (event.key === "u") {
          event.preventDefault();
          chatRef.current?.redoLastUserCommit();
        }

        // Retry the last user message
        if (event.key === "r") {
          if (commit.metadata.message.content) {
            setIsLoading(true);
            append(commit.metadata.message);
          }
        }

        // Go to the previous message
        if (event.key === "p") {
          event.preventDefault();
          if (commit.parentId) {
            chatRef.current?.setCommitHead(commit.parentId);
          }
        }

        // Go to the child node at the specified index in currentCommitChildren
        if (!isNaN(Number(event.key)) && event.key.trim() !== "") {
          const index = Number(event.key);
          if (index > 0 && index <= currentCommitChildren.length) {
            chatRef.current?.setCommitHead(currentCommitChildren[index - 1].id);
          }
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    // Cleanup function to remove the event listener
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    commitHead,
    commits,
    currentCommitChildren,
    setCmdkOpen,
    isLoading,
    cmdkOpen,
    setMcpConfigOpen,
    setDialogOpen,
  ]);

  return (
    <SidebarProvider>
      <div className="flex flex-row h-screen w-full">
        {/* Left Sidebar */}
        <Sidebar className="border-r flex flex-col">
          <SidebarHeader className="py-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                chatRef.current?.clearCommits(true);
              }}
            >
              Clear
            </Button>
          </SidebarHeader>
          <SidebarContent className="flex-grow overflow-y-auto">
            <SidebarGroup className="py-2 px-0">
              {fullCommitList.map((commit) => {
                // Determine background color based on commit selection and parent relationship
                let bgColor = "";
                if (commitHead === commit.id) {
                  // Current commit head
                  bgColor = "bg-primary/10 dark:bg-muted py-6";
                }
                let author = <span>{commit.author}</span>;
                if (currentCommitChildrenIndexMap[commit.id] !== undefined) {
                  author = (
                    <div className="my-2">
                      <Keybinding>
                        {currentCommitChildrenIndexMap[commit.id] + 1}
                      </Keybinding>{" "}
                      <span className="ml-2 font-bold">Next user message</span>
                    </div>
                  );
                }
                if (
                  commitHead !== null &&
                  commit.id === commits[commitHead]?.parentId
                ) {
                  author = (
                    <div className="my-2">
                      <Keybinding>P</Keybinding>{" "}
                      <span className="ml-2 font-bold">Previous message</span>
                    </div>
                  );
                }
                return (
                  <div
                    key={commit.id}
                    onClick={() => {
                      if (isLoading) return;
                      chatRef.current?.setCommitHead(commit.id);
                      setMessages(commitThread.map((c) => c.metadata.message));
                    }}
                    className={cn(
                      `px-4 py-3 rounded-md ${bgColor}`,
                      isLoading
                        ? "cursor-default"
                        : "cursor-pointer hover:bg-gray-100 dark:hover:bg-muted"
                    )}
                  >
                    <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                      <span className="text-muted-foreground">{author}</span>
                      <span>
                        <span
                          className="font-semibold"
                          suppressHydrationWarning={true}
                        >
                          {formatRelativeTime(commit.date)}
                        </span>
                        {" · "}
                        <Badge variant="outline" className="mx-1">
                          {commit.id.slice(0, 10)}
                        </Badge>
                      </span>
                      <span
                        className="text-foreground truncate"
                        style={{
                          maxWidth: "100%",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          display: "block",
                        }}
                        title={commit.message}
                      >
                        {commit.message}
                      </span>
                    </div>
                  </div>
                );
              })}
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>

        {/* Main Chat Content */}
        <div className="flex flex-col flex-1 h-full overflow-x-auto">
          <header className="p-4 border-b flex justify-between items-center">
            <h1 className="text-xl font-semibold">Git Chat</h1>
          </header>

          <ScrollArea className="flex-1 p-4 space-y-4" ref={scrollAreaRef}>
            <div className="max-w-xs lg:max-w-3xl mx-auto space-y-4 pb-20">
              {commitThread.length === 0 &&
              !isLoading &&
              currentCommitChildren.length === 0 ? (
                <div className="text-center py-20 flex flex-col items-center gap-4">
                  <span className="text-muted-foreground">
                    <span className="text-xl text-muted-foreground flex items-center gap-2 justify-center">
                      Press{" "}
                      <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
                        Tab
                      </kbd>{" "}
                      to type a message.
                    </span>
                  </span>
                  <span className="text-muted-foreground">
                    <span className="text-xl text-muted-foreground flex items-center gap-2 justify-center">
                      <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
                        <span className="text-xs">⌘</span>K
                      </kbd>{" "}
                      to open the command palette.
                    </span>
                  </span>
                </div>
              ) : (
                commitThread.map((commit, index) => (
                  <div key={`msg-${commit.id}-${index}`}>
                    <div className="w-full flex items-center justify-center gap-2">
                      <p className="text-xs text-muted-foreground">
                        {commit.author}
                      </p>
                      <p
                        className="text-xs text-muted-foreground"
                        suppressHydrationWarning={true}
                      >
                        {formatRelativeTime(commit.date)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        <Badge variant="outline">
                          {commit.id.slice(0, 10)}
                        </Badge>
                      </p>
                    </div>
                    <ChatMessage commit={commit} />
                    <div className="flex justify-end gap-2">
                      {lastUserCommit?.id === commit.id && !isLoading && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              chatRef.current?.redoLastUserCommit()
                            }
                          >
                            <Keybinding>U</Keybinding> Undo
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              if (commit.metadata.message.content) {
                                setIsLoading(true);
                                append(commit.metadata.message);
                              }
                            }}
                          >
                            <Keybinding>R</Keybinding> Retry
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))
              )}
              {status === "streaming" && (
                <ChatMessage
                  commit={commitThread[commitThread.length - 1]}
                  messageProp={messages[messages.length - 1]}
                />
              )}
              {isLoading && <LoadingMessage />}
              {currentCommitChildren.length > 0 && (
                <ScrollArea className="max-w-3xl whitespace-nowrap rounded-md border">
                  <div className="flex w-max space-x-4 p-4">
                    {currentCommitChildren.map((commit) => {
                      // Determine background color based on commit selection and parent relationship
                      let bgColor = "";
                      if (commitHead === commit.id) {
                        // Current commit head
                        bgColor = "bg-gray-200 dark:bg-muted py-6";
                      } else if (
                        commitHead &&
                        commits[commitHead]?.parentId === commit.id
                      ) {
                        // This commit is the parent of the current head
                        // TODO: Add a different color for this
                      } else if (
                        commit.parentId &&
                        commit.parentId === commitHead
                      ) {
                        // This commit is a child of the current head
                        bgColor =
                          "border-1 border-dashed border-gray-400 dark:border-gray-500/50";
                      }
                      return (
                        <div
                          key={commit.id}
                          onClick={() => {
                            chatRef.current?.setCommitHead(commit.id);
                            setMessages(
                              commitThread.map((c) => c.metadata.message)
                            );
                          }}
                          className={`cursor-pointer px-4 py-3 hover:bg-gray-100 dark:hover:bg-muted rounded-md ${bgColor} w-64`}
                        >
                          <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                            <span className="text-muted-foreground truncate">
                              {currentCommitChildrenIndexMap[commit.id] !==
                                undefined && (
                                <Keybinding>
                                  {currentCommitChildrenIndexMap[commit.id] + 1}
                                </Keybinding>
                              )}
                              <span className="ml-2">{commit.author}</span>
                            </span>
                            <span>
                              <span
                                className="font-semibold"
                                suppressHydrationWarning={true}
                              >
                                {formatRelativeTime(commit.date)}
                              </span>
                              {" · "}
                              <Badge variant="outline" className="mx-1">
                                {commit.id.slice(0, 10)}
                              </Badge>
                            </span>
                            <span
                              className="text-foreground truncate"
                              style={{
                                maxWidth: "100%",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                display: "block",
                              }}
                              title={commit.message}
                            >
                              {commit.message}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <ScrollBar orientation="horizontal" />
                </ScrollArea>
              )}
            </div>
          </ScrollArea>

          <div className="p-4 border-t">
            <div className="max-w-3xl mx-auto">
              <div className="flex justify-between items-center mb-2 gap-4">
                <div>
                  <h1 className="text-sm text-muted-foreground">
                    Model: {pendingMessageConfig.modelName}
                  </h1>
                </div>
                <div className="flex gap-2">
                  <ServerConfigDialog />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setMcpConfigOpen(true)}
                  >
                    <Keybinding>M</Keybinding> MCP
                  </Button>
                  {commitThread.length > 0 && (
                    <>
                      <Export />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDialogOpen(true)}
                      >
                        <Keybinding>E</Keybinding> Export Chat
                      </Button>
                      {!isLoading && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            chatRef.current?.clearCommits();
                          }}
                        >
                          <Keybinding>C</Keybinding> New Thread
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </div>
              <form onSubmit={onSubmit} className="flex gap-2">
                <Input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="[PRESS TAB] Type a message..."
                  className="flex-1"
                  disabled={isLoading}
                  autoFocus
                />
                {status === "streaming" ? (
                  <Button
                    type="button"
                    className="bg-red-500"
                    size="icon"
                    onClick={() => stop()}
                  >
                    <Square className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    size="icon"
                    disabled={isLoading || !input.trim()}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                )}
                <CmdK />
              </form>
            </div>
          </div>
        </div>

        {/* Tools Sidebar on the right */}
        <ToolsSidebar />
      </div>
    </SidebarProvider>
  );
}
