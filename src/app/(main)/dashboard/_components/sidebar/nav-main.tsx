"use client";

import * as React from "react";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

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
import type { DocumentEmailTemplate } from "@/lib/email-templates";
import { formatPhoneNumber, normalizePhoneNumber } from "@/lib/phone";
import type { NavGroup, NavMainItem } from "@/navigation/sidebar/sidebar-items";

import { useDashboardNavigationLoader } from "../dashboard-navigation-loader";
import { type CompanySettingsState, updateCompanySettingsAction } from "./actions";
import { EmailComposerDialog } from "./email-composer-dialog";

interface NavMainProps {
  readonly items: readonly NavGroup[];
  readonly companyName: string;
  readonly companyEmail: string | null;
  readonly companyPhone: string | null;
  readonly estimateValidDays: number;
  readonly invoiceDueDays: number;
  readonly gmailConnected: boolean;
  readonly gmailSenderEmail: string | null;
  readonly emailTemplates: DocumentEmailTemplate[];
  readonly emailRecipients: Array<{
    email: string;
    id: string;
    name: string;
    type: "Customer" | "Lead";
  }>;
  readonly logoSrc: string;
  readonly onCompanySettingsSaved: () => void;
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

const NavItemExpanded = ({
  item,
  isActive,
  isSubmenuOpen,
  onNavigate,
}: {
  item: NavMainItem;
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
              disabled={item.comingSoon}
              isActive={isActive(item.url, item.subItems)}
              tooltip={item.title}
            >
              {item.icon && <item.icon />}
              <span>{item.title}</span>
              {item.comingSoon && <IsComingSoon />}
              <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
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
                  <SidebarMenuSubButton aria-disabled={subItem.comingSoon} isActive={isActive(subItem.url)} asChild>
                    <Link
                      prefetch={false}
                      href={subItem.url}
                      target={subItem.newTab ? "_blank" : undefined}
                      onClick={() => onNavigate(subItem.url, subItem.newTab)}
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
  isActive,
  onNavigate,
}: {
  item: NavMainItem;
  isActive: (url: string, subItems?: NavMainItem["subItems"]) => boolean;
  onNavigate: (url: string, isNewTab?: boolean) => void;
}) => {
  return (
    <SidebarMenuItem key={item.title}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <SidebarMenuButton
            disabled={item.comingSoon}
            tooltip={item.title}
            isActive={isActive(item.url, item.subItems)}
          >
            {item.icon && <item.icon />}
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
                aria-disabled={subItem.comingSoon}
                isActive={isActive(subItem.url)}
              >
                <Link
                  prefetch={false}
                  href={subItem.url}
                  target={subItem.newTab ? "_blank" : undefined}
                  onClick={() => onNavigate(subItem.url, subItem.newTab)}
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
  companyEmail,
  companyName,
  companyPhone,
  estimateValidDays,
  invoiceDueDays,
  logoSrc,
  onSaved,
}: {
  readonly companyEmail: string | null;
  readonly companyName: string;
  readonly companyPhone: string | null;
  readonly estimateValidDays: number;
  readonly invoiceDueDays: number;
  readonly logoSrc: string;
  readonly onSaved: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [deleteLogo, setDeleteLogo] = React.useState(false);
  const [logoError, setLogoError] = React.useState("");
  const [companyPhoneDigits, setCompanyPhoneDigits] = React.useState(() =>
    normalizePhoneNumber(companyPhone).slice(0, 10),
  );
  const [state, formAction, isPending] = React.useActionState(updateCompanySettingsAction, initialCompanySettingsState);

  React.useEffect(() => {
    if (open) {
      setCompanyPhoneDigits(normalizePhoneNumber(companyPhone).slice(0, 10));
    }
  }, [companyPhone, open]);

  React.useEffect(() => {
    if (state.success) {
      setDeleteLogo(false);
      setLogoError("");
      onSaved();
      toast.success(state.message || "Company settings saved.");
      const timeout = window.setTimeout(() => setOpen(false), 1600);

      return () => window.clearTimeout(timeout);
    }
  }, [state, onSaved]);

  const handleLogoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    setLogoError("");

    if (!file) return;

    if (file.size > maxLogoSize) {
      event.currentTarget.value = "";
      setLogoError("Logo must be 2 MB or smaller. Try exporting the SVG smaller or using a compressed PNG.");
      return;
    }

    if (!allowedLogoTypes.has(file.type)) {
      event.currentTarget.value = "";
      setLogoError("Logo must be a PNG, JPG, WebP, or SVG file.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
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
              maxLength={12}
              value={formatPhoneNumber(companyPhoneDigits)}
              onChange={(event) => setCompanyPhoneDigits(normalizePhoneNumber(event.target.value).slice(0, 10))}
            />
          </div>
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
          <div className="grid gap-3 rounded-lg border bg-muted/20 p-3">
            <div className="flex items-center gap-3">
              <div className="flex size-12 items-center justify-center overflow-hidden rounded-lg border bg-background">
                {!deleteLogo ? (
                  <Image
                    src={logoSrc}
                    alt=""
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
                <Label htmlFor="company-logo">Company logo</Label>
                <p className="text-muted-foreground text-xs">PNG, JPG, WebP, or SVG. Maximum 2 MB.</p>
              </div>
            </div>
            <Input
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
                onChange={(event) => setDeleteLogo(event.target.checked)}
              />
              <Trash2 className="size-4" />
              Remove uploaded logo and use the default
            </label>
          </div>
          {logoError || (state.message && !state.success) ? (
            <FieldError errors={[{ message: logoError || state.message }]} />
          ) : null}
          {state.success && state.message ? (
            <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-700 text-sm dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
              {state.message}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
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
  items,
  companyEmail,
  companyName,
  companyPhone,
  estimateValidDays,
  gmailConnected,
  gmailSenderEmail,
  emailTemplates,
  emailRecipients,
  invoiceDueDays,
  logoSrc,
  onCompanySettingsSaved,
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
              <CompanySettingsDialog
                companyName={companyName}
                companyEmail={companyEmail}
                companyPhone={companyPhone}
                estimateValidDays={estimateValidDays}
                invoiceDueDays={invoiceDueDays}
                logoSrc={logoSrc}
                onSaved={onCompanySettingsSaved}
              />
              <EmailComposerDialog
                gmailConnected={gmailConnected}
                recipients={emailRecipients}
                senderEmail={gmailSenderEmail}
                templates={emailTemplates}
              />
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
                if (state === "collapsed" && !isMobile) {
                  // If no subItems, just render the button as a link
                  if (!item.subItems) {
                    return (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton
                          asChild
                          aria-disabled={item.comingSoon}
                          tooltip={item.title}
                          isActive={isItemActive(item.url)}
                        >
                          <Link
                            prefetch={false}
                            href={item.url}
                            target={item.newTab ? "_blank" : undefined}
                            onClick={() => handleNavigate(item.url, item.newTab)}
                          >
                            {item.icon && <item.icon />}
                            <span>{item.title}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  }
                  // Otherwise, render the dropdown as before
                  return (
                    <NavItemCollapsed
                      key={item.title}
                      item={item}
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
