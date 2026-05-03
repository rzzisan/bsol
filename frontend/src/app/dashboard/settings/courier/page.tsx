"use client";

import { useEffect, useMemo, useState } from "react";
import UserShell from "@/components/user-shell";
import { getStoredLocale, getStoredToken, type Locale } from "@/lib/dashboard-client";

const API = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api").replace(/\/$/, "");

const t = {
  bn: {
    pageTitle: "কুরিয়ার সেটিং",
    save: "সেভ করুন",
    saving: "সেভ হচ্ছে...",
    test: "কানেকশন টেস্ট",
    testing: "চেক হচ্ছে...",
    loading: "লোড হচ্ছে...",
    defaultCourier: "ডিফল্ট কুরিয়ার",
    steadfastTitle: "Steadfast API",
    steadfastApiKey: "API Key",
    steadfastSecretKey: "Secret Key",
    pathaoTitle: "Pathao API",
    pathaoClientId: "Client ID",
    pathaoClientSecret: "Client Secret",
    pathaoStoreId: "Store ID",
    pathaoUsername: "লগইন ইমেইল (Pathao Merchant)",
    pathaoPassword: "লগইন পাসওয়ার্ড (Pathao Merchant)",
    testPathao: "Pathao টেস্ট",
    testingPathao: "চেক হচ্ছে...",
    testPathaoSuccess: "Pathao কানেকশন সফল।",
    testPathaoError: "Pathao কানেকশন ব্যর্থ।",
    redxTitle: "RedX API",
    redxApiKey: "API Key",
    saveSuccess: "সেটিং সেভ হয়েছে!",
    saveError: "সেভ ব্যর্থ হয়েছে।",
    testSuccess: "Steadfast কানেকশন সফল।",
    testError: "কানেকশন ব্যর্থ।",
    none: "নির্বাচন করুন",
  },
  en: {
    pageTitle: "Courier Settings",
    save: "Save",
    saving: "Saving...",
    test: "Test Connection",
    testing: "Testing...",
    loading: "Loading...",
    defaultCourier: "Default Courier",
    steadfastTitle: "Steadfast API",
    steadfastApiKey: "API Key",
    steadfastSecretKey: "Secret Key",
    pathaoTitle: "Pathao API",
    pathaoClientId: "Client ID",
    pathaoClientSecret: "Client Secret",
    pathaoStoreId: "Store ID",
    pathaoUsername: "Login Email (Pathao Merchant)",
    pathaoPassword: "Login Password (Pathao Merchant)",
    testPathao: "Test Pathao",
    testingPathao: "Testing...",
    testPathaoSuccess: "Pathao connection successful.",
    testPathaoError: "Pathao connection failed.",
    redxTitle: "RedX API",
    redxApiKey: "API Key",
    saveSuccess: "Settings saved!",
    saveError: "Failed to save.",
    testSuccess: "Steadfast connection successful.",
    testError: "Connection failed.",
    none: "Select",
  },
};

type Form = {
  default_courier: string;
  steadfast_api_key: string; steadfast_secret_key: string;
  pathao_client_id: string; pathao_client_secret: string; pathao_store_id: string;
  pathao_username: string; pathao_password: string;
  redx_api_key: string;
};

const EMPTY_FORM: Form = {
  default_courier: "", steadfast_api_key: "", steadfast_secret_key: "",
  pathao_client_id: "", pathao_client_secret: "", pathao_store_id: "",
  pathao_username: "", pathao_password: "", redx_api_key: "",
};

