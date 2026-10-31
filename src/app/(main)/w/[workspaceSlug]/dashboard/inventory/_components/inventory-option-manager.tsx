"use client";

import * as React from "react";

import { Merge, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useWorkspaceRouter } from "@/components/workspace-path-provider";
import type { InventoryOptionSummary, InventoryOptionType } from "@/lib/commerce/inventory-options";

import {
  createInventoryOptionAction,
  deleteInventoryOptionAction,
  type InventoryMergePreview,
  type InventoryOptionResult,
  mergeInventoryOptionAction,
  previewInventoryOptionMergeAction,
  renameInventoryOptionAction,
} from "../option-actions";

type Editor = { mode: "rename" | "merge" | "delete"; option: InventoryOptionSummary };
export function InventoryOptionManager({
  kind,
  items,
  open,
}: {
  kind: InventoryOptionType;
  items: InventoryOptionSummary[];
  open: boolean;
}) {
  const router = useWorkspaceRouter();
  const [query, setQuery] = React.useState("");
  const [newName, setNewName] = React.useState("");
  const [editor, setEditor] = React.useState<Editor | null>(null);
  const [name, setName] = React.useState("");
  const [target, setTarget] = React.useState<InventoryOptionSummary | null>(null);
  const [reason, setReason] = React.useState("");
  const [confirmed, setConfirmed] = React.useState(false);
  const [samePhysicalLocation, setSamePhysicalLocation] = React.useState(false);
  const [preview, setPreview] = React.useState<InventoryMergePreview | null>(null);
  const [previewError, setPreviewError] = React.useState("");
  const [loadingPreview, setLoadingPreview] = React.useState(false);
  const [result, setResult] = React.useState<InventoryOptionResult | null>(null);
  const [editorError, setEditorError] = React.useState("");
  const [pending, startTransition] = React.useTransition();
  const inFlight = React.useRef(false);
  const label = kind === "category" ? "category" : "location";
  const plural = kind === "category" ? "categories" : "locations";
  const filtered = items.filter((item) => item.name.toLowerCase().includes(query.trim().toLowerCase()));

  React.useEffect(() => {
    if (!open) {
      setEditor(null);
      setResult(null);
    }
  }, [open]);
  React.useEffect(() => {
    if (editor?.mode !== "merge" || !target) {
      setPreview(null);
      return;
    }
    let current = true;
    setLoadingPreview(true);
    setPreview(null);
    setPreviewError("");
    void previewInventoryOptionMergeAction({ kind, sourceId: editor.option.id, targetId: target.id })
      .then((response) => {
        if (!current) return;
        if (response.success && response.preview) setPreview(response.preview);
        else setPreviewError(response.message);
      })
      .catch(() => {
        if (current) setPreviewError("The merge preview could not be loaded. Choose the destination again.");
      })
      .finally(() => {
        if (current) setLoadingPreview(false);
      });
    return () => {
      current = false;
    };
  }, [editor, kind, target]);

  function edit(mode: Editor["mode"], option: InventoryOptionSummary) {
    setEditor({ mode, option });
    setName(option.name);
    setTarget(null);
    setReason("");
    setConfirmed(false);
    setSamePhysicalLocation(false);
    setPreview(null);
    setPreviewError("");
    setEditorError("");
  }
  function run(operation: () => Promise<InventoryOptionResult>, creating = false) {
    if (inFlight.current) return;
    inFlight.current = true;
    startTransition(async () => {
      try {
        const response = await operation();
        if (!response.success) {
          if (creating) setResult(response);
          else setEditorError(response.message);
          return;
        }
        setResult(response);
        setEditor(null);
        if (creating) {
          setNewName("");
          setQuery("");
        }
        toast.success(response.message);
        router.refresh();
      } catch {
        const error = "The request could not be confirmed. Refresh the list before trying again.";
        if (creating) setResult({ success: false, message: error });
        else setEditorError(error);
        router.refresh();
      } finally {
        inFlight.current = false;
      }
    });
  }
  function commit() {
    if (!editor) return;
    const base = { kind, id: editor.option.id, expectedUpdatedAt: editor.option.updatedAt };
    if (editor.mode === "rename") run(() => renameInventoryOptionAction({ ...base, name }));
    else if (editor.mode === "delete") run(() => deleteInventoryOptionAction(base));
    else if (target && preview && confirmed && (kind !== "location" || samePhysicalLocation))
      run(() =>
        mergeInventoryOptionAction({
          kind,
          sourceId: editor.option.id,
          targetId: target.id,
          sourceUpdatedAt: editor.option.updatedAt,
          targetUpdatedAt: target.updatedAt,
          reason,
          confirmed,
          samePhysicalLocation,
        }),
      );
  }
  const mergeBlocked = [
    !target,
    !preview,
    loadingPreview,
    (preview?.conflictCount ?? 0) > 0,
    !confirmed,
    !reason.trim(),
    kind === "location" && !samePhysicalLocation,
  ].some(Boolean);
  return (
    <>
      <section className="flex h-full min-h-0 flex-col gap-3 overflow-hidden" aria-busy={pending}>
        <div className="grid gap-1">
          <h3 className="font-medium text-sm">{kind === "category" ? "Categories" : "Locations"}</h3>
          <p className="text-muted-foreground text-xs">
            Rename typos, merge duplicates, or delete unused {plural}. Counts include archived records.
          </p>
        </div>
        <form
          className="flex items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            run(() => createInventoryOptionAction(kind, newName), true);
          }}
        >
          <div className="grid min-w-0 flex-1 gap-1">
            <Label htmlFor={`new-inventory-${kind}`}>New {label}</Label>
            <Input
              id={`new-inventory-${kind}`}
              value={newName}
              maxLength={100}
              required
              disabled={pending}
              placeholder={kind === "category" ? "Accessories" : "Warehouse A"}
              onChange={(event) => setNewName(event.target.value)}
            />
          </div>
          <Button type="submit" disabled={pending || !newName.trim()} size="sm">
            <Plus />
            Add
          </Button>
        </form>
        {result ? (
          <p
            role={result.success ? "status" : "alert"}
            className={result.success ? "text-muted-foreground text-xs" : "text-destructive text-xs"}
          >
            {result.message}
          </p>
        ) : null}
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label={`Search ${plural}`}
            className="pl-8"
            placeholder={`Search ${plural}...`}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <div className="grid min-h-0 flex-1 content-start gap-2 overflow-y-auto rounded-lg border p-2">
          {filtered.length ? (
            filtered.map((item) => (
              <div key={item.id} className="grid gap-2 rounded-md border p-3">
                <div className="grid min-w-0 gap-1">
                  <p className="break-words font-medium text-sm">{item.name}</p>
                  <p className="text-muted-foreground text-xs">
                    {item.recordCount} inventory {item.recordCount === 1 ? "record" : "records"} · {item.productCount}{" "}
                    {item.productCount === 1 ? "product" : "products"}
                    {item.archivedCount ? ` · ${item.archivedCount} archived` : ""}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {item.available} available · {item.reserved} reserved · {item.available + item.reserved} on hand
                  </p>
                </div>
                <div className="flex flex-wrap gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={pending}
                    aria-label={`Rename ${item.name}`}
                    onClick={() => edit("rename", item)}
                  >
                    <Pencil className="size-3.5" />
                    Rename
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={pending || items.length < 2}
                    aria-label={`Merge ${item.name}`}
                    onClick={() => edit("merge", item)}
                  >
                    <Merge className="size-3.5" />
                    Merge
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={pending || item.recordCount > 0}
                    aria-label={`Delete ${item.name}`}
                    onClick={() => edit("delete", item)}
                  >
                    <Trash2 className="size-3.5" />
                    Delete
                  </Button>
                </div>
                {item.recordCount > 0 ? (
                  <p className="text-muted-foreground text-xs">
                    Delete is unavailable while inventory records use this {label}. Reassign them or merge duplicates
                    first.
                  </p>
                ) : null}
              </div>
            ))
          ) : (
            <p className="p-4 text-muted-foreground text-sm">No {plural} found.</p>
          )}
        </div>
      </section>
      <Dialog
        open={Boolean(editor)}
        onOpenChange={(next) => {
          if (!pending && !next) setEditor(null);
        }}
      >
        <DialogContent className="flex max-h-[calc(100svh-2rem)] flex-col overflow-hidden sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editor?.mode === "rename"
                ? `Rename ${label}`
                : editor?.mode === "merge"
                  ? `Merge duplicate ${plural}`
                  : `Delete unused ${label}`}
            </DialogTitle>
            <DialogDescription>
              {editor?.mode === "rename"
                ? "Correct the current name without changing assignments or saved transaction history."
                : editor?.mode === "merge"
                  ? "Choose the name to keep. All active and archived inventory records will use it; the duplicate name will be removed."
                  : "Only unused options can be deleted. Historical snapshots stay unchanged."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid min-h-0 gap-4 overflow-y-auto py-1">
            <p className="break-words text-sm">
              <span className="text-muted-foreground">
                {editor?.mode === "merge" ? "Remove duplicate: " : "Current name: "}
              </span>
              <strong>{editor?.option.name}</strong>
            </p>
            {editor?.mode === "rename" ? (
              <div className="grid gap-2">
                <Label htmlFor="inventory-option-name">New name</Label>
                <Input
                  id="inventory-option-name"
                  value={name}
                  maxLength={100}
                  disabled={pending}
                  onChange={(event) => setName(event.target.value)}
                />
              </div>
            ) : null}
            {editor?.mode === "merge" ? (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="inventory-option-target">Keep this {label}</Label>
                  <Select
                    value={target?.id ?? ""}
                    disabled={pending}
                    onValueChange={(id) => {
                      setTarget(items.find((item) => item.id === id) ?? null);
                      setConfirmed(false);
                      setSamePhysicalLocation(false);
                      setEditorError("");
                    }}
                  >
                    <SelectTrigger id="inventory-option-target" className="w-full">
                      <SelectValue placeholder={`Choose a ${label}`} />
                    </SelectTrigger>
                    <SelectContent>
                      {items
                        .filter((item) => item.id !== editor.option.id)
                        .map((item) => (
                          <SelectItem key={item.id} value={item.id}>
                            {item.name} · {item.recordCount} records
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                {loadingPreview ? (
                  <p role="status" className="text-muted-foreground text-sm">
                    Checking inventory assignments...
                  </p>
                ) : null}
                {previewError ? (
                  <p role="alert" className="text-destructive text-sm">
                    {previewError}
                  </p>
                ) : null}
                {preview ? (
                  <div className="rounded-md border bg-muted/20 p-3 text-sm">
                    <p>
                      {preview.sourceCount} inventory records will be reassigned to {preview.targetName}, which
                      currently has {preview.targetCount} records.
                    </p>
                    <p className="mt-1 text-muted-foreground">
                      Quantities, orders, returns, and recorded stock history stay unchanged.
                    </p>
                    {preview.conflictCount ? (
                      <p role="alert" className="mt-2 text-destructive">
                        These locations share {preview.conflictCount} product identities. This merge is blocked to
                        prevent duplicate product/location records. Reconcile those records separately; use Rename for
                        typo fixes.
                      </p>
                    ) : null}
                  </div>
                ) : null}
                <div className="grid gap-2">
                  <Label htmlFor="inventory-option-merge-reason">Reason for merge</Label>
                  <Textarea
                    id="inventory-option-merge-reason"
                    value={reason}
                    maxLength={500}
                    disabled={pending}
                    onChange={(event) => setReason(event.target.value)}
                    placeholder="Duplicate label for the same category or storage area"
                  />
                </div>
                {kind === "location" ? (
                  <label className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={samePhysicalLocation}
                      disabled={pending}
                      onChange={(event) => setSamePhysicalLocation(event.target.checked)}
                    />
                    <span>
                      Both names refer to the same physical location. To move goods between different places, use Adjust
                      stock.
                    </span>
                  </label>
                ) : null}
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={confirmed}
                    disabled={pending}
                    onChange={(event) => setConfirmed(event.target.checked)}
                  />
                  <span>
                    I understand that the duplicate name will be removed and its inventory records reassigned.
                  </span>
                </label>
              </>
            ) : null}
            {editorError ? (
              <p role="alert" className="text-destructive text-sm">
                {editorError}
              </p>
            ) : null}
          </div>
          <DialogFooter className="shrink-0 border-t pt-3">
            <Button type="button" variant="outline" disabled={pending} onClick={() => setEditor(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant={editor?.mode === "delete" ? "destructive" : "default"}
              disabled={
                pending || (editor?.mode === "rename" && !name.trim()) || (editor?.mode === "merge" && mergeBlocked)
              }
              onClick={commit}
            >
              {pending
                ? "Saving..."
                : editor?.mode === "rename"
                  ? "Save name"
                  : editor?.mode === "merge"
                    ? "Merge duplicates"
                    : "Delete unused option"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
