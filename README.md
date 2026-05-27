# Sathi — Multi-Tenant Shop Management SaaS

Modern inventory, billing & POS platform for **any retail business** — grocery, pharmacy, electronics, clothing, and more.

![Stack](https://img.shields.io/badge/React-19-61DAFB)
![Stack](https://img.shields.io/badge/FastAPI-0.115-009688)
![Stack](https://img.shields.io/badge/MongoDB-7-47A248)

## Features

| Module | Capabilities |
|--------|-------------|
| **Auth** | Signup, login, JWT + refresh, RBAC (Owner/Manager/Cashier/Staff) |
| **Multi-tenant** | Isolated workspace per shop, onboarding wizard |
| **Inventory** | Products, SKU auto-gen, stock tracking, low-stock alerts |
| **POS** | Fast checkout, tax calc, cash/card/UPI, keyboard shortcuts |
| **Billing** | Invoices, HTML templates, stock movements |
| **CRM** | Customer profiles, purchase history |
| **Dashboard** | Sales KPIs, charts, recent transactions |
| **Admin** | Platform analytics, tenant list (super admin) |
| **WhatsApp Bills** | Send generated invoice PDFs directly to customers through WhatsApp Cloud API |

## Tech Stack

- **Frontend**: React, TypeScript, Vite, Tailwind CSS v4, Framer Motion, Zustand, TanStack Query, Recharts
- **Backend**: Python FastAPI, Motor (async MongoDB), JWT, Jinja2 invoices
- **Database**: MongoDB
- **Deploy**: Docker Compose, Nginx, Vercel (FE), Render/Railway (BE)

## Project Structure

```
sathi/
├── frontend/          # React SPA
├── backend/app/       # FastAPI application
├── docker/            # Nginx config
├── docs/              # Architecture, schema, roadmap
└── docker-compose.yml
```

## Quick Start

### Prerequisites

- Node.js 20+
- Python 3.12+
- MongoDB (local or Atlas)

### 1. Clone & configure

```bash
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

### 2. Start MongoDB

```bash
docker compose up mongodb -d
```

### 3. Backend

```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

API docs: https://dukan-saathi.onrender.com/docs

To send invoice PDFs directly on WhatsApp, add these to `backend/.env`:

```bash
WHATSAPP_CLOUD_API_TOKEN=your_meta_whatsapp_cloud_api_token
WHATSAPP_PHONE_NUMBER_ID=your_meta_phone_number_id
WHATSAPP_BUSINESS_ACCOUNT_ID=your_meta_whatsapp_business_account_id
WHATSAPP_TEST_RECIPIENT_PHONE=your_meta_test_recipient_number
WHATSAPP_API_VERSION=v20.0
WHATSAPP_ENABLED=false
```

Keep `WHATSAPP_ENABLED=false` until the Meta Cloud API credentials and test/production recipient setup are confirmed. Without a working WhatsApp setup, the app still supports invoice PDF download and QR bill links.

To bootstrap the SaaS admin login, add:

```bash
SUPER_ADMIN_EMAIL=admin@sathi.app
SUPER_ADMIN_PASSWORD=choose-a-strong-password
```

The backend creates this super admin on startup only when `SUPER_ADMIN_PASSWORD` is set and the email does not already exist.

For subscription checkout, configure Razorpay so plan payments come to your business account:

```bash
RAZORPAY_KEY_ID=rzp_live_or_test_key
RAZORPAY_KEY_SECRET=your_razorpay_secret
RAZORPAY_WEBHOOK_SECRET=optional_webhook_secret
```

New shopkeepers are created with `subscription_status=pending`; they must complete a plan payment before dashboard, POS, inventory, and reports unlock.

### 4. Frontend

```bash
cd frontend
npm install
npm run dev
```

App: http://localhost:5173

For QR bill downloads that customers scan from another phone, set `VITE_PUBLIC_API_URL` in `frontend/.env` to a reachable backend URL, such as your deployed API domain or your computer's LAN URL during local testing:

```bash
VITE_PUBLIC_API_URL=http://192.168.1.25:8000/api/v1
```

The backend must be running with `--host 0.0.0.0` so phones on the same Wi-Fi can reach it.

### Docker (full stack)

```bash
docker compose up --build
```

## API Overview

| Endpoint | Description |
|----------|-------------|
| `POST /api/v1/auth/signup` | Register shop + owner |
| `POST /api/v1/auth/login` | Get tokens |
| `GET /api/v1/billing/dashboard` | Analytics |
| `POST /api/v1/billing/invoices` | Create sale |
| `GET/POST /api/v1/products` | Inventory |
| `GET/POST /api/v1/customers` | CRM |
| `WS /api/v1/ws/{tenant_id}` | Live billing updates |

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Database Schema](docs/DATABASE_SCHEMA.md)
- [Roadmap](docs/ROADMAP.md)

## License

Proprietary — All rights reserved.
