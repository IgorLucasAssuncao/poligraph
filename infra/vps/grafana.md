# Grafana: subir e usar

Logs, rastros e métricas da API, e os logs da ETL, num painel só. O serviço `observabilidade` do
`docker-compose.prod.yaml` é a imagem tudo em um da Grafana (`grafana/otel-lgtm`): Grafana, Loki
(logs), Tempo (rastros), Prometheus (métricas) e o coletor OpenTelemetry. A API e a ETL já mandam
para ele pelo padrão OpenTelemetry. Pendência 21.

---

## 1. A senha do administrador

**production → Shared Variables → + Add**

Name:

```
GRAFANA_SENHA_ADMIN
```

Value: uma senha forte, gerada no gerenciador de senhas. Não colar em chat nem em arquivo.

**Aplicação → Environment Variables**, a variável que o compose pede:

```
GRAFANA_SENHA_ADMIN
```

```
{{environment.GRAFANA_SENHA_ADMIN}}
```

A senha só vale na **primeira** subida: depois, o Grafana a guarda no volume dele, e trocar a
variável não muda nada. Para trocar, no próprio Grafana (perfil do admin).

---

## 2. Subir

```powershell
git push origin master
```

Coolify: aplicação → **Reload Compose File** → aparecem seis serviços (`migrations`, `api`, `api2`,
`etl`, `observabilidade`, `web`) → **Deploy**.

O primeiro deploy baixa a imagem da Grafana, que é grande. O serviço pede uns 2 GB de memória; o
compose limita a esse teto.

---

## 3. O endereço

**Aplicação → Domains → serviço `observabilidade`**

```
http://grafana.registroaberto.org
```

Porta interna:

```
3000
```

Com `http://`, como o site e o painel, por causa do túnel.

**Cloudflare → o túnel `registroaberto-vps` → Published application routes → Add**

| Subdomain | Domain | Type | URL |
|---|---|---|---|
| `grafana` | `registroaberto.org` | HTTP | `localhost:80` |

**Cloudflare → Zero Trust → Access → Applications → `Painel Coolify` → Edit**: acrescentar o
hostname `grafana.registroaberto.org` à mesma aplicação, com a mesma regra (só o e-mail do autor).
Sem isso, a tela de login do Grafana fica à vista de qualquer um.

---

## 4. Entrar e olhar

`https://grafana.registroaberto.org` → a tela do Access (e-mail e código) → a do Grafana:
usuário `admin`, a senha do passo 1.

| Para ver | Onde | Consulta |
|---|---|---|
| Logs da API | **Explore** → fonte **Loki** | `{service_name="poligraph-api"}` |
| Só os erros da API | Explore → Loki | `{service_name="poligraph-api"} \|= "fail"` |
| Só uma das cópias | Explore → Loki | `{service_name="poligraph-api", service_instance_id="api2"}` |
| Logs da ETL | Explore → Loki | `{service_name="poligraph-etl"}` |
| Um request por dentro (tempo de cada parte, consultas ao banco) | Explore → fonte **Tempo** → Search | Service Name `poligraph-api` |
| Requests por segundo, erros, tempo de resposta | **Dashboards** (a imagem traz alguns prontos) ou Explore → fonte **Prometheus** | `http_server_request_duration_seconds_count` |

Os rótulos exatos aparecem no próprio Explore, no seletor de rótulos: se um nome acima não bater,
o seletor mostra o certo.

---

## 5. Quanto guarda

| Dado | Por quanto tempo |
|---|---|
| Logs (Loki) | 30 dias (`LOKI_EXTRA_ARGS` no compose) |
| Métricas (Prometheus) | 30 dias (`PROMETHEUS_EXTRA_ARGS`) |
| Rastros (Tempo) | O padrão da imagem |

Os dados ficam no volume `observabilidade-dados` e sobrevivem aos deploys.

---

## O que não vem para cá

O nginx do site não fala OpenTelemetry: os logs dele continuam na aba **Logs** do serviço `web`,
no Coolify. A ETL manda só os logs, sem rastros nem métricas.
