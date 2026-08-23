"use client";

import { useEffect, useRef } from "react";

export const dialogTransitionClassName = "moby-dialog-transition";

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
      return;
    }

    if (dialog.open) {
      dialog.close();
    }
  }, [open]);

  return dialogRef;
}
