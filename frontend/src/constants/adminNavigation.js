import { LayoutDashboard, ListChecks, Users, Sparkles, BookOpen } from "lucide-react";

/**
 * Admin sidebar structure. Same shape as constants/navigation.js
 * (NAV_SECTIONS) so components/admin/AdminSidebar.jsx can reuse the exact
 * rendering logic/style of components/layout/SidebarContent.jsx.
 *
 * Section order/grouping mirrors the Admin Panel structure: Dashboard,
 * Learner Management, Resource Management (admin-curated resources),
 * Generated Content Management (system-generated shared AI content) —
 * kept as two separate sections/screens since they're two different
 * concepts (see screens/admin/ResourceBankScreen.jsx and
 * screens/admin/GeneratedContentScreen.jsx's docstrings).
 */
export const ADMIN_NAV_SECTIONS = [
  {
    key: "overview",
    title: "Dashboard",
    icon: LayoutDashboard,
    children: [{ key: "admin-dashboard", label: "Dashboard" }],
  },
  {
    key: "people",
    title: "Learner Management",
    icon: Users,
    children: [
      { key: "student-records", label: "Student Records" },
      { key: "learner-intelligence", label: "Learner Intelligence" },
    ],
  },
  {
    key: "content",
    title: "Resource Management",
    icon: ListChecks,
    children: [
      { key: "resource-bank", label: "Resource Management" },
    ],
  },
  {
    key: "generated-content",
    title: "Generated Content Management",
    icon: Sparkles,
    children: [
      { key: "generated-content", label: "Generated Content Management" },
    ],
  },
  {
    key: "lesson-plans",
    title: "Lesson Plan Management",
    icon: BookOpen,
    children: [
      { key: "lesson-plans", label: "Lesson Plan Management" },
    ],
  },
];
