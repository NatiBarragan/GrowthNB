# Debug Checklist - Email Routing Issue PERSISTS

**Issue**: Emails still going to ao@robot.com despite code fix
**Hypothesis**: A/B test code or localStorage caching is the culprit

---

## HubSpot cookie (hubspotutk) — envíos asociados al contacto equivocado

**Formulario webinar**: En el webinar de automation-robot-deployment **no se envía** hubspotutk a propósito. El envío se identifica solo por el email del formulario, así que el correo de confirmación va siempre a la dirección con la que se registraron (sin depender del navegador). HubSpot sigue creando/actualizando el contacto por ese email.

**Otros formularios** (ej. ventas): Sí envían la cookie para vincular con contactos existentes. Si en esos forms pruebas con varios correos en el mismo navegador, usa **ventana privada/incognito** o borra cookies para no asociar todo a tu contacto.

---

## Critical Questions to Answer

### 1. Browser Storage (MOST LIKELY CAUSE)
Has localStorage/sessionStorage been cleared?

**Check this NOW in browser console**:
```javascript
// Run these commands in browser console (F12)
console.log('localStorage:', localStorage);
console.log('sessionStorage:', sessionStorage);

// Clear everything
localStorage.clear();
sessionStorage.clear();
console.log('Cleared! Reload page now.');
```

**What to look for**:
- `robot_webinar_ab_variant` - This stores the A/B test variant
- `robot_utm_*` - These store UTM parameters
- Any other robot.com related keys

---

### 2. URL Parameters
What URL are you using to access the form?

**Copy paste the FULL URL**:
```
https://lp.robot.com/webinar/automation-robot-deployment/?...
```

**Check if it has any of these**:
- `?ab_variant=...` (A/B test variant)
- `?variant=...` (A/B test variant alternate)
- Any other parameters?

---

### 3. Browser Console Logs
When you submit the form, what EXACTLY do you see in console?

**Copy paste ALL console output**:
```
[BREVO-DEBUG] Form submitted with email: ...
[BREVO-DEBUG] Full Name: ...
[BREVO] Identify called with email: ...
[BREVO] Track event sent for: ...
```

Or do you see ERRORS instead?

---

### 4. Network Tab
Check the actual network requests being sent:

**Steps**:
1. Open DevTools (F12)
2. Click "Network" tab
3. Submit the form
4. Look for requests to:
   - `.netlify/functions/submit-lead`
   - `.netlify/functions/validate-email`
   - Any requests to Brevo API

**For each request, check**:
- What email is in the REQUEST body?
- What do the RESPONSES say?

---

### 5. Code Verification
Did the code fix actually deploy?

**Check in browser console**:
```javascript
// Get the form code
document.getElementById('webinarForm').parentElement.innerHTML
// Look for: Brevo.push(["track", ...
// Should have: email: formData.email in the track event
// Should NOT have: setProfile in the code
```

Or simpler: **Search the page source** (Ctrl+F):
- Search for: `setProfile` - Should NOT be found
- Search for: `"track"` - Should be found multiple times

---

## Potential Causes (In Order of Likelihood)

### 🔴 MOST LIKELY: localStorage is caching old data

**Evidence**: Form shows same variant repeatedly, email doesn't change

**Fix**:
```javascript
// In browser console:
localStorage.clear();
sessionStorage.clear();
// Then reload the page and test again
```

---

### 🟡 MEDIUM LIKELIHOOD: Code wasn't deployed

**Evidence**: setProfile still appears in page source OR emails still wrong

**Check**:
1. View page source (Ctrl+U)
2. Search for "setProfile"
3. If found → Code wasn't deployed
4. Force Netlify redeploy:
   ```bash
   netlify deploy --prod --clear-cache
   ```

---

### 🟡 MEDIUM LIKELIHOOD: Brevo is consolidating contacts

**Evidence**: Multiple emails showing up as one contact in Brevo

**Check**:
1. Go to Brevo dashboard
2. Search for your test emails
3. Are they linked/consolidated?
4. Check contact merge settings

---

### 🟢 LESS LIKELY: Email template is wrong

**Evidence**: Brevo contact has correct email, but template sends to different email

**Check**:
1. Brevo → Email Templates
2. Find: `Email confirmation webinar_1_ste...`
3. Check "To:" field is `{{ contact.email }}`

---

### 🟢 LESS LIKELY: Workflow recipient is hardcoded

**Evidence**: Workflow shows recipient as `ao@robot.com` instead of `{{ contact.email }}`

