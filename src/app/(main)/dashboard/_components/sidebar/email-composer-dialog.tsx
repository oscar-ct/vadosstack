"use client";

import * as React from "react";

import { usePathname, useRouter } from "next/navigation";

import Color from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import LinkExtension from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";
import { FontSize, TextStyle } from "@tiptap/extension-text-style";
import UnderlineExtension from "@tiptap/extension-underline";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  ChevronDown,
  Eraser,
  File,
  Highlighter,
  Italic,
  LinkIcon,
  List,
  ListOrdered,
  MailIcon,
  Palette,
  Paperclip,
  Plus,
  Quote,
  Redo2,
  Send,
  Strikethrough,
  Trash2,
  Underline,
  Undo2,
  Unlink,
  UsersRound,
  X,
} from "lucide-react";
import { siGmail } from "simple-icons";

import { EmailDeliveryResult, type EmailDeliveryResultValue } from "@/components/email-delivery-result";
import { SimpleIcon } from "@/components/simple-icon";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { DocumentEmailTemplate } from "@/lib/email-templates";
import { cn } from "@/lib/utils";

import { type GeneralEmailState, sendGeneralEmailAction } from "./actions";

const initialState: GeneralEmailState = {
  success: false,
  message: "",
};

type EmailRecipient = {
  email: string;
  id: string;
  name: string;
  type: "Customer" | "Lead";
};

function escapeEditorHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function plainTextToEditorHtml(value: string) {
  return value
    .trim()
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => `<p>${escapeEditorHtml(block).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

function fileSizeLabel(size: number) {
  if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(size / 1024))} KB`;
}

const activeToolClass =
  "bg-zinc-950 text-white shadow-sm hover:bg-zinc-900 hover:text-white dark:bg-white dark:text-zinc-950";

const textColors = [
  { label: "Default text", value: "" },
  { label: "Charcoal", value: "#18181b" },
  { label: "Blue", value: "#2563eb" },
  { label: "Green", value: "#059669" },
  { label: "Amber", value: "#d97706" },
  { label: "Red", value: "#dc2626" },
];

const highlightColors = [
  { label: "No highlight", value: "" },
  { label: "Yellow", value: "#fef08a" },
  { label: "Green", value: "#bbf7d0" },
  { label: "Blue", value: "#bfdbfe" },
  { label: "Rose", value: "#fecdd3" },
];

const fontSizes = [
  { label: "Small", value: "12px" },
  { label: "Normal", value: "" },
  { label: "Large", value: "18px" },
  { label: "X-Large", value: "22px" },
  { label: "XX-Large", value: "26px" },
];

