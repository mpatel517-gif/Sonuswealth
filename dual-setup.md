# Dual Terminal Setup: DeepSeek + Claude

## Quick Commands (from Desktop\finio folder)

| Command | What it does |
|---------|--------------|
| `ds` | Start Claude Code with **DeepSeek** backend (cheap) |
| `cc` | Start Claude Code with **Claude** backend (powerful) |

## The Strategy

Run BOTH terminals side-by-side:

```
Terminal 1: ds     (DeepSeek for heavy lifting)
Terminal 2: cc     (Claude for creative/design work)
```

## When to Use Which

### Use DeepSeek (`ds`) for:
- Quick scripts & automation
- Algorithmic problems
- Unit tests
- Backend work
- Database queries
- Non-visual calculations
- Heavy lifting that's not design-related

### Use Claude (`cc`) for:
- Building landing pages
- UI/UX polish
- Creative/visual work
- Multi-file refactors
- Design systems
- Documentation
- Anything requiring "creative imagination"

## Rule of Thumb
> "DeepSeek daily. Claude for hard stuff."

## Design Resources

Design systems repo cloned to:
`C:\Users\Mihir Patel.Mihir\awesome-design-md\design-md\`

Contains design systems from: Apple, BMW, Spotify, Airbnb, Linear, SpaceX, NVIDIA, Uber, and 30+ more companies.

**Usage in prompt:**
```
Using the design system from awesome-design-md/design-md/apple/DESIGN.md,
build me a landing page for...
```

## Voice Typing Options

1. **Windows built-in**: Press `Win + H` anywhere
2. **Claude Code built-in**: Type `/voice` in Claude Code
3. **Glaido**: https://glaido.com (external app, privacy-focused)

## Cost Comparison

| Model | Cost per 1M tokens |
|-------|-------------------|
| Claude Opus | ~$15.00 |
| DeepSeek V4-Pro | ~$0.44 |
| DeepSeek V4-Flash | ~$0.14 |

**Savings: 30-100x cheaper with DeepSeek!**
