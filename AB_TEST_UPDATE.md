# A/B Test Headlines Update - Warehouse Automation Webinar

**Date**: February 6, 2026
**Status**: ✅ DEPLOYED
**Experiment ID**: `webinar_warehouse_headlines_feb2026`

---

## 📊 Test Overview

Changed from 3 generic headlines to warehouse-focused messaging with strategic positioning.

**Distribution**: 33.3% each variant (equal split)
**Duration**: Ongoing
**Measurement**: Conversion rate (registrations), engagement metrics in GTM/HubSpot

---

## 🎯 Headlines by Variant

### CONTROL (33.3%)
**Headline**: 3 Things to Know Before Your First Warehouse Robot
**Subheadline**: Decisions that make or break performance, ROI, and reliability

**Strategy**:
- Speaks to decision-makers evaluating automation
- Focus on "before buying" framework
- Positions Robot.com as trusted advisor
- Addresses key pain points: performance, ROI, reliability

**Target**: Cautious buyers, evaluation stage

---

### TEST-A (33.3%)
**Headline**: The Hard Truth About Warehouse Automation
**Subheadline**: What we learned deploying robots in environments where mistakes are unacceptable

**Strategy**:
- Direct, honest messaging
- Emphasizes hard-won experience
- Speaks to risk mitigation
- Shows we understand stakes (mission-critical environments)
- "Unacceptable" creates urgency

**Target**: Risk-aware operators, experienced buyers

---

### TEST-B (33.3%)
**Headline**: The Make or Break Moments in Warehouse Automation
**Subheadline**: What we learned from deploying robots that scaled vs. those that stalled

**Strategy**:
- Narrative-driven ("make or break")
- Success vs. failure comparison
- Learning from real deployments
- Creates binary stakes (scaled vs. stalled)
- More relatable, story-based approach

**Target**: Growth-oriented companies, case-study learners

---

## 🔧 Technical Changes

### Code Changes
**File**: `webinar/automation-robot-deployment/index.html`

```javascript
// Variant Names Changed
VARIANTS: ['control', 'test-a', 'test-b']  // was: variant-a, variant-b, variant-c

// HTML IDs Changed
id="headline-control"   // was: headline-variant-a
id="headline-test-a"    // was: headline-variant-b
id="headline-test-b"    // was: headline-variant-c

// Experiment ID Updated
EXPERIMENT_ID: 'webinar_warehouse_headlines_feb2026'  // more descriptive

// Webinar Tracking Updated
webinar: 'warehouse-automation-february-2026'  // was: 3-things-we-got-wrong-about-automation
```

### Distribution Logic
```javascript
// 33.3% each variant
if (rand < 0.33) {
    variant = 'control';
} else if (rand < 0.67) {
    variant = 'test-a';
} else {
    variant = 'test-b';
}
```

---

## 📈 What Gets Tracked

### Via GTM (Google Tag Manager)
```javascript
{
    form_id: 'robot_webinar_form',
    ab_variant: 'control' | 'test-a' | 'test-b',  // which variant
    experiment_id: 'webinar_warehouse_headlines_feb2026',
    webinar: 'warehouse-automation-february-2026',
    // ... plus UTM params and event data
}
```

### Via HubSpot
```
ab_variant field: Stores which variant user saw
```

### Via Brevo
```
ab_variant: Stored with registration event for email personalization
```

---

## 🧪 Testing Guidelines

### How to Force a Specific Variant
Use URL parameter:
```
https://lp.robot.com/webinar/automation-robot-deployment/?ab_variant=control
https://lp.robot.com/webinar/automation-robot-deployment/?ab_variant=test-a
https://lp.robot.com/webinar/automation-robot-deployment/?ab_variant=test-b
```

### How to Clear Variant Assignment
In browser console:
```javascript
localStorage.clear();
// Then reload page - will be reassigned randomly
```

---

## 📊 Expected Metrics

### Primary Metrics
- **Conversion Rate**: Registrations per variant
- **Click-through**: Form interactions
- **Completion Rate**: Form submission completion

### Secondary Metrics
- **Session Duration**: Time on page by variant
- **Bounce Rate**: Abandonment by variant
- **Email Engagement**: Open/click rates from confirmation emails

---

## 🎓 Variant Strategy Comparison

| Aspect | Control | Test-A | Test-B |
|--------|---------|--------|--------|
| **Tone** | Advisory | Honest/Candid | Narrative |
| **Focus** | Framework | Risk/Reality | Results/Stories |
| **Audience** | Decision-makers | Risk-aware | Growth-oriented |
| **Key Message** | Know before buying | Hard truths | Scale vs. stall |
| **Primary CTA** | "Learn framework" | "Understand risks" | "Learn from stories" |

---

## 🚀 Deployment Info

**Commit**: `4e768ec`
**Branch**: `main`
**Deployment**: Live immediately (no cache to clear)

### Files Changed
- `webinar/automation-robot-deployment/index.html`

### Backward Compatibility
- Old URL parameters (`variant-a`, `variant-b`, `variant-c`) will NO LONGER work
- Use new parameters: `control`, `test-a`, `test-b`
- Stored localStorage will be reset on first page visit (old keys ignored)

---

## 💡 Messaging Rationale

### Why These Headlines?

**Control**: "3 Things to Know Before..."
- Educational framing (we know what you need to know)
- "Before" creates urgency without pressure
- Numbers (3 things) = digestible, structured
- Focuses on decision quality

**Test-A**: "The Hard Truth..."
- Authenticity (we're not sugar-coating)
- Demonstrates humility and expertise
- "Mistakes are unacceptable" = high stakes
- Appeals to engineering/operations mindset

**Test-B**: "Make or Break Moments..."
- Storytelling (readers love narratives)
- "Scaled vs. Stalled" = clear outcomes
- Learning from others (social proof)
- More emotional/relatable angle

---

## 🔄 Running the Experiment

### Phase 1: Baseline (Now)
- All three variants running equally
- Tracking who sees what
- Collecting registration data

### Phase 2: Analysis (1-2 weeks)
- Review conversion rates
- Check HubSpot contact quality
- Look for messaging resonance patterns

### Phase 3: Decision (2-3 weeks)
- Identify winning variant (highest conversions)
- Could also be tied (all performing similarly)
- Use learnings for next round

---

## 🔗 Related Documents

- `PROYECTO_WEBINAR_RESUMEN.md` - Full project summary
- `FINAL_STATUS.md` - System status
- `docs/BREVO_WORKFLOW_VERIFICATION.md` - Email workflow

---

## ✅ Checklist

- [x] Headlines updated in HTML
- [x] Variant names changed (control/test-a/test-b)
- [x] Experiment ID updated
- [x] Distribution logic verified (33.3% each)
- [x] Tracking configured
- [x] Code deployed
- [x] Documentation created

---

## 📝 Notes

### Cache Consideration
- New variant names will not conflict with old stored variants
- localStorage from old test will be cleared on first load
- Users will be reassigned new variants on first visit

### A/B Testing Best Practices
- Sample size: Aim for 100+ conversions per variant for statistical significance
- Duration: Run for at least 1-2 weeks to capture different traffic patterns
- External factors: Note any major campaigns, seasonal changes, etc.

---

## Success Metrics

**Hypothesis**: Warehouse-focused, outcome-focused headlines will outperform generic headlines.

**Success Definition**:
- ✅ Any variant outperforms by 10%+ = significant improvement
- ✅ All variants perform similarly = headlines matter less than other factors
- ❌ Conversion drops = messaging needs rework

---

**Status**: ✅ Live and Tracking
**Created**: February 6, 2026
**Last Updated**: February 6, 2026
