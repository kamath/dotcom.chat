import { useAtomValue } from "jotai";
import { keybindingsActiveAtom } from "@/services/commands/atoms";

export default function Keybinding({
  children,
}: {
  children: React.ReactNode;
}) {
  const keybindingsActive = useAtomValue(keybindingsActiveAtom);

  if (!keybindingsActive) {
    return null;
  }

  return (
    <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
      {children}
    </kbd>
  );
}
