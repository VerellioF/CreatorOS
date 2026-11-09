import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold tracking-wide transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 select-none",
  {
    variants: {
      variant: {
        default:
          "border-primary/20 bg-primary text-primary-foreground shadow-xs hover:bg-primary/90",
        secondary:
          "border-secondary bg-secondary/80 text-secondary-foreground hover:bg-secondary",
        destructive:
          "border-destructive/20 bg-destructive text-destructive-foreground shadow-xs hover:bg-destructive/90",
        outline: "border-border/80 text-foreground hover:bg-accent/40",
        success: "border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
        warning: "border-amber-500/30 bg-amber-500/15 text-amber-700 dark:text-amber-300",
        comingSoon: "border-primary/25 bg-primary/10 text-primary dark:text-indigo-300 font-medium",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
