"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

export type ShellLocale = "bn" | "en";
export type ShellTheme = "dark" | "light";

export type ShellMenuItem = {
  key: string;
  label: string;
  href?: string;
  icon?: string;
  children?: Array<{ key: string; label: string; href?: string }>;
};

type CatvShellProps = {
  title: string;
  subtitle: string;
  locale: ShellLocale;
  theme: ShellTheme;
  localeLabel: string;
  themeLabel: string;
  sidebarTitle: string;
  searchPlaceholder?: string;
  userName?: string;
  userMeta?: string;
  menu: ShellMenuItem[];
  activeKey: string;
  defaultExpandedKey?: string | null;
  onToggleLocale: () => void;
  onToggleTheme: () => void;
  children: React.ReactNode;
};

const SIDEBAR_COLLAPSE_KEY = "catv_shell_sidebar_collapsed";

export default function CatvShell({
  title,
  subtitle,
  locale,
  theme,
  localeLabel,
  themeLabel,
  sidebarTitle,
  searchPlaceholder,
  userName,
  userMeta,
  menu,
  activeKey,
  defaultExpandedKey = null,
  onToggleLocale,
  onToggleTheme,
  children,
}: CatvShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(defaultExpandedKey);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(SIDEBAR_COLLAPSE_KEY) === "true");
    } catch {
      // ignore storage failure
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_COLLAPSE_KEY, collapsed ? "true" : "false");
    } catch {
      // ignore storage failure
    }
  }, [collapsed]);

  useEffect(() => {
    const activeParent = menu.find((item) => item.children?.some((child) => child.key === activeKey));
    if (activeParent) {
      setExpanded(activeParent.key);
    }
  }, [activeKey, menu]);

  const normalizedMenu = useMemo(() => menu, [menu]);

  function handleToggleSidebar() {
    if (window.matchMedia("(max-width: 980px)").matches) {
      setMobileOpen((prev) => !prev);
      return;
    }
    setCollapsed((prev) => !prev);
  }

  function handleGroupClick(key: string) {
    const isMobile = window.matchMedia("(max-width: 980px)").matches;

    if (collapsed && !isMobile) {
      setCollapsed(false);
      setExpanded(key);
      return;
    }

    setExpanded((prev) => (prev === key ? null : key));
  }

  return (
    <div className={`catv-shell ${collapsed ? "is-collapsed" : ""}`}>
      <aside className={`catv-sidebar ${mobileOpen ? "is-open" : ""}`}>
        <div className="catv-sidebar-brand">
          <div className="catv-brand-mark">HY</div>
          <div className="catv-brand-copy">
            <p className="catv-brand-title">{sidebarTitle}</p>
            <p className="catv-brand-sub">Hybrid Commerce SaaS</p>
          </div>
          <button type="button" className="catv-sidebar-close" onClick={() => setMobileOpen(false)}>
            ✕
          </button>
        </div>

        <nav className="catv-nav">
          {normalizedMenu.map((item) => {
            const hasChildren = Boolean(item.children?.length);
            const isActive = activeKey === item.key;
            const isExpanded = expanded === item.key;

            if (!hasChildren) {
              return item.href ? (
                <Link
                  key={item.key}
                  href={item.href}
                  className={`catv-nav-link ${isActive ? "active" : ""}`}
                  onClick={() => setMobileOpen(false)}
                >
                  <span className="catv-nav-icon">{item.icon ?? "•"}</span>
                  <span className="catv-nav-label">{item.label}</span>
                </Link>
              ) : (
                <button key={item.key} type="button" className={`catv-nav-link ${isActive ? "active" : ""}`}>
                  <span className="catv-nav-icon">{item.icon ?? "•"}</span>
                  <span className="catv-nav-label">{item.label}</span>
                </button>
              );
            }

            return (
              <div key={item.key} className={`catv-nav-group ${isExpanded ? "is-open" : ""}`}>
                <button type="button" className="catv-nav-link" onClick={() => handleGroupClick(item.key)}>
                  <span className="catv-nav-icon">{item.icon ?? "▸"}</span>
                  <span className="catv-nav-label">{item.label}</span>
                  <span className="catv-nav-caret">{isExpanded ? "▾" : "▸"}</span>
                </button>
                <div className="catv-subnav">
                  {item.children?.map((child) => (
                    <Link
                      key={child.key}
                      href={child.href ?? "#"}
                      className={`catv-nav-link catv-nav-sublink ${activeKey === child.key ? "active" : ""}`}
                      onClick={() => setMobileOpen(false)}
                    >
                      <span className="catv-nav-label">{child.label}</span>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </nav>
      </aside>

      <button
        type="button"
        aria-label="Close sidebar"
        className={`catv-sidebar-overlay ${mobileOpen ? "is-visible" : ""}`}
        onClick={() => setMobileOpen(false)}
      />

      <section className="catv-main">
        <header className="catv-topbar">
          <div className="catv-topbar-left">
            <button type="button" className="catv-menu-toggle" onClick={handleToggleSidebar}>
              <span />
              <span />
              <span />
            </button>
            <div>
              <h1 className="catv-topbar-title">{title}</h1>
              <p className="catv-topbar-sub">{subtitle}</p>
            </div>
          </div>

          <div className="catv-topbar-right">
            {searchPlaceholder ? (
              <input className="catv-search" placeholder={searchPlaceholder} />
            ) : null}
            <button type="button" className="catv-chip" onClick={onToggleLocale}>
              {localeLabel}: {locale === "bn" ? "বাংলা" : "English"}
            </button>
            <button type="button" className="catv-chip" onClick={onToggleTheme}>
              {themeLabel}: {theme === "dark" ? "Dark" : "Light"}
            </button>
            {(userName || userMeta) && (
              <div className="catv-user-box">
                <span className="catv-avatar" aria-hidden="true" />
                <div>
                  <p className="catv-user-name">{userName ?? "User"}</p>
                  <p className="catv-user-meta">{userMeta ?? ""}</p>
                </div>
              </div>
            )}
          </div>
        </header>

        <div className="catv-content">{children}</div>
      </section>
    </div>
  );
}
