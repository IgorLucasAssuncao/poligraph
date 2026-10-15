# Coolify: as tarefas agendadas da ETL

A carga de dados roda sozinha, toda semana e todo mês, dentro do serviço `etl` da aplicação. O
serviço fica parado à espera das tarefas; quem dispara é o Coolify, no horário de Brasília (o fuso
da instância é `America/Sao_Paulo`).

---

## 1. Antes das tarefas

**Publicar o código** com o serviço `etl` no compose, e fazer o **Deploy** da aplicação.

```powershell
git push origin master
```

Depois do deploy, a aplicação tem quatro serviços: `migrations`, `api`, `etl` e `web`. O `etl` fica
**Running** o tempo todo, sem fazer nada até a tarefa chamar.

**A chave do CPF**, em production, Shared Variables:

| Name | Value |
|---|---|
| `POLIGRAPH_CHAVE_CPF` | A **mesma** do computador do autor. Os `cpf_hash` copiados do banco local foram calculados com ela; com outra chave, a ETL deixa de reconhecer os parlamentares já gravados |

Para ver o valor local sem mostrar os outros segredos:

```powershell
dotnet user-secrets list --project src/Poligraph.AppHost | Select-String "chave-cpf"
```

Copiar do terminal direto para o Coolify. Não colar em chat nem em arquivo.

Na aplicação, Environment Variables:

| Name | Value |
|---|---|
| `POLIGRAPH_CHAVE_CPF` | `{{environment.POLIGRAPH_CHAVE_CPF}}` |

A `ConnectionStrings__poligraph` já existe e serve à ETL também. Depois de criar a variável,
**Deploy** de novo.

---

## 2. As duas tarefas

Aplicação, aba **Scheduled Tasks**, **+ Add**, duas vezes:

### Semanal

| Campo | Valor |
|---|---|
| Name | `rotina-semanal` |
| Command | `python -m poligraph_etl rotina --frequencia semanal` |
| Frequency | `0 3 * * 1` |
| Container name / Service | `etl` |

Toda segunda, às 3h. Traz as votações da Câmara e do Senado do ano, as simbólicas e as
palavras-chave das proposições novas, confere o banco e limpa o cache.

### Mensal

| Campo | Valor |
|---|---|
| Name | `rotina-mensal` |
| Command | `python -m poligraph_etl rotina --frequencia mensal` |
| Frequency | `0 3 2 * *` |
| Container name / Service | `etl` |

Todo dia 2, às 3h. Tudo da semanal, mais cota, emendas, convênios, governo federal, viagens,
compras, sanções, população e o recálculo do grafo das duas casas. Em janeiro, abril, julho e
outubro, também o cadastro de CNPJ da Receita (gigabytes). Em novembro e dezembro de ano de
eleição geral, também os dados do TSE.

Para copiar:

```
python -m poligraph_etl rotina --frequencia semanal
```

```
0 3 * * 1
```

```
python -m poligraph_etl rotina --frequencia mensal
```

```
0 3 2 * *
```

```
etl
```

---

## 3. Saber quando falha

**Notifications** (menu lateral do Coolify): ligar um canal (e-mail, Telegram ou Discord) e, nele,
o aviso de **falha de tarefa agendada** (*Scheduled task failure*).

A rotina para na primeira etapa que falhar, e termina com o `conferir`, que falha se algum total
não fechar com a fonte. Falha avisada é o sinal de olhar o log.

---

## 4. A primeira execução

O cache no servidor começa vazio, e em outubro a mensal também baixa o cadastro da Receita. A
primeira mensal vai demorar e pesar no VPS. Rodar à mão, num horário de pouco acesso:

1. Scheduled Tasks, `rotina-mensal`, **Execute now** (ou o botão de rodar).
2. Acompanhar o log na própria tarefa.
3. Em **Metrics** da aplicação, acompanhar a memória do `etl`.

A semanal não precisa disso: é leve.

---

## 5. Lendo o log

| Linha | Quer dizer |
|---|---|
| `Rotina semanal: ingerir --anos 2026 · …` | As etapas que vão rodar, na ordem |
| `Etapa 3 de 6: simbolicas --anos 2026` | Onde está |
| `Outra rotina está rodando; esperando ela terminar.` | A semanal e a mensal caíram juntas. A segunda espera a primeira e roda em seguida; não é erro |
| `cache: 12 itens apagados, 380 MB` | A limpeza do fim. Downloads com mais de 35 dias e cópias de procedência com mais de 180 saem; do cadastro da Receita fica só o mês mais recente |
| `ERRO` no `conferir` | Algum total não fecha com a fonte. A tarefa falha; os dados carregados ficam, e a diferença aparece na tela de reconciliação |

---

## 6. À mão, pelo terminal do Coolify ou pelo SSH

No Coolify: aplicação, **Terminal**, serviço `etl`. Pelo SSH, no VPS:

```bash
docker exec -it $(docker ps -q --filter "name=etl-") sh
```

Dentro do container:

```bash
python -m poligraph_etl rotina --frequencia semanal
python -m poligraph_etl conferir
python -m poligraph_etl limpar-cache
du -sh /cache
```

O cache fica no volume `etl-cache` e sobrevive aos deploys.
