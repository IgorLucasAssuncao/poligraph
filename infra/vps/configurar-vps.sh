#!/usr/bin/env bash
# Configuração do VPS do Registro Aberto, do sistema recém-instalado ao Coolify de pé.
#
# Refaz o que foi feito à mão em 2026-10-15 (roteiro em arquitetura.html, "Roteiro do servidor").
# Pode rodar de novo: cada etapa confere o estado antes de mudar algo.
#
# Uso, como root, no VPS:
#   bash configurar-vps.sh igor "ssh-ed25519 AAAA... igor-notebook-hostinger"
#   CLOUDFLARE_TUNNEL_TOKEN=... bash configurar-vps.sh igor     (instala também o túnel)
#
# O segundo argumento é opcional: sem ele, o usuário recebe as chaves que o root já tem.
#
# O que NÃO está aqui, porque não se faz de dentro da máquina:
#   - o firewall, que fica no painel da Hostinger (com o túnel, só a 22);
#   - o Coolify por dentro: projeto, banco, variáveis e aplicação, feitos no painel;
#   - o DNS, que fica na Cloudflare.
#
# ATENÇÃO: o root continua entrando por chave (prohibit-password), nunca por senha. O Coolify
#   comanda o próprio servidor por SSH como root, com uma chave dele; "PermitRootLogin no"
#   cortaria esse acesso.

set -euo pipefail

USUARIO="${1:-igor}"
CHAVE_PUBLICA="${2:-}"

# Escreve uma etapa no terminal, para quem acompanha saber onde o script está.
etapa() { printf '\n== %s\n' "$*"; }

# Para tudo com uma mensagem, sem deixar a máquina pela metade sem aviso.
falhar() { printf '\nERRO: %s\n' "$*" >&2; exit 1; }

# Só root altera usuários, SSH e pacotes.
conferir_root() {
    [ "$(id -u)" -eq 0 ] || falhar "rode como root (sudo bash $0 ...)"
    command -v apt-get >/dev/null || falhar "o script supõe Ubuntu ou Debian (apt-get)"
}

# Sistema em dia antes de instalar qualquer coisa.
atualizar_sistema() {
    etapa "1. Atualizando o sistema"
    export DEBIAN_FRONTEND=noninteractive
    apt-get update -q
    apt-get upgrade -yq
}

# Usuário próprio com sudo, para não trabalhar como root.
criar_usuario() {
    etapa "2. Usuário $USUARIO com sudo"
    if id "$USUARIO" >/dev/null 2>&1; then
        echo "já existe"
    else
        adduser --gecos "" "$USUARIO"
    fi
    usermod -aG sudo "$USUARIO"
}

# A chave pública vai para o usuário: a do argumento, ou as que o root já tem.
instalar_chave() {
    etapa "3. Chave SSH do $USUARIO"
    local pasta="/home/$USUARIO/.ssh"
    local arquivo="$pasta/authorized_keys"
    install -d -m 700 -o "$USUARIO" -g "$USUARIO" "$pasta"
    touch "$arquivo"
    if [ -n "$CHAVE_PUBLICA" ]; then
        grep -qxF "$CHAVE_PUBLICA" "$arquivo" || echo "$CHAVE_PUBLICA" >> "$arquivo"
    elif [ -s /root/.ssh/authorized_keys ]; then
        grep -v -i "coolify" /root/.ssh/authorized_keys | while read -r linha; do
            [ -n "$linha" ] && { grep -qxF "$linha" "$arquivo" || echo "$linha" >> "$arquivo"; }
        done
    fi
    chown "$USUARIO:$USUARIO" "$arquivo"
    chmod 600 "$arquivo"
    [ -s "$arquivo" ] || falhar "o $USUARIO ficou sem chave; passe a chave pública como segundo argumento"
    echo "$(wc -l < "$arquivo") chave(s) em $arquivo"
}

# Sem senha pela rede. Root só por chave, por causa do Coolify.
endurecer_ssh() {
    etapa "4. SSH só por chave"
    local arquivo=/etc/ssh/sshd_config.d/99-endurecer.conf
    cat > "$arquivo" <<'CONF'
PermitRootLogin prohibit-password
PasswordAuthentication no
KbdInteractiveAuthentication no
CONF
    sshd -t || { rm -f "$arquivo"; falhar "configuração do SSH inválida; nada foi aplicado"; }
    systemctl restart ssh
    echo "aplicado: $arquivo"
    echo "ATENÇÃO: antes de fechar esta sessão, teste numa janela nova: ssh $USUARIO@<IP>"
}

