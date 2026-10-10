import { Slot } from "@radix-ui/react-slot";
import { LoaderCircle } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps, ReactElement } from "react";
import { cn } from "../lib/cn.js";

/** min-h-11 / min-w-11 keep every button a 44 pixel touch target (13-UX section 8.4). */
export const buttonVariants = cva(
  "inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-md px-4 text-body font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-brand text-on-brand hover:bg-brand-hover",
        secondary: "border border-default bg-surface text-primary hover:bg-subtle",
        danger: "bg-danger text-on-brand hover:opacity-90",
        ghost: "text-primary hover:bg-subtle",
      },
    },
    defaultVariants: { variant: "primary" },
  },
);

export interface ButtonProps extends ComponentProps<"button">, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  /** Shows an inline spinner and blocks further presses while a submit is running (13-UX section 5). */
  isLoading?: boolean;
}

export function Button({
  className,
  variant,
  asChild = false,
  isLoading = false,
  type = "button",
  children,
  disabled,
  ...props
}: ButtonProps): ReactElement {
  const classes = cn(buttonVariants({ variant }), className);
  if (asChild)
    return (
      <Slot className={classes} {...props}>
        {children}
      </Slot>
    );
  return (
    <button
      type={type}
      className={classes}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      {...props}
    >
      {isLoading ? <LoaderCircle aria-hidden="true" className="size-5 animate-spin" /> : null}
      {children}
    </button>
  );
}
