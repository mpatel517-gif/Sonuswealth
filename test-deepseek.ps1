$headers = @{
    "x-api-key" = "sk-db275c4c339b431189833fb2d2d7e8b1"
    "anthropic-version" = "2024-01-01"
    "content-type" = "application/json"
}

$body = @{
    model = "deepseek-v4-pro"
    max_tokens = 50
    messages = @(
        @{
            role = "user"
            content = "Say hello in exactly 5 words"
        }
    )
} | ConvertTo-Json -Depth 3

Write-Host "Testing DeepSeek API..." -ForegroundColor Yellow

try {
    $response = Invoke-RestMethod -Uri "https://api.deepseek.com/anthropic/v1/messages" -Method Post -Headers $headers -Body $body
    Write-Host ""
    Write-Host "SUCCESS! DeepSeek is working." -ForegroundColor Green
    Write-Host ""
    Write-Host "Response:" -ForegroundColor Cyan
    Write-Host $response.content[0].text
    Write-Host ""
    Write-Host "Model used: $($response.model)" -ForegroundColor Cyan
} catch {
    Write-Host ""
    Write-Host "FAILED: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "Check your API key at platform.deepseek.com" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Press any key to close..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
