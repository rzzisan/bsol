'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';

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

  const [stats, setStats] = useState<Stats | null>(null);
  const [visitors, setVisitors] = useState<VisitorResponse | null>(null);
  const [countryStats, setCountryStats] = useState<CountryStats[]>([]);
  const [referrerStats, setReferrerStats] = useState<ReferrerStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [visitorPage, setVisitorPage] = useState(0);

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

        const [statsRes, visitorsRes, countriesRes, referrersRes] = await Promise.all([
          fetch(
            `/api/landing/analytics/${landingPageId}/statistics?${queryParams}`,
            { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
          ),
          fetch(
            `/api/landing/analytics/${landingPageId}/visitors?limit=20&offset=${visitorPage * 20}&${queryParams}`,
            { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
          ),
          fetch(
            `/api/landing/analytics/${landingPageId}/by-country?${queryParams}`,
            { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
          ),
          fetch(
            `/api/landing/analytics/${landingPageId}/by-referrer?${queryParams}`,
            { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
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
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 text-red-700 rounded-lg">
        <strong>Error:</strong> {error}
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Landing Page Analytics</h1>
      </div>

      {/* Date Filter */}
      <div className="bg-white p-4 rounded-lg shadow">
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
              className="px-3 py-2 border rounded-md"
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
              className="px-3 py-2 border rounded-md"
            />
          </div>
          <button
            onClick={handleDateReset}
            className="px-4 py-2 bg-gray-300 hover:bg-gray-400 rounded-md font-medium"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="text-gray-600 text-sm font-medium">Total Visits</div>
            <div className="text-4xl font-bold mt-2 text-blue-600">{stats.total_visits}</div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="text-gray-600 text-sm font-medium">Unique Visitors</div>
            <div className="text-4xl font-bold mt-2 text-green-600">{stats.total_unique_visitors}</div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="text-gray-600 text-sm font-medium">Orders Placed</div>
            <div className="text-4xl font-bold mt-2 text-purple-600">{stats.total_orders}</div>
          </div>
        </div>
      )}

      {/* Daily Stats Table */}
      {stats && stats.daily_stats.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-bold mb-4">Daily Statistics</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-4">Date</th>
                  <th className="text-right py-2 px-4">Visits</th>
                  <th className="text-right py-2 px-4">Unique Visitors</th>
                  <th className="text-right py-2 px-4">Orders</th>
                </tr>
              </thead>
              <tbody>
                {stats.daily_stats.map((day, idx) => (
                  <tr key={idx} className="border-b hover:bg-gray-50">
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
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-bold mb-4">Visitors by Country</h2>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {countryStats.map((country, idx) => (
              <div key={idx} className="flex justify-between items-center py-2 px-3 bg-gray-50 rounded">
                <span className="font-medium">{country.country || 'Unknown'}</span>
                <span className="text-gray-600 text-sm">
                  {country.visits} visits • {country.unique_visitors} unique
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Referrer Stats */}
      {referrerStats.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-bold mb-4">Traffic Sources</h2>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {referrerStats.map((ref, idx) => (
              <div key={idx} className="flex justify-between items-center py-2 px-3 bg-gray-50 rounded">
                <span className="font-medium truncate text-sm">{ref.referrer || 'Direct'}</span>
                <span className="text-gray-600 text-sm">
                  {ref.visits} visits • {ref.unique_visitors} unique
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Visitors */}
      {visitors && (
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-bold mb-4">Recent Visitors</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-4">IP Address</th>
                  <th className="text-left py-2 px-4">Location</th>
                  <th className="text-left py-2 px-4">Visited At</th>
                  <th className="text-center py-2 px-4">Orders</th>
                </tr>
              </thead>
              <tbody>
                {visitors.visitors.map((visitor, idx) => (
                  <tr key={idx} className="border-b hover:bg-gray-50">
                    <td className="py-2 px-4 font-mono text-xs">{visitor.ip_address}</td>
                    <td className="py-2 px-4 text-sm">
                      {visitor.city && visitor.country
                        ? `${visitor.city}, ${visitor.country}`
                        : visitor.country || 'Unknown'}
                    </td>
                    <td className="py-2 px-4 text-sm">
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
                className="px-3 py-1 border rounded disabled:opacity-50"
              >
                Previous
              </button>
              <span className="py-1 px-2">
                Page {visitorPage + 1} of {Math.ceil(visitors.total / 20)}
              </span>
              <button
                onClick={() =>
                  setVisitorPage(
                    Math.min(Math.ceil(visitors.total / 20) - 1, visitorPage + 1)
                  )
                }
                disabled={visitorPage >= Math.ceil(visitors.total / 20) - 1}
                className="px-3 py-1 border rounded disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
