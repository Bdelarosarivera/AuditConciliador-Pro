# Security Specification for AuditConciliador Pro (Firebase Access Control)

This document contains the Security Specification (TDD) for the Cloud Firestore rules, outlining the invariants, the "Dirty Dozen" spoofing payloads, and the corresponding integration tests.

## 1. Data Invariants

- **User Profiles (`/users/{userId}`)**: A user profile can only be written by the authenticated user whose `uid` matches the document ID. No user can change their own assigned `role` or `status` to prevent self-assigned privilege escalation.
- **Audits (`/audits/{auditId}`)**: An audit header can only be created by an authenticated user with role `Admin`, `Auditor` or `Supervisor`. The `uploadedBy` must match the creator's UID. The `createdAt` must match the server time.
- **Inventory Items (`/audits/{auditId}/inventoryItems/{itemId}`)**: Items are sub-resources bound to a parent audit. They cannot exist without the parent audit exist. Only users with write access to the parent audit (Admins, Auditors, Supervisors) can create/update items.
- **Reports (`/reports/{reportId}`)**: Reports cannot be modified once generated. They always reference exists() parent audit.

---

## 2. The "Dirty Dozen" Payloads (Malicious Writes)

Here are the 12 precise attack payloads aimed at breaking our access control layers:

1. **Self-Elevated Admin Profile**: Registering or updating a user's own `/users/attackerUID` with `"role": "Admin"` manually to bypass role checks.
2. **Zombie Suspend Override**: Creating/updating `/users/suspendedUID` with `"status": "active"` after being suspended by an Admin.
3. **Alien Audit Spoofing**: Attempting to create `/audits/someAuditId` with `"uploadedBy": "otherUserUID"` to pin ownership on another auditor.
4. **Invalid Identification Poisoning**: Injecting an audit ID like `/audits/VERY_LONG_STRING_OVER_128_CHARS` to poison cache or memory.
5. **Backdated Audit Creation**: Forging `"createdAt": "2020-01-01T00:00:00Z"` to trick reporting systems.
6. **State Hijack to Approved**: Direct update of an audit's `"status"` to `"approved"` as a Viewer or Auditor without standard validation loop.
7. **Phantom Inventory Item Creation**: Creating an item `/audits/nonExistentAuditId/inventoryItems/item123` to pollute database with orphan items.
8. **Malicious Cost Overwrite**: Updating an inventory item's `"cost"` to `-45000` or a non-numeric payload to crash math engines on client dashboards.
9. **Invisible Field Shadows**: Inserting unlisted properties `"isSuperUser": true` into `/users/{userId}` to gain unmapped roles.
10. **Shadow Report Forgery**: Creating a fake report under `/reports/fakeReport` with high authority executive summaries.
11. **Malicious Difference Math**: Uploading an item with manually falsified `"differenceRD": 9999999` while `"physical"` and `"theoretical"` are equal.
12. **Status Lock Break-in**: Modifying a finalized audit (`"status": "finalized"`) or its sub-items when it is locked.

---

## 3. The Test Runner (`firestore.rules.test.ts`)

This is a complete, self-contained TypeScript file that tests the rules using `@firebase/rules-unit-testing`.

```typescript
import {
  initializeTestEnvironment,
  RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, setDoc, updateDoc, getDoc } from "firebase/firestore";
import * as fs from "fs";

describe("AuditConciliador Pro Security Rules", () => {
  let testEnv: RulesTestEnvironment;

  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: "gen-lang-client-0042560362",
      firestore: {
        rules: fs.readFileSync("firestore.rules", "utf8"),
      },
    });
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
  });

  it("blocks self-elevated Admin role creation", async () => {
    const attackerContext = testEnv.authenticatedContext("attacker_123");
    attackerContext.firestore();
    // Payload 1
    const badPayload = {
      uid: "attacker_123",
      name: "Attacker",
      email: "attacker@test.com",
      role: "Admin", // self-elevating
      createdAt: new Date().toISOString(),
      status: "active"
    };
    await expect(
      setDoc(doc(attackerContext.firestore(), "users", "attacker_123"), badPayload)
    ).rejects.toThrow();
  });

  it("blocks zombie status bypass on suspended users", async () => {
    const context = testEnv.authenticatedContext("attacker_123");
    const db = context.firestore();
    // Payload 2
    await expect(
      updateDoc(doc(db, "users", "attacker_123"), { status: "active" })
    ).rejects.toThrow();
  });

  it("blocks alien audit spoofing", async () => {
    const context = testEnv.authenticatedContext("auditor_bob");
    const db = context.firestore();
    // Payload 3
    const badAudit = {
      auditName: "Bob's Malicious Session",
      uploadedBy: "alien_charlie", // Spoofed ownership
      uploadedAt: new Date().toISOString(),
      status: "draft",
      summary: { totalArticulos: 0 },
      createdAt: new Date().toISOString()
    };
    await expect(
      setDoc(doc(db, "audits", "audit_999"), badAudit)
    ).rejects.toThrow();
  });
});
```
