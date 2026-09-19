# Quick Reference: Email Routing Fix

## Current Status: ✅ CODE FIXED - AWAITING VERIFICATION

The code issue has been fixed and deployed. The problem was in how data was being sent to Brevo.

---

## What Was Wrong

```javascript
// ❌ BROKEN (old code):
Brevo.push(["setProfile", {
    email: formData.email,
    firstname: formData.fullName.split(' ')[0],
    lastname: formData.fullName.split(' ').slice(1).join(' '),
    company: formData.company
}]);
```

**Problem**: `setProfile()` was not updating contact attributes in Brevo. Contacts were created empty, so the workflow had no data to work with.

---

## What's Fixed Now

```javascript
// ✅ CORRECT (new code):
Brevo.push(["identify", {
    email: formData.email
}]);

Brevo.push(["track", "webinar_registration-automation_robot_deployment", {
    event_id: "webinar-automation-robot-deployment-february-2026",
    email: formData.email,
    FIRSTNAME: formData.fullName.split(' ')[0],
    LASTNAME: formData.fullName.split(' ').slice(1).join(' '),
    COMPANY: formData.company,
    // ... other event data
}]);
```

**Solution**:
- ✅ Identify with email only (prevents contact consolidation)
- ✅ Pass all contact data as event properties (workflow can access via `{{event.FIRSTNAME}}`, etc.)
- ✅ Use UPPERCASE field names (Brevo convention for event properties)

---

## Test It Now

### What You Need To Do
1. Go to the live webinar form
2. Register with a NEW email address (e.g., `test123@yourcompany.com`)
3. Check your email inbox
4. **Verify the confirmation email arrives at the email address you used to register**

### What Should Happen
- Email to `hello@andresospina.co` → arrives at `hello@andresospina.co` ✅
- Email to `a@treebox.co` → arrives at `a@treebox.co` ✅
- Email to `andres@treebox.co` → arrives at `andres@treebox.co` ✅
- NOT at `ao@robot.com` ❌

### Debug Tools
Open browser console (F12) and you'll see:
```
[BREVO-DEBUG] Form submitted with email: user@email.com
[BREVO] Identify called with email: user@email.com
[BREVO] Track event sent for: user@email.com
```

---

## If It's Still Wrong

If emails are STILL going to `ao@robot.com`, the issue is NOT in our code. Check Brevo configuration:

### Brevo Workflow (to verify by user)
1. Brevo → Automations → `webinar_registration-automation_robot_deployment`
2. Click "Send Email" step
3. Check "Recipient" field:
   - Should be: `{{ contact.email }}` (dynamic)
   - NOT: `ao@robot.com` (hardcoded)

### Brevo Email Template (to verify by user)
1. Brevo → Email Templates → Find `Email confirmation webinar_1_ste...`
2. Check "To:" field:
   - Should be: `{{ contact.email }}` (dynamic)
   - NOT: `ao@robot.com` (hardcoded)

### If Workflow Is Broken
We can implement a **Transactional Email API** approach instead:
- Send emails directly via Netlify function
- Bypass the broken workflow entirely
- Guaranteed correct recipient

---

## Files Modified
- `/webinar/automation-robot-deployment/index.html` (lines 638-697)

## Recent Commits
- `9cc319f` - Remove setProfile, pass data in track event
- `610a228` - Add debug logging
- `26532a3` - Prevent contact consolidation

## Documentation
- Full investigation: `docs/EMAIL_ROUTING_INVESTIGATION.md`

---

## Decision Tree

```
Are emails still going to ao@robot.com?

YES → Check Brevo workflow configuration
      ├─ Is "Send Email" recipient hardcoded to ao@robot.com?
      │  YES → Change to {{ contact.email }}
      │  NO → Check email template
      ├─ Is template "To:" hardcoded?
      │  YES → Change to {{ contact.email }}
      │  NO → Check contact list settings
      └─ Contact consolidation? → Use Transactional Email API

NO → ✅ FIXED! Issue is resolved.
```

---

## Contact Data Flow

```
Form Submission
    ↓
[1] JavaScript: email = "user@company.com"
    ✅ VERIFIED CORRECT
    ↓
[2] HubSpot: Receives correct email
    ✅ VERIFIED CORRECT
    ↓
[3] Brevo: Creates contact with correct email
    ✅ VERIFIED CORRECT
    ↓
[4] Brevo Event: Passes data via track() event
    ✅ NOW FIXED (was using broken setProfile)
    ↓
[5] Brevo Workflow: Receives email + data from event
    ⚠️ NEEDS VERIFICATION: Check if recipient field is correct
    ↓
[6] Email Template: Sends confirmation email to {{ contact.email }}
    ⚠️ NEEDS VERIFICATION: Check if "To:" field is correct
    ↓
[7] User Inbox: Should receive email at registered address
    🔄 AWAITING TEST
```

---

## Summary

✅ **What's Done**:
- Code fixed and deployed
- Debug logging added
- Brevo contact consolidation prevented
- Event data properly structured for workflow

🔄 **What's Needed**:
- User to test with new email registrations
- Verify emails arrive at correct address
- If wrong, check Brevo workflow and template configuration

📍 **Current Waiting Point**:
User test confirmation to determine if Brevo workflow is properly configured to use dynamic email recipient.
