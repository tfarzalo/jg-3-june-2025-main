# 🚀 QUICK DEPLOY GUIDE
**Date:** November 17, 2025

---

## ONE-COMMAND DEPLOY

```bash
cd "/Users/timothyfarzalo/Desktop/jg-3-june-2025-main-main - September 2025"
./deploy-approval-workflow.sh
```

Then follow the prompts. That's it!

---

## OR: MANUAL DEPLOY (5 Steps)

### 1. Apply Migration (2 minutes)
```bash
supabase db push
```

### 2. Deploy Functions (2 minutes)
```bash
supabase functions deploy validate-approval-token
supabase functions deploy process-approval
```

### 3. Configure Email (3 minutes)
Supabase Dashboard → Edge Functions → Secrets:
- `ZOHO_EMAIL` = admin@jgpaintingprosinc.com
- `ZOHO_PASSWORD` = [your-app-password]
- `ZOHO_SMTP_HOST` = smtp.zoho.com
- `ZOHO_SMTP_PORT` = 587

### 4. Enable Storage (1 minute)
Supabase SQL Editor:
```sql
UPDATE storage.buckets SET public = true WHERE id = 'job-images';
```

### 5. Test (5 minutes)
```sql
SELECT approval_token FROM approvals LIMIT 1;
```
Visit: `http://localhost:5173/approve/{token}`

---

## ROLLBACK (If Needed)

```sql
ALTER TABLE approvals DROP COLUMN approval_token;
ALTER TABLE approvals DROP COLUMN token_expires_at;
ALTER TABLE approvals DROP COLUMN token_used;
```

---

## FILES TO REFERENCE

- `DEPLOY_APPROVAL_WORKFLOW.md` - Full guide
- `DEPLOYMENT_STATUS_NOV_17.md` - Current status
- `APPROVAL_SYSTEM_CURRENT_STATUS.md` - System overview

---

**Total Time:** ~15 minutes  
**Risk:** LOW (fully reversible)  
**Status:** READY ✅
