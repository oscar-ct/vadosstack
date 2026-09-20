"use client";

import * as React from "react";

import Image from "next/image";
import { usePathname, useSearchParams } from "next/navigation";

import { Building2, ChevronRight, Command, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { WorkspaceLink as Link, useWorkspaceRouter as useRouter } from "@/components/workspace-path-provider";
import type { DocumentEmailTemplate } from "@/lib/email-templates";
import { formatPhoneNumber, normalizePhoneNumber } from "@/lib/phone";
import { getWorkspaceModeDescription, getWorkspaceModeLabel, type WorkspaceMode } from "@/lib/workspace-mode";
import { getLegacyDashboardPath, getWorkspaceDashboardPath } from "@/lib/workspace-path";
import type { NavGroup, NavMainItem } from "@/navigation/sidebar/sidebar-items";

import { useDashboardNavigationLoader } from "../dashboard-navigation-loader";
import { type CompanySettingsState, updateCompanySettingsAction } from "./actions";
import { EmailComposerDialog } from "./email-composer-dialog";

interface NavMainProps {
  readonly items: readonly NavGroup[];
  readonly companyName: string;
  readonly companyAddress: string | null;
  readonly companyEmail: string | null;
  readonly companyPhone: string | null;
  readonly estimateValidDays: number;
  readonly invoiceDueDays: number;
  readonly workspaceMode: WorkspaceMode;
  readonly gmailConnected: boolean;
  readonly gmailSenderEmail: string | null;
  readonly emailTemplates: DocumentEmailTemplate[];
  readonly emailRecipients: Array<{
    email: string;
    id: string;
    name: string;
    type: "Customer" | "Lead";
  }>;
  readonly dueTodayTaskCount: number;
  readonly logoSrc: string;
  readonly onCompanySettingsSaved: () => void;
  readonly pendingTimeReviewCount: number;
  readonly canManageSettings: boolean;
  readonly canManageBranding: boolean;
  readonly canManageEmailAccount: boolean;
  readonly canSendEmail: boolean;
}

const initialCompanySettingsState: CompanySettingsState = {
  success: false,
  message: "",
};
const maxLogoSize = 2 * 1024 * 1024;
const allowedLogoTypes = new Set(["image/png", "image/jpeg", "image/webp", "image/svg+xml"]);

const IsComingSoon = () => (
  <span className="ml-auto rounded-md bg-gray-200 px-2 py-1 text-xs dark:text-gray-800">Soon</span>
);

type NavAlert = {
  count: number;
  label: string;
  tone: "amber" | "rose";
};

const alertBadgeClassNames = {
  amber: {
    collapsed: "absolute top-1.5 right-1.5 size-2 rounded-full bg-amber-500 ring-2 ring-sidebar",
    expanded:
      "ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-amber-500 px-1.5 font-semibold text-[10px] text-white shadow-sm ring-2 ring-sidebar",
  },
  rose: {
    collapsed: "absolute top-1.5 right-1.5 size-2 rounded-full bg-rose-600 ring-2 ring-sidebar",
    expanded:
      "ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-rose-600 px-1.5 font-semibold text-[10px] text-white shadow-sm ring-2 ring-sidebar",
  },
};

function NavAlertBadge({ alert, collapsed = false }: { alert: NavAlert; collapsed?: boolean }) {
  const { count, label: alertLabel, tone } = alert;

  if (count <= 0) {
    return null;
  }

  const label = count > 99 ? "99+" : String(count);
  const className = collapsed ? alertBadgeClassNames[tone].collapsed : alertBadgeClassNames[tone].expanded;

  return (
    <span title={`${count} ${alertLabel}`} className={className}>
      {collapsed ? null : label}
      <span className="sr-only"> {alertLabel}</span>
    </span>
  );
}

function getItemAlert(item: NavMainItem, dueTodayTaskCount: number, pendingTimeReviewCount: number): NavAlert {
  const itemPath = getLegacyDashboardPath(item.url);

  if (itemPath === "/dashboard/calendar") {
    return {
      count: dueTodayTaskCount,
      label: `task${dueTodayTaskCount === 1 ? "" : "s"} due today`,
      tone: "amber",
    };
  }

  if (itemPath === "/dashboard/time-tracking") {
    return {
      count: pendingTimeReviewCount,
      label: `pending time ${pendingTimeReviewCount === 1 ? "review" : "reviews"}`,
      tone: "rose",
    };
  }

  return {
    count: 0,
    label: "",
    tone: "rose",
  };
}

const NavItemExpanded = ({
  item,
  alert,
  isActive,
  isSubmenuOpen,
  onNavigate,
}: {
  item: NavMainItem;
  alert: NavAlert;
  isActive: (url: string, subItems?: NavMainItem["subItems"]) => boolean;
  isSubmenuOpen: (subItems?: NavMainItem["subItems"]) => boolean;
  onNavigate: (url: string, isNewTab?: boolean) => void;
}) => {
  return (
    <Collapsible key={item.title} asChild defaultOpen={isSubmenuOpen(item.subItems)} className="group/collapsible">
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          {item.subItems ? (
            <SidebarMenuButton
              disabled={item.comingSoon ? true : Boolean(item.disabledReason)}
              isActive={isActive(item.url, item.subItems)}
              tooltip={item.disabledReason ?? item.title}
            >
              {item.icon && <item.icon />}
              <span>{item.title}</span>
              {item.comingSoon && <IsComingSoon />}
              <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
            </SidebarMenuButton>
          ) : item.disabledReason ? (
            <SidebarMenuButton disabled tooltip={item.disabledReason} isActive={isActive(item.url)}>
              {item.icon && <item.icon />}
              <span>{item.title}</span>
            </SidebarMenuButton>
          ) : (
            <SidebarMenuButton
              asChild
              aria-disabled={item.comingSoon}
              isActive={isActive(item.url)}
              tooltip={item.title}
            >
              <Link
                prefetch={false}
                href={item.url}
                target={item.newTab ? "_blank" : undefined}
                onClick={() => onNavigate(item.url, item.newTab)}
              >
                {item.icon && <item.icon />}
                <span>{item.title}</span>
                <NavAlertBadge alert={alert} />
                {item.comingSoon && <IsComingSoon />}
              </Link>
            </SidebarMenuButton>
          )}
        </CollapsibleTrigger>
        {item.subItems && (
          <CollapsibleContent>
            <SidebarMenuSub>
              {item.subItems.map((subItem) => (
                <SidebarMenuSubItem key={subItem.title}>
                  <SidebarMenuSubButton
                    aria-disabled={subItem.comingSoon ? true : Boolean(subItem.disabledReason)}
                    isActive={isActive(subItem.url)}
                    title={subItem.disabledReason}
                    asChild
                  >
                    <Link
                      prefetch={false}
                      href={subItem.url}
                      target={subItem.newTab ? "_blank" : undefined}
                      onClick={(event) => {
                        if (subItem.disabledReason) {
                          event.preventDefault();
                          return;
                        }
                        onNavigate(subItem.url, subItem.newTab);
                      }}
                    >
                      {subItem.icon && <subItem.icon />}
                      <span>{subItem.title}</span>
                      {subItem.comingSoon && <IsComingSoon />}
                    </Link>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              ))}
            </SidebarMenuSub>
          </CollapsibleContent>
        )}
      </SidebarMenuItem>
    </Collapsible>
  );
};

const NavItemCollapsed = ({
  item,
  alert,
  isActive,
  onNavigate,
}: {
  item: NavMainItem;
  alert: NavAlert;
  isActive: (url: string, subItems?: NavMainItem["subItems"]) => boolean;
  onNavigate: (url: string, isNewTab?: boolean) => void;
}) => {
  return (
    <SidebarMenuItem key={item.title}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <SidebarMenuButton
            disabled={item.comingSoon ? true : Boolean(item.disabledReason)}
            tooltip={item.disabledReason ?? item.title}
            isActive={isActive(item.url, item.subItems)}
            className="relative"
          >
            {item.icon && <item.icon />}
            <NavAlertBadge alert={alert} collapsed />
            <span>{item.title}</span>
            <ChevronRight />
          </SidebarMenuButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-50 space-y-1" side="right" align="start">
          {item.subItems?.map((subItem) => (
            <DropdownMenuItem key={subItem.title} asChild>
              <SidebarMenuSubButton
                key={subItem.title}
                asChild
                className="focus-visible:ring-0"
                aria-disabled={subItem.comingSoon ? true : Boolean(subItem.disabledReason)}
                isActive={isActive(subItem.url)}
              >
                <Link
                  prefetch={false}
                  href={subItem.url}
                  target={subItem.newTab ? "_blank" : undefined}
                  onClick={(event) => {
                    if (subItem.disabledReason) {
                      event.preventDefault();
                      return;
                    }
                    onNavigate(subItem.url, subItem.newTab);
                  }}
                >
                  {subItem.icon && <subItem.icon className="[&>svg]:text-sidebar-foreground" />}
                  <span>{subItem.title}</span>
                  {subItem.comingSoon && <IsComingSoon />}
                </Link>
              </SidebarMenuSubButton>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  );
};

function CompanySettingsDialog({
  canManageBranding,
  companyEmail,
  companyAddress,
  companyName,
  companyPhone,
  estimateValidDays,
  invoiceDueDays,
  workspaceMode,
  logoSrc,
  onSaved,
}: {
  readonly canManageBranding: boolean;
  readonly companyEmail: string | null;
  readonly companyAddress: string | null;
  readonly companyName: string;
  readonly companyPhone: string | null;
  readonly estimateValidDays: number;
  readonly invoiceDueDays: number;
  readonly workspaceMode: WorkspaceMode;
  readonly logoSrc: string;
  readonly onSaved: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [deleteLogo, setDeleteLogo] = React.useState(false);
  const [logoError, setLogoError] = React.useState("");
  const [logoPreview, setLogoPreview] = React.useState<{ name: string; url: string } | null>(null);
  const logoInputRef = React.useRef<HTMLInputElement>(null);
  const logoPreviewUrlRef = React.useRef<string | null>(null);
  const [selectedWorkspaceMode, setSelectedWorkspaceMode] = React.useState<WorkspaceMode>(workspaceMode);
  const [companyPhoneDigits, setCompanyPhoneDigits] = React.useState(() =>
    normalizePhoneNumber(companyPhone).slice(0, 10),
  );
  const [state, formAction, isPending] = React.useActionState(updateCompanySettingsAction, initialCompanySettingsState);
  const handledSuccessStateRef = React.useRef<typeof state | null>(null);
  const clearLogoPreview = React.useCallback(() => {
    if (logoPreviewUrlRef.current) {
      URL.revokeObjectURL(logoPreviewUrlRef.current);
      logoPreviewUrlRef.current = null;
    }
    setLogoPreview(null);
  }, []);
  const clearLogoSelection = React.useCallback(() => {
    clearLogoPreview();
    if (logoInputRef.current) {
      logoInputRef.current.value = "";
    }
  }, [clearLogoPreview]);

  React.useEffect(
    () => () => {
      if (logoPreviewUrlRef.current) {
        URL.revokeObjectURL(logoPreviewUrlRef.current);
      }
    },
    [],
  );

  React.useEffect(() => {
    if (open) {
      setCompanyPhoneDigits(normalizePhoneNumber(companyPhone).slice(0, 10));
      setSelectedWorkspaceMode(workspaceMode);
    }
  }, [companyPhone, open, workspaceMode]);

  React.useEffect(() => {
    if (!state.success || handledSuccessStateRef.current === state) {
      return;
    }

    handledSuccessStateRef.current = state;
    setDeleteLogo(false);
    setLogoError("");
    clearLogoSelection();
    onSaved();
    if (state.workspaceSlug) {
      const dashboardPath = getLegacyDashboardPath(pathname);
      const query = searchParams.toString();
      router.replace(`${getWorkspaceDashboardPath(state.workspaceSlug, dashboardPath)}${query ? `?${query}` : ""}`);
    } else {
      router.refresh();
    }
    toast.success(state.message || "Company settings saved.", { id: "company-settings-saved" });
    const timeout = window.setTimeout(() => setOpen(false), 1600);

    return () => window.clearTimeout(timeout);
  }, [clearLogoSelection, onSaved, pathname, router, searchParams, state]);

  const handleLogoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    setLogoError("");

    if (!file) {
      clearLogoSelection();
      return;
    }

    if (file.size > maxLogoSize) {
      clearLogoSelection();
      setLogoError("Logo must be 2 MB or smaller. Try exporting the SVG smaller or using a compressed PNG.");
      return;
    }

    if (!allowedLogoTypes.has(file.type)) {
      clearLogoSelection();
      setLogoError("Logo must be a PNG, JPG, WebP, or SVG file.");
      return;
    }

    clearLogoPreview();
    const previewUrl = URL.createObjectURL(file);
    logoPreviewUrlRef.current = previewUrl;
    setLogoPreview({ name: file.name, url: previewUrl });
    setDeleteLogo(false);
  };

  const handleDeleteLogoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const checked = event.currentTarget.checked;
    setDeleteLogo(checked);
    if (checked) {
      clearLogoSelection();
    }
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      clearLogoSelection();
      setDeleteLogo(false);
      setLogoError("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <SidebarMenuButton
          tooltip="Company Settings"
          className="min-w-8 bg-primary text-primary-foreground duration-200 ease-linear hover:bg-primary/90 hover:text-primary-foreground active:bg-primary/90 active:text-primary-foreground"
        >
          <Building2 />
          <span>Company Settings</span>
        </SidebarMenuButton>
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Company settings</DialogTitle>
          <DialogDescription>
            These details appear in the sidebar and on printable invoices and estimates.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="company-name">Company name</Label>
            <Input id="company-name" name="companyName" defaultValue={companyName} required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="company-address">Company address</Label>
            <Input
              id="company-address"
              name="companyAddress"
              type="text"
              defaultValue={companyAddress ?? ""}
              placeholder="123 Main St, San Antonio, TX 78205"
              autoComplete="street-address"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="company-email">Company email</Label>
            <Input id="company-email" name="companyEmail" type="email" defaultValue={companyEmail ?? ""} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="company-phone">Company phone</Label>
            <Input
              id="company-phone"
              name="companyPhone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              maxLength={14}
              value={formatPhoneNumber(companyPhoneDigits)}
              onChange={(event) => setCompanyPhoneDigits(normalizePhoneNumber(event.target.value).slice(0, 10))}
            />
          </div>
          {selectedWorkspaceMode === "commerce" ? (
            <>
              <input type="hidden" name="estimateValidDays" value={estimateValidDays} />
              <input type="hidden" name="invoiceDueDays" value={invoiceDueDays} />
            </>
          ) : (
            <div className="grid gap-3 rounded-lg border bg-muted/20 p-3 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="estimate-valid-days">Estimate valid days</Label>
                <Input
                  id="estimate-valid-days"
                  name="estimateValidDays"
                  type="number"
                  min={1}
                  max={365}
                  step={1}
                  defaultValue={estimateValidDays}
                  required
                />
                <p className="text-muted-foreground text-xs">Used for estimate valid-through dates.</p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="invoice-due-days">Invoice due days</Label>
                <Input
                  id="invoice-due-days"
                  name="invoiceDueDays"
                  type="number"
                  min={1}
                  max={365}
                  step={1}
                  defaultValue={invoiceDueDays}
                  required
                />
                <p className="text-muted-foreground text-xs">Used for invoice due-by dates.</p>
              </div>
            </div>
          )}
          <div className="grid gap-2 rounded-lg border bg-muted/20 p-3">
            <Label htmlFor="workspace-mode">Business focus</Label>
            <select
              id="workspace-mode"
              name="workspaceMode"
              value={selectedWorkspaceMode}
              onChange={(event) => setSelectedWorkspaceMode(event.currentTarget.value as WorkspaceMode)}
              className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <option value="both">{getWorkspaceModeLabel("both")}</option>
              <option value="service">{getWorkspaceModeLabel("service")}</option>
              <option value="commerce">{getWorkspaceModeLabel("commerce")}</option>
            </select>
            <p className="text-muted-foreground text-xs">
              Choose which modules are shown in the sidebar. You can change this anytime.
            </p>
            <div className="grid gap-1 text-muted-foreground text-xs">
              <span>
                {getWorkspaceModeLabel("both")}: {getWorkspaceModeDescription("both")}
              </span>
              <span>
                {getWorkspaceModeLabel("service")}: {getWorkspaceModeDescription("service")}
              </span>
              <span>
                {getWorkspaceModeLabel("commerce")}: {getWorkspaceModeDescription("commerce")}
              </span>
            </div>
          </div>
          {canManageBranding ? (
            <div className="grid gap-3 rounded-lg border bg-muted/20 p-3">
              <div className="flex items-center gap-3">
                <div
                  className={`flex size-12 items-center justify-center overflow-hidden rounded-lg border bg-background ${
                    logoPreview ? "border-emerald-500 ring-2 ring-emerald-500/15" : ""
                  }`}
                >
                  {!deleteLogo ? (
                    <Image
                      src={logoPreview?.url ?? logoSrc}
                      alt={logoPreview ? "Selected company logo preview" : ""}
                      width={48}
                      height={48}
                      unoptimized
                      className="size-full object-contain p-1"
                    />
                  ) : (
                    <Command className="size-5 text-muted-foreground" />
                  )}
                </div>
                <div className="grid gap-0.5">
                  <Label htmlFor="company-logo">{logoPreview ? "New logo selected" : "Company logo"}</Label>
                  {logoPreview ? (
                    <p className="max-w-72 truncate text-emerald-700 text-xs dark:text-emerald-300">
                      {logoPreview.name} · Ready to upload when you save
                    </p>
                  ) : (
                    <p className="text-muted-foreground text-xs">PNG, JPG, WebP, or SVG. Maximum 2 MB.</p>
                  )}
                </div>
              </div>
              <Input
                ref={logoInputRef}
                id="company-logo"
                name="companyLogo"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                onChange={handleLogoChange}
              />
              <label className="flex items-center gap-2 text-muted-foreground text-sm">
                <input
                  type="checkbox"
                  name="deleteLogo"
                  value="true"
                  checked={deleteLogo}
                  onChange={handleDeleteLogoChange}
                />
                <Trash2 className="size-4" />
                Remove uploaded logo and use the default
              </label>
            </div>
          ) : null}
          {logoError || (state.message && !state.success) ? (
            <FieldError errors={[{ message: logoError || state.message }]} />
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving..." : "Save company settings"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function NavMain({
  canManageBranding,
  canManageEmailAccount,
  canManageSettings,
  canSendEmail,
  items,
  companyEmail,
  companyAddress,
  companyName,
  companyPhone,
  estimateValidDays,
  gmailConnected,
  gmailSenderEmail,
  emailTemplates,
  emailRecipients,
  dueTodayTaskCount,
  invoiceDueDays,
  workspaceMode,
  logoSrc,
  onCompanySettingsSaved,
  pendingTimeReviewCount,
}: NavMainProps) {
  const path = usePathname();
  const { state, isMobile, setOpenMobile } = useSidebar();
  const { startNavigation } = useDashboardNavigationLoader();

  const handleNavigate = React.useCallback(
    (url: string, isNewTab?: boolean) => {
      startNavigation(url, isNewTab);
      if (isMobile) setOpenMobile(false);
    },
    [isMobile, setOpenMobile, startNavigation],
  );

  const isItemActive = (url: string, subItems?: NavMainItem["subItems"]) => {
    if (subItems?.length) {
      return subItems.some((sub) => path.startsWith(sub.url));
    }
    return path === url || path.startsWith(`${url}/`);
  };

  const isSubmenuOpen = (subItems?: NavMainItem["subItems"]) => {
    return subItems?.some((sub) => path.startsWith(sub.url)) ?? false;
  };

  return (
    <>
      <SidebarGroup>
        <SidebarGroupContent className="flex flex-col gap-2">
          <SidebarMenu>
            <SidebarMenuItem className="flex items-center gap-2">
              {canManageSettings ? (
                <CompanySettingsDialog
                  canManageBranding={canManageBranding}
                  companyName={companyName}
                  companyAddress={companyAddress}
                  companyEmail={companyEmail}
                  companyPhone={companyPhone}
                  estimateValidDays={estimateValidDays}
                  invoiceDueDays={invoiceDueDays}
                  workspaceMode={workspaceMode}
                  logoSrc={logoSrc}
                  onSaved={onCompanySettingsSaved}
                />
              ) : null}
              {canSendEmail ? (
                <EmailComposerDialog
                  canManageGmailAccount={canManageEmailAccount}
                  gmailConnected={gmailConnected}
                  recipients={emailRecipients}
                  senderEmail={gmailSenderEmail}
                  templates={emailTemplates}
                />
              ) : null}
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
      {items.map((group) => (
        <SidebarGroup key={group.id}>
          {group.label && <SidebarGroupLabel>{group.label}</SidebarGroupLabel>}
          <SidebarGroupContent className="flex flex-col gap-2">
            <SidebarMenu>
              {group.items.map((item) => {
                const alert = getItemAlert(item, dueTodayTaskCount, pendingTimeReviewCount);

                if (state === "collapsed" && !isMobile) {
                  // If no subItems, just render the button as a link
                  if (!item.subItems) {
                    return (
                      <SidebarMenuItem key={item.title}>
                        {item.disabledReason ? (
                          <SidebarMenuButton
                            disabled
                            tooltip={item.disabledReason}
                            isActive={isItemActive(item.url)}
                            className="relative"
                          >
                            {item.icon && <item.icon />}
                            <span>{item.title}</span>
                          </SidebarMenuButton>
                        ) : (
                          <SidebarMenuButton
                            asChild
                            aria-disabled={item.comingSoon}
                            tooltip={item.title}
                            isActive={isItemActive(item.url)}
                            className="relative"
                          >
                            <Link
                              prefetch={false}
                              href={item.url}
                              target={item.newTab ? "_blank" : undefined}
                              onClick={() => handleNavigate(item.url, item.newTab)}
                            >
                              {item.icon && <item.icon />}
                              <NavAlertBadge alert={alert} collapsed />
                              <span>{item.title}</span>
                            </Link>
                          </SidebarMenuButton>
                        )}
                      </SidebarMenuItem>
                    );
                  }
                  // Otherwise, render the dropdown as before
                  return (
                    <NavItemCollapsed
                      key={item.title}
                      item={item}
                      alert={alert}
                      isActive={isItemActive}
                      onNavigate={handleNavigate}
                    />
                  );
                }
                // Expanded view
                return (
                  <NavItemExpanded
                    key={item.title}
                    item={item}
                    alert={alert}
                    isActive={isItemActive}
                    isSubmenuOpen={isSubmenuOpen}
                    onNavigate={handleNavigate}
                  />
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ))}
    </>
  );
}
