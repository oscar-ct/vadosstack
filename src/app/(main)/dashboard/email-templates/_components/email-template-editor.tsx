"use client";

import * as React from "react";

import Link from "next/link";
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
  Braces,
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
  Save,
  Strikethrough,
  Trash2,
  Underline,
  Undo2,
  Unlink,
} from "lucide-react";
import { toast } from "sonner";

import { BackButton } from "@/components/back-button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import type { EmailTemplateMutationState } from "../actions";
import type { EmailTemplateRow } from "../types";

const initialState: EmailTemplateMutationState = {
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

const variableGroups = {
  estimate: [
    { label: "Customer name", value: "customerName" },
    { label: "Customer email", value: "customerEmail" },
    { label: "Company name", value: "companyName" },
    { label: "Company email", value: "companyEmail" },
    { label: "Estimate number", value: "estimateNumber" },
    { label: "Estimated total", value: "estimatedTotal" },
    { label: "Valid through", value: "validThrough" },
    { label: "Job title", value: "jobTitle" },
    { label: "Service location", value: "serviceLocation" },
  ],
  general: [
    { label: "Company name", value: "companyName" },
    { label: "Company email", value: "companyEmail" },
    { label: "Company phone", value: "companyPhone" },
  ],
  invoice: [
    { label: "Customer name", value: "customerName" },
    { label: "Customer email", value: "customerEmail" },
    { label: "Company name", value: "companyName" },
    { label: "Company email", value: "companyEmail" },
    { label: "Invoice number", value: "invoiceNumber" },
    { label: "Balance due", value: "balanceDue" },
    { label: "Due date", value: "dueDate" },
    { label: "Job title", value: "jobTitle" },
    { label: "Service location", value: "serviceLocation" },
  ],
  lead: [
    { label: "Lead name", value: "leadName" },
    { label: "Lead first name", value: "leadFirstName" },
    { label: "Lead email", value: "leadEmail" },
    { label: "Lead phone", value: "leadPhone" },
    { label: "Lead source", value: "leadSource" },
    { label: "Service type", value: "serviceType" },
    { label: "Service location", value: "serviceLocation" },
    { label: "Service location phrase", value: "serviceLocationPhrase" },
    { label: "Estimated value", value: "estimatedValue" },
    { label: "Follow-up date", value: "followUpDate" },
    { label: "Company name", value: "companyName" },
    { label: "Company email", value: "companyEmail" },
    { label: "Company phone", value: "companyPhone" },
  ],
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

export function DeleteEmailTemplateButton({
  action,
  template,
}: {
  action: (state: EmailTemplateMutationState, formData: FormData) => Promise<EmailTemplateMutationState>;
  template: EmailTemplateRow;
}) {
  const router = useRouter();
  const formRef = React.useRef<HTMLFormElement>(null);
  const [open, setOpen] = React.useState(false);
  const [state, formAction, isPending] = React.useActionState(action, initialState);

  React.useEffect(() => {
    if (!state.success) return;

    setOpen(false);
    toast.success(state.message || "Template deleted.");
    router.replace(state.redirectTo ?? "/dashboard/email-templates");
    router.refresh();
  }, [router, state]);

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <Trash2 className="text-destructive" />
          Delete
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete template?</AlertDialogTitle>
          <AlertDialogDescription>
            This removes {template.title} from the email composer template picker.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <form ref={formRef} action={formAction}>
          <input type="hidden" name="id" value={template.id} />
        </form>
        {state.message && !state.success ? <p className="text-destructive text-sm">{state.message}</p> : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={isPending}
            onClick={(event) => {
              event.preventDefault();
              formRef.current?.requestSubmit();
            }}
          >
            {isPending ? "Deleting..." : "Delete template"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function EmailTemplateEditor({
  action,
  deleteAction,
  mode,
  template,
}: {
  action: (state: EmailTemplateMutationState, formData: FormData) => Promise<EmailTemplateMutationState>;
  deleteAction?: (state: EmailTemplateMutationState, formData: FormData) => Promise<EmailTemplateMutationState>;
  mode: "create" | "edit";
  template?: EmailTemplateRow;
}) {
  const router = useRouter();
  const formRef = React.useRef<HTMLFormElement>(null);
  const bodyTextInputRef = React.useRef<HTMLInputElement>(null);
  const bodyHtmlInputRef = React.useRef<HTMLInputElement>(null);
  const [, refreshEditorState] = React.useReducer((value: number) => value + 1, 0);
  const [state, formAction, isPending] = React.useActionState(action, initialState);
  const [scope, setScope] = React.useState<"estimate" | "general" | "invoice" | "lead">(template?.scope ?? "general");
  const [bodyText, setBodyText] = React.useState(template?.bodyText ?? "");
  const [bodyHtml, setBodyHtml] = React.useState(template?.bodyHtml ?? "");
  const [linkUrl, setLinkUrl] = React.useState("");
  const [bodyError, setBodyError] = React.useState("");
  const variables = variableGroups[scope];
  const copy =
    mode === "edit"
      ? {
          title: "Edit email template",
          description: "Tune the reusable subject and rich message used by document email composers.",
          submitLabel: "Save changes",
          pendingLabel: "Saving...",
        }
      : {
          title: "Create email template",
          description: "Build a reusable document email with variables for customer and document details.",
          submitLabel: "Create template",
          pendingLabel: "Creating...",
        };

  const setEditorDraft = React.useCallback((text: string, html: string) => {
    if (bodyTextInputRef.current) bodyTextInputRef.current.value = text;
    if (bodyHtmlInputRef.current) bodyHtmlInputRef.current.value = html;
    setBodyText(text);
    setBodyHtml(html);
  }, []);

  const editor = useEditor({
    content: template?.bodyHtml || plainTextToEditorHtml(template?.bodyText ?? ""),
    editorProps: {
      attributes: {
        "aria-label": "Email template message",
        "aria-multiline": "true",
        class:
          "min-h-72 w-full px-3 py-3 text-base leading-6 outline-none sm:min-h-96 sm:text-sm [&_.is-editor-empty:first-child::before]:pointer-events-none [&_.is-editor-empty:first-child::before]:float-left [&_.is-editor-empty:first-child::before]:h-0 [&_.is-editor-empty:first-child::before]:text-muted-foreground [&_.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_ol]:ml-5 [&_ol]:list-decimal [&_p]:my-0 [&_p+_p]:mt-3 [&_ul]:ml-5 [&_ul]:list-disc",
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
        placeholder: "Write the reusable email message...",
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
    if (!state.success) return;

    toast.success(state.message || "Email template saved.");

    if (state.redirectTo) {
      router.push(state.redirectTo);
      router.refresh();
      return;
    }

    router.refresh();
  }, [router, state]);

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

  const insertVariable = React.useCallback(
    (value: string) => {
      editor?.chain().focus().insertContent(`{{${value}}}`).run();
    },
    [editor],
  );

  const removeLink = React.useCallback(() => {
    editor?.chain().focus().extendMarkRange("link").unsetLink().run();
  }, [editor]);

  const clearFormatting = React.useCallback(() => {
    editor?.chain().focus().unsetAllMarks().clearNodes().run();
  }, [editor]);

  const prepareSubmit = React.useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      const text = editor?.getText() ?? bodyText;
      const html = editor?.getHTML() ?? bodyHtml;

      setEditorDraft(text, html);

      if (!text.trim()) {
        event.preventDefault();
        setBodyError("Write a message before saving.");
        editor?.commands.focus();
      }
    },
    [bodyHtml, bodyText, editor, setEditorDraft],
  );

  return (
    <div className="@container/main mx-auto grid w-full max-w-7xl gap-4 md:gap-6">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
        <BackButton fallbackHref="/dashboard/email-templates" label="Email templates" />
        {mode === "edit" && template && deleteAction ? (
          <DeleteEmailTemplateButton action={deleteAction} template={template} />
        ) : null}
      </div>

      <form ref={formRef} action={formAction} onSubmit={prepareSubmit} className="grid min-w-0 gap-4">
        {template ? <input type="hidden" name="id" value={template.id} /> : null}
        <input ref={bodyTextInputRef} type="hidden" name="bodyText" value={bodyText} readOnly />
        <input ref={bodyHtmlInputRef} type="hidden" name="bodyHtml" value={bodyHtml} readOnly />

        <Card className="min-w-0 overflow-visible rounded-lg">
          <CardHeader className="border-b bg-muted/20">
            <div className="grid min-w-0 gap-1">
              <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-normal">
                <Mail className="size-4" />
                Template builder
              </div>
              <CardTitle className="text-xl">{copy.title}</CardTitle>
              <CardDescription>{copy.description}</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 p-4 md:p-5">
            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_12rem]">
              <div className="grid gap-2">
                <Label htmlFor="email-template-title">Template name</Label>
                <Input
                  id="email-template-title"
                  name="title"
                  defaultValue={template?.title ?? ""}
                  placeholder="Follow-up estimate"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email-template-scope">Document type</Label>
                <select
                  id="email-template-scope"
                  name="scope"
                  value={scope}
                  onChange={(event) => {
                    if (event.target.value === "invoice") setScope("invoice");
                    else if (event.target.value === "estimate") setScope("estimate");
                    else if (event.target.value === "lead") setScope("lead");
                    else setScope("general");
                  }}
                  className="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  <option value="general">General</option>
                  <option value="lead">Lead</option>
                  <option value="estimate">Estimate</option>
                  <option value="invoice">Invoice</option>
                </select>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="email-template-subject">Subject</Label>
              <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto]">
                <Input
                  id="email-template-subject"
                  name="subject"
                  defaultValue={template?.subject ?? ""}
                  placeholder={
                    scope === "invoice"
                      ? "Invoice {{invoiceNumber}} from {{companyName}}"
                      : scope === "estimate"
                        ? "Estimate {{estimateNumber}} from {{companyName}}"
                        : scope === "lead"
                          ? "Thanks for reaching out about your {{serviceType}}"
                          : "Following up from {{companyName}}"
                  }
                  required
                />
                <Popover>
                  <PopoverTrigger asChild>
                    <Button type="button" variant="outline">
                      <Braces />
                      Insert variable
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-64 p-2">
                    <div className="grid gap-1">
                      {variables.map((variable) => (
                        <button
                          key={variable.value}
                          type="button"
                          className="rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          onClick={() => {
                            const input = document.getElementById("email-template-subject") as HTMLInputElement | null;
                            if (!input) return;
                            const token = `{{${variable.value}}}`;
                            const start = input.selectionStart ?? input.value.length;
                            const end = input.selectionEnd ?? input.value.length;
                            input.value = `${input.value.slice(0, start)}${token}${input.value.slice(end)}`;
                            input.focus();
                            input.setSelectionRange(start + token.length, start + token.length);
                          }}
                        >
                          <span className="font-medium">{variable.label}</span>
                          <span className="ml-2 text-muted-foreground text-xs">{`{{${variable.value}}}`}</span>
                        </button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Message</Label>
              <div className="h-max min-h-80 rounded-lg border bg-background">
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
                          <Label htmlFor="email-template-link-url">Link URL</Label>
                          <div className="flex gap-2">
                            <Input
                              id="email-template-link-url"
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
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={!editor}
                          onMouseDown={(event) => event.preventDefault()}
                        >
                          <Braces />
                          Variable
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent align="start" className="w-64 p-2">
                        <div className="grid gap-1">
                          {variables.map((variable) => (
                            <button
                              key={variable.value}
                              type="button"
                              className="rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              onClick={() => insertVariable(variable.value)}
                            >
                              <span className="font-medium">{variable.label}</span>
                              <span className="ml-2 text-muted-foreground text-xs">{`{{${variable.value}}}`}</span>
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

            {state.message && !state.success ? (
              <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-destructive text-sm">
                {state.message}
              </p>
            ) : null}
          </CardContent>
        </Card>

        <div className="sticky bottom-0 z-10 -mx-4 border-t bg-background/95 px-4 py-3 backdrop-blur md:static md:mx-0 md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button asChild type="button" variant="outline">
              <Link prefetch={false} href="/dashboard/email-templates">
                Cancel
              </Link>
            </Button>
            <Button type="submit" disabled={isPending}>
              <Save />
              {isPending ? copy.pendingLabel : copy.submitLabel}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
