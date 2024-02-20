import React from "react";
import * as ShadcnButton from "./shadcn-ui/button";
import { cn } from "@/lib/utils";
import { type VariantProps } from "class-variance-authority";
import { Loader2Icon } from "lucide-react";

type BaseButtonVariants = VariantProps<typeof ShadcnButton.buttonVariants>;

type ExtendedButtonVariants = Omit<BaseButtonVariants, "size"> & {
  size?: BaseButtonVariants["size"] | "icon-sm";
};

const buttonVariants = (inputVariants: ExtendedButtonVariants) => {
  const adjustedVariants = {
    ...inputVariants,
    size: inputVariants.size === "icon-sm" ? null : inputVariants.size,
  };
  return ShadcnButton.buttonVariants(adjustedVariants);
};

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    ExtendedButtonVariants {
  asChild?: boolean;
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, size, disabled, loading, children, ...props }, ref) => {
    return (
      <ShadcnButton.Button
        ref={ref}
        className={cn(className, [size === "icon-sm" ? "h-9 w-9" : null])}
        size={size === "icon-sm" ? null : size}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? <Loader2Icon className="animate-spin" /> : children}
      </ShadcnButton.Button>
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
