# Fix: Session user not transmitted to home page after login/signup

## Root Cause
The `secure: true` flag on the session cookie is hardcoded. In the Kubernetes environment with Traefik as Ingress:
- Browser ↔ Traefik: HTTPS (TLS terminated at Ingress)
- Traefik ↔ Gateway: HTTP (internal cluster traffic)

With `secure: true`, the browser requires HTTPS for the cookie. While the browser ↔ Traefik connection IS HTTPS, Traefik must forward `X-Forwarded-Proto: https` header for the gateway's `trust proxy: 1` setting to work correctly. 

If the header is missing or misconfigured, `req.secure` returns `false`, and the `secure: true` cookie may not be sent back by the browser on subsequent requests.

## Steps
- [x] Step 1: Read all relevant files to understand auth flow
- [x] Step 2: Analyze root cause and create plan
- [x] Step 3: **Edit `gateway-service/index.js`** — Fix cookie `secure` flag + cleanup
- [x] Step 4: **Edit `frontend-service/index.js`** — Add robust header handling + debug logs

