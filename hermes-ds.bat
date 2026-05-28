@echo off
REM ===================================================
REM Hermes Direct DeepSeek Mode (Bypassing OpenRouter)
REM ===================================================

REM This completely blanks out and kills any OpenRouter hooks in this window
set OPENROUTER_API_KEY=
set BASE_URL=

REM Force true direct DeepSeek OpenAI-compatible routing
set OPENAI_API_KEY=sk-48db4687d4f149e3873f691f433e00bc
set OPENAI_BASE_URL=https://api.deepseek.com/v1
set PROVIDER=openai
set MODEL=deepseek-chat

echo.
echo [HERMES DIRECT DEEPSEEK] Purged OpenRouter hooks. Initializing Direct Agent Mode...
echo.

hermes