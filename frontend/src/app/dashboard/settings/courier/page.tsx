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
    createStoreTitle: "Pathao Store তৈরি করুন",
    createStoreBtn: "Store তৈরি করুন",
    creatingStore: "তৈরি হচ্ছে...",
    storeName: "Store নাম",
    contactName: "Contact Person",
    contactNumber: "প্রধান মোবাইল",
    secondaryContact: "বিকল্প মোবাইল (ঐচ্ছিক)",
    storeAddress: "Store ঠিকানা",
    city: "City",
    zone: "Zone",
    area: "Area",
    selectCity: "City নির্বাচন করুন",
    selectZone: "Zone নির্বাচন করুন",
    selectArea: "Area নির্বাচন করুন",
    storesList: "আপনার Pathao Stores",
    refreshStores: "Refresh Stores",
    noStores: "কোনো store পাওয়া যায়নি।",
    storeCreateSuccess: "Store তৈরি হয়েছে। Pathao approval পেতে কিছু সময় লাগতে পারে।",
    storeCreateFailed: "Store তৈরি ব্যর্থ হয়েছে।",
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
    createStoreTitle: "Create Pathao Store",
    createStoreBtn: "Create Store",
    creatingStore: "Creating...",
    storeName: "Store Name",
    contactName: "Contact Person",
    contactNumber: "Primary Phone",
    secondaryContact: "Secondary Phone (optional)",
    storeAddress: "Store Address",
    city: "City",
    zone: "Zone",
    area: "Area",
    selectCity: "Select city",
    selectZone: "Select zone",
    selectArea: "Select area",
    storesList: "Your Pathao Stores",
    refreshStores: "Refresh Stores",
    noStores: "No store found.",
    storeCreateSuccess: "Store created. Pathao approval may take some time.",
    storeCreateFailed: "Failed to create store.",
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

type PathaoStore = {
  store_id: number;
  store_name: string;
  store_address: string;
  is_active: number;
  city_id?: number;
  zone_id?: number;
};

type PathaoLocation = { id: number; name: string };

