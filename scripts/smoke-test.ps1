param(
  [string]$BaseUrl = "http://localhost:8080",
  [string]$Email = "smoke.user@example.com",
  [string]$Username = "smoke_user",
  [string]$Password = "Passw0rd!"
)

$ErrorActionPreference = "Stop"

function Step($message) {
  Write-Host "`n==> $message" -ForegroundColor Cyan
}

function Print-Ok($message) {
  Write-Host "[OK] $message" -ForegroundColor Green
}

function Print-Fail($message) {
  Write-Host "[FAIL] $message" -ForegroundColor Red
}

$token = $null

try {
  Step "Health check"
  $health = Invoke-RestMethod -Method Get -Uri "$BaseUrl/health"
  Print-Ok "Gateway health: $($health.status)"

  Step "Register or login"
  try {
    $registerBody = @{
      email = $Email
      username = $Username
      password = $Password
    } | ConvertTo-Json

    $registerResponse = Invoke-RestMethod -Method Post -Uri "$BaseUrl/auth/register" -ContentType "application/json" -Body $registerBody
    $token = $registerResponse.token
    Print-Ok "Registered new user"
  } catch {
    $loginBody = @{
      email = $Email
      password = $Password
    } | ConvertTo-Json

    $loginResponse = Invoke-RestMethod -Method Post -Uri "$BaseUrl/auth/login" -ContentType "application/json" -Body $loginBody
    $token = $loginResponse.token
    Print-Ok "Logged in existing user"
  }

  if (-not $token) {
    throw "No JWT token returned from auth endpoints"
  }

  $authHeaders = @{ Authorization = "Bearer $token" }

  Step "Catalogue read"
  $manufacturers = Invoke-RestMethod -Method Get -Uri "$BaseUrl/catalogue/manufacturers"
  Print-Ok "Manufacturers returned: $($manufacturers.manufacturers.Count)"

  Step "Recognition"
  $tinyPngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMB/axkP7wAAAAASUVORK5CYII="
  $recognizeBody = @{ imageBase64 = $tinyPngBase64 } | ConvertTo-Json
  $recognize = Invoke-RestMethod -Method Post -Uri "$BaseUrl/recognize/predict" -ContentType "application/json" -Headers $authHeaders -Body $recognizeBody
  Print-Ok "Recognition label: $($recognize.prediction.label)"

  Step "Collection write + read"
  $collectionBody = @{
    generationId = 9001
    manufacturerName = "Smoke"
    modelName = "Tester"
    generationCode = "S1"
  } | ConvertTo-Json
  $collectionWrite = Invoke-RestMethod -Method Post -Uri "$BaseUrl/collection" -ContentType "application/json" -Headers $authHeaders -Body $collectionBody
  $collectionProgress = Invoke-RestMethod -Method Get -Uri "$BaseUrl/collection/progress" -Headers $authHeaders
  Print-Ok "Collection generations discovered: $($collectionProgress.discoveredGenerations)"

  Step "Achievements read"
  $achievements = Invoke-RestMethod -Method Get -Uri "$BaseUrl/gamification/achievements" -Headers $authHeaders
  Print-Ok "Achievements count: $($achievements.achievements.Count)"

  Step "Leaderboard"
  $leaderboard = Invoke-RestMethod -Method Get -Uri "$BaseUrl/gamification/leaderboard?limit=5" -Headers $authHeaders
  Print-Ok "Leaderboard rows: $($leaderboard.leaderboard.Count)"

  Write-Host "`nSmoke test completed successfully." -ForegroundColor Green
}
catch {
  Print-Fail $_.Exception.Message
  exit 1
}
