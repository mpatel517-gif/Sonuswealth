@echo off
REM ========================================
REM DeepSeek Mode - Works from ANY folder
REM ========================================

set ANTHROPIC_AUTH_TOKEN=sk-db275c4c339b431189833fb2d2d7e8b1
set ANTHROPIC_BASE_URL=https://api.deepseek.com/anthropic
set ANTHROPIC_MODEL=deepseek-v4-pro
set ANTHROPIC_DEFAULT_OPUS_MODEL=deepseek-v4-pro
set ANTHROPIC_DEFAULT_SONNET_MODEL=deepseek-v4-pro
set ANTHROPIC_DEFAULT_HAIKU_MODEL=deepseek-v4-flash
set CLAUDE_CODE_SUBAGENT_MODEL=deepseek-v4-flash
set CLAUDE_CODE_EFFORT_LEVEL=max

echo.
echo [DEEPSEEK MODE] V4-Pro + V4-Flash
echo.

claude
