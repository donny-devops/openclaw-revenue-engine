# SARA Plus Touchless Seller Orchestration

## What I Need

- AT&T mobile new-account / touchless intent
- Non-sensitive customer profile (name, service address)
- Seller-visible order or transaction reference, if one exists
- Preferred customer handoff channel (email, text, Telegram, Slack)
- Confirmation that the seller will trigger official ID authentication

## Do Not Send

- SSN, date of birth, driver license, PIN, or payment details
- Requests to complete or skip ID authentication for the customer
- The customer’s secure-form session or screenshots of those fields

## Deliverables

- Seller-side step checklist from `skills/sara-plus-touchless/SKILL.md`
- Secure-link handoff prompt (link itself stays in SARA Plus)
- Draft customer SMS/email that does not collect secrets
- Pending-order tracker (waiting on seller, customer, or ID auth)
- Follow-up reminder list for stale customer-complete steps

## Operator Checklist

- Human review is required before any live SARA Plus click
- Agent may fill name, address, availability, plan, and device only
- Agent may trigger or resend the official secure link
- Customer completes consent, identity, and payment on their device
- ID authentication is mandatory — automated link or official call with transaction ID
- Location-services / iPad proximity rules stay in force
- Full hands-off automation of the regulated order is out of scope
