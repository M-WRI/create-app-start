import type * as React from "react";
import { cn } from "../../../lib/utils.js";

export type SpinnerProps = React.ComponentProps<"output"> & {
  label?: string;
};

export function Spinner({ className, label = "Loading", ...props }: SpinnerProps) {
  return (
    <output
      aria-live="polite"
      className={cn("inline-flex items-center justify-center", className)}
      {...props}
    >
      <span className="size-4 animate-spin rounded-full border-2 border-muted border-t-primary" />
      <span className="sr-only">{label}</span>
    </output>
  );
}
