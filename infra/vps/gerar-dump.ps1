# Gera no computador do autor o dump do banco local para a produção (Pendência 87).
#
# Roda com o Aspire ligado e nenhuma carga da ETL em andamento, na pasta do projeto:
#   powershell -ExecutionPolicy Bypass -File infra/vps/gerar-dump.ps1
#
# Os dados de usuário não vão: as tabelas deles entram vazias (--exclude-table-data), e o resto
# vai inteiro, com o esquema e a __EFMigrationsHistory. No fim, mostra o sha256 e os comandos de
# envio e de restauração, já com o sha256 preenchido.

$ErrorActionPreference = 'Stop'

$destino = Join-Path $env:USERPROFILE 'poligraph.dump'
$tabelasDeUsuario = @('usuarios', 'segue', 'seguidos_encerrados', 'consentimentos', 'avisos_enviados',
    'inscricoes_no_navegador', 'avaliacoes', 'eventos')

$container = podman ps --format '{{.Names}}' | Where-Object { $_ -like 'postgres-*' } | Select-Object -First 1
if (-not $container) { throw 'Nenhum container postgres-* rodando: ligue o Aspire.' }
Write-Host "== Container $container"

$opcoes = @('-U', 'postgres', '-d', 'poligraph', '-Fc', '--no-owner', '--no-acl', '-f', '/tmp/poligraph.dump')
$opcoes += $tabelasDeUsuario | ForEach-Object { "--exclude-table-data=$_" }

Write-Host '== Gerando o dump (alguns minutos)'
podman exec $container sh -c 'PGPASSWORD=$POSTGRES_PASSWORD exec pg_dump $*' sh @opcoes
if ($LASTEXITCODE -ne 0) { throw 'O pg_dump falhou.' }
podman cp "$($container):/tmp/poligraph.dump" $destino
podman exec $container rm -f /tmp/poligraph.dump

$sha = (Get-FileHash $destino -Algorithm SHA256).Hash.ToLower()
$tamanho = [math]::Round((Get-Item $destino).Length / 1MB)
Write-Host "== Pronto: $destino, $tamanho MB"
Write-Host "sha256 $sha"
Write-Host ''
Write-Host '== 1. Enviar o dump e o script ao VPS'
Write-Host "scp -o ClearAllForwardings=yes `"$destino`" infra/vps/restaurar-banco.sh coolify:/tmp/"
Write-Host ''
Write-Host '== 2a. Produção sem usuário de verdade: esvazia e restaura'
Write-Host "ssh -t -o ClearAllForwardings=yes coolify `"sudo bash /tmp/restaurar-banco.sh /tmp/poligraph.dump $sha --substituir`""
Write-Host ''
Write-Host '== 2b. Produção com usuários: guarda as contas e quem cada uma segue, restaura e devolve'
Write-Host "ssh -t -o ClearAllForwardings=yes coolify `"sudo bash /tmp/restaurar-banco.sh /tmp/poligraph.dump $sha --preservar-usuarios`""
Write-Host ''
Write-Host "Depois: apague $destino."
