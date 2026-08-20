import { type ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center rounded-[var(--radius-md)] px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none",
        variant === "primary" &&
          "bg-[var(--color-action-primary)] text-[var(--color-action-primary-text)] hover:opacity-90",
        variant === "secondary" &&
          "border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--gray-3)]",
        variant === "ghost" &&
          "text-[var(--color-text)] hover:bg-[var(--gray-3)]",
        className,
      )}
      {...props}
    />
  ),
);
Button.displayName = "Button";
