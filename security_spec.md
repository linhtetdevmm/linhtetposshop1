# ShwePOS Firestore Security Specification (Phase 0)

## 1. Data Invariants
1. **Shop Isolation (Master Gate)**: Every sub-resource (`products`, `sales`, `purchases`, `stockLogs`, `debts`, `expenses`, `deliveries`) belongs to a parent `/shops/{shopId}` document where `shopId == request.auth.uid` and `ownerId == request.auth.uid`.
2. **Verified Identity**: All writes require `request.auth != null && request.auth.token.email_verified == true`.
3. **Immutable Ownership & Timestamps**: `ownerId` and `createdAt` can never be altered after creation; `createdAt` and `updatedAt` must strictly equal `request.time`.
4. **No Shadow Fields**: Every create checks `keys().hasAll(...) && keys().hasOnly(...)`, and every update checks `incoming().diff(existing()).affectedKeys().hasOnly(...)` wrapped inside `isValid[Entity](incoming())`.
5. **Terminal State Locking**: Once a `debt` reaches `status == 'settled'` or a `delivery` reaches `status in ['delivered', 'cancelled']`, non-admin updates are denied.
6. **Bounded Arrays & Strings**: Every string has an explicit `.size()` bound; `items` arrays in `sales` and `purchases` are strictly bounded (`size() > 0 && size() <= 100 && items[0] is map`).
7. **PII Protection**: Shop phone/address and customer phones/addresses are strictly owner-only; zero blanket `isSignedIn()` reads or list queries.

## 2. The "Dirty Dozen" Attack Payloads (Must Return PERMISSION_DENIED)
1. **Shadow Field Injection on Shop Create**: Adding `isAdmin: true` to `/shops/{uid}`.
2. **Identity Spoofing on Product Create**: Setting `ownerId: "victim_uid"` while authenticated as `"attacker_uid"`.
3. **Cross-Tenant Read (PII Leak)**: Reading `/shops/victim_uid/debts/debt_1` as `"attacker_uid"`.
4. **Unverified Email Write**: Creating a product when `request.auth.token.email_verified == false`.
5. **Client-Forged Timestamp**: Setting `createdAt` to a past timestamp instead of `request.time`.
6. **Immortal Field Tampering**: Updating `createdAt` or `ownerId` on an existing product.
7. **ID Poisoning**: Attempting to write to `/shops/{uid}/products/invalid$id%with spaces`.
8. **Value Poisoning on Update**: Updating `sellPrice` to a string `"999999"` or `name` to a 5KB string.
9. **Terminal State Re-opening**: Updating a `settled` debt back to `pending` as a non-admin.
10. **Unbounded Array Exhaustion**: Creating a sale with `items: []` or > 100 items.
11. **Unfiltered List Scraping**: Listing `/shops/victim_uid/sales` without `ownerId == request.auth.uid`.
12. **Orphaned Sub-Document Write**: Creating a product under `/shops/{uid}/products/p1` when parent `/shops/{uid}` does not exist.
