# AC-Pro Multi-Tenant SaaS Platform

AC-Pro is a full-featured, enterprise-grade Multi-Tenant Software-as-a-Service (SaaS) platform tailored for Air Conditioning Service & Maintenance Companies, with integrated Text.lk SMS and WhatsApp Business Gateways, automated service due reminder engines, QR code tagging, technician field PWAs, and dynamic per-technician seat SaaS billing.

---

## 🏛️ Architecture & Hierarchy

```
                   👑 SUPER ADMIN (Master Platform Owner)
                     ↓               ↓               ↓
             🏢 AC Company 1   🏢 AC Company 2   🏢 AC Company 3
                     ↓               ↓               ↓
             👤 Company Admin  👤 Company Admin  👤 Company Admin
                     ↓               ↓               ↓
              🧑‍🔧 Technicians    🧑‍🔧 Technicians    🧑‍🔧 Technicians
```

---

## 🔑 Key Features

1. **Multi-Tenant Data Isolation**:
   - Every tenant table stores `company_id`.
   - The backend automatically extracts `company_id` from the authenticated user token (NEVER trusted from frontend payloads).
   - Super Admin has a master company switcher to seamlessly and safely inspect tenant workspaces.

2. **Per-Technician SaaS Licensing & Billing**:
   - Default Price: **LKR 2,000 / active technician / month** (configurable in Super Admin SaaS Pricing settings).
   - Dynamic formula: `active_technicians × technician_price`.
   - Four technician lifecycle statuses: `ACTIVE`, `SUSPENDED`, `PENDING`, `CANCELLED`. Only `ACTIVE` technicians count towards billing.
   - When adding a technician (`+ ADD TECHNICIAN`), the system displays the exact fee confirmation: *"Adding this technician will add LKR 2,000 to your monthly subscription."*

3. **Text.lk SMS & WhatsApp Business Gateway Integration**:
   - Secure backend proxying (never exposes API tokens to frontend or technician PWA).
   - Super Admin configuration for Text.lk API Key, Sender ID, and test SMS dispatches.
   - Omnipresent communication triggers: `[SEND SMS]`, `[SEND WHATSAPP]`, `[SEND BOTH]`.
   - 11 built-in communication templates with dynamic variables (`{{customer_name}}`, `{{service_date}}`, `{{job_number}}`, `{{invoice_total}}`, `{{next_service_date}}`, etc.).
   - Full communication history and delivery tracking (`Pending`, `Sent`, `Delivered`, `Failed`).

4. **Automated AC Service Due Reminder Engine**:
   - When a service is completed or next service interval (e.g. 3 Months) is chosen, the engine automatically schedules reminders for:
     - 30 days before
     - 14 days before
     - 7 days before
     - 1 day before
     - On Due date (0 days)
   - Background cron schedule and manual reminder dispatching.

5. **AC Unit QR Tagging & Field Verification**:
   - Unique QR code generation for every AC unit.
   - Public scan verification page showing AC specifications, previous service records, and authorized service company hotline.

6. **Technician Field PWA**:
   - Dedicated mobile UI for technicians: My Assigned Jobs, Navigation/On The Way trigger, Start Job, Service Checklist, Parts Used, and Next Service Interval Selector.

---

## 🚀 Quick Start Guide

### 1. Install & Run Server
```bash
cd server
npm install
npm start
```
*Runs on `http://localhost:5000`*

### 2. Install & Run Client
```bash
cd client
npm install
npm run dev
```
*Runs on `http://localhost:5173`*

### 3. Run 29-Step Automated Acceptance Test
```bash
cd server
npm test
```

---

## 👥 Default Accounts

| Role | Username / Email | Password |
|---|---|---|
| **Super Admin (Master)** | `superadmin@acpro.com` / `superadmin` | `superadmin123` |
| **ABC Company Admin** | `abcadmin` / `admin@abc-aircon.lk` | `adminPassword123` |
| **Field Technician** | `kasun_tech` | `kasunPassword123` |
