# Finio - How to Start Claude Code

You have TWO ways to start Claude Code:

## Option 1: Claude Mode (Full Power)
Double-click: `start-with-claude.bat`
- Uses your Anthropic subscription
- Full Claude Opus 4.5 power
- Best for complex work

## Option 2: DeepSeek Mode (Cheap)
Double-click: `start-with-deepseek.bat`
- 90-100x cheaper than Claude
- Good for routine tasks
- Requires ONE-TIME setup (see below)

---

## ONE-TIME SETUP for DeepSeek

1. Go to: https://platform.deepseek.com
2. Sign in (you already did this!)
3. Click "API Keys" in sidebar
4. Click "Create API Key"
5. Copy the key
6. Open `start-with-deepseek.bat` with Notepad
7. Find this line:
   `set ANTHROPIC_AUTH_TOKEN=YOUR_DEEPSEEK_API_KEY_HERE`
8. Replace `YOUR_DEEPSEEK_API_KEY_HERE` with your actual key
9. Save and close

Now double-click `start-with-deepseek.bat` anytime for cheap mode!

---

## When to use which?

| Task | Use |
|------|-----|
| Complex architecture decisions | Claude |
| Reviewing large code changes | Claude |
| Simple file edits | DeepSeek |
| Routine coding tasks | DeepSeek |
| When budget matters | DeepSeek |
| When quality matters most | Claude |
