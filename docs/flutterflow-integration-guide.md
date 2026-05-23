# FlutterFlow Integration Guide — Valises Backend MVP

> Version: 1.0 | Lot: #265 | Date: 2026-05-23

## Table of Contents

1. [Base configuration](#1-base-configuration)
2. [Auth flow](#2-auth-flow)
3. [Onboarding flow](#3-onboarding-flow)
4. [Mobile contract](#4-mobile-contract)
5. [Trip creation flow](#5-trip-creation-flow)
6. [Package + transaction flow](#6-package--transaction-flow)
7. [Legal acknowledgements](#7-legal-acknowledgements)
8. [Notifications & activity feed](#8-notifications--activity-feed)
9. [Error handling](#9-error-handling)
10. [Recommended FlutterFlow variables](#10-recommended-flutterflow-variables)
11. [CORS configuration](#11-cors-configuration)

---

## 1. Base configuration

### Base URL

```
https://valises-backend-production.up.railway.app
```

Configure this as a **Global App State** string variable `apiBaseUrl` in FlutterFlow.

### Required headers

Every authenticated request must include:

```
Authorization: Bearer <accessToken>
Content-Type: application/json
```

In FlutterFlow API calls, set the `Authorization` header dynamically from the `accessToken` app state variable.

### Swagger documentation

Interactive API docs are available at:
```
https://valises-backend-production.up.railway.app/docs
```

---

## 2. Auth flow

### 2.1 Register

**POST** `/auth/register`

```json
{
  "email": "user@example.com",
  "password": "SecurePassword123"
}
```

| Response | Meaning |
|---|---|
| 201 | User created — proceed to login |
| 400 | Validation error (password too short, invalid email) |
| 409 | Email already registered |

### 2.2 Login

**POST** `/auth/login`

```json
{
  "email": "user@example.com",
  "password": "SecurePassword123"
}
```

**Response 200:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "userId": "uuid",
  "email": "user@example.com",
  "role": "USER"
}
```

**FlutterFlow action sequence:**
1. API call → POST /auth/login
2. On success → set `accessToken` (App State String)
3. Set `userId` (App State String)
4. Navigate to onboarding check page

---

## 3. Onboarding flow

### 3.1 Check onboarding status

**GET** `/onboarding/status`

**Response 200:**
```json
{
  "isComplete": false,
  "nextStep": "KYC",
  "nextStepUrl": "/kyc",
  "completedSteps": ["REGISTRATION"]
}
```

**FlutterFlow routing logic:**
```
if isComplete == true  → navigate to Home
if nextStep == "KYC"   → navigate to KYC page
if nextStep == null    → navigate to Home
```

---

## 4. Mobile contract

The mobile contract is the **single source of truth** for the mobile app's capabilities. Fetch it once after login and cache it in App State.

### 4.1 Get mobile contract

**GET** `/mobile/me/contract`

**Response 200:**
```json
{
  "contractVersion": "v1",
  "platformVersion": "1.0.0",
  "supportedPayinMethods": ["MOBILE_MONEY", "CARD"],
  "corridors": [
    {
      "id": "uuid-corridor",
      "code": "FR_CM",
      "name": "France → Cameroun",
      "status": "ACTIVE"
    }
  ],
  "user": { "id": "uuid", "email": "...", "role": "USER" },
  "kyc": {
    "status": "PENDING",
    "isVerified": false,
    "nextStep": "KYC",
    "nextStepUrl": "/kyc"
  },
  "capabilities": {
    "canPublishTrips": true,
    "canPublishPackages": true,
    "canMessage": true,
    "canCreateTransactions": true
  }
}
```

**Critical field:** `corridors[].id` is the `corridorId` UUID required for trip and package creation.

**FlutterFlow usage:**
- Populate corridor dropdown from `corridors[]`
- Store selected `corridors[N].id` as `corridorId` app state variable
- Check `capabilities.canPublishPackages` before showing package form
- Check `kyc.isVerified` before showing transaction UI

### 4.2 Pricing details

**GET** `/pricing/corridors`

Returns pricing info per corridor with `items[]`:

```json
{
  "items": [
    {
      "corridorCode": "FR_CM",
      "priceDisplayLabel": "From",
      "priceDisplayValue": "11.5 EUR/kg",
      "isBookable": true,
      "settlementCurrency": "XAF"
    }
  ],
  "count": 1
}
```

Use this to show pricing labels in corridor selection UI.

---

## 5. Trip creation flow

A traveler creates a trip to offer luggage capacity.

```
POST /trips → DRAFT
  ↓
POST /trips/:id/ticket-upload-intent → upload URL
  ↓
PATCH /trips/:id/submit-ticket → ticket submitted
  ↓
[Admin verification]
  ↓
PATCH /trips/:id/publish → ACTIVE (trip visible for matching)
```

### 5.1 Create trip

**POST** `/trips`

```json
{
  "corridorId": "<uuid from contract.corridors[].id>",
  "departAt": "2026-09-15T10:00:00Z",
  "capacityKg": 23
}
```

**Response 201:** Trip object with `id`, `status: "DRAFT"`

Store `tripId` in App State.

### 5.2 Get my trips

**GET** `/trips/me`

Returns list of all trips for the authenticated traveler.

---

## 6. Package + transaction flow

### 6.1 Create package (sender)

**POST** `/packages`

```json
{
  "corridorId": "<uuid from contract.corridors[].id>",
  "weightKg": 5,
  "description": "Clothing and personal items"
}
```

**Response 201:** Package object with `id`, `status: "DRAFT"`

### 6.2 Declare content

**PATCH** `/packages/:id/declare-content`

```json
{
  "contentCategory": "CLOTHING",
  "contentSummary": "Clothes, shoes, and personal care items",
  "declaredItemCount": 6,
  "declaredValueAmount": 150,
  "declaredValueCurrency": "EUR",
  "containsFragileItems": false,
  "containsLiquid": false,
  "containsElectronic": false,
  "containsBattery": false,
  "containsMedicine": false,
  "containsPerishableItems": false,
  "containsValuableItems": false,
  "containsDocuments": false,
  "containsProhibitedItems": false,
  "prohibitedItemsDeclarationAccepted": true
}
```

`contentCategory` enum values: `CLOTHING`, `ELECTRONICS`, `FOOD`, `MEDICINE`, `DOCUMENTS`, `COSMETICS`, `OTHER`

### 6.3 Publish package

**PATCH** `/packages/:id/publish`

No body. Package becomes `PUBLISHED` and appears in matching.

### 6.4 Find trip candidates

**GET** `/matching/packages/:id/trip-candidates`

Returns a list of trips that can carry this package (same corridor, compatible dates).

### 6.5 Create transaction

**POST** `/transactions`

```json
{
  "tripId": "<uuid of an ACTIVE trip>",
  "packageId": "<uuid of the PUBLISHED package>"
}
```

**Response 201:**
```json
{
  "transaction": {
    "id": "uuid",
    "status": "CREATED",
    "amount": 57500,
    "currency": "XAF"
  },
  "pricingDetails": { ... }
}
```

Store `transactionId` in App State.

### 6.6 Initiate payment

**POST** `/transactions/:id/payment-intent`

**Response 201:** Payment provider URL or redirect info.

### 6.7 List and view transactions

**GET** `/transactions` — all transactions for the authenticated user

**GET** `/transactions/:id` — single transaction with full details

---

## 7. Legal acknowledgements

Legal steps must be completed before key actions are possible.

### 7.1 Acknowledge package rules

**POST** `/legal/packages/:packageId/acknowledge-rules`

No body. Records the sender's acceptance of prohibited-items rules for this package.

Call this before showing the declare-content form.

### 7.2 Acknowledge platform role for transaction

**POST** `/legal/transactions/:transactionId/acknowledge-platform-role`

No body. Acknowledges the platform's role in the transaction. Required before payment.

---

## 8. Notifications & activity feed

### 8.1 Notifications

**GET** `/notifications/me`

```json
[
  {
    "id": "uuid",
    "type": "TRANSACTION_CONFIRMED",
    "message": "Your transaction has been confirmed",
    "isRead": false,
    "createdAt": "2026-05-23T10:00:00Z"
  }
]
```

**Acknowledge a notification:**

**POST** `/notifications/:notificationId/ack`

> Note: `POST /notifications/me` does **not** exist. The correct method for listing is `GET`.

### 8.2 Activity feed

**GET** `/activity-feed/me`

Returns a chronological list of events (trip created, package published, transaction confirmed, etc.) for the authenticated user.

---

## 9. Error handling

| HTTP Code | Meaning | FlutterFlow action |
|---|---|---|
| 400 | Validation error — check `message` field | Show field errors |
| 401 | Missing or expired JWT | Redirect to login |
| 403 | Forbidden — KYC not verified or role mismatch | Show KYC prompt |
| 404 | Resource not found | Show "not found" state |
| 409 | Conflict — resource already exists | Show "already registered" message |
| 422 | Business rule violation (e.g., package not published) | Show specific guidance |
| 429 | Rate limit exceeded | Show retry countdown |
| 500 | Server error | Show generic error + retry |

### 9.1 KYC gate

When the backend returns a 403 with `{ "code": "KYC_REQUIRED", ... }`, redirect to the KYC page. The response includes `nextStepUrl` to guide the user.

### 9.2 JWT expiry

When a 401 is returned, the token has expired. Clear `accessToken` from App State and redirect to login. Implement token refresh logic if needed.

### 9.3 Common 400 codes

| Code | Meaning |
|---|---|
| `PACKAGE_CONTENT_NOT_DECLARED` | Must call `/declare-content` before publishing or booking |
| `PACKAGE_CONTENT_BLOCKED` | Package contains prohibited items — cannot proceed |
| `PRICING_CONFIG_NOT_BOOKABLE` | Corridor not currently open for booking |
| `LIMIT_EXCEEDED` | Transaction amount exceeds platform limit |

---

## 10. Recommended FlutterFlow variables

Define these as **App State** variables:

| Variable | Type | Source |
|---|---|---|
| `apiBaseUrl` | String | Constant: production URL |
| `accessToken` | String | POST /auth/login → accessToken |
| `userId` | String | POST /auth/login → userId |
| `corridorId` | String | GET /mobile/me/contract → corridors[].id |
| `tripId` | String | POST /trips → id |
| `packageId` | String | POST /packages → id |
| `transactionId` | String | POST /transactions → transaction.id |
| `kycStatus` | String | GET /mobile/me/contract → kyc.status |
| `canPublishPackages` | Boolean | GET /mobile/me/contract → capabilities.canPublishPackages |
| `onboardingComplete` | Boolean | GET /onboarding/status → isComplete |

---

## 11. CORS configuration

The backend CORS policy uses **exact string matching** on allowed origins. Wildcard domains (e.g., `*.flutterflow.app`) are **not** supported by default.

### FlutterFlow app domains

FlutterFlow web previews and published apps use domains such as:
- `https://<your-project>.flutterflow.app`
- `https://<your-project>.web.app` (Firebase Hosting)

### Required action

Add your FlutterFlow app URL to the `CORS_ORIGINS` Railway variable:

```
CORS_ORIGINS=https://your-project.flutterflow.app,https://your-project.web.app,https://your-custom-domain.com
```

Multiple origins are comma-separated. The backend parses this variable at startup.

> Note: For mobile apps (iOS/Android), CORS does not apply — the `Authorization` header is all that is needed.

### Verification

After updating `CORS_ORIGINS`, redeploy on Railway and test with:

```bash
curl -I -X OPTIONS https://valises-backend-production.up.railway.app/auth/login \
  -H "Origin: https://your-project.flutterflow.app" \
  -H "Access-Control-Request-Method: POST"
```

Expect `Access-Control-Allow-Origin: https://your-project.flutterflow.app` in the response headers.
