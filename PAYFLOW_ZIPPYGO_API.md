# PayFlow API for ZippyGo

## Endpoint

`POST https://YOUR_SUPABASE_PROJECT.supabase.co/functions/v1/payflow-api`

Authenticate with the PayFlow API key using either:

`Authorization: Bearer pf_live_...`

or

`X-API-Key: pf_live_...`

## Create a payment link

```json
{
  "action": "create_payment_link",
  "amount": 36.75,
  "currency": "USD",
  "title": "ZippyGo Airport Transfer",
  "description": "Airport transfer booking",
  "reference_id": "ZG-12345",
  "customer": {
    "name": "Ashraf Razi",
    "email": "customer@example.com",
    "phone": "+919177902449"
  },
  "return_url": "https://zippygo.example/payment/success",
  "cancel_url": "https://zippygo.example/payment/cancel",
  "max_uses": 1,
  "payment_methods": ["card", "upi", "bank_transfer", "wallet"]
}
```

## Successful response

```json
{
  "success": true,
  "id": "...",
  "link_id": "pl_...",
  "checkout_url": "https://payflow.example/checkout/pl_...",
  "amount": 36.75,
  "amount_minor": 3675,
  "currency": "USD",
  "status": "active",
  "reference_id": "ZG-12345",
  "customer_id": "..."
}
```

ZippyGo should redirect the customer to `checkout_url`. It should never construct the URL itself.

## Important

- `amount` is in major currency units.
- `amount_minor` can be supplied instead when the caller already has minor units.
- API keys are hashed in the database; the secret is never returned by API calls after creation.
- Keep the PayFlow API key on the ZippyGo server, never in browser JavaScript.
- Set `PAYFLOW_FRONTEND_URL` to the public PayFlow website origin.
- Deploy both `payflow-api` and `razorpay-checkout` Supabase Edge Functions.
