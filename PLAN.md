# Implementation Plan - Facebook Ads Duplicator

Build a modern full-stack web application for duplicating Facebook Ads structures using the Meta Marketing API, following a safety-first approach.

## 1. Project Initialization
- Create root directory structure:
  - `backend/`: Express.js server
  - `frontend/`: Next.js application

## 2. Backend Development (Node.js/Express)
- **Setup**:
  - Initialize `npm` and install dependencies (`express`, `prisma`, `axios`, `jsonwebtoken`, `passport-facebook`, `dotenv`, `cors`, `zod`).
  - Configure Prisma with PostgreSQL.
- **Database Schema (`prisma/schema.prisma`)**:
  - `User`: Store user info and FB ID.
  - `Account`: Store Meta Ad Accounts.
  - `Session`: Store OAuth tokens safely.
  - `DuplicateJob`: Track duplication status and history.
- **Meta API Integration (`services/facebook.service.ts`)**:
  - Implement functions to fetch ad accounts, campaigns, ad sets, and ads.
  - Implement duplication logic:
    - Read original object.
    - Extract configuration.
    - Create new object with `status: "PAUSED"`.
    - Reuse `creative_id` for ads.
- **Authentication**:
  - Facebook OAuth 2.0 flow using Passport.js or manual Axios implementation.
  - JWT for session management between frontend and backend.
- **API Routes**:
  - `GET /api/adaccounts`: List ad accounts.
  - `GET /api/campaigns`: List campaigns for an account.
  - `GET /api/adsets/:campaignId`: List ad sets.
  - `GET /api/ads/:adsetId`: List ads.
  - `POST /api/duplicate`: Unified duplication endpoint (campaign/adset/ad).

## 3. Frontend Development (Next.js)
- **Setup**:
  - Initialize Next.js with TypeScript, Tailwind CSS, and App Router.
  - Install `shadcn/ui` components (button, card, dialog, table, checkbox, etc.).
  - Setup `zustand` for state management (auth, selected account, etc.).
  - Setup `framer-motion` for animations.
- **Components**:
  - `Layout`: Sidebar and Top Navbar.
  - `TreeView`: Nested expandable structure for Campaign -> Ad Set -> Ad.
  - `DuplicateModal`: Configuration for duplication (rename pattern, budget, copies).
  - `StatusBadge`: Visual indicator for "PAUSED" status.
- **Pages**:
  - `/login`: Facebook Login button.
  - `/dashboard`: Main ad account selection and overview.
  - `/explorer`: The main tree-view interface for browsing and selecting items.
  - `/history`: Log of duplication jobs.

## 4. Safety & Security
- **Safety**:
  - Hardcode `status: "PAUSED"` in all creation requests.
  - Confirmation dialogs before any write operation.
  - Clear visual warnings about potential ad spend.
- **Security**:
  - Store `access_token` securely (not in local storage if possible, use HTTP-only cookies or encrypted DB).
  - Validate all inputs using `zod`.

## 5. Verification Plan
- **Unit Tests**:
  - Test Meta API payload generation.
  - Test rename pattern logic.
- **Manual Verification**:
  - Log in with Facebook.
  - Fetch and display nested structure.
  - Perform a test duplication (verify `PAUSED` status in Meta Ads Manager).
  - Check `creative_id` reuse.

## 6. Documentation
- `README.md` with setup instructions.
- `.env.example` with required Meta App credentials.
