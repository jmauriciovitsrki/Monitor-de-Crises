# Security Specification: Seizure and Sleep Monitor

This document details the security specification, access control, and threat modeling for the Child Seizure and Sleep Tracking application using Google Firestore.

## 1. Data Invariants

1. **User Ownership**: A log document in `users/{userId}/logs/{logId}` must strictly belong to the user identified by `{userId}`.
2. **Immutable Identity**: No user can write a log containing a `userId` other than their own authenticated UID (`request.auth.uid`).
3. **Log ID Constraint**: The document ID (`logId`) represents the log date, formatted as a valid YYYY-MM-DD string, preventing duplicate profiles or spoofed historical indexing.
4. **Data Integrity for Sleep Metrics**: Sleep ratings must be positive integers between 1 and 5. Hours slept must be a non-negative number.
5. **Data Integrity for Seizure counts**: Morning, afternoon, night, and total seizure counts must be non-negative integers. Total count must correspond to the reported intervals and details.
6. **Temporal Order**: `createdAt` is set only on creation to the request server timestamp, while `updatedAt` is updated during writes to the request server timestamp.
7. **Verified Auth**: Authenticated interactions require an active, valid authentication token associated with the unique UID.

---

## 2. The "Dirty Dozen" Malicious Payloads (Negative Tests)

The rules must reject these 12 malicious requests with `PERMISSION_DENIED`.

### P1: Spoofing Owner UUID
An authenticated attacker (`UID = auth_user_123`) attempts to create a log inside `users/other_user_456/logs/2026-06-01` but sets `userId: "other_user_456"` to insert data into another user's tracking partition.
*Target: Create `users/other_user_456/logs/2026-06-01`*
```json
{
  "userId": "other_user_456",
  "date": "2026-06-01",
  "sleep": { "status": "dormiu", "quality": 4, "wakeUpCount": 1 },
  "seizures": { "occurred": false, "totalCount": 0 },
  "medication": { "taken": true }
}
```

### P2: Injecting Ghost Fields
An attacker attempts to write unvalidated "ghost" fields (e.g., `role: "admin"` or `isApproved: true`) to escalates visual state privileges.
*Target: Create/Update `users/auth_user_123/logs/2026-06-01`*
```json
{
  "userId": "auth_user_123",
  "date": "2026-06-01",
  ... (standard fields) ...,
  "role": "admin",
  "ghostField": "hacked"
}
```

### P3: Forging Client Timestamps
An attacker attempts to set an arbitrary `createdAt` timestamp (e.g., in the future or backdated to 2010), bypassing server timestamp verification.
*Target: Create `users/auth_user_123/logs/2026-06-01`*
```json
{
  "userId": "auth_user_123",
  "date": "2026-06-01",
  "createdAt": "2010-01-01T00:00:00Z"
}
```

### P4: Overwriting Historical Lock (Altering `createdAt`)
An attacker attempts to change the `createdAt` value during a log update.
*Target: Update `users/auth_user_123/logs/2026-06-01`*
```json
{
  "createdAt": "2020-05-01T12:00:00Z"
}
```

### P5: Poisoned Sleep Quality Boundary (Quality = 99)
An attacker writes a log setting `sleep.quality` to 99, designed to break statistical charts or cause calculation range errors.
*Target: Create `users/auth_user_123/logs/2026-06-01`*
```json
{
  "userId": "auth_user_123",
  "date": "2026-06-01",
  "sleep": { "status": "dormiu", "quality": 99, "wakeUpCount": 0 },
  "seizures": { "occurred": false, "totalCount": 0 },
  "medication": { "taken": true }
}
```

### P6: Poisoned Negative Seizure Counts (count = -5)
An attacker attempts to set `seizures.totalCount = -5` or negative segment counts to reverse aggregate counts or manipulate chart rendering.
*Target: Create `users/auth_user_123/logs/2026-06-01`*
```json
{
  "userId": "auth_user_123",
  "date": "2026-06-01",
  "sleep": { "status": "dormiu", "quality": 4, "wakeUpCount": 0 },
  "seizures": { "occurred": true, "totalCount": -5 },
  "medication": { "taken": true }
}
```

### P7: Injecting Oversized Triggers String (Buffer Overflow Attack)
An attacker attempts to inject a 1MB string into the `seizures.triggers` field to drive up memory footprints and exceed billing bounds.
*Target: Create `users/auth_user_123/logs/2026-06-01`*
```json
{
  "userId": "auth_user_123",
  "date": "2026-06-01",
  "seizures": {
    "occurred": true,
    "totalCount": 2,
    "triggers": "...(1MB long string goes here)..."
  }
}
```

### P8: Poisoned Path Variable Document ID
An attacker requests a write to a path where parent `{userId}` matches, but the `{logId}` is malicious (e.g. `../../admins/admin_user`), attempting path-traversal or directory escapes in ID injection.
*Target: Create `users/auth_user_123/logs/malicious_escaped_path`*

### P9: Blanket Read Request (Query Scraping)
An authenticated attacker attempts to query ALL logs across the entire database without setting the owner path parameter or query constraints, looking to harvest private names or details.
*Target: Get `users/other_user/logs`*

### P10: Unauthorized Delete of Historical Records
An attacker attempts to delete another user's historical log files.
*Target: Delete `users/other_user_456/logs/2023-08-15`*

### P11: Malicious Type Substitution (Sleep status = 45)
An attacker attempts to submit a log where `sleep.status` is registered as 45 instead of the required enum strings.
*Target: Create `users/auth_user_123/logs/2026-06-01`*

### P12: Anisotropic Multi-field Update Bypass
An attacker attempts to update critical structural fields like the parent log ID or date, seeking to decouple the document from its logical calendar index.
*Target: Update `users/auth_user_123/logs/2026-06-01`*
```json
{
  "date": "1999-12-31"
}
```

---

## 3. The Security Assertion & Verification Plan

All writes must be validated by the `firestore.rules` containing schema functions and structural validations.
We ensure that the rules contains strict checking of:
1. `request.auth.uid == userId`
2. `isValidId(logId)`
3. Valid payload shape: `isValidDailyLog(request.resource.data)`
4. Value boundaries: sleep quality within `[1, 5]`, numeric counts `>= 0`.