type CreateStoreForm = {
  name: string;
  contact_name: string;
  contact_number: string;
  secondary_contact: string;
  address: string;
  city_id: string;
  zone_id: string;
  area_id: string;
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
  const [stores, setStores] = useState<PathaoStore[]>([]);
  const [loadingStores, setLoadingStores] = useState(false);
  const [creatingStore, setCreatingStore] = useState(false);
  const [cities, setCities] = useState<PathaoLocation[]>([]);
  const [zones, setZones] = useState<PathaoLocation[]>([]);
  const [areas, setAreas] = useState<PathaoLocation[]>([]);
  const [locationLoading, setLocationLoading] = useState({ cities: false, zones: false, areas: false });
  const [storeForm, setStoreForm] = useState<CreateStoreForm>({
    name: "",
    contact_name: "",
    contact_number: "",
    secondary_contact: "",
    address: "",
    city_id: "",
    zone_id: "",
    area_id: "",
  });

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

  const fetchPathaoStores = async () => {
    setLoadingStores(true);
    try {
      const res = await fetch(`${API}/courier/pathao/stores`, { headers: { Authorization: `Bearer ${token}` } });
      const d = await res.json();
      if (res.ok && d.success) {
        setStores(d.data ?? []);
      }
    } finally {
      setLoadingStores(false);
    }
  };

  const fetchCities = async () => {
    setLocationLoading(prev => ({ ...prev, cities: true }));
    try {
      const res = await fetch(`${API}/courier/locations/cities`, { headers: { Authorization: `Bearer ${token}` } });
      const d = await res.json();
      if (res.ok) {
        setCities((d.data ?? []).map((c: { id?: number; city_id?: number; name?: string; city_name?: string }) => ({ id: c.id ?? c.city_id ?? 0, name: c.name ?? c.city_name ?? "" })).filter((x: PathaoLocation) => x.id > 0 && x.name));
      }
    } finally {
      setLocationLoading(prev => ({ ...prev, cities: false }));
    }
  };

  const fetchZones = async (cityId: string) => {
    if (!cityId) return;
    setLocationLoading(prev => ({ ...prev, zones: true }));
    try {
      const res = await fetch(`${API}/courier/locations/zones/${cityId}`, { headers: { Authorization: `Bearer ${token}` } });
      const d = await res.json();
      if (res.ok) {
        setZones((d.data ?? []).map((z: { id?: number; zone_id?: number; name?: string; zone_name?: string }) => ({ id: z.id ?? z.zone_id ?? 0, name: z.name ?? z.zone_name ?? "" })).filter((x: PathaoLocation) => x.id > 0 && x.name));
      }
    } finally {
      setLocationLoading(prev => ({ ...prev, zones: false }));
    }
  };

  const fetchAreas = async (zoneId: string) => {
    if (!zoneId) return;
    setLocationLoading(prev => ({ ...prev, areas: true }));
    try {
      const res = await fetch(`${API}/courier/locations/areas/${zoneId}`, { headers: { Authorization: `Bearer ${token}` } });
      const d = await res.json();
      if (res.ok) {
        setAreas((d.data ?? []).map((a: { id?: number; area_id?: number; name?: string; area_name?: string }) => ({ id: a.id ?? a.area_id ?? 0, name: a.name ?? a.area_name ?? "" })).filter((x: PathaoLocation) => x.id > 0 && x.name));
      }
    } finally {
      setLocationLoading(prev => ({ ...prev, areas: false }));
    }
  };

  useEffect(() => {
    if (!loading) {
      void fetchPathaoStores();
      void fetchCities();
    }
  }, [loading]);

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

  const handleCreateStore = async () => {
    setCreatingStore(true);
    setMessage(null);
    try {
      const payload = {
        name: storeForm.name.trim(),
        contact_name: storeForm.contact_name.trim(),
        contact_number: storeForm.contact_number.trim(),
        secondary_contact: storeForm.secondary_contact.trim() || undefined,
        address: storeForm.address.trim(),
        city_id: Number(storeForm.city_id),
        zone_id: Number(storeForm.zone_id),
        area_id: Number(storeForm.area_id),
      };

      const res = await fetch(`${API}/courier/pathao/stores`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const d = await res.json();
      if (res.ok && d.success) {
        setMessage({ type: "success", text: d.message ?? txt.storeCreateSuccess });
        setStoreForm({ name: "", contact_name: "", contact_number: "", secondary_contact: "", address: "", city_id: "", zone_id: "", area_id: "" });
        setZones([]);
        setAreas([]);
        void fetchPathaoStores();
      } else {
        setMessage({ type: "error", text: d.message ?? txt.storeCreateFailed });
      }
    } finally {
      setCreatingStore(false);
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

          {/* Create Pathao Store */}
          <div className="catv-panel p-4">
            <h3 className="mb-3 text-sm font-semibold">{txt.createStoreTitle}</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <label>
                <span className="mb-1 block text-xs text-[var(--muted)]">{txt.storeName}</span>
                <input value={storeForm.name} onChange={e => setStoreForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm" />
              </label>
              <label>
                <span className="mb-1 block text-xs text-[var(--muted)]">{txt.contactName}</span>
                <input value={storeForm.contact_name} onChange={e => setStoreForm(f => ({ ...f, contact_name: e.target.value }))}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm" />
              </label>
              <label>
                <span className="mb-1 block text-xs text-[var(--muted)]">{txt.contactNumber}</span>
                <input value={storeForm.contact_number} onChange={e => setStoreForm(f => ({ ...f, contact_number: e.target.value }))}
                  placeholder="01XXXXXXXXX"
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm" />
              </label>
              <label>
                <span className="mb-1 block text-xs text-[var(--muted)]">{txt.secondaryContact}</span>
                <input value={storeForm.secondary_contact} onChange={e => setStoreForm(f => ({ ...f, secondary_contact: e.target.value }))}
                  placeholder="01XXXXXXXXX"
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm" />
              </label>
              <label className="sm:col-span-2">
                <span className="mb-1 block text-xs text-[var(--muted)]">{txt.storeAddress}</span>
                <textarea value={storeForm.address} onChange={e => setStoreForm(f => ({ ...f, address: e.target.value }))}
                  rows={2}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm resize-none" />
              </label>

              <label>
                <span className="mb-1 block text-xs text-[var(--muted)]">{txt.city}</span>
                <select value={storeForm.city_id} onChange={e => {
                  const val = e.target.value;
                  setStoreForm(f => ({ ...f, city_id: val, zone_id: "", area_id: "" }));
                  setZones([]);
                  setAreas([]);
                  if (val) void fetchZones(val);
                }}
                  disabled={locationLoading.cities}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm disabled:opacity-50">
                  <option value="">{txt.selectCity}</option>
                  {cities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>

              <label>
                <span className="mb-1 block text-xs text-[var(--muted)]">{txt.zone}</span>
                <select value={storeForm.zone_id} onChange={e => {
                  const val = e.target.value;
                  setStoreForm(f => ({ ...f, zone_id: val, area_id: "" }));
                  setAreas([]);
                  if (val) void fetchAreas(val);
                }}
                  disabled={!storeForm.city_id || locationLoading.zones}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm disabled:opacity-50">
                  <option value="">{txt.selectZone}</option>
                  {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
                </select>
              </label>

              <label className="sm:col-span-2">
                <span className="mb-1 block text-xs text-[var(--muted)]">{txt.area}</span>
                <select value={storeForm.area_id} onChange={e => setStoreForm(f => ({ ...f, area_id: e.target.value }))}
                  disabled={!storeForm.zone_id || locationLoading.areas}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm disabled:opacity-50">
                  <option value="">{txt.selectArea}</option>
                  {areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </label>
            </div>

            <div className="mt-4 flex justify-end">
              <button onClick={() => void handleCreateStore()} disabled={creatingStore || !storeForm.city_id || !storeForm.zone_id || !storeForm.area_id}
                className="rounded-xl bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
                {creatingStore ? txt.creatingStore : txt.createStoreBtn}
              </button>
            </div>

            <div className="mt-5 border-t border-[var(--border)] pt-4">
              <div className="mb-2 flex items-center justify-between">
                <h4 className="text-sm font-semibold">{txt.storesList}</h4>
                <button onClick={() => void fetchPathaoStores()} disabled={loadingStores}
                  className="rounded-lg border border-[var(--border)] px-3 py-1 text-xs hover:bg-[var(--surface-soft)] disabled:opacity-60">
                  {txt.refreshStores}
                </button>
              </div>
              {loadingStores ? (
                <p className="text-xs text-[var(--muted)]">{txt.loading}</p>
              ) : stores.length === 0 ? (
                <p className="text-xs text-[var(--muted)]">{txt.noStores}</p>
              ) : (
                <div className="grid gap-2">
                  {stores.map(s => (
                    <div key={s.store_id} className="rounded-xl border border-[var(--border)] px-3 py-2">
                      <p className="text-sm font-medium">{s.store_name} <span className="text-xs text-[var(--muted)]">#{s.store_id}</span></p>
                      <p className="text-xs text-[var(--muted)]">{s.store_address}</p>
                    </div>
                  ))}
                </div>
              )}
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
