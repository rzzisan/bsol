'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import UserShell from '@/components/user-shell';
import { getStoredLocale, type Locale } from '@/lib/dashboard-client';

interface Stats {
  total_visits: number;
  total_unique_visitors: number;
  total_orders: number;
  daily_stats: Array<{
    date: string;
    visits: number;
    unique_visitors: number;
    orders: number;
  }>;
}

interface Visitor {
  id: number;
  ip_address: string;
  country: string;
  city: string;
  referrer: string;
  visited_at: string;
  orders_count: number;
}

interface VisitorResponse {
  total: number;
  limit: number;
  offset: number;
  visitors: Visitor[];
}

interface CountryStats {
  country: string;
  visits: number;
  unique_visitors: number;
}

interface ReferrerStats {
  referrer: string;
  visits: number;
  unique_visitors: number;
}

export default function LandingPageAnalyticsDashboard() {
  const params = useParams();
  const landingPageId = params?.landingPageId as string;

  const [locale, setLocale] = useState<Locale>('bn');
  const [stats, setStats] = useState<Stats | null>(null);
  const [visitors, setVisitors] = useState<VisitorResponse | null>(null);
  const [countryStats, setCountryStats] = useState<CountryStats[]>([]);
  const [referrerStats, setReferrerStats] = useState<ReferrerStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [landingPageTitle, setLandingPageTitle] = useState<string>('');

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [visitorPage, setVisitorPage] = useState(0);

  useEffect(() => {
    setLocale(getStoredLocale());
    const handleStorage = () => setLocale(getStoredLocale());
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  useEffect(() => {
    if (!landingPageId) return;

    const fetchAnalytics = async () => {
      try {
        setLoading(true);
        setError(null);

        // Build query parameters
        const queryParams = new URLSearchParams();
        if (startDate) queryParams.append('start_date', startDate);
        if (endDate) queryParams.append('end_date', endDate);

        const authToken = localStorage.getItem('auth_token');
        if (!authToken) {
          setError('Authentication required. Please log in.');
          setLoading(false);
          return;
        }

        const headers = {
          Authorization: `Bearer ${authToken}`,
        };

        // Fetch landing page details
        const pageRes = await fetch(`/api/landing/pages/${landingPageId}`, { headers });
        if (pageRes.ok) {
          const pageData = await pageRes.json();
          setLandingPageTitle(pageData.data?.title || `Landing Page #${landingPageId}`);
        } else {
          setLandingPageTitle(`Landing Page #${landingPageId}`);
        }

        const [statsRes, visitorsRes, countriesRes, referrersRes] = await Promise.all([
          fetch(
            `/api/landing/analytics/${landingPageId}/statistics?${queryParams}`,
            { headers }
          ),
          fetch(
            `/api/landing/analytics/${landingPageId}/visitors?limit=20&offset=${visitorPage * 20}&${queryParams}`,
            { headers }
          ),
          fetch(
            `/api/landing/analytics/${landingPageId}/by-country?${queryParams}`,
            { headers }
          ),
          fetch(
            `/api/landing/analytics/${landingPageId}/by-referrer?${queryParams}`,
            { headers }
          ),
        ]);

        if (!statsRes.ok || !visitorsRes.ok || !countriesRes.ok || !referrersRes.ok) {
          const errorData = await statsRes.json().catch(() => ({}));
          const errorMsg = errorData.error || errorData.message || `API error: ${statsRes.status}`;
          throw new Error(errorMsg);
        }

        const [statsData, visitorsData, countriesData, referrersData] = await Promise.all([
          statsRes.json(),
          visitorsRes.json(),
          countriesRes.json(),
          referrersRes.json(),
        ]);

        setStats(statsData);
        setVisitors(visitorsData);
        setCountryStats(countriesData);
        setReferrerStats(referrersData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, [landingPageId, startDate, endDate, visitorPage]);

  const handleDateReset = () => {
    setStartDate('');
    setEndDate('');
  };

  if (loading) {
    return (
      <UserShell activeKey="landing-pages" pageTitle={{ bn: 'স্ট্যাটিস্টিক্স লোড হচ্ছে...', en: 'Loading Statistics...' }}>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      </UserShell>
    );
  }

  if (error) {
    return (
      <UserShell activeKey="landing-pages" pageTitle={{ bn: 'স্ট্যাটিস্টিক্স', en: 'Statistics' }}>
        <div className="p-4 bg-red-50 text-red-700 rounded-lg">
          <strong>Error:</strong> {error}
        </div>
      </UserShell>
    );
  }

  return (
    <UserShell
      activeKey="landing-pages"
      pageTitle={{
        bn: `${landingPageTitle} - স্ট্যাটিস্টিক্স`,
        en: `${landingPageTitle} - Statistics`,
      }}
      pageSubtitle={{
        bn: 'ভিজিটর ট্র্যাফিক, রূপান্তর এবং কর্মক্ষমতা মেট্রিক্স দেখুন।',
        en: 'View visitor traffic, conversions, and performance metrics.',
      }}
    >
      <section className="catv-panel p-4 sm:p-5">
        <div className="space-y-6">
          {/* Date Filter */}
          <div className="flex gap-4 items-end flex-wrap">
            <div>
              <label className="block text-sm font-medium mb-1">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setVisitorPage(0);
                }}
                className="px-3 py-2 border rounded-md border-[var(--border)]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setVisitorPage(0);
                }}
                className="px-3 py-2 border rounded-md border-[var(--border)]"
              />
            </div>
            <button
              onClick={handleDateReset}
              className="px-4 py-2 bg-[var(--surface-soft)] hover:bg-[var(--surface)] rounded-md font-medium text-[var(--foreground)]"
            >
              Reset
            </button>
          </div>

          {/* Summary Stats */}
          {stats && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-[var(--surface)] p-6 rounded-lg border border-[var(--border)]">
                <div className="text-[var(--muted)] text-sm font-medium">Total Visits</div>
                <div className="text-4xl font-bold mt-2 text-blue-600">{stats.total_visits}</div>
          </div>
              <div className="bg-[var(--surface)] p-6 rounded-lg border border-[var(--border)]">
                <div className="text-[var(--muted)] text-sm font-medium">Unique Visitors</div>
                <div className="text-4xl font-bold mt-2 text-green-600">{stats.total_unique_visitors}</div>
              </div>
              <div className="bg-[var(--surface)] p-6 rounded-lg border border-[var(--border)]">
                <div className="text-[var(--muted)] text-sm font-medium">Orders Placed</div>
                <div className="text-4xl font-bold mt-2 text-purple-600">{stats.total_orders}</div>
          </div>
        </div>
      )}

          {/* Daily Stats Table */}
          {stats && stats.daily_stats.length > 0 && (
            <div className="bg-[var(--surface)] p-6 rounded-lg border border-[var(--border)] overflow-hidden">
              <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">Daily Statistics</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-[var(--surface-soft)] text-[var(--muted)]">
                    <tr className="border-b border-[var(--border)]">
                      <th className="text-left py-2 px-4 font-medium">Date</th>
                      <th className="text-right py-2 px-4 font-medium">Visits</th>
                      <th className="text-right py-2 px-4 font-medium">Unique Visitors</th>
                      <th className="text-right py-2 px-4 font-medium">Orders</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.daily_stats.map((day, idx) => (
                      <tr key={idx} className="border-b border-[var(--border)] hover:bg-[var(--surface-soft)]">
                    <td className="py-2 px-4">{day.date}</td>
                    <td className="text-right py-2 px-4">{day.visits}</td>
                    <td className="text-right py-2 px-4">{day.unique_visitors}</td>
                    <td className="text-right py-2 px-4 font-semibold text-green-600">{day.orders}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
            </div>
          )}

          {/* Country Stats */}
          {countryStats.length > 0 && (
            <div className="bg-[var(--surface)] p-6 rounded-lg border border-[var(--border)]">
              <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">Visitors by Country</h2>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {countryStats.map((country, idx) => (
                  <div key={idx} className="flex justify-between items-center py-2 px-3 bg-[var(--surface-soft)] rounded hover:bg-[var(--surface-soft)]/80">
                    <span className="font-medium text-[var(--foreground)]">{country.country || 'Unknown'}</span>
                    <span className="text-[var(--muted)] text-sm">
                      {country.visits} visits • {country.unique_visitors} unique
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Referrer Stats */}
          {referrerStats.length > 0 && (
            <div className="bg-[var(--surface)] p-6 rounded-lg border border-[var(--border)]">
              <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">Traffic Sources</h2>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {referrerStats.map((ref, idx) => (
                  <div key={idx} className="flex justify-between items-center py-2 px-3 bg-[var(--surface-soft)] rounded hover:bg-[var(--surface-soft)]/80">
                    <span className="font-medium truncate text-sm text-[var(--foreground)]">{ref.referrer || 'Direct'}</span>
                    <span className="text-[var(--muted)] text-sm">
                      {ref.visits} visits • {ref.unique_visitors} unique
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent Visitors */}
          {visitors && (
            <div className="bg-[var(--surface)] p-6 rounded-lg border border-[var(--border)] overflow-hidden">
              <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">Recent Visitors</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-[var(--surface-soft)] text-[var(--muted)]">
                    <tr className="border-b border-[var(--border)]">
                      <th className="text-left py-2 px-4 font-medium">IP Address</th>
                      <th className="text-left py-2 px-4 font-medium">Location</th>
                      <th className="text-left py-2 px-4 font-medium">Visited At</th>
                      <th className="text-center py-2 px-4 font-medium">Orders</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visitors.visitors.map((visitor, idx) => (
                      <tr key={idx} className="border-b border-[var(--border)] hover:bg-[var(--surface-soft)]">
                        <td className="py-2 px-4 font-mono text-xs text-[var(--muted)]">{visitor.ip_address}</td>
                        <td className="py-2 px-4 text-sm text-[var(--foreground)]">
                          {visitor.city && visitor.country
                            ? `${visitor.city}, ${visitor.country}`
                            : visitor.country || 'Unknown'}
                        </td>
                        <td className="py-2 px-4 text-sm text-[var(--muted)]">
                          {new Date(visitor.visited_at).toLocaleString()}
                        </td>
                        <td className="text-center py-2 px-4">
                          {visitor.orders_count > 0 && (
                            <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-semibold">
                              {visitor.orders_count}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {visitors && visitors.total > 20 && (
                <div className="flex gap-2 mt-4 justify-center">
                  <button
                    onClick={() => setVisitorPage(Math.max(0, visitorPage - 1))}
                    disabled={visitorPage === 0}
                    className="px-3 py-1 border border-[var(--border)] rounded disabled:opacity-50 text-[var(--foreground)] hover:bg-[var(--surface-soft)]"
                  >
                    Previous
                  </button>
                  <span className="py-1 px-2 text-[var(--muted)]">
                    Page {visitorPage + 1} of {Math.ceil(visitors.total / 20)}
                  </span>
                  <button
                    onClick={() =>
                      setVisitorPage(
                        Math.min(Math.ceil(visitors.total / 20) - 1, visitorPage + 1)
                      )
                    }
                    disabled={visitorPage >= Math.ceil(visitors.total / 20) - 1}
                    className="px-3 py-1 border border-[var(--border)] rounded disabled:opacity-50 text-[var(--foreground)] hover:bg-[var(--surface-soft)]"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </UserShell>
  );
}
