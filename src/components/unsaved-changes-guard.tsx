"use client";

import * as React from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

function serializeForm(form: HTMLFormElement | null) {
  if (!form) return "";

  return JSON.stringify(
    Array.from(new FormData(form).entries()).map(([name, value]) => [
      name,
      value instanceof File
        ? {
            lastModified: value.lastModified,
            name: value.name,
            size: value.size,
            type: value.type,
          }
        : value,
    ]),
  );
}

export function useUnsavedChangesGuard({
  formRef,
  onOpenChange,
  open,
}: {
  formRef: React.RefObject<HTMLFormElement | null>;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  const initialSnapshotRef = React.useRef("");
  const snapshotReadyRef = React.useRef(false);
  const [discardDialogOpen, setDiscardDialogOpen] = React.useState(false);

  const captureInitialSnapshot = React.useCallback(() => {
    initialSnapshotRef.current = serializeForm(formRef.current);
    snapshotReadyRef.current = true;
  }, [formRef]);

  const hasUnsavedChanges = React.useCallback(() => {
    if (!open || !snapshotReadyRef.current) return false;

    return serializeForm(formRef.current) !== initialSnapshotRef.current;
  }, [formRef, open]);

  const closeWithoutPrompt = React.useCallback(() => {
    setDiscardDialogOpen(false);
    initialSnapshotRef.current = "";
    snapshotReadyRef.current = false;
    onOpenChange(false);
  }, [onOpenChange]);

  const requestOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) {
        onOpenChange(true);
        return;
      }

      if (hasUnsavedChanges()) {
        setDiscardDialogOpen(true);
        return;
      }

      closeWithoutPrompt();
    },
    [closeWithoutPrompt, hasUnsavedChanges, onOpenChange],
  );

  React.useEffect(() => {
    if (!open) {
      initialSnapshotRef.current = "";
      snapshotReadyRef.current = false;
      setDiscardDialogOpen(false);
      return;
    }

    const frame = window.requestAnimationFrame(captureInitialSnapshot);

    return () => window.cancelAnimationFrame(frame);
  }, [captureInitialSnapshot, open]);

  return {
    captureInitialSnapshot,
    closeWithoutPrompt,
    discardDialogOpen,
    requestOpenChange,
    setDiscardDialogOpen,
  };
}

export function UnsavedChangesDialog({
  onDiscard,
  onOpenChange,
  open,
}: {
  onDiscard: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
          <AlertDialogDescription>Any unsaved changes will be deleted.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Continue editing</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onDiscard}>
            Discard changes
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