export default function CourierSettingsPage() {
  const [locale] = useState<Locale>(getStoredLocale);
  const txt = useMemo(() => t[locale], [locale]);
  const token = getStoredToken();

  const [form, setForm] = useState<Form>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testingPathao, setTestingPathao] = useState(false);
  const [message, setMessage] = useState<{ type: "success"|"error"; text: string } | null>(null);

  const set = (field: keyof Form, value: string) => setForm(f => ({ ...f, [field]: value }));

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API}/courier/settings`, { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) {
          const d = await res.json();
          if (d.data) setForm({ ...EMPTY_FORM, ...d.data });
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const handleSave = async () => {
    setSaving(true); setMessage(null);
    try {
      const res = await fetch(`${API}/courier/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      const d = await res.json();
      if (res.ok) {
        setMessage({ type: "success", text: txt.saveSuccess });
        if (d.data) setForm({ ...EMPTY_FORM, ...d.data });
      } else {
        setMessage({ type: "error", text: d.message ?? txt.saveError });
      }
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true); setMessage(null);
    try {
      const res = await fetch(`${API}/courier/settings/test`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await res.json();
      if (res.ok && d.success) {
        const balance = d.data?.current_balance !== undefined ? ` (Balance: ৳${d.data.current_balance})` : "";
        setMessage({ type: "success", text: txt.testSuccess + balance });
      } else {
        setMessage({ type: "error", text: d.message ?? txt.testError });
      }
    } finally {
      setTesting(false);
    }
  };

  const handleTestPathao = async () => {
    setTestingPathao(true); setMessage(null);
    try {
      const res = await fetch(`${API}/courier/settings/test-pathao`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await res.json();
      if (res.ok && d.success) {
        const storeInfo = d.data?.store_count !== undefined ? ` (${d.data.store_count} store(s) found)` : "";
        setMessage({ type: "success", text: txt.testPathaoSuccess + storeInfo });
      } else {
        setMessage({ type: "error", text: d.message ?? txt.testPathaoError });
      }
    } finally {
      setTestingPathao(false);
    }
  };

  return (
    <UserShell activeKey="settings-courier" defaultExpandedKey="settings"
      pageTitle={{ bn: t.bn.pageTitle, en: t.en.pageTitle }}>

      {loading ? (
        <div className="catv-panel p-8 text-center text-[var(--muted)]">{txt.loading}</div>
      ) : (
        <div className="grid gap-4 max-w-xl">

          {message && (
            <div className={`rounded-xl px-4 py-2.5 text-sm ${message.type === "success" ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}>
              {message.text}
            </div>
          )}

          {/* Default courier */}
          <div className="catv-panel p-4">
            <h3 className="mb-3 text-sm font-semibold">{txt.defaultCourier}</h3>
            <select value={form.default_courier} onChange={e => set("default_courier", e.target.value)}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm">
              <option value="">{txt.none}</option>
              <option value="steadfast">Steadfast</option>
              <option value="pathao">Pathao</option>
              <option value="redx">RedX</option>
              <option value="manual">Manual</option>
            </select>
          </div>

          {/* Steadfast */}
          <div className="catv-panel p-4">
            <h3 className="mb-3 text-sm font-semibold">{txt.steadfastTitle}</h3>
            <div className="grid gap-3">
              <label>
                <span className="mb-1 block text-xs text-[var(--muted)]">{txt.steadfastApiKey}</span>
                <input value={form.steadfast_api_key} onChange={e => set("steadfast_api_key", e.target.value)}
                  placeholder="API Key"
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm font-mono outline-none focus:border-[var(--accent)]" />
              </label>
              <label>
                <span className="mb-1 block text-xs text-[var(--muted)]">{txt.steadfastSecretKey}</span>
                <input type="password" value={form.steadfast_secret_key} onChange={e => set("steadfast_secret_key", e.target.value)}
                  placeholder="Secret Key"
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm font-mono outline-none focus:border-[var(--accent)]" />
              </label>
            </div>
          </div>

          {/* Pathao */}
          <div className="catv-panel p-4">
            <h3 className="mb-3 text-sm font-semibold">{txt.pathaoTitle}</h3>
            <div className="grid gap-3">
              {(["pathao_client_id", "pathao_client_secret", "pathao_store_id"] as const).map((field) => (
                <label key={field}>
                  <span className="mb-1 block text-xs text-[var(--muted)]">
                    {field === "pathao_client_id" ? txt.pathaoClientId : field === "pathao_client_secret" ? txt.pathaoClientSecret : txt.pathaoStoreId}
                  </span>
                  <input value={form[field]} onChange={e => set(field, e.target.value)}
                    type={field === "pathao_client_secret" ? "password" : "text"}
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm font-mono outline-none focus:border-[var(--accent)]" />
                </label>
              ))}
              <label>
                <span className="mb-1 block text-xs text-[var(--muted)]">{txt.pathaoUsername}</span>
                <input value={form.pathao_username} onChange={e => set("pathao_username", e.target.value)}
                  type="email" placeholder="merchant@email.com"
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" />
              </label>
              <label>
                <span className="mb-1 block text-xs text-[var(--muted)]">{txt.pathaoPassword}</span>
                <input value={form.pathao_password} onChange={e => set("pathao_password", e.target.value)}
                  type="password"
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" />
              </label>
            </div>
          </div>

          {/* RedX */}
          <div className="catv-panel p-4">
            <h3 className="mb-3 text-sm font-semibold">{txt.redxTitle}</h3>
            <label>
              <span className="mb-1 block text-xs text-[var(--muted)]">{txt.redxApiKey}</span>
              <input value={form.redx_api_key} onChange={e => set("redx_api_key", e.target.value)}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm font-mono outline-none focus:border-[var(--accent)]" />
            </label>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-3">
            <button onClick={() => void handleSave()} disabled={saving}
              className="rounded-xl bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
              {saving ? txt.saving : txt.save}
            </button>
            <button onClick={() => void handleTest()} disabled={testing}
              className="rounded-xl border border-[var(--border)] px-5 py-2.5 text-sm hover:bg-[var(--surface-soft)] disabled:opacity-60">
              {testing ? txt.testing : txt.test}
            </button>
            <button onClick={() => void handleTestPathao()} disabled={testingPathao}
              className="rounded-xl border border-[var(--border)] px-5 py-2.5 text-sm hover:bg-[var(--surface-soft)] disabled:opacity-60">
              {testingPathao ? txt.testingPathao : txt.testPathao}
            </button>
          </div>

        </div>
      )}
    </UserShell>
  );
}
