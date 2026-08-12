import { LayoutDashboard, ListChecks, Users } from "lucide-react";

/**
 * Admin sidebar structure. Same shape as constants/navigation.js
 * (NAV_SECTIONS) so components/admin/AdminSidebar.jsx can reuse the exact
 * rendering logic/style of components/layout/SidebarContent.jsx.
 */
export const ADMIN_NAV_SECTIONS = [
  {
    key: "overview",
    title: "Overview",
    icon: LayoutDashboard,
    children: [{ key: "admin-dashboard", label: "Dashboard" }],
  },
  {
    key: "content",
    title: "Content",
    icon: ListChecks,
    children: [
      { key: "question-bank", label: "Question Bank" },
      { key: "resource-bank", label: "Resource Bank" },
    ],
  },
  {
    key: "people",
    title: "People",
    icon: Users,
    children: [
      { key: "student-records", label: "Student Records" },
      { key: "learner-intelligence", label: "Learner Intelligence" },
    ],
  },
];
