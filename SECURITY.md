# Security notes

- Never commit `.env` files, API tokens, authorization headers, or real invoice/customer data.
- `amd_omni_pipeline.mjs` reads `AMD_TOKENFACTORY_API_KEY` or `RADEON_API_KEY` from the local process environment. The public UI never accepts or stores a provider key.
- The pipeline has a request timeout, strict JSON parsing, strict input type/date/quantity validation, exact master-data allowlists, and fail-closed behavior for unknown SKUs/suppliers.
- Model output is untrusted. It is not passed directly to a ledger write until schema validation succeeds; deterministic domain operations enforce subsequent business rules.
- `server.mjs` binds to `127.0.0.1` by default, serves static files only, restricts HTTP methods, protects against path traversal, and sets baseline browser security headers. Override `HOST` deliberately only when local network exposure is intended.
- The GitHub Pages entrypoints declare a meta Content Security Policy. Static-host response headers remain controlled by GitHub Pages; a meta policy is defense in depth and does not replace response-header protections such as `frame-ancestors`.
- SHA-256 hashes and Merkle-root seals are integrity checks, not encryption or a legal digital signature.
- This repository has not undergone a professional penetration test, regulated validation, or production threat-model review.