**Check**:
1. Brevo → Automations
2. Find: `webinar_registration-automation_robot_deployment`
3. Click "Send Email" step
4. Check recipient field

---

## Step-by-Step Debug Process

### Step 1: Clear Storage (5 minutes)
```bash
# In browser console F12:
localStorage.clear();
sessionStorage.clear();
# Reload the page
```

### Step 2: Verify Code (5 minutes)
```bash
# Check page source
View page source (Ctrl+U)
Search for "setProfile"
Search for "track"
```

### Step 3: Test Fresh Registration (10 minutes)
1. New browser tab (completely separate)
2. Use COMPLETELY NEW email (never used before)
3. Fill form
4. Watch console
5. Check inbox for email

### Step 4: Check Network Requests (5 minutes)
1. DevTools Network tab
2. Submit form
3. Look at `.netlify/functions/submit-lead` request
4. Check REQUEST body for correct email
5. Check RESPONSE for success

### Step 5: Check Brevo Directly (5 minutes)
1. Brevo dashboard
2. Search for the email you just registered
3. Check contact attributes
4. Check if contact is linked to other emails

---

## Information To Provide

When you run these checks, provide:

```
1. localStorage/sessionStorage cleared? YES/NO
2. URL you're accessing: [paste URL]
3. Console logs when submitting: [paste logs]
4. Did you see [BREVO-DEBUG] logs? YES/NO
5. Page source has "setProfile"? YES/NO
6. Page source has "track" events? YES/NO
7. Network request body email: [what email was sent?]
8. Email in inbox? YES/NO / WHICH EMAIL?
9. Brevo contact has correct email? YES/NO
10. Contact attributes populated? YES/NO
```

---

## A/B Test Code Concern

The A/B test code is:
1. Reading URL parameters
2. Storing variant in localStorage
3. Using sessionStorage for UTM params

**Could this be interfering?**

Possibly if:
- Old localStorage data is cached
- URL parameters are being misread
- The form is reading from stale storage

**Solution**: Clear all storage and test again with fresh data

---

## My Hypothesis

I think the issue is **localStorage caching old data**. Here's why:

1. You've tested the form multiple times
2. Each test stores data in localStorage
3. The form reads from localStorage on next visit
4. If there's ANY bug in how localStorage is used, it could carry over stale data
5. Especially if the email is somehow being cached

**Test This Theory**:
1. Clear localStorage completely
2. Use brand new email (never used before)
3. Open form in PRIVATE/INCOGNITO window (fresh storage)
4. Submit and verify

If it works in incognito → Problem is localStorage caching
If it still fails → Problem is something else (code or Brevo config)

---

## Next Steps

1. **Right now**: Run the localStorage clear commands above
2. **Then**: Test with a new email in a fresh browser session
3. **While testing**: Open console to see debug logs
4. **Report back**: Tell me exactly what happens

**If it works after clearing storage** → We need to find and fix the storage bug in the code

**If it still fails** → We need to check Brevo configuration or verify the code deployed correctly

---

## Questions for You

Before I make code changes, answer these:

1. ✋ Have you cleared localStorage/sessionStorage?
2. ✋ Did you see [BREVO-DEBUG] logs in console when submitting?
3. ✋ What email did you use for testing?
4. ✋ Does the code still have setProfile() when you view page source?
5. ✋ Have you tested in an incognito/private window?

**These answers will tell me exactly what to fix.**

---

## Red Flags 🚩

If ANY of these are true, STOP and report:
- [ ] You see console ERRORS related to Brevo
- [ ] The page source still contains "setProfile"
- [ ] localStorage shows data from previous tests
- [ ] You're seeing different emails in Brevo than you registered
- [ ] Brevo shows contacts as "linked" or "merged"

---

## Expected Behavior (After Fix + Clear Storage)

1. Clear storage ✅
2. Use NEW email ✅
3. Submit form ✅
4. See [BREVO-DEBUG] logs ✅
5. See [BREVO] logs ✅
6. Email arrives at registered address ✅ (THIS SHOULD WORK)
7. Check Brevo contact ✅ (Should have correct email + attributes)

---

## Decision Point

This debug checklist will tell us if:

- **A**: Storage caching issue → Fix code to prevent caching
- **B**: Code not deployed → Force redeploy
- **C**: Brevo configuration issue → Fix in Brevo UI
- **D**: Something else we haven't found → Deep investigation needed

---

**Run through this checklist and report results. This will pinpoint the exact issue.**
