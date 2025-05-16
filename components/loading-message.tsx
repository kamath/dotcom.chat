import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { Bot } from "lucide-react";

interface LoadingMessageProps {
  message?: string;
}

export function LoadingMessage({ message }: LoadingMessageProps) {
  return (
    <div className={cn("flex items-start gap-3")}>
      <Avatar
        className={cn(
          "h-8 w-8 mt-0.5 flex items-center justify-center",
          "bg-muted"
        )}
      >
        <Bot className="h-5 w-5" />
      </Avatar>

      <div
        className={cn("flex flex-col max-w-[80%] rounded-lg p-4", "bg-muted")}
      >
        <div className="flex items-center space-x-1">
          <div className="h-2 w-2 bg-foreground/50 rounded-full animate-bounce [animation-delay:-0.3s]" />
          <div className="h-2 w-2 bg-foreground/50 rounded-full animate-bounce [animation-delay:-0.15s]" />
          <div className="h-2 w-2 bg-foreground/50 rounded-full animate-bounce" />
        </div>
        {message && (
          <p className="mt-2 text-sm text-foreground/80">{message}</p>
        )}
      </div>
    </div>
  );
}
