"use client";

import { useEffect, useRef } from "react";

export const dialogTransitionClassName =
  "opacity-0 translate-y-2 scale-[0.98] transition-[opacity,transform,display,overlay] duration-[var(--moby-duration-slow)] ease-standard data-[state=open]:opacity-100 data-[state=open]:translate-y-0 data-[state=open]:scale-100 data-[state=closing]:pointer-events-none data-[state=closing]:opacity-0 data-[state=closing]:translate-y-2 data-[state=closing]:scale-[0.98] motion-reduce:transition-none backdrop:transition-[background-color,opacity] backdrop:duration-[var(--moby-duration-slow)] backdrop:ease-standard";

export function useDialogTransition(open: boolean) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;

    if (dialog == null) {
      return;
    }

    if (open) {
      if (!dialog.open) {
        dialog.showModal();
      }

      dialog.dataset.state = "opening";
      const frame = window.requestAnimationFrame(() => {
        dialog.dataset.state = "open";
      });

      return () => window.cancelAnimationFrame(frame);
    }

    if (!dialog.open) {
      return;
    }

    dialog.dataset.state = "closing";
    const timer = window.setTimeout(() => {
      dialog.close();
      delete dialog.dataset.state;
    }, 180);

    return () => window.clearTimeout(timer);
  }, [open]);

  return dialogRef;
}
