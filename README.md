# Akshar Real Estate — Backend

Node.js / Express REST API powering the Akshar Estate real estate platform.

## Tech Stack

- **Node.js + Express** — REST API server
- **MongoDB + Mongoose** — database and ODM
- **JWT** — stateless authentication
- **Cloudinary** — image / document storage
- **Google OAuth** — one-tap login token verification

## Key Features

- **Property CRUD** — public listing queries with text search, BHK, city, type and deal-mode filters
- **Advanced Search** — token-based query parser (`normalizeSearch`, `searchTokens`, `priceIntentFilter`) feeding ranked MongoDB queries
- **Authentication** — email/password + Google OAuth, JWT issue and refresh
- **User Management** — admin endpoints for listing, filtering, status-toggle and CSV export
- **Owner Applications** — submit, review, approve/reject property listing requests
- **Wishlist API** — save/remove properties per authenticated user
- **Admin CMS** — hero section, site settings, navbar areas, staff accounts
- **Enquiries** — contact and property enquiry capture

## API Route Groups

| Prefix | Description |
|---|---|
| `/api/auth` | Login, register, Google OAuth, user profile, wishlist |
| `/api/properties` | Public property listing and search |
| `/api/admin/properties` | Admin property CRUD and media upload |
| `/api/admin/users` | User management (list, stats, status, export) |
| `/api/admin/owners` | Owner application review workflow |
| `/api/admin/enquiries` | Contact and property enquiry management |
| `/api/admin/cms` | Site content / CMS management |
| `/health` | Health check endpoint |

## Local Development

1. Install dependencies:

```bash
npm install
```

2. Create `Backend/.env` from `Backend/.env.example` and fill real values:

```bash
cp .env.example .env
```

Required values are `MONGODB_URI` or `MONGO_URI`, `JWT_SECRET`, and Cloudinary credentials for uploads.
For production Google login, also set `GOOGLE_CLIENT_ID` to the same OAuth Web Client ID used by the frontend `VITE_GOOGLE_CLIENT_ID`.

3. Start the API:

```bash
npm run dev
```

The default API port is `5000`. In development, if that port is already busy and `PORT_FALLBACK=true`, the server will try the next port and print the final URL.

4. Health check:

```bash
curl http://127.0.0.1:5000/health
```

If the server started on a fallback port, use that printed port and update `Frontend/.env.local` accordingly.

## Environment Variable Reference

| Variable | Required | Description |
|---|---|---|
| `MONGODB_URI` | ✅ | MongoDB Atlas connection string |
| `JWT_SECRET` | ✅ | Random secret ≥ 32 characters |
| `JWT_EXPIRES_IN` | Optional | Token lifetime (default: `7d`) |
| `CLOUDINARY_CLOUD_NAME` | ✅ for uploads | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | ✅ for uploads | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | ✅ for uploads | Cloudinary API secret |
| `GOOGLE_CLIENT_ID` | Optional | OAuth Web Client ID for Google login |
| `CORS_ORIGIN` | Optional | Comma-separated allowed frontend origins, e.g. `https://www.aksharestate.in,https://aksharestate.in,http://localhost:5173,http://localhost:3000` |
| `PORT` | Optional | API port (default: `5000`) |
| `PORT_FALLBACK` | Optional | Auto-increment port if busy (`true`/`false`) |

## Security Notes

- **Never commit `.env`** — it is in `.gitignore`. Only `.env.example` with placeholder values belongs in source control.
- `JWT_SECRET` must be a long random string; generate one with: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
- `GOOGLE_CLIENT_ID` must match `VITE_GOOGLE_CLIENT_ID` in the frontend exactly.