# Bloqueia por um tempo quem erra o login várias vezes. O padrão do Ubuntu já cobre o sshd.
# ATENÇÃO: as redes internas do Docker ficam de fora. O Coolify entra no próprio servidor por SSH a
#   partir de um container (host.docker.internal); quando o login de root foi recusado, em
#   2026-10-15, o fail2ban bloqueou o container, e o Coolify passou a ver "Connection refused".
instalar_fail2ban() {
    etapa "5. fail2ban"
    apt-get install -yq fail2ban
    cat > /etc/fail2ban/jail.d/redes-internas.local <<'CONF'
[DEFAULT]
ignoreip = 127.0.0.1/8 ::1 172.16.0.0/12 10.0.0.0/8
CONF
    systemctl enable fail2ban
    systemctl restart fail2ban
    fail2ban-client status sshd 2>/dev/null | head -3 || true
}

# Docker, Traefik e o painel, pelo instalador oficial. Não reinstala se já existe.
instalar_coolify() {
    etapa "6. Coolify"
    if [ -d /data/coolify ] && docker ps --format '{{.Names}}' 2>/dev/null | grep -qx coolify; then
        echo "já instalado"
    else
        curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
    fi
    local alheios
    alheios=$(docker ps --format '{{.Names}} {{.Image}}' | grep -i traefik | grep -v '^coolify-proxy ' || true)
    if [ -n "$alheios" ]; then
        echo "ATENÇÃO: há um Traefik que não é o do Coolify e disputa as portas 80 e 443:"
        echo "$alheios"
        echo "Remova com 'docker compose down' na pasta dele, ou 'docker rm -f <nome>'."
    fi
}

# Túnel da Cloudflare (P88): o conector abre uma conexão de saída até ela, e as visitas chegam por
# ele ao Traefik na porta 80, sem as portas 80 e 443 abertas na internet. Fica no sistema, fora do
# Coolify: se o Coolify cair, o túnel continua. Só roda com CLOUDFLARE_TUNNEL_TOKEN definido; o
# token é segredo, mostrado uma vez no painel Zero Trust, e não entra em arquivo nenhum.
instalar_tunel() {
    etapa "7. Túnel da Cloudflare"
    if [ -z "${CLOUDFLARE_TUNNEL_TOKEN:-}" ]; then
        echo "pulado: defina CLOUDFLARE_TUNNEL_TOKEN para instalar"
        return
    fi
    if ! command -v cloudflared >/dev/null; then
        install -d -m 0755 /usr/share/keyrings
        curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg -o /usr/share/keyrings/cloudflare-main.gpg
        echo 'deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared any main' \
            > /etc/apt/sources.list.d/cloudflared.list
        apt-get update -q
        apt-get install -yq cloudflared
    fi
    if systemctl is-active --quiet cloudflared; then
        echo "o serviço já está rodando"
    else
        cloudflared service install "$CLOUDFLARE_TUNNEL_TOKEN"
    fi
    systemctl --no-pager --lines=0 status cloudflared | head -3
}

# O atalho "conteineres": os containers pelo nome do serviço, legível, em vez do código do Coolify.
# DECISÃO (2026-10-15): o nome do container fica o do Coolify (serviço, código da aplicação, horário
# do deploy). Um nome fixo no compose arrisca o Coolify não achar o container para as tarefas
# agendadas, os logs e o terminal.
instalar_atalhos() {
    etapa "8. Atalho conteineres"
    cat > /etc/profile.d/registroaberto.sh <<'ATALHO'
conteineres() {
    docker ps --format 'table {{.Label "com.docker.compose.service"}}	{{.Image}}	{{.Status}}	{{.Names}}'
}
ATALHO
    echo "em /etc/profile.d/registroaberto.sh; vale a partir do próximo login"
}

# O que conferir depois, de fora da máquina.
resumo() {
    etapa "Pronto. Falta conferir de fora:"
    cat <<TEXTO
- Firewall no painel da Hostinger: com o túnel, entrada só em TCP 22; sem ele, 22, 80 e 443.
- No seu computador:
    Test-NetConnection <IP> -Port 22      # True
    Test-NetConnection <IP> -Port 8000    # False
    ssh $USUARIO@<IP>                     # entra sem pedir senha
    ssh root@<IP>                         # entra só com a sua chave; sem ela, recusado
- O painel: ssh coolify (ver ssh-config.exemplo) e http://localhost:8000.
  Crie a conta de administrador logo em seguida.
TEXTO
}

conferir_root
atualizar_sistema
criar_usuario
instalar_chave
endurecer_ssh
instalar_fail2ban
instalar_coolify
instalar_tunel
instalar_atalhos
resumo
