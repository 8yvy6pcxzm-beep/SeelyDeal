import { cn } from "@/lib/utils";
import type { InputHTMLAttributes, LabelHTMLAttributes } from "react";

export function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "flex h-10 w-full rounded-lg border border-input bg-card px-3 text-sm text-foreground placeholder:text-muted-foreground/70 transition-all duration-200",
        "focus-visible:outline-none focus-visible:border-primary/50 focus-visible:shadow-[0_0_0_4px_oklch(55%_0.2_280/0.12)] disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export function Label({
  className,
  ...props
}: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("text-sm font-medium text-foreground", className)}
      {...props}
    />
  );
}
