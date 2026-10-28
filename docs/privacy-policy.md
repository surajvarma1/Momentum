# Momentum — Privacy Policy & Data Safety Disclosures

> **Effective Date:** October 25, 2026  
> **Application:** Momentum ("Build momentum. Crush your goals.")  
> **Developer:** Momentum Team  
> **Compliance:** Google Play Data Safety, GDPR, CCPA

---

## 1. Core Privacy Philosophy: Local-First by Default

Momentum is engineered with a **local-first** foundation:
- You can use Momentum indefinitely in **Guest Mode** without ever creating an account, supplying an email, or connecting to the internet.
- When used in Guest Mode, 100% of your tasks, subtasks, focus sessions, and reminder settings remain stored strictly on your local device sandbox in SQLite.
- We **never** silently upload or exfiltrate guest tasks. If you subsequently choose to register a cloud account, Momentum explicitly asks for your consent before associating local tasks with your account.

---

## 2. Information We Collect (Cloud Users Only)

When you explicitly register for a Momentum Cloud account, we collect:

| Data Type | Purpose | Storage & Protection |
|---|---|---|
| **Account Credentials** (Email, Password Hash) | Authentication, session restoration, and password recovery. | Managed securely by Supabase Auth (Argon2 / bcrypt password hashing). |
| **Tasks & Productivity Data** | Syncing tasks, subtasks, deadlines, priorities, and tags across your authorized devices. | Stored in PostgreSQL with Row Level Security (RLS). Encrypted in transit via TLS 1.3. |
| **Focus Arena History** | Syncing focus session timestamps and streak metrics. | Stored with strict user-id scoping and RLS. |
| **AI Goal Decomposition Prompts** | Processing goal breakdown requests via the `ai-decompose` Edge Function and Bytez. | Sent to the authenticated Supabase Edge Function over TLS. Bytez processes the prompt to provide the requested service. |

We **do not** collect:
- Precise GPS location data
- Financial or payment card data
- Contacts or phonebook entries
- Advertising IDs or tracking cookies
- Raw audio, microphone, or camera data

---

## 3. Bytez AI Processing

If you use the optional AI Goal Decomposer:
- The goal description and parameters (such as preferred session duration or target deadline) are sent to the authenticated Supabase Edge Function.
- The Bytez API key is configured by the project operator in the Supabase Edge Function environment; it is not entered or transmitted by the client.
- If the Edge Function is unavailable, the app displays an error and does not send the prompt or provider credentials directly from the client.
- Bytez processes the prompt using the project-configured model (`Qwen/Qwen3-4B`) to generate structured milestone proposals under its own service terms and data-retention policies.
- Results are treated as drafts until you review and confirm them.

---

## 4. Platform Permissions

Momentum requests minimal Android permissions:

| Permission | Purpose | Mandatory? |
|---|---|---|
| `POST_NOTIFICATIONS` (Android 13+) | Delivering scheduled deadline reminders and focus timer completion alerts. | Optional (can be revoked in device settings at any time). |

We **do not** request:
- `SCHEDULE_EXACT_ALARM` (Momentum uses battery-friendly inexact alarms)
- `READ_EXTERNAL_STORAGE` or `WRITE_EXTERNAL_STORAGE`
- `CAMERA` or `RECORD_AUDIO`

---

## 5. Account Deletion & Data Retention

You have the complete right to delete your account and all associated data at any time:
1. In the app: Navigate to **Settings $\rightarrow$ Cloud Sync & Account $\rightarrow$ Delete Account**.
2. Or via web request to privacy@momentum.app.
3. Upon deletion, a cascading database trigger (`ON DELETE CASCADE`) permanently purges all profile records, tasks, subtasks, focus sessions, reminders, and AI quotas from the cloud database within 24 hours.
