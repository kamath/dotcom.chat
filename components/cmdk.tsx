"use client";

import * as React from "react";

import {
  CommandDialog,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

import {
  atom,
  getDefaultStore,
  useAtom,
  useAtomValue,
  useSetAtom,
} from "jotai";
import { Command } from "@/services/commands";
import { atomWithStorage } from "jotai/utils";
import {
  cmdkOpenAtom,
  modelNameAtom,
  dialogOpenAtom,
  keybindingsActiveAtom,
} from "@/services/commands/atoms";
import { availableModelSchema, type AvailableModel } from "@/sharedTypes";
import { ChevronRight } from "lucide-react";
import gitChat from "@/services/gitchat/client";
import { isMcpConfigOpenAtom } from "@/services/mcp/atoms";

function setModelName(modelName: AvailableModel) {
  const store = getDefaultStore();
  store.set(modelNameAtom, modelName);
}

const setMcpConfigOpen = (value: boolean) => {
  const store = getDefaultStore();
  store.set(isMcpConfigOpenAtom, value);
};

const setExportDialogOpen = (value: boolean) => {
  const store = getDefaultStore();
  store.set(dialogOpenAtom, value);
};

const getIsLoading = () => {
  const store = getDefaultStore();
  // Assuming you have an isLoading atom somewhere, e.g. in gitchat/atoms
  // If not, you need to define it.
  // For now, let's assume it exists for the logic to make sense.
  // import { isLoadingAtom } from "@/services/gitchat/atoms";
  // return store.get(isLoadingAtom);
  return false; // Placeholder
};

const HIERARCHY_SEPARATOR = " --->>> ";

const parentIdAtom = atom<string | null>(null);
const commandTreeAtom = atomWithStorage<Command[]>("commandTree", [
  {
    name: "Set Model",
    id: "set-model",
  },
  {
    name: "MCP Config",
    id: "mcp-config",
    onSelect: () => {
      setMcpConfigOpen(true);
    },
  },
  {
    name: "Export Chat",
    id: "export-chat",
    onSelect: () => {
      if (!getIsLoading() && gitChat.commitThread.length > 0) {
        setExportDialogOpen(true);
      } else {
        alert("Please wait for the current operation to complete.");
      }
    },
  },
  {
    name: "Clear",
    id: "new-thread",
    onSelect: () => {
      gitChat.clearCommits(true);
    },
  },
  {
    name: "Search Messages",
    id: "search-messages",
  },
  {
    name: "DELETE ALL CHATS",
    id: "delete-all-chats",
    onSelect: () => {
      gitChat.clearCommits(true);
    },
  },
  ...availableModelSchema.options.map((model) => ({
    name: model,
    id: model,
    onSelect: () => {
      setModelName(model);
    },
    parentId: "set-model",
  })),
  ...Object.values(gitChat.commits).map((commit) => ({
    name: commit.metadata.message.content,
    id: commit.id,
    onSelect: () => {
      gitChat.setCommitHead(commit.id);
    },
    parentId: "search-messages",
  })),
]);

const commandsListAtom = atom((get) => {
  const commandTree = get(commandTreeAtom);
  const parentId = get(parentIdAtom);
  const commands = commandTree
    .filter((c) => c.parentId === parentId || !parentId)
    .map((command) => {
      const parents = [];
      let node: Command | undefined = command;
      while (node?.parentId) {
        const parent = commandTree.find((c) => c.id === node?.parentId);
        parents.push(parent?.name ?? "");
        node = commandTree.find((c) => c.id === node?.parentId);
      }
      return {
        ...command,
        name:
          parents.reverse().join(HIERARCHY_SEPARATOR) +
          HIERARCHY_SEPARATOR +
          command.name,
      };
    });
  return commands;
});

export function CmdK() {
  const [inputValue, setInputValue] = React.useState("");
  const commandsList = useAtomValue(commandsListAtom);
  const setParentId = useSetAtom(parentIdAtom);
  const [open, setOpen] = useAtom(cmdkOpenAtom);
  const setKeybindingsActive = useSetAtom(keybindingsActiveAtom);

  React.useEffect(() => {
    if (open) {
      setKeybindingsActive(false);
    } else {
      setKeybindingsActive(true);
      setParentId(null);
    }
    return () => {
      setKeybindingsActive(true);
    };
  }, [open, setKeybindingsActive, setParentId]);

  return (
    <>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder="Type a command or search..."
          value={inputValue}
          onValueChange={setInputValue}
        />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          {commandsList.map((command, commandIndex) => {
            return (
              <CommandItem
                key={`${commandIndex} - ${command.name}`}
                value={command.name}
                onSelect={() => {
                  command.onSelect?.();
                  if (command.onSelect) {
                    setOpen(false);
                  } else {
                    setParentId(command.id);
                  }
                }}
              >
                {command.name.split(HIERARCHY_SEPARATOR).map((part, index) => {
                  return (
                    <span key={index} className="flex items-center gap-2">
                      {part}
                      {index <
                        command.name.split(HIERARCHY_SEPARATOR).length - 1 && (
                        <ChevronRight />
                      )}
                    </span>
                  );
                })}
              </CommandItem>
            );
          })}
        </CommandList>
      </CommandDialog>
    </>
  );
}
