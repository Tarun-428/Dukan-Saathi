# Sathi SaaS Platform - Complete Deployment Guide

## Table of Contents
1. [Project Overview](#project-overview)
2. [Architecture & Tech Stack](#architecture--tech-stack)
3. [Prerequisites](#prerequisites)
4. [Environment Setup](#environment-setup)
5. [Local Development Deployment](#local-development-deployment)
6. [Production Deployment](#production-deployment)
   - [Option 1: AWS Deployment](#option-1-aws-deployment)
   - [Option 2: Render Deployment](#option-2-render-deployment)
   - [Option 3: Railway Deployment](#option-3-railway-deployment)
   - [Option 4: DigitalOcean Deployment](#option-4-digitalocean-deployment)
7. [Frontend Deployment](#frontend-deployment)
8. [Database Configuration](#database-configuration)
9. [SSL/TLS Configuration](#ssltls-configuration)
10. [Monitoring & Logging](#monitoring--logging)
11. [Backup & Recovery](#backup--recovery)
12. [Troubleshooting](#troubleshooting)

---

## Project Overview

**Sathi** is a multi-tenant SaaS platform for retail shop management built with:
- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS
- **Backend**: FastAPI (Python) with async MongoDB driver (Motor)
- **Database**: MongoDB (7.0+)
- **Cache**: Redis
- **APIs**: REST + WebSocket for real-time updates

### Key Features
- Multi-tenant architecture (isolated workspace per shop)
- POS billing system with tax calculations
- Inventory management
- Customer CRM
- Dashboard with analytics
- WhatsApp integration for sending invoices
- Razorpay payment integration
- JWT-based authentication with RBAC

---

## Architecture & Tech Stack

### System Architecture
```
┌─────────────────────────────────────────────────────────────────┐
│                        React SPA (Frontend)                      │
│              Deployed on: Vercel / Netlify / S3+CloudFront      │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTPS REST & WebSocket
┌────────────────────────────▼────────────────────────────────────┐
│                      FastAPI Backend (Port 8000)                 │
│  Auth | RBAC | Rate Limiting | Tenant Middleware | Swagger API   │
│     Deployed on: Render / Railway / AWS ECS / DigitalOcean      │
└────────────────────────────┬────────────────────────────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        ▼                    ▼                    ▼
   MongoDB Atlas         Redis (Upstash)      External Services
   (Multi-tenant)        (Sessions/Queues)    (Email, Payments)
```

### Technology Stack

| Component | Technology | Version |
|-----------|-----------|---------|
| **Frontend Framework** | React | 19.2.6 |
| **Frontend Language** | TypeScript | 6.0 |
| **Build Tool** | Vite | 8.0.12 |
| **Styling** | Tailwind CSS | 4.3.0 |
| **HTTP Client** | Axios | 1.16.1 |
| **State Management** | Zustand | 5.0.13 |
| **Data Fetching** | TanStack Query | 5.100.11 |
| **Backend Framework** | FastAPI | 0.115.6 |
| **Python Version** | Python | 3.12+ |
| **Async Server** | Uvicorn | 0.34.0 |
| **Database Driver** | Motor | 3.6.0 |
| **Database** | MongoDB | 7.0+ |
| **Cache/Sessions** | Redis | 7.0+ |
| **Authentication** | JWT + passlib | - |
| **API Documentation** | Swagger/OpenAPI | Auto-generated |

---

## Prerequisites

### System Requirements
- **CPU**: 2+ cores
- **RAM**: 4GB minimum (8GB recommended)
- **Storage**: 20GB (SSD recommended)
- **OS**: Linux (Ubuntu 22.04 LTS recommended) / macOS / Windows (with WSL2)

### Required Software

#### 1. Node.js & npm
```bash
# Install Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation
node --version  # v20.x.x
npm --version   # 10.x.x
```

#### 2. Python 3.12+
```bash
# Install Python 3.12
sudo apt-get install -y python3.12 python3.12-venv python3-pip

# Verify installation
python3 --version  # Python 3.12.x
pip3 --version
```

#### 3. Docker & Docker Compose
```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Verify installation
docker --version         # Docker version 24+
docker-compose --version # Docker Compose version 2.20+
```

#### 4. Git
```bash
sudo apt-get install -y git
git --version
```

#### 5. PostgreSQL Client (optional, for backups)
```bash
sudo apt-get install -y postgresql-client
```

---

## Environment Setup

### 1. Clone the Repository
```bash
cd /home/lapuser/projects  # Choose your directory
git clone https://github.com/your-organization/sathi.git
cd sathi
```

### 2. Create Environment Files

#### Backend Environment (.env)

Create file: `backend/.env`

```env
# Application
APP_NAME=Sathi
APP_VERSION=1.0.0
DEBUG=false  # Set to 'true' for development, 'false' for production
API_V1_PREFIX=/api/v1

# MongoDB Configuration
MONGODB_URI=mongodb+srv://username:password@cluster0.mongodb.net/sathi?retryWrites=true&w=majority
MONGODB_DB_NAME=sathi

# JWT Configuration
JWT_SECRET_KEY=your-super-secret-jwt-key-change-this-in-production-minimum-32-characters
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7

# CORS Configuration (comma-separated domains)
CORS_ORIGINS=["https://app.sathi.com","https://dashboard.sathi.com"]

# Rate Limiting
RATE_LIMIT=100/minute

# Email Configuration (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-specific-password  # Use App Password for Gmail
SMTP_FROM=noreply@sathi.com

# Redis Configuration
REDIS_URL=redis://default:password@redis-host:6379/0

# Admin Credentials (for initial setup)
SUPER_ADMIN_EMAIL=admin@sathi.com
SUPER_ADMIN_PASSWORD=secure-password-here-change-after-first-login

# Razorpay Payment Integration
RAZORPAY_KEY_ID=rzp_live_xxxxxxxxxx
RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxx
RAZORPAY_WEBHOOK_SECRET=webhook-secret-key

# WhatsApp Cloud API Integration
WHATSAPP_ENABLED=true
WHATSAPP_CLOUD_API_TOKEN=EAAQ...
WHATSAPP_PHONE_NUMBER_ID=1116946968172468
WHATSAPP_BUSINESS_ACCOUNT_ID=982915367794760
WHATSAPP_API_VERSION=v22.0

# AWS S3 Configuration (for document storage)
AWS_ACCESS_KEY=AKIA...
AWS_SECRET_KEY=...
AWS_REGION=ap-south-1
AWS_BUCKET_NAME=sathi-documents

# Environment: development, staging, production
ENVIRONMENT=production
```

#### Frontend Environment (.env)

Create file: `frontend/.env.production`

```env
# API Configuration
VITE_API_URL=https://api.sathi.com/api/v1
VITE_PUBLIC_API_URL=https://api.sathi.com/api/v1

# Analytics (optional)
VITE_ANALYTICS_ID=your-analytics-id

# Feature Flags
VITE_ENABLE_WHATSAPP=true
VITE_ENABLE_PAYMENTS=true
```

---

## Local Development Deployment

### Option 1: Using Docker Compose (Recommended)

#### Step 1: Start Services
```bash
cd /home/lapuser/projects/sathi

# Build and start all containers
docker-compose up -d

# Verify services are running
docker-compose ps

# Expected output:
# NAME                COMMAND             STATUS              PORTS
# sathi-mongodb-1     "docker-entrypoint" Up 10 seconds        27017/tcp
# sathi-redis-1       "redis-server"      Up 9 seconds         6379/tcp
# sathi-backend-1     "uvicorn..."        Up 5 seconds         8000:8000
# sathi-frontend-1    "npm run dev"       Up 3 seconds         5173:5173
# sathi-nginx-1       "nginx -g..."       Up 2 seconds         80:80
```

#### Step 2: Access Applications
- **Frontend**: http://localhost:5173
- **Backend API**: https://dukan-saathi.onrender.com
- **API Docs**: https://dukan-saathi.onrender.com/docs
- **Nginx Reverse Proxy**: http://localhost:80
- **MongoDB**: localhost:27017
- **Redis**: localhost:6379

#### Step 3: Initialize Database
```bash
# Backend container is already running, next steps are optional
docker-compose exec backend python -c "from app.core.database import init_db; init_db()"
```

#### Step 4: View Logs
```bash
# View all logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f mongodb
```

#### Step 5: Stop Services
```bash
# Stop all services
docker-compose down

# Stop and remove volumes (database data will be deleted)
docker-compose down -v
```

### Option 2: Manual Local Setup (Without Docker)

#### Step 1: Setup Backend

```bash
# Navigate to backend directory
cd backend

# Create virtual environment
python3 -m venv venv

# Activate virtual environment
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create .env file (copy from section above)
cp .env.example .env
nano .env  # Edit with your values

# Run database migrations (if applicable)
python -m app.core.database init

# Start backend server
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

#### Step 2: Setup Frontend

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Create .env file
cp .env.example .env.local
nano .env.local

# Start development server
npm run dev

# Application will be available at http://localhost:5173
```

#### Step 3: Start Supporting Services

```bash
# MongoDB - Option A: Local installation
# Download and install from https://www.mongodb.com/try/download/community
# Then start:
mongod --dbpath /path/to/data

# MongoDB - Option B: Docker
docker run -d -p 27017:27017 --name mongodb mongo:7

# Redis
docker run -d -p 6379:6379 --name redis redis:7-alpine
```

---

## Production Deployment

### Prerequisites for Production
1. Domain name (e.g., sathi.com)
2. SSL certificate (from Let's Encrypt or commercial provider)
3. External MongoDB instance (MongoDB Atlas recommended)
4. External Redis instance (Upstash or AWS ElastiCache)
5. SMTP server for emails (SendGrid, AWS SES, Gmail with app password)
6. Hosting platform account

---

### Option 1: AWS Deployment

#### Step 1: AWS Infrastructure Setup

**A. Create EC2 Instance**
```bash
# AWS Console:
# 1. Navigate to EC2 Dashboard
# 2. Click "Launch Instance"
# 3. Configuration:
#    - Image: Ubuntu 22.04 LTS AMI
#    - Instance Type: t3.medium (2 vCPU, 4GB RAM) minimum
#    - Security Group: Open ports 22 (SSH), 80 (HTTP), 443 (HTTPS)
#    - Storage: 50GB SSD gp3
#    - Enable detailed monitoring

# Connect to instance
ssh -i your-key.pem ubuntu@your-ec2-public-ip
```

**B. Create RDS PostgreSQL (for sessions if not using MongoDB)**
```
# AWS RDS Console:
# - Engine: MongoDB (AWS DocumentDB) or keep MongoDB Atlas
# - Multi-AZ: Enabled
# - Backup: 7 days retention
```

**C. Create ElastiCache Redis Cluster**
```
# AWS ElastiCache Console:
# - Engine: Redis
# - Node type: cache.t3.micro (for development) or larger for production
# - Number of nodes: 1 (primary)
# - Multi-AZ: Disabled for dev, Enabled for production
```

#### Step 2: Install Dependencies on EC2

```bash
# Update system
sudo apt-get update && sudo apt-get upgrade -y

# Install required packages
sudo apt-get install -y \
    curl wget git \
    python3.12 python3.12-venv python3-pip \
    nodejs npm \
    docker.io docker-compose \
    nginx certbot python3-certbot-nginx

# Add ubuntu user to docker group
sudo usermod -aG docker ubuntu

# Start Docker daemon
sudo systemctl start docker
sudo systemctl enable docker
```

#### Step 3: Deploy Application

```bash
# Clone repository
git clone https://github.com/your-org/sathi.git
cd sathi

# Create production .env file
nano backend/.env

# Example production .env:
# MONGODB_URI=mongodb+srv://username:password@cluster0.mongodb.net/sathi
# REDIS_URL=redis://default:password@elasticache-endpoint.us-east-1.cache.amazonaws.com:6379
# DEBUG=false
# (... other env vars from earlier section)

# Build Docker image for backend
docker build -t sathi-backend:latest ./backend

# Push to AWS ECR (if using ECR)
# aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin your-account-id.dkr.ecr.us-east-1.amazonaws.com
# docker tag sathi-backend:latest your-account-id.dkr.ecr.us-east-1.amazonaws.com/sathi-backend:latest
# docker push your-account-id.dkr.ecr.us-east-1.amazonaws.com/sathi-backend:latest

# Or use Docker Hub
# docker login
# docker tag sathi-backend:latest yourusername/sathi-backend:latest
# docker push yourusername/sathi-backend:latest
```

#### Step 4: Setup Nginx Reverse Proxy

Create `/etc/nginx/sites-available/sathi`:

```nginx
upstream backend {
    server localhost:8000;
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name api.sathi.com;
    
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    
    location / {
        return 301 https://$server_name$request_uri;
    }
}

# Main HTTPS server block for API
server {
    listen 443 ssl http2;
    server_name api.sathi.com;

    # SSL certificates (generated via Certbot)
    ssl_certificate /etc/letsencrypt/live/api.sathi.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.sathi.com/privkey.pem;
    
    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Logging
    access_log /var/log/nginx/sathi_api_access.log;
    error_log /var/log/nginx/sathi_api_error.log;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api_limit:10m rate=100r/m;
    limit_req zone=api_limit burst=20 nodelay;

    location / {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
        proxy_connect_timeout 60s;
    }

    # WebSocket support
    location /api/v1/ws {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 3600s;
    }
}
```

Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/sathi /etc/nginx/sites-enabled/sathi
sudo nginx -t  # Test configuration
sudo systemctl restart nginx
```

#### Step 5: Setup SSL Certificate with Let's Encrypt

```bash
# Generate SSL certificate
sudo certbot certonly --webroot -w /var/www/certbot \
    -d api.sathi.com \
    --email admin@sathi.com \
    --agree-tos \
    --no-eff-email

# Setup auto-renewal
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer

# Verify certificate
sudo certbot certificates
```

#### Step 6: Start Backend Container

```bash
# Run backend container
docker run -d \
    --name sathi-backend \
    --restart always \
    -p 8000:8000 \
    --env-file backend/.env \
    sathi-backend:latest

# Verify it's running
docker ps | grep sathi-backend
```

#### Step 7: Setup Monitoring

```bash
# Install CloudWatch agent
wget https://s3.amazonaws.com/amazoncloudwatch-agent/ubuntu/amd64/latest/amazon-cloudwatch-agent.deb
sudo dpkg -i -E ./amazon-cloudwatch-agent.deb

# Configure and start
sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
    -a fetch-config \
    -m ec2 \
    -s \
    -c file:/opt/aws/amazon-cloudwatch-agent/etc/config.json
```

---

### Option 2: Render Deployment

Render is a modern cloud platform with built-in support for MongoDB and Redis.

#### Step 1: Create Render Account
- Visit https://render.com
- Sign up and connect GitHub repository

#### Step 2: Create Backend Web Service

1. **Dashboard → New → Web Service**
   - Connect your GitHub repository
   - Select `sathi` repository
   - Configuration:
     - **Name**: sathi-backend
     - **Region**: Singapore / India (depending on your users)
     - **Branch**: main
     - **Runtime**: Python 3
     - **Build Command**: `pip install -r requirements.txt`
     - **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port 8000`
     - **Instance Type**: Starter (2GB RAM) minimum

2. **Add Environment Variables** (in Settings → Environment):
```
MONGODB_URI=<your-mongodb-atlas-uri>
MONGODB_DB_NAME=sathi
JWT_SECRET_KEY=<your-secret-key>
DEBUG=false
REDIS_URL=<render-redis-url>
CORS_ORIGINS=["https://sathi.vercel.app"]
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=<your-email>
SMTP_PASSWORD=<app-password>
... (other env vars)
```

3. **Add PostgreSQL Database** (if needed):
   - In Render dashboard: New → PostgreSQL
   - Configuration: db.nano or db.small

#### Step 3: Deploy Frontend on Vercel

1. **Visit https://vercel.com**
   - Click "New Project"
   - Import your GitHub repository

2. **Configure Project**:
   - **Framework**: Vite
   - **Root Directory**: frontend
   - **Build Command**: `npm run build`
   - **Output Directory**: dist

3. **Environment Variables** (in Settings → Environment Variables):
```
VITE_API_URL=https://sathi-backend.onrender.com/api/v1
```

4. **Deploy**: Vercel automatically deploys on each push to main

#### Step 4: Connect Services

```bash
# After deployment, get your URLs:
Backend API: https://sathi-backend.onrender.com
Frontend: https://sathi.vercel.app

# Update environment variables:
# Backend CORS_ORIGINS: ["https://sathi.vercel.app"]
# Frontend VITE_API_URL: https://sathi-backend.onrender.com/api/v1
```

---

### Option 3: Railway Deployment

Railway provides simple deployments with native MongoDB and Redis support.

#### Step 1: Create Railway Account
- Visit https://railway.app
- Sign up and connect GitHub

#### Step 2: Create Project

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login to Railway
railway login

# Link to your repository
railway link

# Create services in railway.json
```

Create `railway.json`:
```json
{
  "services": {
    "backend": {
      "dockerfile": "./backend/Dockerfile",
      "port": 8000,
      "startCommand": "uvicorn app.main:app --host 0.0.0.0 --port $PORT"
    },
    "frontend": {
      "root": "./frontend",
      "buildCommand": "npm install && npm run build",
      "startCommand": "npm run preview",
      "port": 5173
    }
  },
  "environments": {
    "production": {
      "backend": {
        "replicas": 2
      }
    }
  }
}
```

#### Step 3: Deploy

```bash
# Deploy
railway up

# Get URLs
railway env   # Shows service URLs
```

---

### Option 4: DigitalOcean Deployment

DigitalOcean App Platform or Droplets with Docker.

#### Step 1: Create Droplet

```bash
# In DigitalOcean Console:
# - Image: Ubuntu 22.04 LTS
# - Size: Regular / Intel / 2GB RAM / 2vCPU / 50GB SSD
# - Region: Singapore / Bangalore
# - Enable backups
```

#### Step 2: Setup Droplet

```bash
# SSH into droplet
ssh root@your_droplet_ip

# Create non-root user
adduser appuser
usermod -aG sudo appuser
su - appuser

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Install Nginx
sudo apt-get install -y nginx certbot python3-certbot-nginx

# Clone repository
git clone https://github.com/your-org/sathi.git
cd sathi
```

#### Step 3: Setup Docker Compose for Production

Create `docker-compose.prod.yml`:

```yaml
version: "3.9"

services:
  backend:
    image: sathi-backend:latest
    restart: always
    ports:
      - "8000:8000"
    environment:
      MONGODB_URI: ${MONGODB_URI}
      MONGODB_DB_NAME: sathi
      JWT_SECRET_KEY: ${JWT_SECRET_KEY}
      REDIS_URL: ${REDIS_URL}
      CORS_ORIGINS: '["https://sathi.example.com"]'
      DEBUG: "false"
    env_file: backend/.env
    networks:
      - sathi-network
    healthcheck:
      test: ["CMD", "curl", "-f", "https://dukan-saathi.onrender.com/docs"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  nginx:
    image: nginx:alpine
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./docker/nginx/nginx.prod.conf:/etc/nginx/nginx.conf:ro
      - /etc/letsencrypt:/etc/letsencrypt:ro
      - /var/www/certbot:/var/www/certbot:ro
    depends_on:
      - backend
    networks:
      - sathi-network

networks:
  sathi-network:
    driver: bridge
```

#### Step 4: Deploy

```bash
# Load environment variables
export $(cat backend/.env | xargs)

# Build and start
docker-compose -f docker-compose.prod.yml up -d

# Verify
docker-compose ps
```

---

## Frontend Deployment

### Deploy to Vercel (Recommended)

#### Step 1: Build Frontend
```bash
cd frontend
npm install
npm run build  # Creates dist/ folder
```

#### Step 2: Connect to Vercel
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod

# Follow prompts and select appropriate options
```

#### Step 3: Configure Environment
In Vercel Dashboard:
- Project Settings → Environment Variables
- Add: `VITE_API_URL=https://api.sathi.com/api/v1`
- Redeploy

### Deploy to Netlify

#### Step 1: Build
```bash
cd frontend
npm run build
```

#### Step 2: Deploy
```bash
# Install Netlify CLI
npm i -g netlify-cli

# Deploy
netlify deploy --prod --dir dist

# Or use dashboard and connect GitHub for auto-deploy
```

### Deploy to AWS S3 + CloudFront

```bash
# Build
npm run build

# Create S3 bucket
aws s3 mb s3://sathi-app-frontend --region us-east-1

# Upload built files
aws s3 sync dist/ s3://sathi-app-frontend --delete

# Create CloudFront distribution pointing to S3 bucket
# (Configure in AWS Console with SSL certificate)

# Setup invalidation for cache
aws cloudfront create-invalidation --distribution-id XXXXX --paths "/*"
```

---

## Database Configuration

### MongoDB Atlas Setup

#### Step 1: Create Cluster
1. Visit https://www.mongodb.com/cloud/atlas
2. Create Account or Login
3. Create Organization and Project
4. Click "Build a Database"
5. Configuration:
   - **Deployment Tier**: M2 Shared (free tier) or M5 (production)
   - **Cloud Provider**: AWS / Google Cloud / Azure
   - **Region**: ap-south-1 (India) or sg-southeast-1 (Singapore)

#### Step 2: Configure Network Access
```
Network Access → Add IP Address
- Allow From Anywhere: 0.0.0.0/0 (less secure)
- Or: Add specific IPs of your servers
```

#### Step 3: Create Database User
```
Database Access → Add New Database User
- Username: sathi_user
- Password: [Generate secure password]
- Role: readWriteAnyDatabase
```

#### Step 4: Get Connection String
```
Databases → Connect → Connection String

# Format:
mongodb+srv://sathi_user:password@cluster0.xxxxx.mongodb.net/sathi?retryWrites=true&w=majority

# Add to backend/.env
MONGODB_URI=mongodb+srv://sathi_user:password@cluster0.xxxxx.mongodb.net/sathi
```

#### Step 5: Create Indexes (Optional, for performance)

```bash
# Using MongoDB Atlas Console:
# Go to Databases → Collections → Suggested Indexes

# Or via command line:
mongosh "mongodb+srv://sathi_user:password@cluster0.xxxxx.mongodb.net/sathi"

# Create indexes:
db.shops.createIndex({ tenant_id: 1 })
db.products.createIndex({ tenant_id: 1, sku: 1 })
db.transactions.createIndex({ tenant_id: 1, created_at: -1 })
```

---

## SSL/TLS Configuration

### Option 1: Let's Encrypt (Free)

```bash
# Install Certbot
sudo apt-get install -y certbot python3-certbot-nginx

# Generate certificate
sudo certbot certonly --standalone \
    -d api.sathi.com \
    -d sathi.com \
    --email admin@sathi.com \
    --agree-tos \
    --no-eff-email

# Configure auto-renewal
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer

# Test renewal
sudo certbot renew --dry-run

# Certificates location:
# /etc/letsencrypt/live/api.sathi.com/fullchain.pem (public)
# /etc/letsencrypt/live/api.sathi.com/privkey.pem (private)
```

### Option 2: Commercial SSL

1. Purchase certificate from Comodo, DigiCert, GlobalSign
2. Download certificate files
3. Place in `/etc/ssl/certs/` and `/etc/ssl/private/`
4. Update Nginx config with certificate paths
5. Restart Nginx

### Nginx SSL Configuration

```nginx
server {
    listen 443 ssl http2;
    server_name api.sathi.com;

    ssl_certificate /etc/letsencrypt/live/api.sathi.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.sathi.com/privkey.pem;

    # SSL security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;

    # Proxy settings remain same as before
}
```

---

## Monitoring & Logging

### Application Performance Monitoring (APM)

#### Option 1: Sentry (Error Tracking)

```bash
# Backend - Install Sentry SDK
pip install sentry-sdk

# Add to app/main.py
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.motor import MotorIntegration

sentry_sdk.init(
    dsn="https://your-sentry-dsn@sentry.io/project-id",
    integrations=[
        FastApiIntegration(),
        MotorIntegration(),
    ],
    traces_sample_rate=0.1,
    environment="production"
)
```

#### Option 2: New Relic

```bash
# Backend - Install New Relic
pip install newrelic

# Configure newrelic.ini
NEW_RELIC_CONFIG_FILE=newrelic.ini \
NEW_RELIC_ENVIRONMENT=production \
newrelic-admin run-program uvicorn app.main:app
```

### Logging

#### Centralized Logging with ELK Stack

```yaml
# docker-compose.yml addition
elasticsearch:
  image: docker.elastic.co/elasticsearch/elasticsearch:8.0.0
  environment:
    - discovery.type=single-node
  ports:
    - "9200:9200"

kibana:
  image: docker.elastic.co/kibana/kibana:8.0.0
  ports:
    - "5601:5601"
  depends_on:
    - elasticsearch
```

#### Application Logging

```python
# backend/app/core/logging.py
import logging
import logging.handlers

def setup_logging():
    logger = logging.getLogger("sathi")
    handler = logging.handlers.RotatingFileHandler(
        "logs/sathi.log",
        maxBytes=10485760,
        backupCount=10
    )
    formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    handler.setFormatter(formatter)
    logger.addHandler(handler)
    return logger
```

### Monitoring Checklist

Create `monitoring/checks.py`:

```python
import requests
from datetime import datetime

def health_check():
    """Check if all services are running"""
    services = {
        "Backend": "https://api.sathi.com/docs",
        "Frontend": "https://sathi.com",
        "Database": "mongodb+srv://...",
        "Redis": "redis://..."
    }
    
    for service, url in services.items():
        try:
            response = requests.get(url, timeout=5)
            status = "✓ UP" if response.status_code < 500 else "✗ DOWN"
        except:
            status = "✗ DOWN"
        
        print(f"{service}: {status} ({datetime.now()})")

if __name__ == "__main__":
    health_check()
```

Run as cron job:
```bash
# Add to crontab
0 * * * * python /opt/monitoring/checks.py >> /var/log/health-checks.log
```

---

## Backup & Recovery

### MongoDB Backup

#### Automated Backup

```bash
#!/bin/bash
# backup-mongodb.sh

BACKUP_DIR="/backups/mongodb"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
MONGODB_URI="mongodb+srv://user:password@cluster0.xxxxx.mongodb.net/sathi"

mkdir -p $BACKUP_DIR

# Create backup
mongodump --uri="$MONGODB_URI" --out="$BACKUP_DIR/backup_$TIMESTAMP"

# Compress
tar -czf "$BACKUP_DIR/backup_$TIMESTAMP.tar.gz" "$BACKUP_DIR/backup_$TIMESTAMP"

# Remove original
rm -rf "$BACKUP_DIR/backup_$TIMESTAMP"

# Keep only last 7 backups
find $BACKUP_DIR -name "backup_*.tar.gz" -mtime +7 -delete

echo "Backup completed: $BACKUP_DIR/backup_$TIMESTAMP.tar.gz"
```

Setup cron:
```bash
# Run daily at 2 AM
0 2 * * * /opt/scripts/backup-mongodb.sh
```

#### Restore Backup

```bash
# Extract backup
tar -xzf backup_20240527_020000.tar.gz

# Restore to MongoDB
mongorestore --uri="mongodb+srv://user:password@cluster0.xxxxx.mongodb.net" backup_20240527_020000
```

### Docker Image Backup

```bash
# Backup Docker image
docker save sathi-backend:latest | gzip > sathi-backend-latest.tar.gz

# Restore
gunzip -c sathi-backend-latest.tar.gz | docker load
```

---

## Troubleshooting

### Common Issues & Solutions

#### 1. **Backend Won't Start**

```bash
# Check logs
docker-compose logs backend

# Common issues:
# - MongoDB connection failed: Verify MONGODB_URI is correct
# - Port 8000 already in use: Change port in docker-compose.yml
# - Missing environment variables: Check backend/.env file

# Solution:
# Verify environment variables
docker-compose exec backend printenv | grep MONGODB

# Check database connection
python3 -c "import motor; print('Motor installed')"
```

#### 2. **Frontend Can't Reach Backend API**

```bash
# Check CORS configuration
curl -i https://dukan-saathi.onrender.com/docs \
  -H "Origin: http://localhost:5173"

# Should see Access-Control-Allow-Origin header

# Check frontend environment
cat frontend/.env.local | grep VITE_API_URL

# Test API endpoint
curl https://dukan-saathi.onrender.com/api/v1/health
```

#### 3. **SSL Certificate Not Working**

```bash
# Check certificate validity
sudo certbot certificates

# Check certificate in Nginx
sudo openssl x509 -in /etc/letsencrypt/live/api.sathi.com/cert.pem -text -noout

# Force certificate renewal
sudo certbot renew --force-renewal

# Restart Nginx
sudo systemctl restart nginx
```

#### 4. **Database Connection Timeout**

```bash
# Test MongoDB connection
mongosh "mongodb+srv://user:password@cluster0.xxxxx.mongodb.net/test"

# If using MongoDB Atlas:
# - Check IP whitelist
# - Verify connection string
# - Ensure MongoDB is running

# For self-hosted:
# Check MongoDB is running
sudo systemctl status mongod
docker ps | grep mongodb
```

#### 5. **High CPU/Memory Usage**

```bash
# Check resource usage
docker stats

# If backend consuming too much:
# - Check for infinite loops in code
# - Monitor database queries
# - Check Redis memory

# Increase container resources
# In docker-compose.yml:
# resources:
#   limits:
#     memory: 2G
#     cpus: '1'
```

#### 6. **Nginx 502 Bad Gateway**

```bash
# Check backend is running
curl https://dukan-saathi.onrender.com

# Check Nginx error log
sudo tail -f /var/log/nginx/error.log

# Verify upstream server in Nginx config
sudo cat /etc/nginx/nginx.conf | grep -A5 "upstream backend"

# Restart Nginx
sudo systemctl restart nginx
```

#### 7. **WebSocket Connection Failing**

```bash
# Check WebSocket endpoint
curl -i -N -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  https://dukan-saathi.onrender.com/api/v1/ws/tenant_id

# Verify Nginx WebSocket configuration
sudo cat /etc/nginx/sites-enabled/sathi | grep -A10 "location /api/v1/ws"

# Should include:
# proxy_set_header Upgrade $http_upgrade;
# proxy_set_header Connection "Upgrade";
```

### Debug Mode

Enable debug mode for detailed logs:

```bash
# Backend
export DEBUG=true
docker-compose restart backend

# Frontend
VITE_DEBUG=true npm run dev

# Check logs
docker-compose logs -f backend --tail=100
```

---

## Performance Optimization

### Backend Optimization

```python
# Add caching
from functools import lru_cache

@lru_cache(maxsize=128)
def get_products_cache(tenant_id: str):
    return db.products.find({"tenant_id": tenant_id})

# Use database indexing
db.products.create_index([("tenant_id", 1), ("sku", 1)])
db.transactions.create_index([("tenant_id", 1), ("created_at", -1)])

# Rate limiting in Nginx
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=100r/m;
```

### Frontend Optimization

```bash
# Enable lazy loading for routes
# Already configured in vite.config.ts

# Use React.memo for expensive components
# Use code splitting for large bundles

# Analyze bundle
npm run build
npm install -g vite-plugin-visualizer
# Check dist folder size
ls -lh dist/
```

### Database Optimization

```bash
# Monitor slow queries
mongosh --eval 'db.setProfilingLevel(1, { slowms: 1000 })'

# Analyze query performance
db.products.explain("executionStats").find({tenant_id: "xyz"})
```

---

## Security Best Practices

### Checklist

- [ ] Change default passwords
- [ ] Use strong JWT secret (minimum 32 characters)
- [ ] Enable HTTPS/SSL on all endpoints
- [ ] Setup firewall rules (UFW, Security Groups)
- [ ] Regular security updates: `sudo apt-get upgrade`
- [ ] Rotate API keys regularly
- [ ] Use environment variables for secrets (never hardcode)
- [ ] Enable rate limiting on all endpoints
- [ ] Setup CORS for specific domains only
- [ ] Regular backups
- [ ] Monitor access logs
- [ ] Use secrets management service (HashiCorp Vault, AWS Secrets Manager)

### Setup UFW Firewall

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp      # SSH
sudo ufw allow 80/tcp      # HTTP
sudo ufw allow 443/tcp     # HTTPS
sudo ufw allow 8000/tcp    # Backend (internal only)
sudo ufw enable
```

---

## Maintenance & Upgrades

### Regular Maintenance

```bash
# Weekly
- Check logs for errors
- Verify backups are working
- Monitor disk space: df -h

# Monthly
- Update dependencies: npm update, pip install --upgrade
- Review security patches
- Test backup restoration

# Quarterly
- Load testing
- Security audit
- Performance review
```

### Update Dependencies

```bash
# Frontend
cd frontend
npm outdated        # Check available updates
npm update          # Update to latest minor versions
npm audit fix       # Fix security vulnerabilities

# Backend
cd backend
pip list --outdated
pip install --upgrade -r requirements.txt
```

### Docker Image Updates

```bash
# Pull latest images
docker pull mongo:7
docker pull redis:7-alpine
docker pull nginx:alpine

# Rebuild application image
docker build -t sathi-backend:latest ./backend

# Update running containers
docker-compose down
docker-compose pull
docker-compose up -d
```

---

## Deployment Checklist

### Pre-Deployment

- [ ] All tests passing locally
- [ ] Code reviewed and merged to main
- [ ] Environment variables configured
- [ ] Database backups taken
- [ ] SSL certificates valid
- [ ] API documentation updated
- [ ] Security audit completed

### During Deployment

- [ ] Monitor deployment logs in real-time
- [ ] Verify all services started correctly
- [ ] Test critical user flows
- [ ] Check performance metrics
- [ ] Verify database connectivity
- [ ] Test WebSocket connections

### Post-Deployment

- [ ] Verify frontend loads
- [ ] Test API endpoints: `curl https://api.sathi.com/docs`
- [ ] Check backend logs for errors
- [ ] Monitor resource usage
- [ ] Test user login flow
- [ ] Verify payment gateway integration
- [ ] Test WhatsApp integration
- [ ] Check SSL certificate validity

---

## Support & Resources

### Documentation
- FastAPI: https://fastapi.tiangolo.com
- React: https://react.dev
- MongoDB: https://docs.mongodb.com
- Docker: https://docs.docker.com
- Nginx: https://nginx.org/en/docs

### Useful Commands

```bash
# Backend health check
curl https://api.sathi.com/api/v1/health

# Frontend
https://sathi.app

# API Documentation
https://api.sathi.com/docs
https://api.sathi.com/redoc

# Monitor services
docker stats
docker-compose logs -f

# SSH into backend
docker-compose exec backend /bin/bash

# Database shell
mongosh "mongodb+srv://user:password@cluster.mongodb.net/sathi"
```

---

## Contact & Support

- **Documentation**: Check docs/ folder in repository
- **Issues**: GitHub Issues
- **Email**: dev-team@sathi.com
- **Slack**: #deployment channel

---

**Last Updated**: May 27, 2026
**Version**: 1.0.0