export function EmailComposerDialog({
  gmailConnected,
  recipients,
  senderEmail,
  templates = [],
}: {
  gmailConnected: boolean;
  recipients: EmailRecipient[];
  senderEmail?: string | null;
  templates?: DocumentEmailTemplate[];
}) {
  const pathname = usePathname();
  const router = useRouter();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const editorHydratedRef = React.useRef(false);
  const messageTextInputRef = React.useRef<HTMLInputElement>(null);
  const messageHtmlInputRef = React.useRef<HTMLInputElement>(null);
  const recipientPickerRef = React.useRef<HTMLDivElement>(null);
  const [, refreshEditorState] = React.useReducer((value: number) => value + 1, 0);
  const [state, formAction, isPending] = React.useActionState(sendGeneralEmailAction, initialState);
  const [open, setOpen] = React.useState(false);
  const [to, setTo] = React.useState("");
  const [subject, setSubject] = React.useState("");
  const [messageText, setMessageText] = React.useState("");
  const [messageHtml, setMessageHtml] = React.useState("");
  const [files, setFiles] = React.useState<File[]>([]);
  const [dragActive, setDragActive] = React.useState(false);
  const [recipientPickerOpen, setRecipientPickerOpen] = React.useState(false);
  const [recipientQuery, setRecipientQuery] = React.useState("");
  const [linkUrl, setLinkUrl] = React.useState("");
  const [bodyError, setBodyError] = React.useState("");
  const [result, setResult] = React.useState<EmailDeliveryResultValue | null>(null);
  const canSendEmail = gmailConnected && !state.reconnectRequired;
  const gmailConnectLabel = state.reconnectRequired ? "Reconnect Gmail" : "Connect Gmail";
  const returnTo = pathname || "/dashboard/overview";

  const setEditorDraft = React.useCallback((text: string, html: string) => {
    if (messageTextInputRef.current) messageTextInputRef.current.value = text;
    if (messageHtmlInputRef.current) messageHtmlInputRef.current.value = html;
    setMessageText(text);
    setMessageHtml(html);
  }, []);

  const editor = useEditor({
    content: "",
    editorProps: {
      attributes: {
        "aria-label": "Email message",
        "aria-multiline": "true",
        class:
          "min-h-36 w-full px-3 py-3 text-sm leading-6 outline-none sm:min-h-64 [&_.is-editor-empty:first-child::before]:pointer-events-none [&_.is-editor-empty:first-child::before]:float-left [&_.is-editor-empty:first-child::before]:h-0 [&_.is-editor-empty:first-child::before]:text-muted-foreground [&_.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_ol]:ml-5 [&_ol]:list-decimal [&_p]:my-0 [&_p+_p]:mt-3 [&_ul]:ml-5 [&_ul]:list-disc",
        role: "textbox",
      },
    },
    extensions: [
      StarterKit.configure({
        heading: false,
        link: false,
        underline: false,
      }),
      TextStyle,
      FontSize,
      Color,
      Highlight.configure({
        multicolor: true,
      }),
      LinkExtension.configure({
        HTMLAttributes: {
          rel: "noopener noreferrer",
          target: "_blank",
        },
        openOnClick: false,
      }),
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
      UnderlineExtension,
      Placeholder.configure({
        placeholder: "Write your message...",
      }),
    ],
    immediatelyRender: false,
    onSelectionUpdate: () => refreshEditorState(),
    onTransaction: () => refreshEditorState(),
    onUpdate: ({ editor: currentEditor }) => {
      setEditorDraft(currentEditor.getText(), currentEditor.getHTML());
      setBodyError((currentError) => (currentError ? "" : currentError));
    },
  });

  React.useEffect(() => {
    if (!editor) return;

    const syncCurrentEditor = () => {
      setEditorDraft(editor.getText(), editor.getHTML());
      setBodyError((currentError) => (currentError ? "" : currentError));
      refreshEditorState();
    };

    editor.on("update", syncCurrentEditor);
    editor.on("transaction", syncCurrentEditor);

    return () => {
      editor.off("update", syncCurrentEditor);
      editor.off("transaction", syncCurrentEditor);
    };
  }, [editor, setEditorDraft]);

  const clearEditorDraft = React.useCallback(() => {
    editor?.commands.clearContent();
    setEditorDraft("", "");
  }, [editor, setEditorDraft]);

  React.useEffect(() => {
    if (!state.message || !state.submittedAt) return;

    if (!state.success && state.message === "Message is required.") {
      setBodyError(state.message);
      editor?.commands.focus();
      return;
    }

    setResult({
      id: state.submittedAt,
      message: state.message,
      type: state.success ? "success" : "error",
    });

    if (state.success) {
      setTo("");
      setSubject("");
      clearEditorDraft();
      setFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
      router.refresh();
    }
  }, [clearEditorDraft, editor, router, state.message, state.submittedAt, state.success]);

  React.useEffect(() => {
    if (!open) {
      editorHydratedRef.current = false;
      return;
    }

    if (editorHydratedRef.current || !editor) return;

    const nextHtml = messageHtml || plainTextToEditorHtml(messageText);

    editor.commands.setContent(nextHtml, { emitUpdate: false });
    setEditorDraft(editor.getText(), editor.getHTML());
    editorHydratedRef.current = true;
  }, [editor, messageHtml, messageText, open, setEditorDraft]);

  React.useEffect(() => {
    if (!fileInputRef.current) return;

    const transfer = new DataTransfer();
    for (const file of files) {
      transfer.items.add(file);
    }
    fileInputRef.current.files = transfer.files;
  }, [files]);

  React.useEffect(() => {
    if (!recipientPickerOpen) return;

    const closeOnOutsidePointerDown = (event: PointerEvent) => {
      const picker = recipientPickerRef.current;

      if (!picker || picker.contains(event.target as Node)) return;

      setRecipientPickerOpen(false);
    };

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setRecipientPickerOpen(false);
    };

    document.addEventListener("pointerdown", closeOnOutsidePointerDown);
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointerDown);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [recipientPickerOpen]);

  const selectedEmails = React.useMemo(
    () =>
      new Set(
        to
          .split(",")
          .map((email) => email.trim().toLowerCase())
          .filter(Boolean),
      ),
    [to],
  );

  const filteredRecipients = React.useMemo(() => {
    const query = recipientQuery.trim().toLowerCase();
    const matches = recipients.filter((recipient) => {
      if (!recipient.email || selectedEmails.has(recipient.email.toLowerCase())) return false;
      if (!query) return true;

      return (
        recipient.name.toLowerCase().includes(query) ||
        recipient.email.toLowerCase().includes(query) ||
        recipient.type.toLowerCase().includes(query)
      );
    });

    return matches.slice(0, 8);
  }, [recipientQuery, recipients, selectedEmails]);

  const toAutocompleteMatches = React.useMemo(() => {
    const currentToken = to.split(",").at(-1)?.trim().toLowerCase() ?? "";

    if (currentToken.length < 2) return [];

    return recipients
      .filter((recipient) => {
        if (!recipient.email || selectedEmails.has(recipient.email.toLowerCase())) return false;

        return (
          recipient.email.toLowerCase().includes(currentToken) || recipient.name.toLowerCase().includes(currentToken)
        );
      })
      .slice(0, 5);
  }, [recipients, selectedEmails, to]);

  const addRecipient = React.useCallback((recipient: EmailRecipient) => {
    setTo((currentValue) => {
      const emails = currentValue
        .split(",")
        .map((email) => email.trim())
        .filter(Boolean);
      const exists = emails.some((email) => email.toLowerCase() === recipient.email.toLowerCase());

      return exists ? emails.join(", ") : [...emails, recipient.email].join(", ");
    });
    setRecipientQuery("");
    setRecipientPickerOpen(false);
  }, []);

  const completeCurrentRecipient = React.useCallback((recipient: EmailRecipient) => {
    setTo((currentValue) => {
      const parts = currentValue.split(",");
      parts[parts.length - 1] = ` ${recipient.email}`;

      return parts
        .map((part) => part.trim())
        .filter(Boolean)
        .join(", ");
    });
  }, []);

  const applyTemplate = React.useCallback(
    (template: DocumentEmailTemplate) => {
      const nextHtml = template.bodyHtml || plainTextToEditorHtml(template.bodyText);

      setSubject(template.subject);
      setEditorDraft(template.bodyText, nextHtml);
      setBodyError("");

      editor?.commands.setContent(nextHtml, { emitUpdate: false });
      editor?.commands.focus("end");
      refreshEditorState();
    },
    [editor, setEditorDraft],
  );

  const applyTextTool = React.useCallback(
    (tool: string) => {
      const chain = editor?.chain().focus();

      if (!chain) return;

      if (tool === "bold") chain.toggleBold().run();
      if (tool === "italic") chain.toggleItalic().run();
      if (tool === "underline") chain.toggleUnderline().run();
      if (tool === "strike") chain.toggleStrike().run();
      if (tool === "list") chain.toggleBulletList().run();
      if (tool === "orderedList") chain.toggleOrderedList().run();
      if (tool === "blockquote") chain.toggleBlockquote().run();
    },
    [editor],
  );

  const applyAlignment = React.useCallback(
    (alignment: "center" | "left" | "right") => {
      editor?.chain().focus().setTextAlign(alignment).run();
    },
    [editor],
  );

  const applyTextColor = React.useCallback(
    (color: string) => {
      const chain = editor?.chain().focus();

      if (!chain) return;

      if (color) chain.setColor(color).run();
      else chain.unsetColor().run();
    },
    [editor],
  );

  const applyFontSize = React.useCallback(
    (size: string) => {
      const chain = editor?.chain().focus();

      if (!chain) return;

      if (size) chain.setFontSize(size).run();
      else chain.unsetFontSize().run();
    },
    [editor],
  );

  const applyHighlight = React.useCallback(
    (color: string) => {
      const chain = editor?.chain().focus();

      if (!chain) return;

      if (color) chain.toggleHighlight({ color }).run();
      else chain.unsetHighlight().run();
    },
    [editor],
  );

  const applyLink = React.useCallback(() => {
    const href = linkUrl.trim();

    if (!editor || !href) return;

    const normalizedHref = /^[a-z][a-z0-9+.-]*:/i.test(href) ? href : `https://${href}`;

    editor.chain().focus().extendMarkRange("link").setLink({ href: normalizedHref }).run();
    setLinkUrl("");
  }, [editor, linkUrl]);

  const removeLink = React.useCallback(() => {
    editor?.chain().focus().extendMarkRange("link").unsetLink().run();
  }, [editor]);

  const clearFormatting = React.useCallback(() => {
    editor?.chain().focus().unsetAllMarks().clearNodes().run();
  }, [editor]);

  const appendFiles = React.useCallback((nextFiles: FileList | File[]) => {
    setFiles((currentFiles) => {
      const byKey = new Map(currentFiles.map((file) => [`${file.name}-${file.size}-${file.lastModified}`, file]));

      Array.from(nextFiles).forEach((file) => {
        byKey.set(`${file.name}-${file.size}-${file.lastModified}`, file);
      });

      return Array.from(byKey.values()).slice(0, 8);
    });
  }, []);

  const removeFile = React.useCallback((fileToRemove: File) => {
    setFiles((currentFiles) => currentFiles.filter((file) => file !== fileToRemove));
  }, []);

  const prepareSubmit = React.useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      const text = editor?.getText() ?? messageText;
      const html = editor?.getHTML() ?? messageHtml;

      setEditorDraft(text, html);

      if (!text.trim()) {
        event.preventDefault();
        setBodyError("Write a message before sending.");
        editor?.commands.focus();
      }
    },
    [editor, messageHtml, messageText, setEditorDraft],
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && editor) setEditorDraft(editor.getText(), editor.getHTML());
        setOpen(nextOpen);
        if (nextOpen) setResult(null);
      }}
    >
      <DialogTrigger asChild>
        <Button size="icon" className="h-9 w-9 shrink-0 group-data-[collapsible=icon]:opacity-0" variant="outline">
          <MailIcon />
          <span className="sr-only">Compose email</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="grid h-[calc(100svh-1rem)] w-[min(calc(100vw-2rem),72rem)] translate-y-0 grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden p-0 max-sm:top-2 sm:top-1/2 sm:h-[min(56rem,calc(100svh-1rem))] sm:max-w-none sm:-translate-y-1/2">
        <DialogHeader className="border-b px-5 pt-5 pr-14 pb-4">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
            <div className="min-w-0">
              <DialogTitle className="flex items-center gap-2 text-lg">
                <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <MailIcon className="size-4" />
                </span>
                Compose email
              </DialogTitle>
              <DialogDescription className="mt-2">
                Send customer communication from your connected Gmail account.
              </DialogDescription>
            </div>
            {canSendEmail ? (
              <div className="max-w-full truncate rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-700 text-xs lg:mr-4 lg:max-w-72 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
                Gmail connected: {senderEmail ?? "ready"}
              </div>
            ) : (
              <Button
                asChild
                variant="outline"
                size="sm"
                className="h-7 w-fit shrink-0 justify-self-start px-2 text-xs lg:mr-4 lg:h-8 lg:px-3 lg:text-sm"
              >
                <a href={`/api/auth/google/mail?returnTo=${encodeURIComponent(returnTo)}`}>
                  <SimpleIcon icon={siGmail} className="size-3 fill-current lg:size-3.5" />
                  {gmailConnectLabel}
                </a>
              </Button>
            )}
          </div>
        </DialogHeader>

        <form
          action={formAction}
          onSubmit={prepareSubmit}
          className="grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden lg:grid-cols-[14rem_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)_auto]"
        >
          <aside className="min-h-0 min-w-0 border-b bg-muted/30 p-3 lg:overflow-y-auto lg:border-r lg:border-b-0 lg:p-4">
            <div className="flex items-center justify-between gap-3 lg:block">
              <Label className="text-muted-foreground text-xs uppercase tracking-wide">Templates</Label>
              <p className="hidden text-muted-foreground text-xs lg:mt-4 lg:block">
                Templates are managed from the email template builder.
              </p>
            </div>
            <div className="mt-2 flex flex-wrap gap-2 lg:grid">
              {templates.map((template) => (
                <Button
                  key={template.title}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0 justify-start bg-background lg:w-full"
                  onClick={() => applyTemplate(template)}
                >
                  <Plus className="size-4" />
                  {template.title}
                </Button>
              ))}
            </div>
          </aside>

          <section className="grid min-h-0 min-w-0 content-start gap-3 overflow-y-auto p-3 sm:gap-4 sm:p-5">
            <div className="grid gap-2">
              <Label htmlFor="general-email-to">To</Label>
              <Input
                id="general-email-to"
                name="to"
                type="text"
                value={to}
                onChange={(event) => setTo(event.target.value)}
                placeholder="customer@example.com, second@example.com"
                required
              />
              {toAutocompleteMatches.length ? (
                <div className="flex flex-wrap gap-2 rounded-lg border bg-muted/20 p-2">
                  {toAutocompleteMatches.map((recipient) => (
                    <button
                      key={`autocomplete-${recipient.type}-${recipient.id}`}
                      type="button"
                      className="inline-flex max-w-full items-center gap-2 rounded-md border bg-background px-2 py-1 text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      onClick={() => completeCurrentRecipient(recipient)}
                    >
                      <span className="truncate">{recipient.name}</span>
                      <span className="truncate text-muted-foreground text-xs">{recipient.email}</span>
                    </button>
                  ))}
                </div>
              ) : null}
              <div ref={recipientPickerRef} className="relative rounded-lg border bg-muted/20">
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-background/70"
                  onClick={() => setRecipientPickerOpen((currentValue) => !currentValue)}
                >
                  <span className="flex items-center gap-2 font-medium">
                    <UsersRound className="size-4" />
                    Add from customers or leads
                  </span>
                  <ChevronDown
                    className={cn("size-4 transition-transform", recipientPickerOpen ? "rotate-180" : "rotate-0")}
                  />
                </button>
                {recipientPickerOpen ? (
                  <div className="absolute top-full right-0 left-0 z-30 mt-2 grid gap-2 rounded-lg border bg-popover p-2 text-popover-foreground shadow-xl">
                    <Input
                      value={recipientQuery}
                      onChange={(event) => setRecipientQuery(event.target.value)}
                      placeholder="Search names or emails"
                      aria-label="Search customers and leads"
                    />
                    <div className="grid max-h-44 gap-1 overflow-y-auto">
                      {filteredRecipients.length ? (
                        filteredRecipients.map((recipient) => (
                          <button
                            key={`${recipient.type}-${recipient.id}`}
                            type="button"
                            className="flex min-w-0 items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left text-sm hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            onClick={() => addRecipient(recipient)}
                          >
                            <span className="min-w-0">
                              <span className="block truncate font-medium">{recipient.name}</span>
                              <span className="block truncate text-muted-foreground text-xs">{recipient.email}</span>
                            </span>
                            <span className="shrink-0 rounded-md border bg-background px-2 py-0.5 text-muted-foreground text-xs">
                              {recipient.type}
                            </span>
                          </button>
                        ))
                      ) : (
                        <div className="px-2 py-1.5 text-muted-foreground text-sm">No matching recipients</div>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="general-email-subject">Subject</Label>
              <Input
                id="general-email-subject"
                name="subject"
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                placeholder="Add a clear subject"
                required
              />
            </div>

            <div className="min-h-60 overflow-hidden rounded-lg border bg-background sm:min-h-96">
              <div className="flex flex-wrap items-center gap-1 border-b bg-muted/40 p-2">
                <div className="flex items-center gap-1 rounded-md border bg-background/70 p-1">
                  {[
                    { action: () => editor?.chain().focus().undo().run(), icon: Undo2, label: "Undo" },
                    { action: () => editor?.chain().focus().redo().run(), icon: Redo2, label: "Redo" },
                  ].map((tool) => (
                    <Tooltip key={tool.label}>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={tool.label}
                          disabled={!editor}
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={tool.action}
                        >
                          <tool.icon />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{tool.label}</TooltipContent>
                    </Tooltip>
                  ))}
                </div>

                <div className="flex items-center gap-1 rounded-md border bg-background/70 p-1">
                  {[
                    { active: editor?.isActive("bold"), command: "bold", icon: Bold, label: "Bold" },
                    { active: editor?.isActive("italic"), command: "italic", icon: Italic, label: "Italic" },
                    {
                      active: editor?.isActive("underline"),
                      command: "underline",
                      icon: Underline,
                      label: "Underline",
                    },
                    { active: editor?.isActive("strike"), command: "strike", icon: Strikethrough, label: "Strike" },
                  ].map((tool) => (
                    <Tooltip key={tool.command}>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={tool.label}
                          aria-pressed={Boolean(tool.active)}
                          className={cn(tool.active && activeToolClass)}
                          disabled={!editor}
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => applyTextTool(tool.command)}
                        >
                          <tool.icon />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{tool.label}</TooltipContent>
                    </Tooltip>
                  ))}
                </div>

                <div className="flex items-center gap-1 rounded-md border bg-background/70 p-1">
                  {[
                    { active: editor?.isActive("bulletList"), command: "list", icon: List, label: "Bulleted list" },
                    {
                      active: editor?.isActive("orderedList"),
                      command: "orderedList",
                      icon: ListOrdered,
                      label: "Numbered list",
                    },
                    {
                      active: editor?.isActive("blockquote"),
                      command: "blockquote",
                      icon: Quote,
                      label: "Quote",
                    },
                  ].map((tool) => (
                    <Tooltip key={tool.command}>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={tool.label}
                          aria-pressed={Boolean(tool.active)}
                          className={cn(tool.active && activeToolClass)}
                          disabled={!editor}
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => applyTextTool(tool.command)}
                        >
                          <tool.icon />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{tool.label}</TooltipContent>
                    </Tooltip>
                  ))}
                </div>

                <div className="flex items-center gap-1 rounded-md border bg-background/70 p-1">
                  {[
                    {
                      active: editor?.isActive({ textAlign: "left" }),
                      action: () => applyAlignment("left"),
                      icon: AlignLeft,
                      label: "Align left",
                    },
                    {
                      active: editor?.isActive({ textAlign: "center" }),
                      action: () => applyAlignment("center"),
                      icon: AlignCenter,
                      label: "Align center",
                    },
                    {
                      active: editor?.isActive({ textAlign: "right" }),
                      action: () => applyAlignment("right"),
                      icon: AlignRight,
                      label: "Align right",
                    },
                  ].map((tool) => (
                    <Tooltip key={tool.label}>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={tool.label}
                          aria-pressed={Boolean(tool.active)}
                          className={cn(tool.active && activeToolClass)}
                          disabled={!editor}
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={tool.action}
                        >
                          <tool.icon />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{tool.label}</TooltipContent>
                    </Tooltip>
                  ))}
                </div>

                <div className="flex items-center gap-1 rounded-md border bg-background/70 p-1">
                  <Popover>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            aria-label="Text size"
                            disabled={!editor}
                            onMouseDown={(event) => event.preventDefault()}
                          >
                            Aa
                            <ChevronDown className="size-3" />
                          </Button>
                        </PopoverTrigger>
                      </TooltipTrigger>
                      <TooltipContent>Text size</TooltipContent>
                    </Tooltip>
                    <PopoverContent align="start" className="w-40 p-2">
                      <div className="grid gap-1">
                        {fontSizes.map((size) => (
                          <button
                            key={size.label}
                            type="button"
                            className="rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            onClick={() => applyFontSize(size.value)}
                          >
                            <span style={{ fontSize: size.value || undefined }}>{size.label}</span>
                          </button>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>

                  <Popover>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Add link"
                            aria-pressed={editor?.isActive("link")}
                            className={cn(editor?.isActive("link") && activeToolClass)}
                            disabled={!editor}
                            onMouseDown={(event) => event.preventDefault()}
                          >
                            <LinkIcon />
                          </Button>
                        </PopoverTrigger>
                      </TooltipTrigger>
                      <TooltipContent>Add link</TooltipContent>
                    </Tooltip>
                    <PopoverContent align="start" className="w-72 p-3">
                      <div className="grid gap-2">
                        <Label htmlFor="email-link-url">Link URL</Label>
                        <div className="flex gap-2">
                          <Input
                            id="email-link-url"
                            value={linkUrl}
                            onChange={(event) => setLinkUrl(event.target.value)}
                            placeholder="https://example.com"
                          />
                          <Button type="button" size="sm" onClick={applyLink}>
                            Apply
                          </Button>
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Remove link"
                        disabled={!editor?.isActive("link")}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={removeLink}
                      >
                        <Unlink />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Remove link</TooltipContent>
                  </Tooltip>
                </div>

                <div className="flex items-center gap-1 rounded-md border bg-background/70 p-1">
                  <Popover>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Text color"
                            disabled={!editor}
                            onMouseDown={(event) => event.preventDefault()}
                          >
                            <Palette />
                          </Button>
                        </PopoverTrigger>
                      </TooltipTrigger>
                      <TooltipContent>Text color</TooltipContent>
                    </Tooltip>
                    <PopoverContent align="start" className="w-56 p-3">
                      <div className="grid grid-cols-6 gap-2">
                        {textColors.map((color) => (
                          <button
                            key={color.label}
                            type="button"
                            className="flex size-7 items-center justify-center rounded-md border text-xs shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            style={{
                              backgroundColor: color.value || "transparent",
                              color: color.value ? "transparent" : undefined,
                            }}
                            title={color.label}
                            onClick={() => applyTextColor(color.value)}
                          >
                            {color.value ? "" : "A"}
                          </button>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>

                  <Popover>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Highlight"
                            disabled={!editor}
                            onMouseDown={(event) => event.preventDefault()}
                          >
                            <Highlighter />
                          </Button>
                        </PopoverTrigger>
                      </TooltipTrigger>
                      <TooltipContent>Highlight</TooltipContent>
                    </Tooltip>
                    <PopoverContent align="start" className="w-48 p-3">
                      <div className="grid grid-cols-5 gap-2">
                        {highlightColors.map((color) => (
                          <button
                            key={color.label}
                            type="button"
                            className="flex size-7 items-center justify-center rounded-md border text-xs shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            style={{ backgroundColor: color.value || "transparent" }}
                            title={color.label}
                            onClick={() => applyHighlight(color.value)}
                          >
                            {color.value ? "" : "X"}
                          </button>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="flex items-center gap-1 rounded-md border bg-background/70 p-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Clear formatting"
                        disabled={!editor}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={clearFormatting}
                      >
                        <Eraser />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Clear formatting</TooltipContent>
                  </Tooltip>
                </div>
              </div>
              <EditorContent editor={editor} />
            </div>
            {bodyError ? <p className="text-destructive text-sm">{bodyError}</p> : null}
            <input ref={messageTextInputRef} type="hidden" name="text" value={messageText} readOnly />
            <input ref={messageHtmlInputRef} type="hidden" name="html" value={messageHtml} readOnly />

            {/* biome-ignore lint/a11y/noStaticElementInteractions: drag-and-drop targets require drag event handlers on the drop region. */}
            <div
              className={cn(
                "rounded-lg border border-dashed p-4 transition-colors",
                dragActive ? "border-primary bg-primary/5" : "border-muted-foreground/30 bg-muted/20",
              )}
              onDragEnter={(event) => {
                event.preventDefault();
                setDragActive(true);
              }}
              onDragOver={(event) => event.preventDefault()}
              onDragLeave={(event) => {
                event.preventDefault();
                setDragActive(false);
              }}
              onDrop={(event) => {
                event.preventDefault();
                setDragActive(false);
                appendFiles(event.dataTransfer.files);
              }}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-lg bg-background">
                    <Paperclip className="size-4" />
                  </span>
                  <div>
                    <div className="font-medium text-sm">Attachments</div>
                    <div className="text-muted-foreground text-xs">Drop files here or choose up to 8 files.</div>
                  </div>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                  <Paperclip />
                  Add files
                </Button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                name="attachments"
                multiple
                className="sr-only"
                onChange={(event) => {
                  if (event.currentTarget.files) appendFiles(event.currentTarget.files);
                }}
              />
              {files.length ? (
                <div className="mt-3 grid gap-2">
                  {files.map((file) => (
                    <div
                      key={`${file.name}-${file.size}-${file.lastModified}`}
                      className="flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm"
                    >
                      <File className="size-4 text-muted-foreground" />
                      <span className="min-w-0 flex-1 truncate">{file.name}</span>
                      <span className="text-muted-foreground text-xs">{fileSizeLabel(file.size)}</span>
                      <Button type="button" variant="ghost" size="icon-sm" onClick={() => removeFile(file)}>
                        <X />
                        <span className="sr-only">Remove {file.name}</span>
                      </Button>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            <EmailDeliveryResult
              result={result}
              onDone={() => {
                if (result?.type === "success") {
                  setOpen(false);
                }
                setResult(null);
              }}
            />
          </section>

          <DialogFooter className="mx-0 mb-0 rounded-none sm:flex-row sm:justify-end lg:col-span-2">
            <Button
              type="button"
              variant="outline"
              className="sm:w-auto"
              onClick={() => {
                setTo("");
                setSubject("");
                clearEditorDraft();
                setFiles([]);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
              disabled={isPending}
            >
              <Trash2 />
              Clear
            </Button>
            <Button type="submit" className="sm:w-auto" disabled={isPending || !canSendEmail}>
              <Send />
              {isPending ? "Sending..." : "Send email"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
