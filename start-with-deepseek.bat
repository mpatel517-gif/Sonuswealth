@echo off
REM ========================================
REM Finio + DeepSeek Mode (Cheaper)
REM Cost: ~90-100x cheaper than Claude Opus
REM ========================================

REM Set your DeepSeek API key below (get from platform.deepseek.com)
set ANTHROPIC_AUTH_TOKEN=%DEEPSEEK_API_KEY%

REM DeepSeek endpoint
set ANTHROPIC_BASE_URL=https://api.deepseek.com/anthropic

REM Model configuration
set ANTHROPIC_MODEL=deepseek-v4-pro
set ANTHROPIC_DEFAULT_OPUS_MODEL=deepseek-v4-pro
set ANTHROPIC_DEFAULT_SONNET_MODEL=deepseek-v4-pro
set ANTHROPIC_DEFAULT_HAIKU_MODEL=deepseek-v4-flash
set CLAUDE_CODE_SUBAGENT_MODEL=deepseek-v4-flash
set CLAUDE_CODE_EFFORT_LEVEL=max

echo.
echo ========================================
echo   DEEPSEEK MODE ACTIVE
echo   Using: DeepSeek V4-Pro + V4-Flash
echo   Cost: ~$0.003/M cached input
echo ========================================
echo.

cd /d "C:\Users\Mihir Patel.Mihir\Desktop\finio"
claude
