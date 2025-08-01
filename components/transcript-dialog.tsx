"use client";

import { useState } from "react";
import { FileJson, FileText, Copy, Download } from "lucide-react";
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
import type { Message } from "@ai-sdk/react";

interface TranscriptDialogProps {
  messages: Message[];
  loading: boolean;
}

export function TranscriptDialog({ messages, loading }: TranscriptDialogProps) {
  const [showTranscriptModal, setShowTranscriptModal] = useState(false);
  const [transcriptContent, setTranscriptContent] = useState("");
  const [transcriptFormat, setTranscriptFormat] = useState<"json" | "markdown">(
    "json"
  );

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

  if (loading || messages.length === 0) {
    return null;
  }

  return (
    <Dialog open={showTranscriptModal} onOpenChange={setShowTranscriptModal}>
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
            Chat Transcript ({transcriptFormat === "json" ? "JSON" : "Markdown"}
            )
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
  );
}
