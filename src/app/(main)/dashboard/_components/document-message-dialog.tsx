"use client";

import * as React from "react";

import { AlignCenter, AlignLeft, AlignRight, FileText, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  type DocumentMessageAlign,
  type DocumentMessageType,
  documentMessageAlignments,
  documentMessageVariables,
} from "@/lib/document-messages";

import type { DocumentMessageMutationState } from "../document-messages/actions";

const initialState: DocumentMessageMutationState = {
  success: false,
  message: "",
};

const alignIcons = {
  center: AlignCenter,
  left: AlignLeft,
  right: AlignRight,
};

export function DocumentMessageDialog({
  action,
  align,
  documentType,
  enabled,
  messageText,
  returnTo,
}: {
  action: (state: DocumentMessageMutationState, formData: FormData) => Promise<DocumentMessageMutationState>;
  align: DocumentMessageAlign;
  documentType: DocumentMessageType;
  enabled: boolean;
  messageText: string;
  returnTo: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [message, setMessage] = React.useState(messageText);
  const [messageAlign, setMessageAlign] = React.useState<DocumentMessageAlign>(align);
  const [isEnabled, setIsEnabled] = React.useState(enabled);
  const [isSaving, setIsSaving] = React.useState(false);
  const [state, setState] = React.useState<DocumentMessageMutationState>(initialState);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const label = documentType === "estimate" ? "estimate" : "invoice";

  React.useEffect(() => {
    setMessage(messageText);
    setMessageAlign(align);
    setIsEnabled(enabled);
  }, [align, enabled, messageText]);

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);

    if (!nextOpen) {
      setIsSaving(false);
    }
  }

  function insertVariable(variable: string) {
    const token = `{{${variable}}}`;
    const textarea = textareaRef.current;

    if (!textarea) {
      setMessage((current) => (current ? `${current} ${token}` : token));
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const nextMessage = `${message.slice(0, start)}${token}${message.slice(end)}`;
    setMessage(nextMessage);

    window.requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(start + token.length, start + token.length);
    });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSaving) return;

    setIsSaving(true);
    setState(initialState);

    try {
      const nextState = await action(initialState, new FormData(event.currentTarget));
      setState(nextState);

      if (nextState.success) {
        toast.success(nextState.message || "Custom message saved.");
        setOpen(false);
      }
    } catch {
      setState({
        success: false,
        message: "Custom message could not be saved. Please try again.",
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant="outline">
          <FileText />
          Footer
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{label === "estimate" ? "Estimate" : "Invoice"} footer</DialogTitle>
          <DialogDescription>
            This bottom message appears on every {label} preview and downloaded PDF when enabled.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4">
          <input type="hidden" name="documentType" value={documentType} />
          <input type="hidden" name="returnTo" value={returnTo} />
          <input type="hidden" name="enabled" value={isEnabled ? "true" : "false"} />
          <input type="hidden" name="align" value={messageAlign} />

          <div className="flex items-center justify-between gap-4 rounded-md border p-3">
            <div className="grid gap-1">
              <Label htmlFor={`${documentType}-message-enabled`}>Show message</Label>
              <p className="text-muted-foreground text-xs">
                Turn this off to hide the bottom message from previews and PDFs.
              </p>
            </div>
            <Switch id={`${documentType}-message-enabled`} checked={isEnabled} onCheckedChange={setIsEnabled} />
          </div>

          <div className="grid gap-2">
            <Label>Text alignment</Label>
            <ToggleGroup
              type="single"
              value={messageAlign}
              onValueChange={(value) => {
                if (value) setMessageAlign(value as DocumentMessageAlign);
              }}
              variant="outline"
              size="sm"
              spacing={0}
            >
              {documentMessageAlignments.map((alignment) => {
                const Icon = alignIcons[alignment.value];

                return (
                  <ToggleGroupItem
                    key={alignment.value}
                    value={alignment.value}
                    aria-label={`${alignment.label} align`}
                  >
                    <Icon />
                  </ToggleGroupItem>
                );
              })}
            </ToggleGroup>
          </div>

          <div className="grid gap-2">
            <Label htmlFor={`${documentType}-message-text`}>Message</Label>
            <Textarea
              ref={textareaRef}
              id={`${documentType}-message-text`}
              name="messageText"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              className="min-h-56 font-mono text-sm"
              autoResize={false}
            />
            <p className="text-muted-foreground text-xs">Line breaks are preserved in the document.</p>
          </div>

          <div className="grid gap-2">
            <Label>Variables</Label>
            <div className="flex flex-wrap gap-2">
              {documentMessageVariables[documentType].map((variable) => (
                <Button
                  key={variable.value}
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => insertVariable(variable.value)}
                >
                  <Plus />
                  {variable.label}
                </Button>
              ))}
            </div>
          </div>

          {state.message && !state.success ? <p className="text-destructive text-sm">{state.message}</p> : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Saving..." : "Save message"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
