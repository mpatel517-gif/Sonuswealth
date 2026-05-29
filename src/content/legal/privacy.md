# Privacy Policy

**Last updated:** 2026-05-28
**Effective:** 2026-05-28

This Privacy Policy explains how Sonuswealth Ltd ("we", "us", "Sonuswealth") collects, uses, and protects personal data when you use the Sonuswealth platform (the "Service").

## 1. Who we are

Sonuswealth Ltd is a private limited company registered in England and Wales. We are the controller of the personal data we collect through the Service.

- **Contact:** privacy@sonuswealth.example *(replace with real address before launch)*
- **Data Protection contact:** dpo@sonuswealth.example *(replace with real address before launch)*

We are **not an FCA-authorised firm**. The Service provides information, guidance, and storage tools only — it does not provide regulated financial advice.

## 2. What data we collect

We collect only what we need to provide the Service:

**You give us directly:**
- Account details: name, email, age, jurisdiction
- Financial information you enter or upload (assets, liabilities, income, pension details, documents)
- Onboarding answers and goals
- Any messages you send to Ask Sonu

**We collect automatically:**
- Technical data: browser type, IP address, device identifiers, timestamps
- Usage data: which screens you visit, features you use, errors encountered
- Cookies and similar technologies (see our Cookie Policy)

We do **not** collect:
- Payment card numbers (the Service is currently free; if billing is added we will use a PCI-compliant payment processor and not store card data ourselves)
- Special-category data (health, biometrics, etc.) unless you choose to upload it
- Facial-recognition or biometric identifiers

## 3. Lawful bases for processing

Under UK GDPR we rely on the following lawful bases:

| Purpose | Lawful basis |
|---|---|
| Providing the Service to you | Contract (Article 6(1)(b)) |
| Account security, fraud prevention | Legitimate interest (Article 6(1)(f)) |
| Compliance with FCA, HMRC, and Companies House obligations | Legal obligation (Article 6(1)(c)) |
| Service analytics, product improvement | Legitimate interest (Article 6(1)(f)) |
| Marketing communications | Consent (Article 6(1)(a)) — you can withdraw consent at any time |

## 4. How long we keep your data

- **Account data:** while your account is active, plus 7 years after closure (HMRC tax record obligations)
- **Financial inputs you provide:** while your account is active; deleted within 30 days of account closure unless retention is required by law
- **Usage analytics:** 24 months, anonymised after that
- **Error logs:** 90 days
- **Ask Sonu conversation history:** 30 days idle, then session reset (token counts retained for usage accounting per §6)

## 5. Who we share data with

We share personal data only with service providers necessary to run the platform:

- **Supabase (database & auth)** — data stored in EU regions
- **Anthropic (AI processing for Ask Sonu)** — message content sent to Claude for response generation; Anthropic's data-handling terms apply
- **Sentry (error monitoring)** — error reports, no message content
- **PostHog (product analytics)** — anonymous events, EU-hosted, no £ amounts
- **HMRC / ONS / Bank of England** — public data only, never personal data

We do **not** sell personal data. We do **not** share with advertisers. We do **not** share with brokers, fund managers, insurers, or financial product providers for marketing.

## 6. Anthropic / Ask Sonu specifics

When you use the Ask Sonu feature, the content of your messages and a structured summary of your financial position is sent to Anthropic to generate the response. Anthropic processes this data on our behalf under their commercial agreement. They do not use it to train their models when accessed via the commercial API (Anthropic's standard contract).

You can choose not to use Ask Sonu at any time. The Service works without it.

## 7. International transfers

Where data is transferred outside the UK (e.g. to Anthropic in the US), we rely on:
- UK International Data Transfer Agreement (IDTA), or
- Standard Contractual Clauses with the UK Addendum, plus
- Supplementary measures where required by ICO guidance

## 8. Your rights

Under UK GDPR you have the right to:

- **Access** — request a copy of the personal data we hold about you (see §9)
- **Rectification** — correct inaccurate data (most fields are editable in Settings)
- **Erasure** — request deletion of your data ("right to be forgotten")
- **Restriction** — limit how we process your data
- **Portability** — receive your data in a machine-readable format
- **Objection** — object to processing based on legitimate interest
- **Withdraw consent** — for any processing based on consent
- **Complain to the ICO** — Information Commissioner's Office (https://ico.org.uk)

We will respond to all rights requests within 30 days.

## 9. Data export (DSAR)

You can export all the data we hold about you at any time:

1. Sign in
2. Go to **Settings → Privacy → Export my data**
3. Receive a JSON file containing your entity record, events, and uploaded documents

For deletion requests (right to be forgotten), email privacy@sonuswealth.example or use the deletion flow in Settings → Privacy.

## 10. Security

- All data encrypted in transit (TLS 1.2+)
- Database encryption at rest (Supabase managed)
- Two-factor authentication available
- Row-level security policies restrict access to your own data
- Step-up authentication required for sensitive operations (e.g. commits to the event log)

No system is perfectly secure. We continue to invest in security practices and respond to disclosed vulnerabilities. Security contact: security@sonuswealth.example.

## 11. Children

The Service is not intended for individuals under 18. We do not knowingly collect data from children. If you believe we have, please contact privacy@sonuswealth.example.

## 12. Changes to this policy

We will notify you of material changes via the Service and update the "Last updated" date above. Continued use after notice constitutes acceptance.
