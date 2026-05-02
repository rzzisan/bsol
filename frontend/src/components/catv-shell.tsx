"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  clearStoredAuth,
  getStoredToken,
  getStoredUser,
  setStoredUser,
  type AuthUser,
} from "@/lib/dashboard-client";

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
const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api").replace(/\/$/, "") || "/api";

type ProfileForm = {
  name: string;
  mobile: string;
  email: string;
  current_password: string;
  password: string;
  password_confirmation: string;
};

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
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileForm, setProfileForm] = useState<ProfileForm>({
    name: "",
    mobile: "",
    email: "",
    current_password: "",
    password: "",
    password_confirmation: "",
  });
  const [profileError, setProfileError] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [authUser, setAuthUser] = useState<AuthUser | null>(() => getStoredUser());
  const menuRef = useRef<HTMLDivElement | null>(null);

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

  useEffect(() => {
    if (!menuOpen) return;

    const onClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (menuRef.current && !menuRef.current.contains(target)) {
        setMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [menuOpen]);

  const normalizedMenu = useMemo(() => menu, [menu]);
  const labels = useMemo(
    () =>
      locale === "bn"
        ? {
            profile: "Profile",
            logout: "Logout",
            profileTitle: "প্রোফাইল আপডেট",
            profileSubtitle: "নাম, মোবাইল, ইমেইল এবং পাসওয়ার্ড আপডেট করুন",
            name: "নাম",
            mobile: "মোবাইল",
            email: "ইমেইল",
            currentPassword: "বর্তমান পাসওয়ার্ড",
            password: "নতুন পাসওয়ার্ড",
            confirmPassword: "পাসওয়ার্ড নিশ্চিত করুন",
            currentPasswordRequired: "নতুন পাসওয়ার্ড দিতে হলে বর্তমান পাসওয়ার্ড দিতে হবে।",
            passwordHint: "খালি রাখলে পাসওয়ার্ড পরিবর্তন হবে না",
            cancel: "বাতিল",
            save: "সংরক্ষণ করুন",
            saving: "সংরক্ষণ হচ্ছে...",
            passwordMismatch: "পাসওয়ার্ড দুটি মিলছে না।",
            profileUpdated: "প্রোফাইল সফলভাবে আপডেট হয়েছে।",
          }
        : {
            profile: "Profile",
            logout: "Logout",
            profileTitle: "Update Profile",
            profileSubtitle: "Update your name, mobile, email, and password",
            name: "Name",
            mobile: "Mobile",
            email: "Email",
            currentPassword: "Current Password",
            password: "New Password",
            confirmPassword: "Confirm Password",
            currentPasswordRequired: "Current password is required to set a new password.",
            passwordHint: "Leave empty to keep current password",
            cancel: "Cancel",
            save: "Save",
            saving: "Saving...",
            passwordMismatch: "Passwords do not match.",
            profileUpdated: "Profile updated successfully.",
          },
    [locale],
  );

  const resolvedUser = authUser;
  const displayName = resolvedUser?.name ?? userName ?? "User";
  const displayMeta = resolvedUser?.email ?? userMeta ?? "";

  function openProfileModal() {
    setMenuOpen(false);
    const current = getStoredUser();
    setAuthUser(current);
    setProfileError(null);
    setProfileForm({
      name: current?.name ?? "",
      mobile: current?.mobile ?? "",
      email: current?.email ?? "",
      current_password: "",
      password: "",
      password_confirmation: "",
    });
    setProfileOpen(true);
  }

  async function handleLogout() {
    setMenuOpen(false);
    const token = getStoredToken();

    if (token) {
      try {
        await fetch(`${API_BASE_URL}/logout`, {
          method: "POST",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
        });
      } catch {
        // ignore logout network errors
      }
    }

    clearStoredAuth();
    window.location.href = "/";
  }

  async function handleProfileSave() {
    setProfileError(null);
    if (profileForm.password && profileForm.password !== profileForm.password_confirmation) {
      setProfileError(labels.passwordMismatch);
      return;
    }
    if (profileForm.password && !profileForm.current_password.trim()) {
      setProfileError(labels.currentPasswordRequired);
      return;
    }

    const token = getStoredToken();
    if (!token) {
      clearStoredAuth();
      window.location.href = "/";
      return;
    }

    const payload: Record<string, string | null> = {
      name: profileForm.name.trim(),
      mobile: profileForm.mobile.trim() || null,
      email: profileForm.email.trim(),
    };

    if (profileForm.password) {
      payload.current_password = profileForm.current_password;
      payload.password = profileForm.password;
      payload.password_confirmation = profileForm.password_confirmation;
    }

    setSavingProfile(true);
    try {
      const response = await fetch(`${API_BASE_URL}/me`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as {
        message?: string;
        user?: AuthUser;
        errors?: Record<string, string[]>;
      };

      if (!response.ok) {
        if (data?.errors) {
          setProfileError(Object.values(data.errors).flat().join(" "));
        } else {
          setProfileError(data?.message ?? "Failed to update profile.");
        }
        return;
      }

      if (data.user) {
        const nextUser: AuthUser = {
          ...data.user,
          role: data.user.role === "admin" ? "admin" : "user",
        };
        setStoredUser(nextUser);
        setAuthUser(nextUser);
      }

      setProfileOpen(false);
      alert(data.message ?? labels.profileUpdated);
    } catch {
      setProfileError("Network error. Please try again.");
    } finally {
      setSavingProfile(false);
    }
  }

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
            {(displayName || displayMeta) && (
              <div className="catv-user-menu" ref={menuRef}>
                <button
                  type="button"
                  className="catv-user-box"
                  onClick={() => setMenuOpen((prev) => !prev)}
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                >
                  <span className="catv-avatar" aria-hidden="true" />
                  <div>
                    <p className="catv-user-name">{displayName}</p>
                    <p className="catv-user-meta">{displayMeta}</p>
                  </div>
                  <span className="catv-user-caret" aria-hidden="true">▾</span>
                </button>

                {menuOpen && (
                  <div className="catv-user-dropdown" role="menu">
                    <button type="button" className="catv-user-dropdown-item" onClick={openProfileModal}>
                      {labels.profile}
                    </button>
                    <button type="button" className="catv-user-dropdown-item danger" onClick={() => void handleLogout()}>
                      {labels.logout}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </header>

        <div className="catv-content">{children}</div>
      </section>

      {profileOpen && (
        <div className="catv-modal-overlay">
          <div className="catv-modal">
            <h3 className="catv-modal-title">{labels.profileTitle}</h3>
            <p className="catv-modal-subtitle">{labels.profileSubtitle}</p>

            <div className="catv-form-grid">
              <label className="catv-field">
                <span>{labels.name}</span>
                <input
                  type="text"
                  value={profileForm.name}
                  onChange={(e) => setProfileForm((prev) => ({ ...prev, name: e.target.value }))}
                />
              </label>

              <label className="catv-field">
                <span>{labels.mobile}</span>
                <input
                  type="text"
                  value={profileForm.mobile}
                  onChange={(e) => setProfileForm((prev) => ({ ...prev, mobile: e.target.value }))}
                />
              </label>

              <label className="catv-field">
                <span>{labels.email}</span>
                <input
                  type="email"
                  value={profileForm.email}
                  onChange={(e) => setProfileForm((prev) => ({ ...prev, email: e.target.value }))}
                />
              </label>

              <label className="catv-field">
                <span>{labels.currentPassword}</span>
                <input
                  type="password"
                  value={profileForm.current_password}
                  onChange={(e) => setProfileForm((prev) => ({ ...prev, current_password: e.target.value }))}
                />
              </label>

              <label className="catv-field">
                <span>{labels.password}</span>
                <input
                  type="password"
                  value={profileForm.password}
                  onChange={(e) => setProfileForm((prev) => ({ ...prev, password: e.target.value }))}
                />
              </label>

              <label className="catv-field">
                <span>{labels.confirmPassword}</span>
                <input
                  type="password"
                  value={profileForm.password_confirmation}
                  onChange={(e) => setProfileForm((prev) => ({ ...prev, password_confirmation: e.target.value }))}
                />
              </label>

              <p className="catv-field-hint">{labels.passwordHint}</p>
            </div>

            {profileError && <p className="catv-form-error">{profileError}</p>}

            <div className="catv-modal-actions">
              <button type="button" className="catv-btn secondary" onClick={() => setProfileOpen(false)} disabled={savingProfile}>
                {labels.cancel}
              </button>
              <button type="button" className="catv-btn primary" onClick={() => void handleProfileSave()} disabled={savingProfile}>
                {savingProfile ? labels.saving : labels.save}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
