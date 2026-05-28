import {
  BriefcaseBusiness,
  CalendarDays,
  ChartNoAxesCombined,
  ListTodo,
  type LucideIcon,
  MailCheck,
  NotebookText,
  PackageCheck,
  ReceiptText,
  ShieldCheck,
  Timer,
  UserCog,
  Users,
} from "lucide-react";

export interface NavSubItem {
  title: string;
  url: string;
  icon?: LucideIcon;
  comingSoon?: boolean;
  newTab?: boolean;
  isNew?: boolean;
  adminOnly?: boolean;
}

export interface NavMainItem {
  title: string;
  url: string;
  icon?: LucideIcon;
  subItems?: NavSubItem[];
  comingSoon?: boolean;
  newTab?: boolean;
  isNew?: boolean;
  adminOnly?: boolean;
}

export interface NavGroup {
  id: number;
  label?: string;
  items: NavMainItem[];
}

export const sidebarItems: NavGroup[] = [
  {
    id: 1,
    label: "Dashboards",
    items: [
      {
        title: "Overview",
        url: "/dashboard/overview",
        icon: ListTodo,
      },
      {
        title: "Calendar",
        url: "/dashboard/calendar",
        icon: CalendarDays,
      },
      {
        title: "Command Center",
        url: "/dashboard/command-center",
        icon: ChartNoAxesCombined,
        isNew: true,
      },
      {
        title: "Customers",
        url: "/dashboard/customers",
        icon: Users,
      },
      {
        title: "Jobs",
        url: "/dashboard/jobs",
        icon: BriefcaseBusiness,
      },
      {
        title: "Estimates",
        url: "/dashboard/estimates",
        icon: NotebookText,
      },
      {
        title: "Services",
        url: "/dashboard/services",
        icon: PackageCheck,
      },
      {
        title: "Time Tracking",
        url: "/dashboard/time-tracking",
        icon: Timer,
      },
      {
        title: "Invoices",
        url: "/dashboard/invoices",
        icon: ReceiptText,
      },
      {
        title: "Email History",
        url: "/dashboard/email-history",
        icon: MailCheck,
      },
      {
        title: "Employee Portal",
        url: "/employee-time-tracking",
        icon: UserCog,
        newTab: true,
      },
    ],
  },
  {
    id: 2,
    label: "Admin",
    items: [
      {
        title: "Users",
        url: "/dashboard/admin/users",
        icon: ShieldCheck,
        adminOnly: true,
      },
    ],
  },
];
