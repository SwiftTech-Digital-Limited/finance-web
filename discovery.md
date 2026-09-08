# Authentication persistence discovery

## Problem

After a successful login, refreshing the Vercel frontend redirects the user to `/login` and appears to log them out.

Frontend URL:

`https://koboplan.vercel.app`

Backend is hosted on Railway.

## Root cause

The frontend keeps the access token in an in-memory variable. A browser refresh clears that variable. The frontend then attempts to restore the session through:

`POST /api/v1/auth/refresh`

That request depends on the backend refresh-token cookie. Because the frontend and backend are hosted on different origins, the refresh cookie must be explicitly configured for cross-origin credentialed requests. If the cookie is missing, blocked, or not sent, session restoration fails and the frontend redirects to login.

## Backend implementation prompt

Fix authentication persistence for the deployed KoboPlan frontend.

The frontend is deployed at:

`https://koboplan.vercel.app`

The backend is deployed on Railway. Users can log in successfully, but refreshing the Vercel page logs them out because the in-memory access token is lost and the refresh-token cookie is not restoring the session.

Please make the following backend changes:

1. Configure the refresh-token cookie for cross-origin HTTPS requests:

```ts
{
  httpOnly: true,
  secure: true,
  sameSite: "none",
  path: "/"
}
```

Use the actual refresh-cookie name already used by the application. Do not expose the refresh token to JavaScript.

2. Configure CORS with the exact frontend origin and credentials enabled:

```ts
{
  origin: "https://koboplan.vercel.app",
  credentials: true
}
```

Do not use `origin: "*"` together with `credentials: true`.

3. Ensure the following endpoints set, read, and clear the same refresh cookie consistently:

- `POST /api/v1/auth/login`
- `POST /api/v1/auth/register`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`

4. Ensure `POST /api/v1/auth/refresh` accepts credentialed requests and returns a valid access token plus the authenticated user in the existing API envelope format.

5. Ensure logout clears the cookie using the same `path`, `sameSite`, `secure`, and domain options used when setting it.

6. Verify that the Railway deployment is served over HTTPS and that proxy trust settings do not prevent secure cookies from being set.

7. Add or update tests covering:

- Login sets the refresh cookie.
- Refresh from `https://koboplan.vercel.app` with credentials restores the session.
- Refresh without a valid cookie returns `401`.
- Logout clears the refresh cookie.
- CORS allows `https://koboplan.vercel.app` and rejects unauthorized origins.

8. Manually verify in a browser:

- Log in at `https://koboplan.vercel.app`.
- Confirm a refresh-token cookie appears in browser storage.
- Refresh the page.
- Confirm `POST /api/v1/auth/refresh` includes the cookie and returns `200`.
- Confirm the user remains on the dashboard.

The frontend already sends requests with `credentials: "include"`; do not solve this by storing the refresh token in localStorage.
