import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    const inputRef = React.useRef<HTMLInputElement | null>(null);

    const setRefs = React.useCallback(
      (node: HTMLInputElement | null) => {
        inputRef.current = node;
        if (typeof ref === "function") {
          ref(node);
        } else if (ref) {
          (ref as React.MutableRefObject<HTMLInputElement | null>).current = node;
        }
      },
      [ref],
    );

    React.useEffect(() => {
      const el = inputRef.current;
      if (!el || type !== "number") return;

      // React's onWheel is passive, so preventDefault() there does not stop the
      // browser from stepping number inputs on wheel. Non-passive native listener does.
      const preventWheelStepWhileFocused = (e: WheelEvent) => {
        if (document.activeElement === el) {
          e.preventDefault();
        }
      };

      const opts: AddEventListenerOptions = { passive: false };
      el.addEventListener("wheel", preventWheelStepWhileFocused, opts);
      return () => {
        el.removeEventListener("wheel", preventWheelStepWhileFocused, opts);
      };
    }, [type]);

    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className,
        )}
        ref={setRefs}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
