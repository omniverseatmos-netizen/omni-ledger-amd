# Phase 3 — OIDC / Microsoft Entra ID

Production startup now fails closed unless `AUTH_MODE=oidc` and the required OIDC settings are present. In OIDC mode `POST /v1/auth/login` returns `LOCAL_PASSWORD_DISABLED`; users authenticate through `GET /v1/auth/oidc/start`, which uses Authorization Code + PKCE, and return through `/v1/auth/oidc/callback`.

The callback validates the signed state, expiry, issuer, audience, nonce, expiry, allowed signing algorithm, JWKS signature, tenant claim, and configured tenant allowlist. Roles are read from the configured claim and intersected with the supported AtMoS roles; missing roles are rejected. The application creates or updates a tenant-scoped external user and issues a short-lived application session. No provider access token is stored.

Required production settings are documented in `deploy/.env.example`. For Entra ID, register the exact HTTPS redirect URI, configure the `roles` app-role claim (or change `OIDC_ROLE_CLAIM`), and use the tenant-specific v2 issuer. Set `OIDC_ALLOWED_TENANTS` explicitly; do not accept arbitrary `tid` values. Existing local-password records remain in the migration snapshot for rollback but are not usable through the API when OIDC mode is enabled.

This implementation is application-side readiness, not proof of an Entra tenant configuration. Before a real pilot, execute a tenant test with a test account for each role, verify disabled users and wrong-tenant tokens, rotate the client secret/state secret, and perform an independent security review.
