# Overview

The FRA Atlas Platform is a comprehensive Forest Rights Act (FRA) document management system designed to digitize and process FRA claims across India. The platform serves multiple user types (Ministry, State, District, Village administrators) and provides OCR processing for multi-language documents, geospatial visualization, analytics dashboards, and decision support tools. The system targets key states including Madhya Pradesh, Odisha, Telangana, and Tripura, with support for local languages (Hindi, Odia, Telugu, Bengali, Gujarati, and English).

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture

The client-side application is built using **React 18** with **TypeScript** and **Vite** as the build tool. The architecture follows a component-based approach with:

- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack React Query for server state and API data fetching
- **UI Framework**: Custom component library built on Radix UI primitives with Tailwind CSS for styling
- **Design System**: Shadcn/ui components with a forest green/professional theme reflecting environmental focus
- **Responsive Design**: Mobile-first approach with collapsible sidebar navigation

Key architectural decisions:
- **Problem**: Need for consistent, accessible UI components across complex data interfaces
- **Solution**: Radix UI primitives with custom styling provide accessibility and consistency
- **Rationale**: Government applications require WCAG compliance and professional appearance

## Backend Architecture

The server follows a **unified Node.js/Express** architecture with TypeScript (consolidated from dual Flask/Express backends):

- **Server Framework**: Express.js with custom middleware for authentication and error handling
- **Database ORM**: Drizzle ORM for type-safe database operations
- **Session Management**: Cookie-based sessions with secure token storage
- **Authentication**: Role-based access control with bcrypt password hashing
- **File Storage**: Direct database storage for document files with OCR processing
- **API Consolidation**: Single /api/claims endpoint with aggregated state/district statistics

Key architectural decisions:
- **Problem**: Dual Flask/Express backends created complexity and redundancy
- **Solution**: Consolidated into single Express backend with unified API endpoints
- **Rationale**: Simplified architecture reduces maintenance overhead while preserving all functionality

## Data Storage Solutions

**Primary Database**: SQLite with unified schema (consolidated from dual backend architecture)

Unified database schema includes:
- **User Management**: Multi-tenant user system with role-based permissions (ministry, state, district, village)
- **Claims Processing**: Comprehensive FRA claim tracking with status management and aggregated analytics
- **Document Management**: File metadata, binary content storage, and OCR processing status tracking
- **Workflow Management**: Data processing pipeline with step tracking and transitions
- **Geospatial Data**: JSON coordinate storage for mapping forest areas and claim boundaries
- **Audit Logging**: Complete audit trail for compliance and monitoring

Key architectural decisions:
- **Problem**: Need unified schema supporting both Flask and Express data models
- **Solution**: SQLite schema with Drizzle ORM provides type safety and includes workflow tables
- **Rationale**: Single database eliminates data synchronization issues and supports government compliance requirements

## Authentication and Authorization

**Multi-tier Role System**:
- **Ministry Admin**: Full system access across all states
- **State Admin**: Access limited to specific state data
- **District Officer**: District-level access only
- **Village Officer**: Village-level access only

**Security Implementation**:
- Secure session management with HTTP-only cookies
- Password hashing with bcrypt
- Role-based middleware for API endpoint protection
- Session expiration and cleanup

## Component Architecture

**Reusable Component Library**:
- **Data Visualization**: Chart components using Recharts with consistent theming
- **Forms**: React Hook Form with Zod validation schemas
- **Tables**: Sortable, filterable data tables with pagination
- **Maps**: Leaflet integration for interactive geospatial visualization
- **File Upload**: Drag-and-drop interfaces with progress tracking

# External Dependencies

## Database and Infrastructure

- **Neon Database**: Serverless PostgreSQL hosting with PostGIS extension
- **Drizzle Kit**: Database migration and schema management
- **Cloudinary**: Cloud storage for document files and image processing

## Frontend Libraries

- **React Query**: Server state management and API caching
- **Radix UI**: Accessible component primitives for forms, dialogs, and navigation
- **Recharts**: Data visualization charts and graphs
- **Leaflet**: Interactive mapping and geospatial visualization
- **React Hook Form**: Form state management and validation
- **Zod**: Schema validation for forms and API data

## Authentication and Security

- **bcrypt**: Password hashing and verification
- **cookie-parser**: Secure session cookie handling
- **connect-pg-simple**: PostgreSQL session store

## Development Tools

- **Vite**: Fast development server and build tool
- **TypeScript**: Type safety across frontend and backend
- **Tailwind CSS**: Utility-first styling framework
- **PostCSS**: CSS processing and optimization

## Government Data Sources

- **data.gov.in API**: Real-time FRA statistics and claim data
- **State Portals**: Integration with Madhya Pradesh, Odisha, Telangana, and Tripura government systems
- **Ministry of Tribal Affairs**: Official FRA progress reports and documentation

## Planned Integrations

- **OCR Services**: Multi-language text extraction for Hindi, Odia, Telugu, Bengali, Gujarati, and English documents
- **NER Processing**: Named Entity Recognition for claim-specific data extraction (Claim ID, Person, Location, Area, Date, Status)
- **Satellite Imagery**: Integration for forest cover analysis and claim verification