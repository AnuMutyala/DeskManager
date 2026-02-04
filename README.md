# DeskManager

A modern hot desk booking and administration system built with React, Express, and PostgreSQL.

## Overview

Desk Manager is a full-stack TypeScript application designed to streamline office workspace management. Employees can book desks for specific time slots (AM, PM, or full day) with support for recurring reservations, while administrators have comprehensive tools to manage seating arrangements, view booking analytics, and block seats for maintenance or special events.


## Key Features
31-day booking window (today + 30 days) aligned across components
### For Administrators
- **Visual Layout Editor**: Drag-and-drop interface for arranging seats in the office layout
- **Seat Management**: Add, edit, or remove seats with custom labels and attributes
- **Date-Range Blocking**: Block seats for specific date ranges (maintenance, events, etc.)
- **Booking Dashboard**: View all bookings with date filtering and search capabilities
- **CSV Export**: Export booking data for reporting and analysis
- **Analytics**: Track total bookings, available seats, and recent booking activity
- **User Management**: Monitor booking patterns and seat utilization

### For Employees
- **Flexible Booking**: Book seats for morning (AM), afternoon (PM), or full day slots
- **Recurring Reservations**: Set up weekly or daily recurring bookings with visual availability preview
- **Smart Conflict Resolution**: When booking full days with conflicts, the system automatically books available half-day slots
- **Real-time Availability**: Live seat availability checking with visual calendar indicators
- **Hover Booking Details**: Instantly view who booked each seat and for which time slot by hovering over occupied seats
- **My Bookings**: View and manage all your current and upcoming reservations with date filtering
- **Blocked Seat Alerts**: Visual indicators and warnings for bookings on seats that become blocked
- **Date Filtering**: Filter bookings by specific date or view all bookings at once
- **Seat Preferences**: Filter seats by type (with/without monitor) and view seat-specific tags

## Deployment to AWS Elastic Beanstalk

### Prerequisites
- AWS CLI configured with credentials
- EB CLI installed (`pip install awsebcli`)
- Node.js 24+ installed locally
- Git repository initialized

### Initial Setup (One-time)

1. **Initialize EB application:**
```bash
eb init
```
- Select region: `ap-southeast-1`
- Choose application name: `DeskManager`
- Platform: Node.js 24
- Set up SSH for instances: Yes

2. **Create RDS Database:**
- Create PostgreSQL 15 instance in AWS RDS Console
- Set security group to allow EB instance connections
- Note the endpoint, database name, username, and password

3. **Create EB Environment:**
```bash
eb create deskmanager-prod
```

4. **Configure Environment Variables:**
```bash
eb setenv \
  DATABASE_URL="postgres://username:password@endpoint:5432/dbname" \
  NODE_ENV=production \
  SESSION_SECRET="your-secret-key" \
  PORT=5000
```

### Deployment Workflow

#### 1. Build the Application
```bash
npm run build
```
This compiles both frontend (Vite) and backend (esbuild) into `dist/`:
- `dist/public/` - Frontend static files
- `dist/index.cjs` - Backend server bundle

#### 2. Set Active Environment (if needed)
```bash
eb use deskmanager-prod
```

#### 3. Deploy to Elastic Beanstalk
```bash
eb deploy --message "Your deployment message"
```

The deployment includes:
- Built frontend and backend from `dist/`
- `node_modules/` dependencies
- `.platform/hooks/postdeploy/` for migrations
- Excludes: source files (`client/`, `server/`), dev dependencies

#### 4. Verify Deployment
```bash
eb status
eb open
```

### Common Commands

**View logs:**
```bash
eb logs
eb logs --all  # All logs including previous deployments
```

**SSH into instance:**
```bash
eb ssh
```

**Check environment health:**
```bash
eb health
eb status
```

**Update environment variables:**
```bash
eb setenv KEY=value
```

**Scale instances:**
```bash
eb scale 2  # Run 2 instances
```

### Database Migrations

Migrations run automatically after each deployment via postdeploy hook:
```bash
.platform/hooks/postdeploy/01_run_migrations.sh
```

To run migrations manually:
```bash
eb ssh
cd /var/app/current
npm run db:push
```

### Database Seeding

**Option 1: Seed from EB instance (recommended):**
```bash
# SSH into the instance
eb ssh

# Set the DATABASE_URL with SSL mode
export DATABASE_URL="postgres://postgres:HFfVaiTy8UyiMwyM@deskmanager-db.c9imgkc2cgtw.ap-southeast-1.rds.amazonaws.com:5432/deskmanager?sslmode=no-verify"

# Run seed script
npm run seed
```

**Option 2: Seed from local machine:**
```bash
# Ensure your IP is allowed in RDS security group, then:
export DATABASE_URL="postgres://username:password@endpoint:5432/dbname?sslmode=no-verify"
npm run seed
```

**Note:** The seed script creates default users and sample data. Only run this once on a fresh database to avoid duplicates.

### Troubleshooting

**Check application logs:**
```bash
eb ssh --command "sudo tail -100 /var/log/web.stdout.log"
```

**Check migration logs:**
```bash
eb ssh --command "sudo tail -100 /var/log/eb-hooks.log"
```

**Rebuild and redeploy:**
```bash
npm run build && eb deploy --message "Fix: description"
```

### Application Architecture

- **Frontend:** React + Vite (served from `/`)
- **Backend API:** Express (routes under `/api/*`)
- **Database:** PostgreSQL on AWS RDS
- **CDN:** CloudFront for HTTPS and global distribution
- **Deployment:** Single-origin architecture (frontend served by backend)

