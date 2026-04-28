import type { ShellMenuItem } from "@/components/catv-shell";

export type AdminMenuLabels = {
  dashboard: string;
  customers: string;
  activeCustomers: string;
  pendingCustomers: string;
  sms: string;
  smsGateway: string;
  smsSend: string;
  smsHistory: string;
  smsCredit: string;
  packages: string;
  billing: string;
  reports: string;
  settings: string;
  emailSettings: string;
  notificationTemplates?: string;
  notificationUseCases?: string;
  notificationLogs?: string;
};

export function buildAdminMenu(labels: AdminMenuLabels): ShellMenuItem[] {
  const settingsChildren: Array<{ key: string; label: string; href?: string }> = [
    { key: "settings-email", label: labels.emailSettings, href: "/admin/settings/email" },
  ];

  if (labels.notificationTemplates) {
    settingsChildren.push({
      key: "settings-notification-templates",
      label: labels.notificationTemplates,
      href: "/admin/settings/notification-templates",
    });
  }

  if (labels.notificationUseCases) {
    settingsChildren.push({
      key: "settings-notification-use-cases",
      label: labels.notificationUseCases,
      href: "/admin/settings/notification-use-cases",
    });
  }

  if (labels.notificationLogs) {
    settingsChildren.push({
      key: "settings-notification-logs",
      label: labels.notificationLogs,
      href: "/admin/settings/notification-logs",
    });
  }

  return [
    { key: "dashboard", label: labels.dashboard, icon: "🏠", href: "/admin" },
    {
      key: "customers",
      label: labels.customers,
      icon: "👥",
      children: [
        { key: "customers-active", label: labels.activeCustomers, href: "/admin/customers/active" },
        { key: "customers-pending", label: labels.pendingCustomers },
      ],
    },
    {
      key: "sms",
      label: labels.sms,
      icon: "✉️",
      children: [
        { key: "sms-gateway", label: labels.smsGateway, href: "/admin/sms/gateways" },
        { key: "sms-send", label: labels.smsSend, href: "/admin/sms/send" },
        { key: "sms-history", label: labels.smsHistory, href: "/admin/sms/history" },
        { key: "sms-credit", label: labels.smsCredit, href: "/admin/sms/credit" },
      ],
    },
    { key: "packages", label: labels.packages, icon: "📦" },
    { key: "billing", label: labels.billing, icon: "💳" },
    { key: "reports", label: labels.reports, icon: "📊" },
    {
      key: "settings",
      label: labels.settings,
      icon: "⚙️",
      children: settingsChildren,
    },
  ];
}
