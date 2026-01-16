# PragatiGIS Platform Design Guidelines

## Design Approach
**Reference-Based Approach** - Drawing inspiration from modern data platforms like Notion (clean layouts), Linear (sophisticated data visualization), and government portals for professional credibility. This platform requires a balance of analytical functionality with institutional trust.

## Core Design Elements

### Color Palette
- **Primary**: 47 69% 41% (Forest green reflecting environmental focus)
- **Secondary**: 220 25% 25% (Professional dark gray)
- **Light mode backgrounds**: 0 0% 98% (Off-white), 220 13% 91% (Light gray)
- **Dark mode backgrounds**: 220 13% 9% (Deep charcoal), 220 9% 15% (Elevated surfaces)
- **Accent**: 200 100% 70% (Bright blue for data highlights and CTAs)
- **Success**: 142 71% 45% (Green for approved claims)
- **Warning**: 38 92% 50% (Orange for pending status)

### Typography
- **Primary**: Inter (Google Fonts) - Clean, readable for data-heavy interfaces
- **Headings**: Inter weights 600-700
- **Body**: Inter weights 400-500
- **Monospace**: JetBrains Mono for technical data/coordinates

### Layout System
**Tailwind spacing primitives**: 2, 4, 6, 8, 12, 16
- Cards: p-6, gap-4
- Sections: py-12, px-8
- Component spacing: gap-2, gap-4, gap-6

### Component Library

#### Navigation & Layout
- **Sidebar Navigation**: Fixed left sidebar with collapsible menu, forest green accent
- **Top Bar**: Breadcrumbs, user profile, notification bell
- **Dashboard Grid**: 12-column responsive grid for analytics cards

#### Data Components
- **Claims Table**: Striped rows, sortable headers, status badges
- **Interactive Maps**: Full-width Leaflet integration with custom markers
- **Document Viewer**: Split-pane layout with thumbnail navigation
- **Upload Interface**: Drag-and-drop zones with progress indicators

#### Forms & Controls
- **Filters Panel**: Collapsible sidebar with date ranges, status dropdowns
- **Search**: Prominent search bar with autocomplete suggestions
- **File Upload**: Large drop zones with file type indicators

#### Data Visualization
- **Analytics Cards**: Clean metric displays with trend indicators
- **Charts**: Recharts integration with forest green/blue color scheme
- **Status Indicators**: Color-coded badges for claim statuses

## Visual Treatment
- **Professional Government Aesthetic**: Clean, trustworthy design suitable for institutional use
- **Subtle Gradients**: Gentle gradients on hero sections and key CTAs (forest green to darker green)
- **Card-Based Layout**: Elevated surfaces with subtle shadows for content organization
- **Generous Whitespace**: Breathing room around complex data displays

## Images
**No large hero images** - This is a data-focused application. Use:
- **Document thumbnails** in upload areas and file managers
- **Small profile avatars** in user areas
- **Government logos/seals** in headers for institutional credibility
- **Map satellite imagery** as base layers in geospatial views

## Key Design Principles
1. **Data Clarity**: Information hierarchy that makes complex geospatial data accessible
2. **Institutional Trust**: Professional appearance suitable for government/NGO use
3. **Responsive Functionality**: Mobile-first approach for field workers
4. **Accessibility**: High contrast ratios, clear navigation for diverse user base