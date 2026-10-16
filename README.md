# 🚀 Bot by mogent (`bot.mogent.tech`)
### Autonomous Multi-Tenant Telegram Commerce Cloud Platform

An ultra-modern, production-ready SaaS platform built for running 50+ autonomous Telegram ecommerce stores and bots simultaneously on a lightweight **$7/mo AWS Lightsail Ubuntu VPS** (<300MB RAM budget).

---

## ⚡ Core Architecture & Highlights

- **100% USD-First Ledger**: Pure USD accounting across customer wallets, orders, wholesale proxies, and merchant balances, eliminating currency mismatch bugs.
- **Dynamic BDT Converter**: End-buyers in Bangladesh deposit in BDT via bKash, Nagad, or Rocket; the bot converts BDT to USD based on the merchant's live exchange rate.
- **Two-Tier Payment Engine**:
  - **Tier 1 (Retail Buyer ➔ Merchant)**:
    - *Local Manual*: bKash/Nagad/Rocket with 1-click merchant dashboard approval.
    - *Isolated Binance Pay*: Customer pays USDT to merchant's personal Binance UID. Automated HMAC SHA256 SAPI verification (`GET /sapi/v1/pay/transactions`) credits customer balance instantly.
  - **Tier 2 (Merchant ➔ Platform Owner)**:
    - Merchant tops up wholesale balance by sending USDT to Platform Owner's Binance UID.
    - Instant SAPI verification credits merchant's wholesale wallet without manual intervention.
- **Unified grammY Multi-Bot Engine**:
  - Dynamic `BotRegistry` loads, starts, and stops multiple merchant bots in a single Node.js process without server restarts.
  - Webhook router (`/api/webhook/telegram/:slug`) ensures zero socket memory bloat for 50+ bots.
  - Universal Unicode Emoji icon mapper (zero missing icons or Telegram Premium emojis).
  - Instant automated delivery of digital serials and accounts inside monospace code blocks.
- **Central Wholesale Reseller Proxy**:
  - Upstream integrations: **DigitalCore** (`digitalcore.top`) and **Canboso** (`canboso.com`).
  - **Automated Margin Engine**: Super Admin sets fixed fee (+$0.01 USD) + % markup. Merchant sees wholesale cost with platform fee included.
  - Two-phase purchase commit prevents balance deduction if upstream API fails.
- **Clean Slate Merchant Guarantee**:
  - New merchant registrations start with a completely clean and empty product catalog (zero fake products).
- **Secret Super Admin God-Mode (`/secure/hkjhl/sadmin`)**:
  - Guarded strictly by secret token `hkjhl-sadmin-godmode-2026`.
  - Zero public links or references in merchant login/landing pages.
  - Real-time Lightsail telemetry (RAM RSS/Heap, OS memory, uptime), wholesale provider live pings, global margin engine, merchant fleet table with 1-click emergency killswitches.

---

## 🛠️ Tech Stack

- **Runtime & Backend**: Node.js v22/v24, Express 5, TypeScript, `better-sqlite3` (WAL Mode).
- **Bot Engine**: `grammY` (dynamic multi-bot runner).
- **Frontend**: React 18, Vite, Tailwind CSS, Lucide icons, React Router 6.
- **Security**: AES-256-GCM encryption for API keys/secrets, bcryptjs, JWT authentication.
- **Design System**: Stealth Carbon (`#0b090a`), Card Surface (`#151214`), Crimson Rose (`#f43f5e`), Laser Blue (`#3b82f6`), and Neon Emerald (`#10b981`).

---

## 💻 Local Development Setup

1. **Install Dependencies:**
   ```bash
   cd "I:\Saas T"
   npm install
   cd client && npm install && npm run build && cd ..
   ```

2. **Run in Development Mode (Concurrent Server + Vite Client):**
   ```bash
   npm run dev
   ```
   - Client: `http://localhost:3000`
   - Server: `http://localhost:5000`

3. **Run in Production Mode (Serves Built Frontend from Express):**
   ```bash
   npm start
   ```
   - Open browser: `http://localhost:5000`
   - Secret God-Mode: `http://localhost:5000/secure/hkjhl/sadmin?token=hkjhl-sadmin-godmode-2026`

---

## 🚢 AWS Lightsail VPS 1-Click Deployment ($7/mo)

1. **Clone repository onto Ubuntu Lightsail VPS:**
   ```bash
   git clone <repo-url> /opt/mogent
   cd /opt/mogent
   ```

2. **Configure Environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your APP_ENCRYPTION_KEY and JWT_SECRET
   ```

3. **Launch with Docker Compose:**
   ```bash
   docker compose up -d --build
   ```

4. **Point Domain:**
   - Map `bot.mogent.tech` A-Record to your Lightsail VPS Public IPv4.
   - Set up Caddy or Nginx reverse proxy with SSL, or let Docker bind port 80/443 directly.
   - The container is configured with a strict 300MB memory ceiling (`deploy.resources.limits.memory: 300M`), fitting effortlessly into the $7 Lightsail tier!

---

## 🛡️ Secret Access & Default Credentials

| Area | URL Route | Access Secret / Guard |
| :--- | :--- | :--- |
| **Public Landing Page** | `/` | Open |
| **Merchant Register** | `/register` | 1-Click Wizard |
| **Merchant Login** | `/login` | Email or Username + Password |
| **Merchant Control Center** | `/admin` | JWT Bearer Token |
| **Secret God-Mode** | `/secure/hkjhl/sadmin` | `hkjhl-sadmin-godmode-2026` |

---
*Created by Antigravity · Engineering Document for Bot by mogent Architecture 2026*
