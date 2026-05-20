import {
  BriefcaseBusiness,
  ChartNoAxesCombined,
  ListTodo,
  type LucideIcon,
  NotebookText,
  PackageCheck,
  ReceiptText,
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
}

export interface NavMainItem {
  title: string;
  url: string;
  icon?: LucideIcon;
  subItems?: NavSubItem[];
  comingSoon?: boolean;
  newTab?: boolean;
  isNew?: boolean;
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
        title: "Employee Portal",
        url: "/employee-time-tracking",
        icon: UserCog,
        newTab: true,
      },
    ],
  },
];
