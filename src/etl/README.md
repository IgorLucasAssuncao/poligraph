# ETL do poligraph — como usar

O porquê da arquitetura (entrada, tratamento, saída e análise) está na docstring de
[`poligraph_etl/__init__.py`](poligraph_etl/__init__.py). Este arquivo é o manual de uso:
como rodar, em que ordem e o que cada comando faz.

O mesmo conteúdo, desenhado: [`mapa_do_sistema.html`](../../mapa_do_sistema.html), na raiz do
repositório. Mostra fontes, comandos por etapa e tabelas, com exemplo do que trafega em cada
conexão, além do modelo do banco e das rotas da API.

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
| `simbolicas` | Conta as votações simbólicas da Câmara a partir dos arquivos de votação do cache, para o painel do início | `--anos ...` |
| `palavras-chave` | Palavras-chave das proposições votadas que ainda não têm (Pendência 70). Retoma de onde parou | `--limite N` |
| `analisar` | Similaridade, comunidades, grafo e alinhamento de uma casa | `--casa CAMARA\|SENADO`, `--legislatura 56 57` ou `--todas`; sem nada, a corrente |
| `curar` | Lista votações candidatas a pergunta do questionário, das mais divididas | `--casa`, `--legislatura`, `--limite` |
| `validar` | Mede o questionário e comunidade × partido. Só lê | `--legislatura`, `--divisao-minima` |
| `conferir` | Regras de plausibilidade sobre o banco inteiro. Falha se alguma der ERRO | — |
| `reclassificar` | Recalcula a categoria de toda votação pela regra atual e diz o que mudou | — |
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
| `populacao` | População estimada de cada município (IBGE, SIDRA 6579), para o mapa por habitante | — |
| `sedes-brasilapi` | Sede dos CNPJs que o cadastro não resolveu, pela BrasilAPI (Pendência 71). Retoma de onde parou | `--limite N` |
| `fundo` | Receitas de campanha, com o fundo eleitoral (TSE). Parlamentares pelo CPF; governadores, deputados estaduais e vices pela candidatura de `mandatos` (2018 e 2022: o layout antigo não traz o número da candidatura) | `--eleicao 2022`; `--arquivo` com o ZIP baixado à mão |
| `mandatos` | Eleitos do TSE (Pendência 90): deputados estaduais e distritais, governadores, prefeitos e vices, com pessoa nova para quem não é do Congresso. Identidade pelo hash do CPF ou do título de eleitor (o de 2024 não traz CPF) | `--eleicoes 2000 ... 2024` (padrão: todas de 2000 a 2024) |
| `patrimonio` | Bens declarados ao TSE, por tipo: parlamentares pelo CPF, os outros cargos por `mandatos` | `--anos 2018 2022` |
| `redes` | Redes sociais: Câmara para deputados, TSE para senadores e para quem só tem mandato no TSE (de 2014 em diante) | `--anos 2018 2020 2022 2024` |
| `governo` | Quem governa (TSE), orçamento, pago, arrecadação e gasto sigiloso (Portal) | `--anos ...`, `--eleicao` |
| `defesa-civil` | Cartão da Defesa Civil (CPDC), mês a mês. Mês que o Portal não publicou é pulado e nomeado no log | `--anos ...` |
| `viagens` | Viagens a serviço do Executivo federal: diárias, passagens, seguro e restituição por órgão, e destinos | `--anos ...` |
| `compras-centralizadas` | Cartão de compras centralizadas (CPCC), por órgão e mês; o favorecido não é lido | `--anos ...` |
| `sancoes` | Empresas sancionadas no CEIS e no CNEP, pelo CNPJ; pessoa física é descartada antes de gravar | — |
| `compras` | Contratos publicados no Diário Oficial, por órgão, modalidade e empresa. Valor inicial e final com erro de digitação: entra o menor quando divergem mais de 100 vezes | `--anos ...` |

RISCO: `--arquivo` (`fundo`) e `--diretorio` (`municipios`) só aceitam caminho dentro da pasta
de cache (`POLIGRAPH_CACHE`). O arquivo vira registro em `procedencia/`, e fora do cache não
haveria como refazer a carga a partir dele. Fora da pasta, o comando recusa antes de abrir.

### A carga agendada

| Comando | O que faz |
|---|---|
| `rotina --frequencia semanal` | `ingerir`, `senado` e `simbolicas` do ano, `palavras-chave`, `conferir` |
| `rotina --frequencia mensal` | A semanal, mais `cota`, `emendas`, `sedes-brasilapi`, `convenios`, `governo`, `defesa-civil`, `compras-centralizadas`, `viagens`, `compras`, `sancoes`, `populacao`, `analisar` das duas casas, `conferir` |
| mensal de jan, abr, jul e out | Também `municipios`: o cadastro da Receita muda por trimestre e pesa gigabytes |
| mensal de nov e dez de ano de eleição geral | Também `mandatos`, `fundo`, `patrimonio` e `redes` da eleição: o TSE fecha a prestação de contas depois do segundo turno |
| mensal de nov e dez de ano de eleição municipal | Também `mandatos`, `patrimonio` e `redes` da eleição |

A tabela sai de [`poligraph_etl/rotina.py`](poligraph_etl/rotina.py), que só decide as
etapas; o `__main__` as executa. Em janeiro e fevereiro a rotina inclui o ano anterior. No VPS, as duas são tarefas
agendadas do Coolify ([`docs/plano/05 §2.3`](../../docs/plano/05-cicd-e-deploy.md)).

---

