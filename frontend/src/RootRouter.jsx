import App from "./App";
import AdminApp from "./AdminApp";

/**
 * RootRouter — the ONLY new "wiring" file. The existing project has no
 * react-router dependency, and App.jsx already manages its own screens via
 * plain useState — so the Admin Panel is switched in the same lightweight
 * way: by URL path, with zero new dependencies.
 *
 * HOW TO WIRE THIS IN:
 * In your main.jsx (or wherever you currently render <App />), replace:
 *     import App from "./App";
 *     ...
 *     <App />
 * with:
 *     import RootRouter from "./RootRouter";
 *     ...
 *     <RootRouter />
 *
 * Visiting /admin (e.g. http://localhost:5173/admin) now renders the Admin
 * Panel; every other path renders the existing student app, completely
 * unchanged.
 */
export default function RootRouter() {
  const isAdminRoute = window.location.pathname.startsWith("/admin");
  return isAdminRoute ? <AdminApp /> : <App />;
}
