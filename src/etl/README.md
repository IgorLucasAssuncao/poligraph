# ETL do poligraph — como usar

O porquê da arquitetura (entrada, tratamento, saída e análise) está na docstring de
[`poligraph_etl/__init__.py`](poligraph_etl/__init__.py). Este arquivo é o manual de uso:
como rodar, em que ordem e o que cada comando faz.

Ajuda de qualquer comando, direto do código:

```bash
py -m poligraph_etl --help
py -m poligraph_etl cota --help
```

---

## 1. Duas formas de rodar

| Forma | Quando | Como |
|---|---|---|
| **Botões do Aspire** | O dia a dia: sobe tudo e cada comando vira um botão `etl-*` no painel | `dotnet run --project src/Poligraph.AppHost`, e clicar no recurso |
| **Linha de comando** | Rodar com argumentos que o botão não tem, ou depurar | `cd src/etl` e `py -m poligraph_etl <comando> [argumentos]` |

Na linha de comando, o ambiente precisa de:

| Variável | Para quê | Obrigatória |
|---|---|---|
| `ConnectionStrings__poligraph` ou `POLIGRAPH_CONEXAO` | O banco. Aceita o formato do Npgsql (`Host=...;Port=...`) | Sempre |
| `POLIGRAPH_CHAVE_CPF` | A chave do HMAC do CPF (Pendência 77), a mesma de `Parameters:chave-cpf` nos user-secrets do AppHost | `cpf`, `cota`, `fundo`, `patrimonio`, `rechavear-cpf` |
| `POLIGRAPH_CACHE` | Pasta dos downloads e de `procedencia/` | Não: o padrão é `.cache` |

RISCO: com outra chave de CPF, os hashes novos não casam com os do banco, e a conciliação
falha em silêncio. Para trocar de chave, `rechavear-cpf`.

Instalação, uma vez: `py -m pip install -r requirements.txt` (e `requirements-dev.txt` para
os testes).

---

## 2. Os comandos

### Voto — o que entra na afinidade

| Comando | O que faz | Argumentos |
|---|---|---|
| `ingerir` | Câmara: deputados, votações, votos, proposições e orientações; marca como secretas as votações sem nenhuma posição (Pendência 69) | `--anos 2023 2024 ...` (padrão: 2023 a 2026) |
| `senado` | Senado: senadores, votações, votos e matérias | `--anos ...` (padrão: 2023 a 2026) |
| `palavras-chave` | Palavras-chave das proposições votadas que ainda não têm (Pendência 70). Retoma de onde parou | `--limite N` |
| `analisar` | Similaridade, comunidades, grafo e alinhamento de uma casa | `--casa CAMARA\|SENADO`, `--legislatura 56 57` ou `--todas`; sem nada, a corrente |
| `curar` | Lista votações candidatas a pergunta do questionário, das mais divididas | `--casa`, `--legislatura`, `--limite` |
| `validar` | Mede o questionário e comunidade × partido. Só lê | `--legislatura`, `--divisao-minima` |
| `conferir` | Regras de plausibilidade sobre o banco inteiro. Falha se alguma der ERRO | — |
| `amostra` | Sorteia votações e as confere, voto a voto, contra um segundo serviço oficial de cada casa (achado #39) | `--por-grupo 20`, `--semente 2026` |

### Pessoas e dinheiro — o perfil, fora da afinidade

| Comando | O que faz | Argumentos |
|---|---|---|
| `cpf` | Completa o `cpf_hash` (Câmara pela API, Senado pelo TSE). Grava o hash, nunca o CPF | — |
| `rechavear-cpf` | Refaz todo hash de CPF com a chave atual: pessoas, cota, campanha e patrimônio | — |
| `cota` | Cota parlamentar: CEAP da Câmara e CEAPS do Senado | `--anos ...` |
| `emendas` | Emendas, favorecidos e convênios (download público do Portal) | `--anos ...`; `--resolver CODIGO=ID_NA_CAMARA` vincula um autor à mão |
| `convenios` | Completa o CNPJ do convenente dos convênios de emenda | — |
| `municipios` | Sede de quem recebeu emenda, pelo cadastro da Receita (~6 GB) | `--diretorio` com os `Estabelecimentos*.zip` já baixados |
| `sedes-brasilapi` | Sede dos CNPJs que o cadastro não resolveu, pela BrasilAPI (Pendência 71). Retoma de onde parou | `--limite N` |
| `fundo` | Receitas de campanha, com o fundo eleitoral (TSE) | `--eleicao 2022`; `--arquivo` com o ZIP baixado à mão |
| `patrimonio` | Bens declarados ao TSE, por tipo | `--anos 2018 2022` |
| `redes` | Redes sociais: Câmara para deputados, TSE para senadores | `--anos 2018 2022` |
| `governo` | Quem governa, orçamento, pago e arrecadação | `--anos ...`, `--eleicao` |

### A carga agendada

| Comando | O que faz |
|---|---|
| `rotina --frequencia semanal` | `ingerir` e `senado` do ano, `palavras-chave`, `conferir` |
| `rotina --frequencia mensal` | A semanal, mais `cota`, `emendas`, `analisar` das duas casas, `conferir` |

Em janeiro e fevereiro a rotina inclui o ano anterior. No VPS, as duas são tarefas
agendadas do Coolify ([`docs/plano/05 §2.3`](../../docs/plano/05-cicd-e-deploy.md)).

---

## 3. A ordem

```
ingerir ─┬─ palavras-chave
senado ──┤
         ├─ analisar --casa CAMARA / SENADO ── validar
         ├─ cota                 (estoura sem ingerir: não há de quem é a despesa)
         ├─ cpf ─┬─ fundo        (estoura sem cpf: não há com quem casar o TSE)
         │       └─ patrimonio
         └─ emendas ─┬─ convenios
                     ├─ municipios
                     └─ sedes-brasilapi
conferir                         (depois de qualquer carga de voto)
```

| Sem o pré-requisito | O que acontece |
|---|---|
| `cota` sem `ingerir` | Estoura, dizendo o que rodar |
| `fundo` sem `cpf` | Estoura, dizendo o que rodar |
| `analisar` sem voto | Avisa e sai |
| `municipios`, `convenios`, `sedes-brasilapi` sem `emendas` | Avisa e sai: não há CNPJ para procurar |

---

## 4. Do zero, numa base vazia

```bash
py -m poligraph_etl ingerir --anos 2023 2024 2025 2026
py -m poligraph_etl senado --anos 2023 2024 2025 2026
py -m poligraph_etl palavras-chave
py -m poligraph_etl analisar --casa CAMARA
py -m poligraph_etl analisar --casa SENADO
py -m poligraph_etl cpf
py -m poligraph_etl cota --anos 2023 2024 2025 2026
py -m poligraph_etl fundo --eleicao 2022
py -m poligraph_etl patrimonio
py -m poligraph_etl emendas --anos 2023 2024 2025 2026
py -m poligraph_etl conferir
```

As legislaturas anteriores: `ingerir` e `senado` com `--anos 2001 ... 2022`, e depois
`analisar --casa CAMARA --todas` e `analisar --casa SENADO --todas`.

---

## 5. Testes

```bash
py -m pytest -q
```

Os testes de banco sobem um Postgres com o Testcontainers, e por isso precisam do Docker
ou do Podman em execução; sem ele, são pulados.
