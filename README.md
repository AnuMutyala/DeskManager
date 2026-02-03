# DeskManager

A modern hot desk booking and administration system built with React, Express, and PostgreSQL.

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
