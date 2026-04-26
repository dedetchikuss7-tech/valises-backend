# Storage Provider Readiness

## Current status

The backend uses a storage abstraction through the `STORAGE_PROVIDER` injection token.

The only implemented provider today is:

- `MOCK_STORAGE`

The following provider names are reserved for future production integration but are not implemented yet:

- `S3`
- `CLOUDINARY`
- `SUPABASE`
- `MANUAL`

If one of these future providers is selected through `STORAGE_PROVIDER`, the application fails fast at startup instead of silently pretending that production storage is available.

## Environment variable

```env
STORAGE_PROVIDER=MOCK_STORAGE
```

If the variable is missing, the backend defaults to `MOCK_STORAGE`.

## Local / development / test behavior

`MOCK_STORAGE` is intended for local, development and automated test flows.

It returns mock upload URLs and mock object URLs such as:

```txt
https://mock-storage.local/upload/...
https://mock-storage.local/object/...
```

It supports the current backend upload lifecycle:

1. prepare upload intent;
2. client-side upload simulation;
3. confirm upload;
4. persist confirmed storage metadata on business records.

## Current consumers

The storage abstraction is currently used by:

- Evidence upload intents;
- Evidence upload confirmations;
- Trip ticket upload intents.

## Evidence lifecycle

Evidence upload flow:

```txt
POST /evidence/upload-intents
client uploads file to returned uploadUrl
POST /evidence/attachments/confirm-upload
backend confirms via STORAGE_PROVIDER.confirmUpload(...)
backend creates EvidenceAttachment with storage metadata
admin reviews EvidenceAttachment
```

Stored Evidence metadata includes:

- `provider`
- `providerUploadId`
- `storageKey`
- `objectUrl`
- `publicUrl`
- `fileName`
- `mimeType`
- `sizeBytes`

## Trip ticket lifecycle

Trip ticket upload flow:

```txt
POST /trips/:id/ticket-upload-intent
client uploads file to returned uploadUrl
PATCH /trips/:id/submit-ticket
admin reviews ticket through PATCH /admin/trips/:id/verify-ticket
trip can be published only after ticket verification
```

Flight ticket metadata is stored directly on `Trip`, because the flight ticket is a core Trip business document and not a generic Evidence attachment.

## Production readiness warning

Do not configure:

```env
STORAGE_PROVIDER=S3
STORAGE_PROVIDER=CLOUDINARY
STORAGE_PROVIDER=SUPABASE
STORAGE_PROVIDER=MANUAL
```

until the matching provider implementation exists.

The current behavior is intentional:

- unsupported provider values fail fast;
- reserved but not implemented provider values fail fast;
- `MOCK_STORAGE` remains the only safe provider for local/dev/test.

## Future production integration checklist

Before enabling a production storage provider, implement and validate:

- provider-specific Nest provider class;
- upload intent generation;
- upload confirmation;
- object URL and/or public URL policy;
- private vs public file access rules;
- signed URL expiration policy;
- file size enforcement;
- MIME type enforcement;
- audit metadata;
- error handling and retry behavior;
- environment variable validation;
- e2e coverage using the provider boundary;
- operational documentation.

## Non-goals of the current implementation

The current storage boundary does not provide:

- real S3 integration;
- real Cloudinary integration;
- real Supabase Storage integration;
- antivirus scanning;
- OCR;
- AI file classification;
- binary file upload through the backend API.