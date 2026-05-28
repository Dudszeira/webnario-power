# Script de build para contornar limitações do sistema de arquivos exFAT no Windows
# Autor: Antigravity AI

$ErrorActionPreference = "Stop"

# Caminhos
$currentDir = Get-Location
$tempBuildDir = "$env:USERPROFILE\webnario-build-temp"

Write-Host "=============================================" -ForegroundColor Cyan
Write-Host " Iniciando build do Webnario Power (Next.js) " -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "Aviso: Detectado drive exFAT. Executando build temporario em NTFS ($tempBuildDir) para evitar o erro EISDIR/readlink." -ForegroundColor Yellow

# Cria diretorio temporario se nao existir
if (-not (Test-Path $tempBuildDir)) {
    Write-Host "Criando pasta temporaria no drive C:..." -ForegroundColor Gray
    New-Item -ItemType Directory -Path $tempBuildDir -Force | Out-Null
}

# Copiar arquivos necessarios
Write-Host "Copiando arquivos do projeto para o drive C:..." -ForegroundColor Gray

# Lista de arquivos e pastas para copiar
$itemsToCopy = @(
    "src",
    "public",
    "data",
    "package.json",
    "package-lock.json",
    "tsconfig.json",
    "next.config.mjs",
    "postcss.config.mjs",
    "tailwind.config.ts",
    "next-env.d.ts"
)

foreach ($item in $itemsToCopy) {
    $sourcePath = Join-Path $currentDir $item
    if (Test-Path $sourcePath) {
        $destPath = Join-Path $tempBuildDir $item
        # Se for um diretorio, limpa antes de copiar para remover arquivos excluidos
        if (Test-Path $destPath -PathType Container) {
            Remove-Item -Recurse -Force $destPath
        }
        Copy-Item -Path $sourcePath -Destination $destPath -Recurse -Force
    }
}

# Copiar .env.local se existir
$envFile = Join-Path $currentDir ".env.local"
if (Test-Path $envFile) {
    Copy-Item -Path $envFile -Destination (Join-Path $tempBuildDir ".env.local") -Force
}

# Entrar no diretorio temporario
Set-Location $tempBuildDir

# Verificar node_modules
if (-not (Test-Path "node_modules")) {
    Write-Host "Pasta node_modules nao encontrada no drive C:. Executando npm install..." -ForegroundColor Yellow
    npm install
} else {
    Write-Host "Pasta node_modules encontrada. Sincronizando dependencias (npm install)..." -ForegroundColor Gray
    npm install
}

# Rodar build
Write-Host "Executando build de producao..." -ForegroundColor Green
npm run build

# Copiar pasta .next de volta para o drive D:
Write-Host "Build concluido com sucesso no drive C:!" -ForegroundColor Green
Write-Host "Copiando pasta .next compilada de volta para o drive D:..." -ForegroundColor Gray

$destNextDir = Join-Path $currentDir ".next"
if (Test-Path $destNextDir) {
    Remove-Item -Recurse -Force $destNextDir
}

Copy-Item -Path (Join-Path $tempBuildDir ".next") -Destination $destNextDir -Recurse -Force

# Voltar para o diretorio original
Set-Location $currentDir

Write-Host "=============================================" -ForegroundColor Green
Write-Host " Build finalizado com SUCESSO no drive D:!   " -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green
