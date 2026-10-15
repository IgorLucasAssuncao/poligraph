# Cloudflare: túnel e DNS do registroaberto.org

Valores prontos para copiar. O ID do túnel não é segredo: aparece no DNS de quem usa túnel. O
**token** do túnel é segredo e não entra aqui.

Túnel: `registroaberto-vps`

ID do túnel:

```
2c8176d6-7add-4300-83bc-c1b216fe3257
```

---

## 1. DNS → Records → Add record

Os três registros são iguais, muda só o Name. Type **CNAME**, Proxy status **Proxied** (nuvem laranja).

Target, o mesmo nos três:

```
2c8176d6-7add-4300-83bc-c1b216fe3257.cfargotunnel.com
```

| Type | Name | Target | Proxy |
|---|---|---|---|
| CNAME | `@` | o de cima | Proxied |
| CNAME | `www` | o de cima | Proxied |
| CNAME | `painel` | o de cima | Proxied |

Name, um por vez:

```
@
```

```
www
```

```
painel
```

Antes de criar, apagar o registro antigo de mesmo nome, se ainda existir (`A` para o IP do VPS, ou o
`CNAME` do `www` para `registroaberto.org`).

---

## 2. Túnel → Published application routes → Add

As três rotas são iguais, muda só o Subdomain. Domain `registroaberto.org`, Path vazio, Type
**HTTP**, URL:

```
localhost:80
```

| Subdomain | Domain | Path | Type | URL |
|---|---|---|---|---|
| *(vazio)* | `registroaberto.org` | *(vazio)* | HTTP | `localhost:80` |
| `www` | `registroaberto.org` | *(vazio)* | HTTP | `localhost:80` |
| `painel` | `registroaberto.org` | *(vazio)* | HTTP | `localhost:80` |

Subdomain, um por vez:

```
www
```

```
painel
```

**HTTP, e não HTTPS:** o túnel entrega a visita ao Traefik dentro da própria máquina; o HTTPS para o
visitante é da Cloudflare. **`localhost:80`:** o `cloudflared` roda no Ubuntu, fora de container, e
o Traefik do Coolify escuta na porta 80 da máquina.

---

## 3. SSL/TLS → Edge Certificates

| Opção | Valor |
|---|---|
| Always Use HTTPS | Ligado |
| Minimum TLS Version | 1.2 |

---

## 4. Conferir

No VPS, o Traefik responde pelos dois nomes:

```bash
curl -sI -H "Host: registroaberto.org" http://localhost:80 | head -3
curl -sI -H "Host: painel.registroaberto.org" http://localhost:80 | head -3
```

No computador, direto na Cloudflare (sem esperar a memória dos servidores públicos):

```powershell
nslookup registroaberto.org gemma.ns.cloudflare.com
nslookup www.registroaberto.org gemma.ns.cloudflare.com
nslookup painel.registroaberto.org gemma.ns.cloudflare.com
```

Os três respondem com endereços da Cloudflare. Só com o site abrindo pelo túnel se fecham as
portas 80 e 443 no firewall da Hostinger; fica só a 22.
