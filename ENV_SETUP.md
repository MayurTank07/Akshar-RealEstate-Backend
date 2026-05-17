# Backend Environment Setup Guide

## Environment Variables

The backend requires several environment variables to function properly.

### Setup Instructions

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Configure your `.env` file with actual values:

### Required Environment Variables

#### Application Environment
```env
NODE_ENV=development        # Options: development, production
PORT=5001                  # Server port (default: 5001)
```

#### Database
```env
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/database?appName=akshar-realestate
```

**To get MongoDB URI:**
1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create a cluster (if not already created)
3. Click "Connect" → "Connect your application"
4. Copy the connection string
5. Replace `<password>` with your database password
6. Replace `<database>` with your database name

#### Authentication
```env
JWT_SECRET=your-super-secret-jwt-key-at-least-32-characters-long
JWT_EXPIRES_IN=7d           # Token expiration time
```

**Generate JWT Secret:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

#### Cloudinary (Required for Image Uploads)
```env
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
```

**To get Cloudinary credentials:**
1. Go to [Cloudinary](https://cloudinary.com/)
2. Sign up or log in
3. Go to Dashboard
4. Copy Cloud Name, API Key, and API Secret

#### CORS Configuration
```env
CORS_ORIGIN=http://127.0.0.1:5173,http://localhost:5173,https://akshar-real-estate.vercel.app
```

**Add your frontend URLs (comma-separated):**
- Local development: `http://127.0.0.1:5173` and `http://localhost:5173`
- Production: `https://akshar-real-estate.vercel.app`

## Running the Application

### Development (with auto-reload)
```bash
npm run dev
```

### Production
```bash
npm start
```

### Seed Database (optional)
```bash
npm run seed
```

## Production Deployment (Render)

### Render Environment Variables

In your Render dashboard, add these environment variables:

| Variable | Value |
|----------|-------|
| `NODE_ENV` | `production` |
| `PORT` | `5001` (or auto-assigned by Render) |
| `MONGODB_URI` | Your MongoDB Atlas URI |
| `JWT_SECRET` | Your generated secret |
| `JWT_EXPIRES_IN` | `7d` |
| `CLOUDINARY_CLOUD_NAME` | Your Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | Your Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Your Cloudinary API secret |
| `CORS_ORIGIN` | `http://127.0.0.1:5173,http://localhost:5173,https://akshar-real-estate.vercel.app` |

### Render Deployment Steps

1. Connect your GitHub repository to Render
2. Select "Web Service"
3. Configure:
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Environment**: `Node`
4. Add environment variables (see table above)
5. Deploy

## Important Security Notes

- **Never commit `.env` file** - It contains sensitive credentials
- The `.env.example` file is safe to commit as a template
- Use strong JWT secrets (minimum 32 characters)
- Use MongoDB Atlas IP allowlist for security
- Rotate secrets periodically

## Troubleshooting

### MongoDB Connection Issues
- Verify MongoDB URI is correct
- Check MongoDB Atlas IP allowlist (allow `0.0.0.0/0` for Render)
- Ensure database user has correct permissions

### CORS Errors
- Add frontend URL to `CORS_ORIGIN`
- Ensure URLs don't have trailing slashes
- Check browser console for actual origin being blocked

### Image Upload Issues
- Verify all Cloudinary credentials are correct
- Check Cloudinary dashboard for upload activity
- Ensure Cloudinary account is active

### Authentication Issues
- Verify `JWT_SECRET` is set and consistent
- Check token expiration time
- Ensure client is sending token in Authorization header

## Health Check

Test if the backend is running:
```bash
curl http://localhost:5001/health
```

Expected response:
```json
{"success":true,"status":"ok"}
```
