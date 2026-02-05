# Production Deploy & Payment Smoke Test

## 1. Production Build Verification

### Environment variables (Vercel)

Ensure these are set in **Vercel → Project → Settings → Environment Variables** for the **Production** environment (and Preview if you test preview URLs):

| Variable | Example / Required | Notes |
|----------|--------------------|--------|
| `VITE_LEMON_SQUEEZY_PRODUCT_ID` | `795931` | Inlined at build time; fallback in code is `795931` |
| `VITE_LEMON_SQUEEZY_VARIANT_ID` | `1255285` | Fallback in code is `1255285` |
| `VITE_LEMON_SQUEEZY_STORE` | `https://optlisting.lemonsqueezy.com` | Optional; fallback in code is this URL |

Vite replaces `import.meta.env.VITE_*` at **build time**. Redeploy after changing these so the new values are baked into the bundle.

### Verifying config in the browser

- **Development:** Open `/pricing`, open DevTools → Console. You should see:
  - `[CHECKOUT] getLemonSqueezyConfig()` with `{ store, productId: "795931", variantId: "1255285" }`.
- **Production:** After deploy, open the live site → `/pricing` → click **Subscribe** (while logged in). The opened URL should start with:
  - `https://optlisting.lemonsqueezy.com/buy/795931?checkout[variant_id]=1255285&...`
  - If you see `/buy/795931`, the build is using the correct product ID.

---

## 2. Live Checkout Trigger

1. Deploy the frontend to Vercel (with the env vars above set for Production).
2. Open the **live** site (e.g. `https://optlisting.vercel.app` or `https://optlisting.com`).
3. Log in so that `user` is available.
4. Go to **Pricing** (e.g. `/pricing`).
5. Click **Subscribe to Professional Plan** (or equivalent Subscribe button).
6. **Expected:** A new tab opens to Lemon Squeezy hosted checkout.
7. **Verify:** The URL in the new tab uses the path **`/buy/795931`** (not `/checkout/buy/...`). No 404.

If the Lemon Squeezy hosted page opens in a new tab without a 404, the live checkout trigger is **PASS**.

---

## 3. Webhook Readiness

### Endpoint

- **URL:** `POST /api/lemonsqueezy/webhook`
- **Host:** Backend (e.g. Railway: `https://optlisting-production.up.railway.app`).
- **Full URL:** `https://<your-backend-host>/api/lemonsqueezy/webhook`

### Backend behavior

- Accepts POST, reads raw body, verifies `X-Signature` with `LEMON_SQUEEZY_WEBHOOK_SECRET`.
- Parses JSON and routes by `meta.event_name` to `process_webhook_event()`.
- **user_id extraction:** Implemented in `webhooks.py` from:
  - `data.attributes.custom_data.user_id`
  - `meta.custom_data.user_id`
  - `data.attributes.first_order_item.custom_data.user_id`
  - Fallback: recursive search for `user_id` in payload.
- Always returns **200 OK** (body indicates success/error) to avoid Lemon Squeezy retries.

### Lemon Squeezy dashboard

1. **Webhook URL:** Set to `https://<your-backend-host>/api/lemonsqueezy/webhook`.
2. **Signing secret:** Set `LEMON_SQUEEZY_WEBHOOK_SECRET` (and optionally `LS_WEBHOOK_SECRET`) on the backend to match.

---

## Result

- **Build/config:** Correct if the opened checkout URL contains `/buy/795931` and the correct variant/store.
- **Live checkout:** **PASS** when the Subscribe button opens the Lemon Squeezy hosted page in a new tab without 404.
- **Webhook:** Backend is ready to receive POST and to extract `user_id` from the payload as above.

**If the checkout page opens successfully when you click Subscribe on the live site:**

# READY FOR REVENUE
