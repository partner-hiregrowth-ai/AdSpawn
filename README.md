# AdsDuplicator - Facebook Ads Structure Duplication Tool

A modern full-stack web application for duplicating Facebook Ads structures safely using the Meta Marketing API.

## Core Features

- **Nested Explorer**: Browse campaigns, ad sets, and ads in a tree-like interface.
- **Bulk Duplication**: Select multiple items and duplicate them at once.
- **Deep Duplication**: Duplicate a campaign along with all its ad sets and ads.
- **Safety First**: Every new object is created with status **PAUSED** to prevent accidental ad spend.
- **Creative Reuse**: Reuses original `creative_id` to preserve social proof (likes, comments, shares).
- **Naming Patterns**: Customize the name of duplicated objects using templates.
- **Audit Log**: Keep track of all duplication jobs and their status.

## Tech Stack

- **Frontend**: Next.js, TypeScript, Tailwind CSS, shadcn/ui, Zustand, Framer Motion.
- **Backend**: Node.js, Express.js, Axios.
- **Database**: PostgreSQL with Prisma ORM.
- **Authentication**: Facebook OAuth 2.0.
- **API**: Meta Marketing API.

## Project Structure

```
├── backend/            # Express.js server
│   ├── prisma/         # Database schema and migrations
│   ├── src/
│   │   ├── controllers/ # Request handlers
│   │   ├── services/    # Business logic (Meta API integration)
│   │   ├── routes/      # API endpoints
│   │   └── middleware/  # Auth and validation
└── frontend/           # Next.js application
    ├── src/
    │   ├── app/        # Pages and layouts
    │   ├── components/ # UI components
    │   ├── services/   # API client
    │   └── store/      # State management (Zustand)
```

## Getting Started

### Prerequisites

- Node.js (v18+)
- PostgreSQL
- Meta App with `ads_management`, `ads_read`, and `business_management` permissions.

### Backend Setup

1. Navigate to `backend/`
2. Install dependencies: `npm install`
3. Copy `.env.example` to `.env` and fill in your credentials.
4. Run Prisma migrations: `npx prisma migrate dev`
5. Start the server: `npm run dev`

### Frontend Setup

1. Navigate to `frontend/`
2. Install dependencies: `npm install`
3. Copy `.env.example` to `.env.local` and fill in your Meta App ID.
4. Start the development server: `npm run dev`

## Safety Requirements

The system strictly enforces the following:
- All duplicated Campaigns, Ad Sets, and Ads are created as **PAUSED**.
- Creative IDs are reused to maintain social proof.
- Confirmation dialogs are shown before any write operation.
- Token security is prioritized.

## Deployment

### Backend
- Deploy as a standard Node.js application (e.g., Heroku, DigitalOcean, Railway).
- Ensure `DATABASE_URL` and `JWT_SECRET` are set.

### Frontend
- Deploy as a Static Site or SSR on Vercel or Netlify.
- Set `NEXT_PUBLIC_API_URL` to your backend URL.

## License
MIT
