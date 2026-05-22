# CinetPay Sandbox Setup

Guide to configure and test CinetPay payments in the sandbox environment before going live.

---

## 1. Create a Sandbox Account

1. Go to [https://sandbox.cinetpay.com](https://sandbox.cinetpay.com).
2. Click **Créer un compte** and fill in your details (name, email, password).
3. Confirm your email address via the verification link sent to your inbox.
4. Log in to the sandbox dashboard.

---

## 2. Retrieve API Credentials

Once logged in:

1. Navigate to **Paramètres** → **API**.
2. Copy your **API Key** (`CINETPAY_API_KEY`).
3. Copy your **Site ID** (`CINETPAY_SITE_ID`).

These sandbox credentials are separate from production credentials and only work against the sandbox environment.

---

## 3. Configure Webhook (Notify URL)

CinetPay calls the notify URL after each payment attempt to confirm the result.

1. In the sandbox dashboard go to **Paramètres** → **Webhooks** (or **IPN**).
2. Set the webhook URL to:
   ```
   https://valises-backend-production.up.railway.app/provider-webhooks/events
   ```
3. Save the configuration.

> For local development, use a tunnelling tool such as [ngrok](https://ngrok.com) to expose your local server and use `https://<your-ngrok-id>.ngrok.io/provider-webhooks/events` instead.

---

## 4. Environment Variables

Add the following variables to your Railway project (or local `.env` file):

```env
PAYMENT_PROVIDER=CINETPAY
CINETPAY_ENV=sandbox
CINETPAY_API_KEY=<your_sandbox_api_key>
CINETPAY_SITE_ID=<your_sandbox_site_id>
CINETPAY_NOTIFY_URL=https://valises-backend-production.up.railway.app/provider-webhooks/events
CINETPAY_RETURN_URL=https://your-app.com/payment/return
```

`CINETPAY_ENV` controls which API URL the provider uses (`sandbox` or `production`). Both currently resolve to `https://api-checkout.cinetpay.com/v2/payment`; the environment is distinguished by the credentials used.

---

## 5. Run a Test Payment

1. Start the backend with the sandbox variables above.
2. Create a transaction and call `POST /transactions/:id/payment-intent`.
3. Open the returned `checkoutUrl` in a browser.
4. CinetPay's sandbox checkout page accepts the following test card details:
   - **Card number**: `4242 4242 4242 4242`
   - **Expiry**: any future date
   - **CVV**: any 3-digit number
5. After payment, CinetPay calls the notify URL and the transaction status should update to `PAID`.

> Sandbox payments never charge real money. Use only the sandbox credentials above.

---

## 6. Switch to Production

When ready to go live:

1. Create a production account at [https://app.cinetpay.com](https://app.cinetpay.com).
2. Complete the KYC / business verification steps.
3. Retrieve production **API Key** and **Site ID**.
4. Update Railway Variables:
   ```env
   CINETPAY_ENV=production
   CINETPAY_API_KEY=<your_production_api_key>
   CINETPAY_SITE_ID=<your_production_site_id>
   ```
5. Leave `CINETPAY_NOTIFY_URL` and `CINETPAY_RETURN_URL` unchanged (already pointing at production Railway URL).
