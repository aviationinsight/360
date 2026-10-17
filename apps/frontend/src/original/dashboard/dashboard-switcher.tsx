"use client";

import { ChevronDown } from "lucide-react";

const dashboards = [
  { key: "amos", label: "AMOS Picking" },
  { key: "aog", label: "AOG Delivery" },
  { key: "fak", label: "FAK Analysis" },
  { key: "marshaling", label: "Marshaling" },
  { key: "permits", label: "Security Permits" },
];

export function DashboardSwitcher({ current, allowed }: { current: string; allowed: Record<string, boolean> }) {
  return (
    <label className="dashboard-switcher">
      <span>OPERATIONAL DASHBOARD</span>
      <div className="dashboard-select-wrap">
        <select
          aria-label="Choose dashboard"
          value={current}
          onChange={(event) => {
            window.location.href = `/dashboard?tab=${event.target.value}&intro=1`;
          }}
        >
          {dashboards.map((dashboard) => (
            <option key={dashboard.key} value={dashboard.key} disabled={allowed[dashboard.key] === false}>
              {dashboard.label}{allowed[dashboard.key] === false ? " · Locked" : ""}
            </option>
          ))}
        </select>
        <ChevronDown aria-hidden="true" size={17} />
      </div>
    </label>
  );
}
