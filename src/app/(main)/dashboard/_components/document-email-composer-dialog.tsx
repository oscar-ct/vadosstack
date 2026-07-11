"use client";

import * as React from "react";

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
  FileText,
  Highlighter,
  Italic,
  LinkIcon,
  List,
  ListOrdered,
  Mail,
  Palette,
  Quote,
  Redo2,
  Send,
  Strikethrough,
  Trash2,
  Underline,
  Undo2,
  Unlink,
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
import { cn } from "@/lib/utils";

type DocumentEmailState = {
  success: boolean;
  message: string;
  reconnectRequired?: boolean;
  submittedAt?: number;
};

type DocumentEmailDetail = {
  label: string;
  value: React.ReactNode;
  tone?: "default" | "invoice" | "estimate";
};

type DocumentEmailTemplate = {
  bodyHtml: string;
  bodyText: string;
  subject: string;
  title: string;
};

const initialState: DocumentEmailState = {
  success: false,
  message: "",
};

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

export function DocumentEmailComposerDialog({
  action,
  attachmentName,
  defaultHtml,
  defaultSubject,
  defaultText,
  details,
  documentId,
  documentIdField,
  documentLabel,
  gmailConnected,
  hideTrigger = false,
  onOpenChange,
  open: controlledOpen,
  recipientEmail,
  returnTo,
  senderEmail,
  templates = [],
}: {
  action: (state: DocumentEmailState, formData: FormData) => Promise<DocumentEmailState>;
  attachmentName: string;
  defaultHtml: string;
  defaultSubject: string;
  defaultText: string;
  details: DocumentEmailDetail[];
  documentId: string;
  documentIdField: string;
  documentLabel: "estimate" | "invoice" | "order" | "return receipt";
  gmailConnected: boolean;
  hideTrigger?: boolean;
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
  recipientEmail?: string | null;
  returnTo: string;
  senderEmail?: string | null;
  templates?: DocumentEmailTemplate[];
}) {
  const editorHydratedRef = React.useRef(false);
  const messageTextInputRef = React.useRef<HTMLInputElement>(null);
  const messageHtmlInputRef = React.useRef<HTMLInputElement>(null);
  const [, refreshEditorState] = React.useReducer((value: number) => value + 1, 0);
  const [state, formAction, isPending] = React.useActionState(action, initialState);
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false);
  const [subject, setSubject] = React.useState(defaultSubject);
  const [messageText, setMessageText] = React.useState(defaultText);
  const [messageHtml, setMessageHtml] = React.useState(defaultHtml);
  const [linkUrl, setLinkUrl] = React.useState("");
  const [bodyError, setBodyError] = React.useState("");
  const [result, setResult] = React.useState<EmailDeliveryResultValue | null>(null);
  const submitLabel = `Send ${documentLabel}`;
  const needsReconnect = state.reconnectRequired;
  const open = controlledOpen ?? uncontrolledOpen;

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
        "aria-label": `${documentLabel} email message`,
        "aria-multiline": "true",
        class:
          "min-h-56 w-full px-3 py-3 text-base leading-6 outline-none sm:min-h-80 sm:text-sm [&_.is-editor-empty:first-child::before]:pointer-events-none [&_.is-editor-empty:first-child::before]:float-left [&_.is-editor-empty:first-child::before]:h-0 [&_.is-editor-empty:first-child::before]:text-muted-foreground [&_.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_ol]:ml-5 [&_ol]:list-decimal [&_p]:my-0 [&_p+_p]:mt-3 [&_ul]:ml-5 [&_ul]:list-disc",
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
        placeholder: `Write your ${documentLabel} message...`,
      }),
    ],
    immediatelyRender: false,
    onSelectionUpdate: () => refreshEditorState(),
    onTransaction: () => refreshEditorState(),
    onUpdate: ({ editor: currentEditor }) => {
      setEditorDraft(currentEditor.getText(), currentEditor.getHTML());
      setBodyError("");
    },
  });

  const handleOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen && editor) setEditorDraft(editor.getText(), editor.getHTML());
      onOpenChange?.(nextOpen);
      if (controlledOpen === undefined) {
        setUncontrolledOpen(nextOpen);
      }
    },
    [controlledOpen, editor, onOpenChange, setEditorDraft],
  );

  const resetDraft = React.useCallback(() => {
    setSubject(defaultSubject);
    setEditorDraft(defaultText, defaultHtml);
    setBodyError("");
    editor?.commands.setContent(defaultHtml || plainTextToEditorHtml(defaultText), { emitUpdate: false });
    refreshEditorState();
  }, [defaultHtml, defaultSubject, defaultText, editor, setEditorDraft]);

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
  }, [editor, state.message, state.submittedAt, state.success]);

  React.useEffect(() => {
    if (!open) {
      editorHydratedRef.current = false;
      return;
    }

    setResult(null);

    if (editorHydratedRef.current || !editor) return;

    setSubject(defaultSubject);
    editor.commands.setContent(defaultHtml || plainTextToEditorHtml(defaultText), { emitUpdate: false });
    setEditorDraft(editor.getText(), editor.getHTML());
    editorHydratedRef.current = true;
    refreshEditorState();
  }, [defaultHtml, defaultSubject, defaultText, editor, open, setEditorDraft]);

  const applyTemplate = React.useCallback(
    (template: DocumentEmailTemplate) => {
      setSubject(template.subject);
      setEditorDraft(template.bodyText, template.bodyHtml);
      setBodyError("");
      editor?.commands.setContent(template.bodyHtml, { emitUpdate: false });
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
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {hideTrigger ? null : (
        <DialogTrigger asChild>
          <Button type="button" variant="outline" size="sm" disabled={!recipientEmail}>
            <Mail />
            Email
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="grid h-[calc(100svh-1rem)] w-[min(calc(100vw-2rem),72rem)] translate-y-0 grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden p-0 max-sm:top-2 sm:top-1/2 sm:h-[min(56rem,calc(100svh-1rem))] sm:max-w-none sm:-translate-y-1/2">
        <DialogHeader className="border-b px-5 pt-5 pr-14 pb-4">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
            <div className="min-w-0">
              <DialogTitle className="flex items-center gap-2 text-lg">
                <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Mail className="size-4" />
                </span>
                Send {documentLabel}
              </DialogTitle>
              <DialogDescription className="mt-2">
                Review the message and PDF attachment before sending from your connected Gmail account.
              </DialogDescription>
            </div>
            {gmailConnected && !needsReconnect ? (
              <div className="hidden max-w-fit truncate rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-700 text-xs md:block lg:mr-4 lg:max-w-72 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
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
                  {needsReconnect ? "Reconnect Gmail" : "Connect Gmail"}
                </a>
              </Button>
            )}
          </div>
        </DialogHeader>

        <form
          action={formAction}
          onSubmit={prepareSubmit}
          className="grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden lg:grid-cols-[15rem_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)_auto]"
        >
          <aside className="min-h-0 min-w-0 border-b bg-muted/30 p-0 lg:overflow-y-auto lg:border-r lg:border-b-0 lg:p-4">
            <div className="hidden lg:grid lg:gap-3 lg:rounded-lg lg:border lg:bg-background lg:p-3 lg:text-sm">
              {details.map((detail) => (
                <div key={detail.label} className="grid gap-1">
                  <span className="text-muted-foreground text-xs">{detail.label}</span>
                  <span
                    className={cn(
                      "min-w-0 break-words font-medium",
                      detail.tone === "estimate" && "text-sky-700 dark:text-sky-400",
                      detail.tone === "invoice" && "text-rose-700 dark:text-rose-400",
                    )}
                  >
                    {detail.value}
                  </span>
                </div>
              ))}
            </div>

            <div className="hidden lg:mt-3 lg:grid lg:rounded-lg lg:border lg:border-sky-200 lg:bg-sky-50 lg:p-3 lg:text-sm">
              <div className="mb-2 flex items-center gap-2 font-medium">
                <FileText className="size-4 text-muted-foreground" />
                PDF attached
              </div>
              <div className="min-w-0 truncate text-muted-foreground text-xs">{attachmentName}</div>
            </div>
            {templates.length ? (
              <div className="hidden lg:mt-3 lg:grid lg:gap-2">
                <Label className="text-muted-foreground text-xs uppercase tracking-wide">Templates</Label>
                {templates.map((template) => (
                  <Button
                    key={template.title}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="justify-start bg-background"
                    onClick={() => applyTemplate(template)}
                  >
                    {template.title}
                  </Button>
                ))}
              </div>
            ) : null}
          </aside>

          <section className="grid min-h-0 min-w-0 content-start gap-3 overflow-y-auto p-3 sm:gap-4 sm:p-5">
            <input type="hidden" name={documentIdField} value={documentId} />
            <input ref={messageTextInputRef} type="hidden" name="message" value={messageText} readOnly />
            <input ref={messageHtmlInputRef} type="hidden" name="html" value={messageHtml} readOnly />

            <div className="grid grid-cols-2 gap-2 rounded-lg border bg-background p-3 text-sm lg:hidden">
              {details.map((detail) => (
                <div key={detail.label} className="grid gap-1">
                  <span className="text-muted-foreground text-xs">{detail.label}</span>
                  <span
                    className={cn(
                      "min-w-0 break-words font-medium",
                      detail.tone === "estimate" && "text-sky-700 dark:text-sky-400",
                      detail.tone === "invoice" && "text-rose-700 dark:text-rose-400",
                    )}
                  >
                    {detail.value}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-2 flex items-center justify-between gap-3 rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm lg:hidden">
              <div className="flex items-center gap-2 font-medium lg:mb-2">
                <FileText className="size-4 text-muted-foreground" />
                PDF attached
              </div>
              <div className="min-w-0 truncate text-muted-foreground text-xs">{attachmentName}</div>
            </div>

            {templates.length ? (
              <div className="grid gap-2 lg:hidden">
                <Label className="text-muted-foreground text-xs uppercase tracking-wide">Templates</Label>
                <div className="grid grid-cols-2 gap-2">
                  {templates.map((template) => (
                    <Button
                      key={template.title}
                      type="button"
                      variant="outline"
                      size="sm"
                      className="justify-start bg-background"
                      onClick={() => applyTemplate(template)}
                    >
                      {template.title}
                    </Button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="grid gap-2">
              <Label>To</Label>
              <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
                {recipientEmail ?? "Add an email address before sending"}
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor={`${documentLabel}-email-subject-${documentId}`}>Subject</Label>
              <Input
                id={`${documentLabel}-email-subject-${documentId}`}
                name="subject"
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                placeholder="Add a clear subject"
                required
              />
            </div>

            <div className="h-max min-h-64 rounded-lg border bg-background sm:min-h-96">
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
                        <Label htmlFor={`${documentLabel}-email-link-url-${documentId}`}>Link URL</Label>
                        <div className="flex gap-2">
                          <Input
                            id={`${documentLabel}-email-link-url-${documentId}`}
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

            <EmailDeliveryResult
              result={result}
              onDone={() => {
                if (result?.type === "success") {
                  handleOpenChange(false);
                }
                setResult(null);
              }}
            />
          </section>

          <DialogFooter className="mx-0 mb-0 rounded-none sm:flex-row sm:justify-end lg:col-span-2">
            <Button type="button" variant="outline" className="sm:w-auto" onClick={resetDraft} disabled={isPending}>
              <Trash2 />
              Reset
            </Button>
            <Button
              type="button"
              variant="outline"
              className="sm:w-auto"
              onClick={() => handleOpenChange(false)}
              disabled={isPending}
            >
              <X />
              Cancel
            </Button>
            {!gmailConnected || needsReconnect ? (
              <Button asChild className="sm:w-auto">
                <a href={`/api/auth/google/mail?returnTo=${encodeURIComponent(returnTo)}`}>
                  <SimpleIcon icon={siGmail} className="size-3.5 fill-current" />
                  {needsReconnect ? "Reconnect Gmail" : "Connect Gmail"}
                </a>
              </Button>
            ) : (
              <Button type="submit" className="sm:w-auto" disabled={isPending}>
                <Send />
                {isPending ? "Sending..." : submitLabel}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
