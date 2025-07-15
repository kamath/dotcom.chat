import { FileJson, FileText, Copy } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useCallback, useEffect, useState } from "react";
import { useAtom, useAtomValue, useSetAtom } from "jotai/react";
import { commitThreadAtom } from "@/services/gitchat/atoms";
import {
  dialogOpenAtom,
  keybindingsActiveAtom,
} from "@/services/commands/atoms";
import { Commit } from "@/services/gitchat/client";

export const Export = () => {
  const [transcriptFormat, setTranscriptFormat] = useState("markdown");
  const [transcriptContent, setTranscriptContent] = useState("");
  const commits = useAtomValue(commitThreadAtom);
  const [dialogOpen, setDialogOpen] = useAtom(dialogOpenAtom);
  const setKeybindingsActive = useSetAtom(keybindingsActiveAtom);

  useEffect(() => {
    if (dialogOpen) {
      setKeybindingsActive(false);
    } else {
      setKeybindingsActive(true);
    }
    return () => {
      setKeybindingsActive(true);
    };
  }, [dialogOpen, setKeybindingsActive]);

  const formatToJson = useCallback((cms: Commit[]): string => {
    return JSON.stringify(cms, null, 2);
  }, []);

  const formatToMarkdown = useCallback((cmts: Commit[]): string => {
    return cmts
      .map((cmt) => {
        return `**${cmt.author}**: ${cmt.message.trim()}`;
      })
      .join("\n\n---\n\n");
  }, []);

  useEffect(() => {
    setTranscriptContent(
      transcriptFormat === "json"
        ? formatToJson(commits)
        : formatToMarkdown(commits)
    );
  }, [transcriptFormat, formatToJson, formatToMarkdown, commits]);

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Chat Transcript</DialogTitle>
        </DialogHeader>

        <div className="flex items-center justify-between mb-4 mt-2">
          <div className="flex gap-2">
            <Button
              variant={transcriptFormat === "markdown" ? "default" : "outline"}
              size="sm"
              onClick={() => setTranscriptFormat("markdown")}
            >
              <FileText className="h-4 w-4 mr-2" />
              Markdown
            </Button>
            <Button
              variant={transcriptFormat === "json" ? "default" : "outline"}
              size="sm"
              onClick={() => setTranscriptFormat("json")}
            >
              <FileJson className="h-4 w-4 mr-2" />
              JSON
            </Button>
          </div>
        </div>

        <Textarea
          readOnly
          value={transcriptContent}
          className="h-[400px] text-xs font-mono"
        />

        <DialogFooter className="flex gap-2 mt-4">
          <Button
            variant="outline"
            onClick={() => navigator.clipboard.writeText(transcriptContent)}
          >
            <Copy className="h-4 w-4 mr-2" />
            Copy
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
