import { Copy } from "lucide-react";
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

  useEffect(() => {
    setTranscriptContent(formatToJson(commits));
  }, [formatToJson, commits]);

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Chat Transcript</DialogTitle>
        </DialogHeader>

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
