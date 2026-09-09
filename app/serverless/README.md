# Yandex Cloud adapter

This adapter serves an allowlisted release from a private Object Storage bucket through Cloud Functions and API Gateway. It reuses server/auth.mjs. The Node runtime entrypoint is serverless/index.handler (index.js bridges to ESM).

Generate serverless/files.json in the deployment package only: URL keys map to `{key,type,private}` storage entries. Include the public build, club JSON at /api/club, and referenced media. Runtime objects are never addressable through the router. Set non-secret BUCKET and PUBLIC_ORIGIN environment variables. The function's service account supplies a short-lived IAM token; there are no static access keys.

Keep runtime/auth.json private with the validated auth configuration. Login counters use ETag conditional writes, so concurrent invocations and cold starts do not reset or overwrite the limit. Logout writes a persistent marker per session ID. Storage failure denies access. New deployment origins require their own origin setting; existing VPS sessions do not transfer between hosts. Password verification can retain the same password with a fresh hash/signing configuration.

The service account needs storage.uploader on the application bucket and functions.functionInvoker on the function for the gateway. Granting roles requires the resource owner's administrator access. Keep bucket anonymous read/list/config flags disabled. Do not make the function publicly invokable; gateway calls it as the service account.

Tests: `node --test tests/serverless.test.mjs`. Deployment additionally requires real gateway login/cookie checks, exact media hashes, anonymous storage denial, origin validation and persistent logout replay checks. Source data and generated file manifests remain outside public Git.
