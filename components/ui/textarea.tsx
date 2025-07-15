import * as React from "react";
import { useAtom } from "jotai";
import { keybindingsActiveAtom } from "@/services/commands/atoms";
import { cn } from "@/lib/utils";

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  showPressEsc?: boolean;
}

function Textarea({
  className,
  placeholder,
  onFocus,
  onBlur,
  showPressEsc = false,
  ...props
}: TextareaProps) {
  const [keybindingsActive, setKeybindingsActive] = useAtom(
    keybindingsActiveAtom
  );

  const handleFocus = (e: React.FocusEvent<HTMLTextAreaElement>) => {
    setKeybindingsActive(false);
    onFocus?.(e);
  };

  const handleBlur = (e: React.FocusEvent<HTMLTextAreaElement>) => {
    setKeybindingsActive(true);
    onBlur?.(e);
  };

  const displayPlaceholder =
    !keybindingsActive && showPressEsc
      ? "Press Esc to reactivate keybindings"
      : placeholder;

  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 flex field-sizing-content min-h-16 w-full rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className
      )}
      placeholder={displayPlaceholder}
      onFocus={handleFocus}
      onBlur={handleBlur}
      {...props}
    />
  );
}

export { Textarea };