### URLs

- **Production (HTTPS):** https://d2rxrqeh0g51rg.cloudfront.net
- **Direct EB (HTTP):** http://deskmanager-prod.eba-vd4dw3mi.ap-southeast-1.elasticbeanstalk.com
- **API Endpoint:** Same domain at `/api/*`

**Note:** Use the CloudFront URL for HTTPS access and better global performance.

### Version Tracking

The login page displays the current git commit hash. This is injected at build time via `vite.config.ts`.

## Project Structure

```
Desk-Manager/
├── client/                    # Frontend React application
│   ├── src/
│   │   ├── components/       # Reusable UI components
│   │   │   ├── ui/          # Radix UI wrappers
│   │   │   ├── BookingModal.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   └── calendar.tsx
│   │   ├── hooks/           # Custom React hooks
│   │   │   ├── use-auth.ts
│   │   │   ├── use-bookings.ts
│   │   │   └── use-seats.ts
│   │   ├── pages/           # Page components
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Login.tsx
│   │   │   ├── MyBookings.tsx
│   │   │   └── admin/
│   │   │       ├── AdminDashboard.tsx
│   │   │       ├── ManageSeats.tsx
│   │   │       └── ViewBookings.tsx
│   │   ├── lib/             # Utilities
│   │   └── App.tsx          # Root component
│   └── index.html
│
├── server/                   # Backend Express application
│   ├── db.ts               # Database connection and schema
│   ├── routes.ts           # API route handlers
│   ├── storage.ts          # Data access layer
│   ├── index.ts            # Server entry point
│   └── vite.ts             # Vite middleware integration
│
├── shared/                   # Shared code between client/server
│   ├── schema.ts           # Zod schemas and database types
│   └── routes.ts           # API route definitions
│
├── script/
│   ├── build.ts            # Production build script
│   └── seed.ts             # Database seeding
│
├── docker-compose.yml       # PostgreSQL container config
├── drizzle.config.ts       # Drizzle ORM configuration
└── package.json
```

## Getting Started

### Prerequisites

- **Node.js** (v18 or higher)
- **npm** or **yarn**
- **Docker** (for PostgreSQL)
- **Git**

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd Desk-Manager
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start PostgreSQL with Docker**
   ```bash
   docker-compose up -d
   ```

   This will start a PostgreSQL instance on port 5432 with credentials defined in `env.postgres`.

4. **Set up the database**
   ```bash
   npm run db:push
   ```

   This applies the database schema using Drizzle migrations.

5. **Seed the database (optional)**
   ```bash
   npm run db:seed
   ```

   This creates sample users, seats, and bookings for testing.

6. **Start the development server**
   ```bash
   npm run dev
   ```

   The application will be available at `http://localhost:5000`.

### Environment Variables

Create a `.env` file in the root directory (or use the provided `env.postgres`):

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/desk_manager

NODE_ENV=development
```

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build locally |
| `npm run db:push` | Apply database schema changes |
| `npm run db:seed` | Populate database with sample data |
| `npm run db:studio` | Open Drizzle Studio (database GUI) |

### Booking System

**Time Slots**:
- **AM**: Morning shift (9 AM - 1 PM)
- **PM**: Afternoon shift (1 PM - 6 PM)
- **FULL**: Full day (9 AM - 6 PM)

**Conflict Resolution**:
1. When a FULL day booking is requested, the system checks both AM and PM availability
2. If conflicts exist, the system offers to book available slots automatically
3. For recurring bookings, conflicted dates can be skipped or partially booked

**Recurring Bookings**:
- Supports weekly and daily patterns
- Preview shows up to 5 upcoming occurrences with real-time availability
- End date can be specified or defaults to a configurable number of weeks
- All recurring bookings are created atomically (all or nothing per date)


### Database Schema

**Key Tables**:
- `users`: Authentication and user profiles (username, password, isAdmin)
- `seats`: Seat definitions with layout position, type, labels, and date-range blocking
- `bookings`: Reservation records linking users, seats, dates, and time slots

**Seat Types**:
- `REGULAR`: Standard desk with monitor
- `HOT_DESK`: Flexible seating without monitor

**Date-Range Blocking**:
- Seats can be blocked from `blockStartDate` to `blockEndDate`
- Blocked seats don't appear in availability calculations for those dates
- Used for maintenance, events, or temporary unavailability

## API Endpoints

### Authentication
- `POST /api/login` - User login
- `POST /api/logout` - User logout
- `GET /api/user` - Get current user

### Bookings
- `GET /api/bookings` - List bookings (with optional date range filters)
- `POST /api/bookings` - Create single booking
- `POST /api/bookings/recurring` - Create recurring bookings
- `DELETE /api/bookings/:id` - Cancel booking

### Seats
- `GET /api/seats` - List all seats
- `POST /api/seats` - Create new seat (admin)
- `PATCH /api/seats/:id` - Update seat (admin)
- `DELETE /api/seats/:id` - Delete seat (admin)
- `POST /api/seats/:id/block` - Block seat for date range (admin)

### Testing Considerations
- Seed script creates test data for all scenarios
- Admin account: `admin` / `password`
- Regular user: `employee` / `password`

## Future Enhancements

Potential areas for expansion:
- Email notifications for booking confirmations
- Calendar integration (Google Calendar, Outlook)
- Mobile app version
- Waiting list for fully booked dates
