# ClickSend Migration - Quick Action Checklist

## ⚡ Quick Start (30 minutes total)

### 1️⃣ Get ClickSend Account (5 min)
- [ ] Sign up: https://dashboard.clicksend.com/signup/
- [ ] Verify email
- [ ] Get $2 free credit

### 2️⃣ Get API Credentials (2 min)
- [ ] Login to ClickSend Dashboard
- [ ] Go to Settings → API Credentials
- [ ] Copy your **Username**
- [ ] Copy your **API Key**

### 3️⃣ Add Secrets to Supabase (3 min)
Go to Supabase Dashboard → Project Settings → Edge Functions → Secrets:

```
CLICKSEND_USERNAME = your_username
CLICKSEND_API_KEY = your_api_key
CLICKSEND_SOURCE = JGManagement
```

OR use CLI:
```bash
cd /Users/timothyfarzalo/Desktop/jg-january-2026
supabase secrets set CLICKSEND_USERNAME="your_username"
supabase secrets set CLICKSEND_API_KEY="your_api_key"
supabase secrets set CLICKSEND_SOURCE="JGManagement"
```

### 4️⃣ Deploy Edge Functions (5 min)
```bash
cd /Users/timothyfarzalo/Desktop/jg-january-2026
supabase functions deploy send-sms
supabase functions deploy handle-clicksend-delivery
supabase functions deploy dispatch-sms-notification
```

### 5️⃣ Configure Webhook (3 min)
- [ ] ClickSend Dashboard → Developers → Webhooks → Add Webhook
- [ ] Event: **SMS Delivery Receipts**
- [ ] URL: `https://tbwtfimnbmvbgesidbxh.supabase.co/functions/v1/handle-clicksend-delivery`
- [ ] Save

### 6️⃣ Add Credit (2 min)
- [ ] ClickSend Dashboard → Billing → Add Credit
- [ ] Add $10-20 to start

### 7️⃣ Test (5 min)
Send test SMS to your phone:
```bash
# Replace YOUR-ANON-KEY and YOUR-PHONE
curl -X POST \
  "https://tbwtfimnbmvbgesidbxh.supabase.co/functions/v1/send-sms" \
  -H "Authorization: Bearer YOUR-ANON-KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "+12025551234",
    "body": "ClickSend test successful!",
    "event_type": "direct"
  }'
```

### 8️⃣ Verify (2 min)
- [ ] Check your phone for SMS
- [ ] Check Settings → SMS Logs in your app
- [ ] Status should be "sent" then "delivered"

### 9️⃣ Clean Up Old Secrets (2 min)
```bash
supabase secrets unset TWILIO_ACCOUNT_SID
supabase secrets unset TWILIO_AUTH_TOKEN
supabase secrets unset TWILIO_PHONE_NUMBER
```

### 🎉 Done!
SMS now running on ClickSend with ~44% cost savings!

---

## 🆘 Quick Troubleshooting

| Error | Fix |
|-------|-----|
| "ClickSend not configured" | Check secrets are set correctly |
| "Invalid destination phone" | Use E.164 format: `+12025551234` |
| "Insufficient credit" | Add credit in ClickSend dashboard |
| No delivery receipt | Check webhook URL in ClickSend |

---

## 📋 Important Info

**Your Supabase Project URL:**
- Your URL: `https://tbwtfimnbmvbgesidbxh.supabase.co`
- Format: `https://[project-ref].supabase.co`

**Your Anon Key:**
- Find in: Supabase Dashboard → Project Settings → API → Project API keys
- Use the `anon` / `public` key for testing

**ClickSend Pricing:**
- ~$0.04-0.08 per SMS (vs Twilio $0.079)
- Check exact rates: ClickSend Dashboard → SMS → Pricing

---

## 📞 Support
- ClickSend: support@clicksend.com
- Supabase: https://discord.supabase.com

---

**See full details:** `CLICKSEND_MIGRATION_GUIDE.md`
