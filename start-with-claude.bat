@echo off
REM ========================================
REM Finio + Claude Mode (Full Power)
REM Uses your Anthropic subscription
REM ========================================

REM Clear any DeepSeek overrides
set ANTHROPIC_BASE_URL=
set ANTHROPIC_AUTH_TOKEN=
set ANTHROPIC_MODEL=
set ANTHROPIC_DEFAULT_OPUS_MODEL=
set ANTHROPIC_DEFAULT_SONNET_MODEL=
set ANTHROPIC_DEFAULT_HAIKU_MODEL=
set CLAUDE_CODE_SUBAGENT_MODEL=

echo.
echo ========================================
echo   CLAUDE MODE ACTIVE
echo   Using: Claude Opus 4.5
echo   Full Anthropic power
echo ========================================
echo.

cd /d "C:\Users\Mihir Patel.Mihir\Desktop\finio"
claude
