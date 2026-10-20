---
name: sara-plus-touchless
description: Seller-side SARA Plus touchless orchestration for AT&T mobile. Fill non-sensitive fields, trigger the official secure link, and track orders waiting on the customer. Never enter SSN, DOB, driver license, PIN, or payment data, and never complete or bypass ID authentication.
---

# SARA Plus Touchless (Seller-Side Only)

Use this skill for AT&T mobile **new account / touchless** work in SARA Plus.

SARA Plus is customer-controlled for compliance. The agent may orchestrate the **seller** UI and communications. The customer must consent and enter their own identity and payment data on their own device.

## Hard limits

Do not enter, collect, store, or relay:

- SSN or social security number
- Date of birth
- Driver license / state ID numbers
- PIN
- Payment card, CVV, bank, or routing details

Do not complete ID authentication for the customer. Do not skip, spoof, or workaround ID auth. Automated link or manual call with the transaction ID is mandatory.

Do not bypass iPad location-services or proximity rules.

Do not attempt full hands-off automation of a regulated sales order.

If a seller asks for any of the above, refuse, explain that the customer must use the SARA Plus secure link, and continue only with seller-side steps.

## Allowed seller-side work

Use built-in browser tools on the seller SARA Plus web UI only:

1. Open the seller’s own authorized session. Do not paste credentials into chat.
2. Start AT&T mobile new account / touchless.
3. Fill non-sensitive fields: name, service address, contact that the seller is allowed to enter.
4. Run service availability.
5. Select plan and device.
6. Trigger credit check **without** entering identity data.
7. Trigger **send secure link** / touchless handoff at the official step.
8. Draft the SMS/email/Telegram note that accompanies the link. The actual URL comes from SARA Plus.
9. Monitor seller-visible order status.
10. Resend the official link if the customer closed the browser.
11. Prompt official ID auth (automated link or call + transaction ID).
12. Advance only after SARA Plus shows the customer finished their secure steps.
13. Message the seller when the link is waiting or the customer is done.
14. Keep a checklist of orders waiting on the customer.

## Decision points

Stop and ask the seller before:

- Plan or promo choice
- Device / fulfillment choice
- Whether to send the link by email or text
- Whether to resend the link
- How to launch ID auth (automated link vs official call)
- Any screen whose label is unfamiliar

Never invent a bypass when a screen asks for customer-secure data. Hand that screen to the customer via the official secure link.

## Customer message

Draft only. Do not fabricate the SARA Plus URL.

Tell the customer:

- The official secure link is coming from SARA Plus (email or text).
- Open it on their own device.
- Complete consent, identity, and payment there.
- Keep that browser open until confirmation appears.
- Do not send SSN, DOB, PIN, or card details back to the seller or agent.

## Scheduling

Cron / heartbeat may:

- List orders in `link_sent` or `awaiting_customer`
- Remind the seller to follow up
- Produce a status report with names/order refs only — no secrets

## Hermes vs OpenClaw

- **Hermes:** after each successful seller session, append observed screen names and button labels to this skill or memory so the procedure improves.
- **OpenClaw:** same skill; reach the seller from Telegram/Slack/Discord through the gateway.

## First live capture

Exact SARA Plus button labels are not guessed here. On the first supervised run:

1. Drive only non-sensitive steps.
2. Let the seller click **send secure link**.
3. Write the real screen titles and button labels back into this skill.
4. Re-test seller-side steps before enabling unattended orchestration.

Until that capture exists, treat every unlabeled control as a seller decision point.
