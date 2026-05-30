# Landing Page Analytics - Quick Start Guide

## 📊 What's New

Your landing pages now have comprehensive analytics tracking! Every visitor is automatically tracked with detailed information including location, traffic source, device, and more.

## 🚀 Getting Started

### 1. Analytics are Already Tracking
Once deployed, analytics automatically start tracking every visitor to your landing pages:
- ✅ IP address and location (country, city)
- ✅ Traffic source (where visitors came from)
- ✅ Device information
- ✅ Session tracking
- ✅ Order conversions

**No setup needed** - it works automatically!

### 2. View Your Analytics Dashboard

Navigate to your admin panel and find the "Analytics" link next to each landing page.

**URL pattern**: `https://yoursite.com/admin/landing-page-analytics/[landingPageId]`

### 3. Dashboard Features

#### Summary Cards
- **Total Visits** - All visits to your landing page
- **Unique Visitors** - Count of unique IP addresses
- **Orders Placed** - Conversions from landing page visitors

#### Filters
- **Date Range** - Filter analytics by start and end dates
- **Reset** - Clear all filters to see all-time stats

#### Data Visualizations
- **Daily Statistics** - Visits, unique visitors, and orders by date
- **Visitors by Country** - Geographic breakdown of your audience
- **Traffic Sources** - Where your visitors are coming from
- **Recent Visitors** - Latest 20 visitors with detailed info including:
  - IP address
  - Country & city
  - Visit time
  - Orders from this visitor

#### Pagination
- View up to 20 recent visitors per page
- Navigate through visitor records with Previous/Next buttons

## 📈 Key Metrics Explained

### Total Visits
Every page view counts as a visit. Refreshing the page, navigating away and back, and multiple visits from the same person all count.

### Unique Visitors
Number of distinct IP addresses that visited. Use this to understand reach - how many different people viewed your landing page.

### Orders Placed
Orders attributed to this landing page. Automatically tracked when a visitor places an order within the same session.

### Conversion Rate
Calculate manually: `(Orders Placed / Unique Visitors) × 100%`

Example: If you had 200 unique visitors and 10 orders, your conversion rate is 5%.

## 🌍 Geographic Insights

### Countries
See which countries your visitors are from. This helps with:
- Targeting marketing efforts
- Understanding audience location
- Planning multilingual content

### Cities
City-level data (when available) shows exactly where in a country your visitors are based.

## 📍 Traffic Sources (Referrers)

### What's Tracked
- Google search results
- Facebook, Twitter, and other social media
- Direct visits (no referrer)
- Email and messenger links
- Custom traffic sources

### Why It Matters
Understanding traffic sources helps you:
- Optimize marketing channels
- Focus budget on high-performing sources
- Find untapped opportunities

## 🔒 Privacy & Security

### Data Collected
- IP address (used for geolocation, then can be anonymized)
- Referrer URL (where the visitor came from)
- Browser/device info (User-Agent string)
- Session identifier
- User ID (if logged in)

### Data NOT Collected
- Personally identifiable information (names, emails, phone numbers) - except if user is logged in
- Passwords or sensitive data
- Click-by-click user behavior

### Data Retention
- Individual visit records are kept for analysis
- Old records (90+ days) can be archived
- Consider GDPR/privacy compliance for your jurisdiction

## 🛠️ Advanced Features

### Date Range Filtering
Use date filters to:
- Analyze campaign performance over specific periods
- Compare performance week-over-week
- Identify seasonal trends

### Pagination
- Default view shows 20 recent visitors
- Click Previous/Next to browse older visitors
- Use with date filters for targeted analysis

### Conversion Tracking
Orders from landing page visitors are automatically linked:
- If a visitor places an order, it appears in the "Orders" column
- Green badge shows number of orders from that visitor

## 📋 Common Questions

**Q: Why don't my analytics show up immediately?**  
A: There's usually a slight delay as data processes. Typically appears within a few seconds to 1 minute.

**Q: Can I delete or modify past analytics?**  
A: Analytics are append-only for data integrity. Contact support if you need to adjust data.

**Q: How far back does data go?**  
A: All historical data since analytics was enabled is retained (subject to your data retention policy).

**Q: Will this slow down my landing page?**  
A: No - analytics tracking runs asynchronously and doesn't impact page load time.

**Q: Can I export this data?**  
A: Currently supports viewing in the dashboard. Export feature coming soon.

**Q: What if I see "Local" as the country?**  
A: This means the visitor accessed from a local development environment or localhost.

## 🚨 Troubleshooting

### No Visitors Showing Up
1. Verify the landing page is published
2. Check that you're accessing the landing page via the public URL
3. Try refreshing the page and checking analytics again (1-2 minute delay)
4. Check that the landing page slug is correct

### Location Shows "Unknown"
- Some visitors may have IP addresses that can't be geolocation-ed
- VPN users may show different locations
- IP lookup service might be temporarily unavailable

### Orders Count is Wrong
- Orders are only counted if placed in the same session as the landing page visit
- If visitor leaves and returns later, they won't be counted as a conversion
- Manual linking is available for edge cases

## 📞 Support

For issues or questions:
1. Check the [complete documentation](./ANALYTICS_FEATURE.md)
2. Review your error logs
3. Contact support with your landing page ID and date of issue

## 🔮 Coming Soon

Planned enhancements:
- Email reports (daily/weekly digests)
- Bot filtering (exclude crawlers)
- Real-time live visitor counter
- Heatmaps and click tracking
- Custom goals and funnels
- CSV/Excel export
- Advanced UTM parameter tracking

---

**Happy analyzing! 📊** Track your landing page performance and optimize your sales funnel with comprehensive visitor insights.
