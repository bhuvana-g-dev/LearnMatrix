import {
  Home as HomeIcon,
  Target,
  ClipboardCheck,
  Map,
  Bot,
  Calendar,
  User,
} from "lucide-react";

/**
 * Sidebar structure. Purely presentational/navigational data — no API
 * dependency, so it stays a constant even after the Flask backend lands.
 *
 * Sections with `children` are expandable groups (toggled open/close by
 * the chevron). "My Profile" additionally has `selfNavigable: true` —
 * its header (icon + title) is itself a clickable link straight to the
 * main profile page, separate from the chevron which only opens/closes
 * the dropdown. "Home" has no `children` at all — it's a single link,
 * no dropdown, no chevron.
 */

export const NAV_SECTIONS = [
  {
    key: "home",
    title: "Home",
    icon: HomeIcon,
    selfNavigable: true,
  },
  {
    // Key stays "role" (not "career") on purpose — App.jsx already
    // routes activeKey === "role" straight to CareerStatusScreen, which
    // internally decides Role Selection vs the committed status
    // dashboard. No children/dropdown anymore — single link, same as
    // Home/Learning Hub, per the redesigned "My Career Path" page.
    key: "role",
    title: "My Career Path",
    icon: Target,
    selfNavigable: true,
  },
  {
    // Own sidebar entry, separate from "My Career Path" — takes the
    // learner straight to AssessmentScreen (App.jsx already routes
    // activeKey === "initial-assessment" there). The result itself
    // (score, skill breakdown, per-question review) lives ONLY on this
    // page now — CareerStatusScreen no longer duplicates it, it just
    // links here.
    key: "initial-assessment",
    title: "Assessment",
    icon: ClipboardCheck,
    selfNavigable: true,
  },
  {
    key: "roadmap",
    title: "Learning Hub",
    icon: Map,
    selfNavigable: true, // single link, no dropdown — goes straight to RoadmapScreen
  },
  {
    key: "ai",
    title: "AI Study Assistant",
    icon: Bot,
    selfNavigable: true, // single unified page (History | Sources | Chat | Studio), no dropdown
  },
  {
    key: "revision",
    title: "Revision",
    icon: Calendar,
    selfNavigable: true, // single link, no dropdown — Today's/Upcoming both live on one page now
  },
  {
    key: "profile",
    title: "My Profile",
    icon: User,
    selfNavigable: true,
  },
];