## 3. A ordem e o que pode rodar junto

Cada comando espera só os próprios pré-requisitos, não a etapa anterior inteira. Dentro de
uma etapa, a ordem não importa.

| Etapa | Comandos | Espera |
|---|---|---|
| 1 | `ingerir`, `senado`, `governo`, `defesa-civil`, `viagens`, `compras`, `sancoes`, `compras-centralizadas` | Nada |
| 2 | `simbolicas`, `palavras-chave`, `analisar`, `cpf`, `cota`, `emendas` | O voto e o cadastro das duas casas (`simbolicas` só da Câmara) |
| 3 | `mandatos` | `cpf` e `senado`: liga o eleito ao parlamentar que já está na base |
| 4 | `fundo`, `patrimonio`, `redes` | `cpf` e `mandatos`: são as chaves para casar com o TSE |
| 3 | `convenios`, `municipios` | `emendas`: são os CNPJs que eles procuram |
| 4 | `sedes-brasilapi` | `municipios`: só pergunta o que o cadastro da Receita não resolveu |
| 4 | `populacao` | `municipios`: grava na linha do município |
| fim | `conferir` | Tudo o que rodou antes. ERRO derruba a rotina |

`curar`, `validar`, `amostra`, `reclassificar` e `rechavear-cpf` ficam fora da sequência:
rodam à mão, quando a pergunta aparece.

ATENÇÃO: dois comandos juntos no mesmo servidor dividem o limite de ritmo dele. `fundo`,
`patrimonio`, `redes`, `mandatos` e `cpf` (Senado) usam o TSE, cujo WAF bloqueia rajada. Na dúvida, um
por servidor; o mapa marca quem divide qual.

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
py -m poligraph_etl governo --anos 2023 2024 2025 2026 --eleicao 2022
py -m poligraph_etl simbolicas --anos 2023 2024 2025 2026
py -m poligraph_etl palavras-chave
py -m poligraph_etl analisar --casa CAMARA
py -m poligraph_etl analisar --casa SENADO
py -m poligraph_etl cpf
py -m poligraph_etl cota --anos 2023 2024 2025 2026
py -m poligraph_etl mandatos
py -m poligraph_etl fundo --eleicao 2022
py -m poligraph_etl patrimonio --anos 2018 2020 2022 2024
py -m poligraph_etl redes --anos 2018 2020 2022 2024
py -m poligraph_etl emendas --anos 2023 2024 2025 2026
py -m poligraph_etl convenios
py -m poligraph_etl municipios
py -m poligraph_etl sedes-brasilapi
py -m poligraph_etl populacao
py -m poligraph_etl conferir
```

As legislaturas anteriores: `ingerir` e `senado` com `--anos 2001 ... 2022`, e depois
`analisar --casa CAMARA --todas` e `analisar --casa SENADO --todas`.

---

## 5. Contratos: o que a fonte manda e o que o banco recebe

Os contratos ficam em [`poligraph_etl/contratos/`](poligraph_etl/contratos/). Cota, cartão da
Defesa Civil, viagens, compras e sanções passam por eles; as outras fontes migram para o mesmo formato.

| Arquivo | O que declara |
|---|---|
| `entrada.py` | `coluna("NomeNaFonte")`, `ler(contrato, registros)` e `LayoutMudou` |
| `camara.py`, `senado.py` | A linha do arquivo de cada casa: um campo por coluna lida, com o nome que a fonte usa |
| `banco.py` | A linha como fica no banco: `TABELA` e um campo por coluna, com o nome que o EF cria |

O caminho de uma linha:

```
arquivo ──ler──► LinhaDaCotaDaCamara ──despesa_da_camara──► Despesa ──gravar_contratos──► despesas
                                                        └─► Descarte(motivo, valor) ────► reconciliacoes
```

| Regra | Por quê |
|---|---|
| Coluna que some do arquivo derruba a leitura com `LayoutMudou` | Ler `None` em silêncio gravaria a linha sem dono, e o total sairia plausível e errado |
| Toda linha vira `Despesa` ou `Descarte` com motivo | A reconciliação soma os mesmos descartes que a gravação deixou de fora: fonte = base + motivos, por construção |
| O `INSERT` sai dos campos do contrato (`persistencia.gravar_contratos`) | Tabela e coluna entram como identificador do `psycopg.sql`, nunca como texto colado |
| `test_contratos.py` confere cada contrato de saída contra a tabela | Nome, tipo, nulidade e coluna obrigatória esquecida: um rename no EF derruba o teste antes da carga |

Para levar outra fonte aos contratos: a linha de entrada em `contratos/<fonte>.py`, a de saída
em `contratos/banco.py`, uma função por linha que devolve o contrato de saída ou um `Descarte`,
e o teste de ponta a ponta com o download trocado por arquivo de teste (modelo em
`test_contratos.py`).

---

## 6. Testes

```bash
py -m pytest -q
```

Os testes de banco sobem um Postgres com o Testcontainers, e por isso precisam do Docker
ou do Podman em execução; sem ele, são pulados.

O schema desse Postgres é o que o EF cria: [`tests/schema_do_ef.sql`](tests/schema_do_ef.sql),
gerado das migrations. A ETL nunca cria tabela, e o teste também não. Depois de toda migration
nova, da raiz do repositório:

```bash
dotnet ef migrations script -p src/Poligraph.Data -o src/etl/tests/schema_do_ef.sql
```

ATENÇÃO: o CI do back gera o script de novo e compara com o arquivo versionado. Migration sem
o arquivo regenerado derruba o CI.
