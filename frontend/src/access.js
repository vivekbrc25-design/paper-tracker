export const appNavItems = [
  { to: "/papers", label: "Paper Entry", key: "papers" },
  { to: "/papers/verification", label: "Hard Copy Verify", key: "verification" },
  { to: "/reports", label: "Reports & KPIs", key: "reports" },
  { to: "/config", label: "Config Masters", key: "config" },
];

export const pageTitles = {
  "/papers": "Paper Tracking Workspace",
  "/papers/analytic-check": "Workbook Comparison Analytics",
  "/papers/verification": "Hard Copy Verification Desk",
  "/reports": "Reports & Evaluation Insights",
  "/config": "Configuration & Entities Master",
};

export const appRoleLabels = {
  admin: "Admin",
  manager: "Manager",
};

export const routeRoleMap = {
  "/papers": ["admin", "manager"],
  "/papers/analytic-check": ["admin", "manager"],
  "/papers/verification": ["admin", "manager"],
  "/reports": ["admin"],
  "/config": ["admin", "manager"],
};

export function canAccessPath(role, path) {
  if (!role) {
    return false;
  }

  const allowedRoles = routeRoleMap[path];
  return Boolean(allowedRoles?.includes(role));
}

export function getDefaultRoute(role) {
  if (canAccessPath(role, "/papers")) {
    return "/papers";
  }

  return "/login";
}

export function getAccessibleNavItems(role) {
  return appNavItems.filter((item) => canAccessPath(role, item.to));
}
