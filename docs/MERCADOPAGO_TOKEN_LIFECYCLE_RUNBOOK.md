# Mercado Pago — Token Lifecycle Runbook

Operator reference for understanding, monitoring, and recovering from MP credential
lifecycle events (refresh, expiry, encryption errors).

See also:
- [MercadoPago OAuth Integration](./MERCADOPAGO_OAUTH.md)
- [API Endpoint Analysis §1.8](./MERCADOPAGO_API_ENDPOINTS.md)

---

## 1. Token Lifecycle Overview

| Phase | When | What happens |
|-------|------|--------------|
| **OAuth connect** | Tenant authorizes app | `access_token` + `refresh_token` stored encrypted (v12 schema) |
| **Normal operation** | Each API call | `credentialsService.getCredentials()` decrypts and returns tokens |
| **Near-expiry** | ≤ 60 s before `token_expires_at` | Auto-refresh triggered transparently in `getCredentials()` |
| **Refresh success** | After grant | New token pair encrypted and written back; `refreshed_at` updated |
| **Refresh failure** | API error / revoked | Row set to `status: "error"`; old token returned for current call |
| **Re-encrypt legacy** | First read of plaintext row | Old token re-encrypted in place silently |
| **Expiry without refresh** | `token_expires_at` passed and no refresh_token | API calls will start failing; tenant must re-authorize |

MP token lifetime: **180 days** (`expires_in: 15552000` seconds).

---

## 2. Database Schema (migration v12)

Table: `mercadopago_credentials`

| Column | Type | Description |
|--------|------|-------------|
| `access_token` | `text` | Encrypted with AES-256-GCM (`enc:v1:` prefix) |
| `refresh_token` | `text \| null` | Encrypted; `null` if MP did not return one |
| `token_expires_at` | `timestamptz \| null` | UTC expiry based on `expires_in` from token response |
| `refreshed_at` | `timestamptz \| null` | Last successful refresh or re-encrypt timestamp |
| `status` | `text` | `active` \| `inactive` \| `error` |
| `error_message` | `text \| null` | Last error detail for `error` status rows |

---

## 3. Encryption Format

Tokens are stored in this format when encrypted:

```
enc:v1:<iv_b64url>.<tag_b64url>.<ciphertext_b64url>
```

- Algorithm: **AES-256-GCM**
- Key derivation: `SHA-256(MP_TOKENS_ENCRYPTION_KEY || AUTH_SECRET)` → 32-byte key
- Each token gets a unique 12-byte random IV (never reused)
- Auth tag is stored inline; tampering causes a decryption error

**Key configuration priority:**

1. `MP_TOKENS_ENCRYPTION_KEY` (recommended, dedicated)
2. `AUTH_SECRET` (fallback)
3. If neither is set: tokens are stored **unencrypted** (development only)

Generate a suitable key:
```bash
openssl rand -hex 32
```

---

## 4. Auto-Refresh Behavior

Refresh skew window: **60 seconds** (`REFRESH_SKEW_MS = 60_000`).

Flow when `token_expires_at - now() ≤ 60 s`:

```
getCredentials(tenantId)
  └── refreshCredentialsIfNeeded(creds)
        ├── POST /oauth/token (grant_type=refresh_token)
        ├── encrypt new access_token + refresh_token
        ├── UPDATE mercadopago_credentials SET access_token=…, token_expires_at=…, refreshed_at=now()
        └── return decrypted new creds
```

If `refresh_token` is `null` or `token_expires_at` is `null`, auto-refresh is skipped
and the current token is returned as-is.

---

## 5. Error States and Recovery

### 5.1 `status: "error"` on a credential row

**Cause:** Decryption failed or refresh API call returned an error.

**Symptoms:**
- `getCredentials()` returns `null` for the tenant
- Payment flows fail with "MP credentials not configured"
- Health-check endpoint reports MP disconnected

**Recovery options:**

| Scenario | Action |
|----------|--------|
| Refresh token revoked / MP app deauthorized | Tenant must re-authorize via OAuth connect |
| Encryption key rotated without re-encrypting rows | Restore original key OR run re-encryption migration |
| Transient MP API error (5xx) | Wait for next request; auto-retry happens on next `getCredentials()` call; manually clear `status = "active"` if needed |
| Token manually corrupted in DB | Delete row and have tenant re-connect |

**Manual status reset (use with caution):**
```sql
UPDATE mercadopago_credentials
SET status = 'active', error_message = NULL
WHERE tenant_id = '<tenant_id>'
  AND status = 'error';
```

### 5.2 Missing encryption key in production

**Symptom:** Server logs `MercadoPago token is encrypted but no MP_TOKENS_ENCRYPTION_KEY/AUTH_SECRET is configured`

**Fix:** Set `MP_TOKENS_ENCRYPTION_KEY` in environment and redeploy. Tokens will be
decrypted on the next read if the key is correct.

### 5.3 Token expired with no refresh_token

**Symptoms:** MP API calls return 401; `token_expires_at` is in the past; `refresh_token` is null.

**Recovery:** Tenant must click "Conectar con Mercado Pago" again to complete a new OAuth flow.
Old credential row will be soft-deleted (set `status: "inactive"`) and a new row inserted.

### 5.4 Key rotation

To rotate `MP_TOKENS_ENCRYPTION_KEY`:

1. Add **new key** as `MP_TOKENS_ENCRYPTION_KEY` without removing old key temporarily.
2. Run a migration script that reads every `active` row using old key, re-encrypts
   with new key, and writes back.
3. Remove old key from environment.

> There is no automated key rotation job yet — this must be done manually or via a
> one-shot migration script.

---

## 6. Monitoring Checklist

| Signal | Source | Action threshold |
|--------|--------|-----------------|
| Credentials with `status = 'error'` | DB query | Alert if count > 0 for > 5 min |
| `refreshed_at` > 180 days ago | DB query | Pre-emptive re-auth warning to tenant |
| Decryption error log entries | Server logs | Alert on any occurrence in production |
| 401 responses from MP API | App logs | Correlate with credential `status` |

**Useful query — credentials expiring within 7 days:**
```sql
SELECT tenant_id, token_expires_at, refreshed_at, status
FROM mercadopago_credentials
WHERE status = 'active'
  AND token_expires_at < now() + interval '7 days'
ORDER BY token_expires_at;
```

**Useful query — error credentials:**
```sql
SELECT tenant_id, error_message, updated_at
FROM mercadopago_credentials
WHERE status = 'error'
ORDER BY updated_at DESC;
```

---

## 7. References

- Implementation: `lib/services/mercadopago/tokenCrypto.ts`
- Credential CRUD: `lib/services/mercadopago/credentialsService.ts`
- OAuth token exchange: `lib/services/mercadopago/oauthService.ts` → `refreshAccessToken()`
- DB schema: `lib/sql/types.ts` — `MercadopagoCredentialsTable`
- Migration: `lib/sql/migrations.ts` — migration v12
- Env var: `MP_TOKENS_ENCRYPTION_KEY`
