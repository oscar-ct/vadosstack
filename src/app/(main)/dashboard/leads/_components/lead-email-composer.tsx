"use client";

import * as React from "react";

import { useRouter } from "next/navigation";

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
  Underline,
  Undo2,
  Unlink,
} from "lucide-react";
import { siGmail } from "simple-icons";

import { EmailDeliveryResult, type EmailDeliveryResultValue } from "@/components/email-delivery-result";
import { SimpleIcon } from "@/components/simple-icon";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { DocumentEmailTemplate } from "@/lib/email-templates";
import { cn } from "@/lib/utils";

import type { LeadRow } from "../_lib/lead-data";
import type { EmailLeadState } from "../actions";

const initialState: EmailLeadState = {
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

export function LeadEmailComposer({
  action,
  gmailConnected,
  lead,
  returnTo,
  senderEmail,
  templates,
}: {
  action: (state: EmailLeadState, formData: FormData) => Promise<EmailLeadState>;
  gmailConnected: boolean;
  lead: LeadRow;
  returnTo: string;
  senderEmail?: string | null;
  templates: DocumentEmailTemplate[];
}) {
  const router = useRouter();
  const messageTextInputRef = React.useRef<HTMLInputElement>(null);
  const messageHtmlInputRef = React.useRef<HTMLInputElement>(null);
  const [, refreshEditorState] = React.useReducer((value: number) => value + 1, 0);
  const [state, formAction, isPending] = React.useActionState(action, initialState);
  const [subject, setSubject] = React.useState("");
  const [messageText, setMessageText] = React.useState("");
  const [messageHtml, setMessageHtml] = React.useState("");
  const [linkUrl, setLinkUrl] = React.useState("");
  const [bodyError, setBodyError] = React.useState("");
  const [result, setResult] = React.useState<EmailDeliveryResultValue | null>(null);
  const stateSubmittedAt = state.submittedAt;
  const needsReconnect = state.reconnectRequired;
  const canSendEmail = gmailConnected && !needsReconnect;
  const gmailConnectLabel = needsReconnect ? "Reconnect Gmail" : "Connect Gmail";
  const hasRecipient = Boolean(lead.email);

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
        "aria-label": "Lead email message",
        "aria-multiline": "true",
        class:
          "min-h-44 w-full px-3 py-3 text-base leading-6 outline-none sm:min-h-64 sm:text-sm [&_.is-editor-empty:first-child::before]:pointer-events-none [&_.is-editor-empty:first-child::before]:float-left [&_.is-editor-empty:first-child::before]:h-0 [&_.is-editor-empty:first-child::before]:text-muted-foreground [&_.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_ol]:ml-5 [&_ol]:list-decimal [&_p]:my-0 [&_p+_p]:mt-3 [&_ul]:ml-5 [&_ul]:list-disc",
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
        placeholder: "Write a custom lead message...",
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

  React.useEffect(() => {
    if (!state.message || !stateSubmittedAt) return;

    if (!state.success && state.message === "Message is required.") {
      setBodyError(state.message);
      editor?.commands.focus();
      return;
    }

    setResult({
      id: stateSubmittedAt,
      message: state.message,
      type: state.success ? "success" : "error",
    });

    if (state.success) {
      setSubject("");
      setEditorDraft("", "");
      editor?.commands.clearContent();
      router.refresh();
    }
  }, [editor, router, setEditorDraft, state.message, state.success, stateSubmittedAt]);

  const applyTemplate = React.useCallback(
    (template: DocumentEmailTemplate) => {
      const html = template.bodyHtml || plainTextToEditorHtml(template.bodyText);

      setSubject(template.subject);
      setEditorDraft(template.bodyText, html);
      setBodyError("");
      editor?.commands.setContent(html, { emitUpdate: false });
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
    <Card className="rounded-lg border border-cyan-200 bg-cyan-50/50 ring-cyan-200/70 dark:border-cyan-900/60 dark:bg-cyan-950/15 dark:ring-cyan-900/50">
      <CardHeader className="border-cyan-200/80 border-b bg-cyan-50/80 dark:border-cyan-900/60 dark:bg-cyan-950/25">
        <CardTitle className="flex min-w-30 items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-cyan-600 text-white shadow-sm dark:bg-cyan-500">
            <Mail className="size-4" />
          </span>
          <span>Email lead</span>
        </CardTitle>
        <CardDescription className="col-span-full text-cyan-950/70 dark:text-cyan-100/70">
          Send a direct Gmail message or start from a lead template.
        </CardDescription>
        <CardAction>
          {canSendEmail ? (
            <div className="hidden rounded-md border border-emerald-200 bg-emerald-50 p-1.5 text-emerald-700 text-xs md:block dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-300">
              Gmail connected: {senderEmail ?? "ready"}
            </div>
          ) : (
            <Button
              asChild
              variant="outline"
              size="sm"
              className="border-cyan-300 bg-background text-cyan-800 hover:bg-cyan-50 dark:border-cyan-800 dark:text-cyan-200 dark:hover:bg-cyan-950/40"
            >
              <a href={`/api/auth/google/mail?returnTo=${encodeURIComponent(returnTo)}`}>
                <SimpleIcon icon={siGmail} className="size-3.5 fill-current" />
                {gmailConnectLabel}
              </a>
            </Button>
          )}
        </CardAction>
      </CardHeader>
      <CardContent className="pt-0">
        <form action={formAction} onSubmit={prepareSubmit} className="grid gap-4">
          <input type="hidden" name="leadId" value={lead.id} />
          <input ref={messageTextInputRef} type="hidden" name="message" value={messageText} readOnly />
          <input ref={messageHtmlInputRef} type="hidden" name="html" value={messageHtml} readOnly />

          <div className="grid gap-3 rounded-lg border border-cyan-200/80 bg-background/90 p-3 text-sm shadow-sm md:grid-cols-2 dark:border-cyan-900/60">
            <div className="grid gap-1">
              <span className="text-muted-foreground text-xs">To</span>
              <span className="font-medium">{lead.email ?? "Add an email address to this lead"}</span>
            </div>
            <div className="grid gap-1">
              <span className="text-muted-foreground text-xs">Lead</span>
              <span className="font-medium">{lead.name}</span>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor={`lead-email-subject-${lead.id}`}>Subject</Label>
            <Input
              id={`lead-email-subject-${lead.id}`}
              name="subject"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              placeholder="Type a subject or choose a template"
              className="border-cyan-200 bg-background shadow-sm focus-visible:border-cyan-500 dark:border-cyan-900/70"
              required
            />
          </div>

          <div className="grid gap-2">
            <Label>Message</Label>
            <div className="overflow-hidden rounded-lg border border-cyan-200 bg-background shadow-sm dark:border-cyan-900/70">
              <div className="flex flex-wrap items-center gap-1 border-cyan-200 border-b bg-cyan-50/60 p-2 dark:border-cyan-900/70 dark:bg-cyan-950/20">
                <div className="flex items-center gap-1 rounded-md border bg-background/80 p-1">
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

                <div className="flex items-center gap-1 rounded-md border bg-background/80 p-1">
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

                <div className="flex items-center gap-1 rounded-md border bg-background/80 p-1">
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

                <div className="flex items-center gap-1 rounded-md border bg-background/80 p-1">
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

                <div className="flex items-center gap-1 rounded-md border bg-background/80 p-1">
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
                        <Label htmlFor={`lead-email-link-url-${lead.id}`}>Link URL</Label>
                        <div className="flex gap-2">
                          <Input
                            id={`lead-email-link-url-${lead.id}`}
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

                <div className="flex items-center gap-1 rounded-md border bg-background/80 p-1">
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
          </div>

          <div className="grid gap-2">
            <Label>Lead templates</Label>
            <div className="flex flex-wrap gap-2">
              {templates.map((template) => (
                <Button
                  key={template.title}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-cyan-200 bg-background text-cyan-900 hover:bg-cyan-100/70 dark:border-cyan-900/70 dark:text-cyan-100 dark:hover:bg-cyan-950/50"
                  onClick={() => applyTemplate(template)}
                >
                  {template.title}
                </Button>
              ))}
            </div>
          </div>

          <EmailDeliveryResult result={result} onDone={() => setResult(null)} />

          <div className="flex justify-end border-cyan-200/80 border-t pt-1 dark:border-cyan-900/60">
            <Button
              type="submit"
              disabled={isPending || !canSendEmail || !hasRecipient}
              className="bg-cyan-700 text-white hover:bg-cyan-800 dark:bg-cyan-500 dark:hover:bg-cyan-600"
            >
              <Send />
              {isPending ? "Sending..." : "Send email"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
