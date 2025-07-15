import { cn } from "@onehash/oe-features/lib/cn";
import * as React from "react";

export type TextFieldProps = React.InputHTMLAttributes<HTMLInputElement> & {
  trailing?: React.ReactNode;
};

const TextField = React.forwardRef<HTMLInputElement, TextFieldProps>(
  ({ className, trailing, type = "text", ...props }, ref) => {
    return (
      <div className="flex w-full items-stretch">
        {/* The input field container */}
        <div
          className={cn(
            "border-input bg-background ring-offset-background focus-within:ring-ring relative flex w-full rounded-md border focus-within:ring-2 focus-within:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
            className
          )}>
          <input
            type={type}
            className={cn(
              "placeholder:text-muted-foreground flex h-9 w-full rounded-md border-0 bg-transparent px-3 py-2 text-sm focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            )}
            ref={ref}
            {...props}
          />
        </div>

        {/* Trailing component outside the field */}
        {trailing && <div className="h-full">{trailing}</div>}
      </div>
    );
  }
);

TextField.displayName = "TextField";

export { TextField };
