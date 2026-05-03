"use client";

import { useCallback, useEffect, useState } from "react";
import { getStoredToken } from "@/lib/dashboard-client";

const API = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api").replace(/\/$/, "");

export type LocationItem = { id: number; name: string };

export type LocationState = {
  cities: LocationItem[];
  zones: LocationItem[];
  areas: LocationItem[];
  cityId: number | "";
  zoneId: number | "";
  areaId: number | "";
  areaName: string;
  cityName: string;
  zoneName: string;
  loadingCities: boolean;
  loadingZones: boolean;
  loadingAreas: boolean;
  hasCredentials: boolean;
  setCity: (id: number | "") => void;
  setZone: (id: number | "") => void;
  setArea: (id: number | "") => void;
  // Pre-load for edit (set existing IDs and fetch dependent lists)
  preload: (cityId: number | null, zoneId: number | null, areaId: number | null, areaName?: string | null) => Promise<void>;
};

export function useLocationDropdowns(): LocationState {
  const token = getStoredToken();

  const [cities, setCities] = useState<LocationItem[]>([]);
  const [zones, setZones] = useState<LocationItem[]>([]);
  const [areas, setAreas] = useState<LocationItem[]>([]);
  const [cityId, setCityId] = useState<number | "">("");
  const [zoneId, setZoneId] = useState<number | "">("");
  const [areaId, setAreaId] = useState<number | "">("");
  const [areaName, setAreaName] = useState("");
  const [cityName, setCityName] = useState("");
  const [zoneName, setZoneName] = useState("");
  const [loadingCities, setLoadingCities] = useState(false);
  const [loadingZones, setLoadingZones] = useState(false);
  const [loadingAreas, setLoadingAreas] = useState(false);
  const [hasCredentials, setHasCredentials] = useState(false);

  // Fetch cities on mount
  useEffect(() => {
    setLoadingCities(true);
    fetch(`${API}/courier/locations/cities`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.success) {
          setCities(d.data ?? []);
          setHasCredentials(d.has_credentials ?? false);
        }
      })
      .finally(() => setLoadingCities(false));
  }, [token]);

  const fetchZones = useCallback(async (cId: number) => {
    setLoadingZones(true);
    setZones([]);
    setAreas([]);
    setZoneId("");
    setAreaId("");
    setAreaName("");
    setZoneName("");
    try {
      const r = await fetch(`${API}/courier/locations/zones/${cId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) {
        const d = await r.json();
        setZones(d.data ?? []);
      }
    } finally {
      setLoadingZones(false);
    }
  }, [token]);

  const fetchAreas = useCallback(async (zId: number) => {
    setLoadingAreas(true);
    setAreas([]);
    setAreaId("");
    setAreaName("");
    try {
      const r = await fetch(`${API}/courier/locations/areas/${zId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) {
        const d = await r.json();
        setAreas(d.data ?? []);
      }
    } finally {
      setLoadingAreas(false);
    }
  }, [token]);

  const setCity = useCallback((id: number | "") => {
    setCityId(id);
    const city = cities.find(c => c.id === id);
    setCityName(city?.name ?? "");
    if (id) fetchZones(id as number);
    else {
      setZones([]); setAreas([]);
      setZoneId(""); setAreaId("");
      setAreaName(""); setZoneName("");
    }
  }, [cities, fetchZones]);

  const setZone = useCallback((id: number | "") => {
    setZoneId(id);
    const zone = zones.find(z => z.id === id);
    setZoneName(zone?.name ?? "");
    if (id) fetchAreas(id as number);
    else {
      setAreas([]); setAreaId(""); setAreaName("");
    }
  }, [zones, fetchAreas]);

  const setArea = useCallback((id: number | "") => {
    setAreaId(id);
    const area = areas.find(a => a.id === id);
    setAreaName(area?.name ?? "");
  }, [areas]);

  // Pre-load for editing: set existing IDs and cascade-fetch dependent lists
  const preload = useCallback(async (
    pCityId: number | null,
    pZoneId: number | null,
    pAreaId: number | null,
    pAreaName?: string | null,
  ) => {
    if (!pCityId) return;
    setCityId(pCityId);

    // Fetch zones for this city
    setLoadingZones(true);
    try {
      const r = await fetch(`${API}/courier/locations/zones/${pCityId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) {
        const d = await r.json();
        const zList: LocationItem[] = d.data ?? [];
        setZones(zList);
        const cName = cities.find(c => c.id === pCityId)?.name ?? "";
        setCityName(cName);

        if (pZoneId) {
          setZoneId(pZoneId);
          const zName = zList.find(z => z.id === pZoneId)?.name ?? "";
          setZoneName(zName);

          // Fetch areas for this zone
          setLoadingAreas(true);
          try {
            const r2 = await fetch(`${API}/courier/locations/areas/${pZoneId}`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (r2.ok) {
              const d2 = await r2.json();
              const aList: LocationItem[] = d2.data ?? [];
              setAreas(aList);
              if (pAreaId) {
                setAreaId(pAreaId);
                setAreaName(pAreaName ?? aList.find(a => a.id === pAreaId)?.name ?? "");
              }
            }
          } finally {
            setLoadingAreas(false);
          }
        }
      }
    } finally {
      setLoadingZones(false);
    }
  }, [token, cities]);

  return {
    cities, zones, areas,
    cityId, zoneId, areaId,
    areaName, cityName, zoneName,
    loadingCities, loadingZones, loadingAreas,
    hasCredentials,
    setCity, setZone, setArea, preload,
  };
}
