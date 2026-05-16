# Shell-owner notes — 2026-05-12

Issues raised in founder audit of Home tab that live in **frozen-this-session shell files**. Not fixed in this session; passed to whoever owns the shell next.

---

## Issue 8 — Ask Sonu overlaps content on laptop

**File:** `src/screens/Dashboard.jsx` (frozen) + the `<AskSonu>` floating pill component (location TBC — likely `src/components/Shell/`).

**Symptom:** On laptop (1440×900) the Ask Sonu pill is positioned absolutely at the bottom of the viewport and overlaps the content area. Visible in [screenshots/home-bruce-laptop-dark-full.png](screenshots/home-bruce-laptop-dark-full.png) — the pill sits on top of the Forgotten Money / SIPP deadline cards.

**Root cause:** The pill's positioning assumes mobile bottom-tab chrome (~78px reserved at viewport bottom). On laptop the bottom-tab is hidden and the pill renders directly over content with no bottom-spacer.

**Fix shape:**
- At ≥1024px viewports, either (a) move the pill into the sidebar nav as a static item, or (b) add a content-area `padding-bottom: 96px` when the pill is rendered as floating.
- Easier: option (a) — the laptop sidebar already has Bruce's persona pill at the bottom-left; Ask Sonu can sit above it as a sidebar CTA, not a floating pill.

**Verification:** snap-rebuild at laptop dark + light, confirm no overlap with content cards on Home and other tabs.

---

## Issue 9 — Persona switcher shows the *next* persona, not the current one

**File:** `src/screens/Dashboard.jsx` or the persona pill component in the sidebar bottom-left.

**Symptom:** When viewing as Bruce (`?demo=a&tab=home`) on laptop, the bottom-left persona pill reads:

```
MT
Mr T · 35 · all-domain canon...
Switch · mrt
```

That's the *alternative* persona to switch to, not the one being viewed. It looks like Mr T is logged in.

**Expected:** Current persona = Bruce. The pill should read:

```
BW
Bruce Wayne · 62
Switch ›
```

…with a switch CTA that opens the persona picker (showing Mr T as one option among others).

**Fix shape:**
- Render the *current* persona's avatar + name in the pill.
- The "Switch" CTA opens a sheet/dropdown listing all available personas, not silently swapping.
- This is a persona-state-management bug — likely the component is showing `personas.find(p => p.id !== current)` instead of `personas.find(p => p.id === current)`.

**Verification:** load with `?demo=a` and `?demo=mrt` separately, confirm correct persona shown in pill in each case. Confirm Switch CTA opens picker (not silent swap).

---

## Cross-cutting context

Both issues are in the shell (Dashboard.jsx + persona-related components), which the founder explicitly listed as **frozen this session** because the MyMoney chat owns it in flight. Flagging them here so they're picked up next.

**Founder audit reference:** session 2026-05-12, points #8 and #9 in the "9 issues" list.
