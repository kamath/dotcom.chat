# Session Storage Refactor

## Overview
Refactored the session storage from local server-side storage to encrypted JWT tokens stored in HTTP-only cookies for better security and scalability.

## Changes Made

1. **Created new JWT-based session manager** (`lib/session-manager.ts`)
   - Uses `jose` library for JWT handling
   - Stores session data in encrypted HTTP-only cookies
   - Maintains OAuth clients in memory (consider Redis for production)

2. **Updated API routes**:
   - `/api/mcp/auth/connect` - Now creates JWT sessions instead of using local sessionStore
   - `/api/mcp/auth/callback` - New route to handle OAuth callbacks
   - `/api/chat` - Uses session from cookies instead of generating new sessionId

3. **Updated connection manager** (`lib/mcp-connection-manager.ts`)
   - Removed local SessionStore class
   - Now uses SessionManager for client storage

4. **Updated tools service** (`services/mcp/tools-service.ts`)
   - Now retrieves session from cookies instead of generating local sessionId

## Configuration

Add to your `.env.local`:
```
JWT_SECRET=your-secure-random-string-here
```

## Security Benefits

1. **No server-side session storage** - Sessions are stored client-side in encrypted cookies
2. **HTTP-only cookies** - Prevents XSS attacks from accessing session tokens
3. **Secure flag** - Cookies only sent over HTTPS in production
4. **SameSite protection** - CSRF protection

## Next Steps for Production

1. Use a proper session store (Redis) for OAuth clients instead of in-memory storage
2. Set a strong JWT_SECRET environment variable
3. Consider implementing refresh tokens for long-lived sessions
4. Add session expiry and renewal logic