@echo off
echo Starting Hermes...
call hermes chat --model deepseek/deepseek-v4-pro
echo Hermes session closed. Syncing to GitHub...
git add .
git commit -m "auto: synchronize Hermes local modifications"
git push origin main
echo Sync complete.