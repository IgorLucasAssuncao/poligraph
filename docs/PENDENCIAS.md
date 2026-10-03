# Pendências — visão consolidada

> **Atualizado:** 2026-10-02 · **113 resolvidas · 61 abertas**
> As pendências vivem espalhadas por 11 documentos. Esta é a visão única, agrupada
> **pelo que destrava cada uma** — que é o que importa na hora de decidir o que fazer.
> 🔴 **O questionário ganhou seção própria** — estava subestimado num bloco de *"trabalho
> manual"*, fora dos bloqueios.
>
> ⚠️ **Recontado em 2026-10-01, ⛔ incrementado.** O cabeçalho de 26/08 dizia 62
> resolvidas, e a lista do fim tinha **60** códigos, sem Pendência 10, Pendência 11, CT3, Pendência 35 nem as
> outras fechadas de 27/08 a 06/09. A contagem agora sai da lista.

---

## 🆕 Estado em 2026-10-01 — comece por aqui

### O que entrou desde a última atualização (07/09 → 25/09)

| Entrega | Fecha |
|---|---|
| Ficha com **patrimônio** declarado ao TSE | ✅ **PP3** |
| Ficha com **redes sociais** (Câmara e TSE) | ✅ **PP4** |
| Ficha com **casa** e presença no voto | ✅ o resto da **Pendência 42** |
| Senadores: nome civil, CPF pelo TSE, financiamento; **CEAPS** | — |
| Governo, emendas por destino, mapa por município, entidades, metodologia | — |
| Emendas e orçamento pelo **download público** — a chave pessoal do Portal saiu ([#33](achados/033-o-destino-da-emenda.md)) | — |

Também fechadas por estarem obsoletas ou já feitas: ✅ **API3** (o teste existe:
`Poligraph.Tests/Unidade/TestesPolaridade.cs`) e ✅ **Pendência 31** (o seed foi aposentado na
Pendência 41).

### 🔴 Novas — achadas em 2026-10-01

| # | Pendência | Prioridade |
|---|---|---|
| ✅ ~~Pendência 54~~ | **Resolvida (2026-10-01)** — a ficha de todo deputado mostrava 0 "mais parecidos": `MaisSimilaresAsync` pegava a última execução de **qualquer casa**. A consulta estava repetida em cinco serviços e virou uma, `ExecucaoVigente`, com casa **e** legislatura. O `validar` do ETL tinha o mesmo defeito. `TestesExecucaoVigente` grava a execução errada DEPOIS da certa; mutação conferida | — |
| ✅ ~~Pendência 53~~ | **Resolvida (2026-10-02)** — as outras legislaturas estão na base: votos de 2001 a 2026 nas duas casas, grafos, cota 2009–2026, emendas 2015–2026 e a navegação por período. Nesta rodada: `cpf --todas-legislaturas` deu `cpf_hash` a **1.563** deputados de legislaturas anteriores (todos casaram); a campanha de **2014** e de **2010** entrou pelo layout antigo do TSE (`receitas.traduzir_layout_antigo`; 64.076 e 85.054 receitas; 604 e 641 dos eleitos naquela eleição); o patrimônio de **2006, 2010 e 2014** também (608, 850 e 830 pessoas). Limites ditos: a prestação de contas de 2006 e anteriores não traz o CPF do candidato, então campanha antes de 2010 fica fora; e os senadores eleitos até 2006 continuam sem CPF (12 de 352 casaram), porque o casamento deles depende desse mesmo arquivo. A sede dos CNPJs de 2014–2022 está na Pendência 71 | — |
| **Pendência 58** | 🟡 **O Senado de 2015–2016 ⛔ está nos dados abertos** ([#37](achados/037-a-votacao-de-1998-datada-de-2015.md)). MEDIDO em 2026-10-02: a lacuna é do acervo, e não de um endpoint. `/votacao`, o antigo `/plenario/lista/votacao/{data}` e o histórico por senador (`/senador/{codigo}/votacoes`) têm o mesmo buraco: Randolfe Rodrigues, senador desde 2011, tem **0** votações em 2015 e **6** em 2016; a MP 665 (26/05/2015) e o julgamento final do impeachment (31/08/2016) não aparecem em nenhum. Fonte estruturada não há. **Decisão do autor:** extrair à mão do Diário do Senado Federal (~230 votações), ou deixar a lacuna dita na tela, como o grafo da 55ª já faz pelo período das votações (Pendência 59) | 🟡 Média |
| ✅ ~~Pendência 59~~ | **Resolvida (2026-10-02)** — o grafo da 55ª do Senado dizia "2015–2019", e as 103 votações abertas que o desenharam vão de mai/2016 a 2018 (3 acima do mínimo). O `GrafoDto` traz `AbertasDesde` e `AbertasAte`, e a tela diz o recorte em todo grafo | — |
| ✅ ~~Pendência 60~~ | **Resolvida (2026-10-02)** — [achado #38](achados/038-a-emenda-sem-autor.md). Remedido: 17.810 linhas, R$ 35,64 bi empenhados e R$ 19,67 bi pagos, todas em 2014–2020; 2014 é 100% sem autor e 2016, 72%. O código `-99` ("RELATOR GERAL") é de emenda de comissão; a de relator vem como `S/I`. O log da carga deixou de chamá-las de "a fonte mudou?" | — |
| ✅ ~~Pendência 81~~ | **Resolvida (2026-10-02)** — as emendas de bancada sem autor entram com a bancada deduzida pela UF (1.221 linhas, R$ 6,39 bi em 2016–2020; `autoria_inferida`, código com "I", `CHECK` que impede pessoa e código do Portal). E a regra do autor, **o orçamento tem de fechar**, virou a reconciliação: a cada carga, por ano, o total do Portal, o da base e o que ficou fora por motivo (`reconciliacoes`, `reconciliacao_motivos`); o `conferir` dá ERRO se Portal ≠ base + motivos ou se a base mudar depois. A página de emendas mostra "Quanto confere com o Portal da Transparência". Ficam fora, com motivo à vista: relator (R$ 20,38 bi), comissão (R$ 2,56 bi), bancada sem UF e R$ 28,85 bi em pagamentos que o Portal publica sem o código da emenda. O caminho do PDF da CMO foi descartado pelo autor: fonte isolada | — |
| **Pendência 82** | 🟡 **Revisar todos os textos do front** — pedido do autor (2026-10-02). Parte das ajudas, dicas e notas soa escrita por IA: antítese em quase toda frase ("não é X, é Y", "fato, não alerta"), explicação do método onde a pessoa queria só a informação. O texto fala com gente: frase direta, voz ativa, o que a pessoa ganha com aquilo. Inclui os verbetes de `Termo.tsx`, os passos do tour (`tour.ts`), os textos de vazio e de erro, os rótulos do modo análise e da seção "O que mudou" EM ANDAMENTO (2026-10-02): três passadas feitas, sem antítese em série, sem travessão no meio da frase e sem CAIXA ALTA de ênfase, nos 21 verbetes de `Termo.tsx`, no tour e nos textos do grafo, início, login, metodologia, entidade, emendas, ficha e resultado. Ficam as ressalvas que são a própria informação (RNF-14; o eixo do alinhamento não é esquerda e direita). Falta uma leitura de ponta a ponta, tela a tela | Média |
| **Pendência 56** | 🟡 **Governos anteriores:** `gestoes` é uma linha por eleição (`ck_gestao_posse`), e ⛔ representa Temer (2016–18). Decidir o modelo antes de ingerir eleições anteriores | 🟡 Média |
| ✅ ~~Pendência 55~~ | **Resolvida (2026-10-02)** — nenhum emoji no código: os marcadores de `.cs`, `.ts`, `.tsx`, `.css` e `.py` viraram `RISCO:`, `ATENÇÃO:`, `DECISÃO:`, `MEDIDO:`. No front, os comentários de dentro de corpos e do JSX foram para o JSDoc das declarações. Regra em `.claude/CLAUDE.md` | — |
| **Pendência 57** | 🟡 **PR bloqueado:** a credencial do GitHub expirou, o `gh` ⛔ está instalado, e o `origin/main` do último fetch só tem o `Initial commit`, ⛔ ancestral da branch | 🟡 Média |
| ✅ ~~Pendência 61~~ | **Resolvida (2026-10-02)** — as notícias saíram de vez, por decisão do autor (sem tempo hábil): coletor RSS, comando `noticias`, `etl-noticias` no AppHost, `/api/parlamentares/{id}/noticias`, `/api/seguidos/noticias`, o digest por e-mail, a aba da ficha e a seção do início. A política de privacidade foi para a `v4-2026-10-02` e ⛔ promete mais e-mail | — |
| **Pendência 62** | 🟡 **Contrair o schema das notícias:** as tabelas `noticias`, `noticia_pessoas` e `noticia_temas` e os modelos do EF ficaram, porque apagar tabela é mudança destrutiva. Como ainda não há produção, cabe num deploy só. Junto: `consentimentos`, cujo único valor permitido é `EMAIL_NOTICIAS`, ficou sem uso depois de a Pendência 63 decidir por nenhum e-mail. Apagar é decisão do autor (dado de LGPD) | 🟢 Baixa |
| ✅ ~~Pendência 63~~ | **Resolvida (2026-10-02)** — seção "O que mudou" no início, para quem segue alguém, antes da lista de seguidos. `GET /api/seguidos/novidades` (exige conta, sem cache e sem log de nome) com os cinco avisos de [`plano/09 §4.1`](plano/09-apresentacao-validacao-e-valor.md): votou na semana (ausência só no Senado), votou contra a bancada do próprio partido (só Câmara, com a regra da disciplina portada para C# em `BancadaDoPartido`, e um arquivo de casos lido pelas duas suítes de teste), trocou de partido, gastou na cota do último mês fechado, emenda paga na última competência fechada. Cada item com a fonte; a seção diz a janela e a data da carga. MEDIDO em 2026-10-02: a última votação de plenário da base é de 03/09/2026 nas duas casas, então a semana de hoje vai de 28/08 a 03/09 | — |
| ✅ ~~Pendência 64~~ | **Resolvida (2026-10-02)** — comando `rotina --frequencia semanal|mensal` (`rotina.py` decide as etapas, o `__main__` executa e para na primeira falha): semanal = `ingerir` e `senado` do ano + `conferir`; mensal = as da semanal + `cota`, `emendas`, `analisar` das duas casas + `conferir`. Em janeiro e fevereiro entra o ano anterior. No VPS, duas Scheduled Tasks do Coolify ([`plano/05 §2.3`](plano/05-cicd-e-deploy.md)); no Aspire, os botões `etl-rotina-semanal` e `etl-rotina-mensal`. ATENÇÃO: o agendamento no Coolify só existe quando houver o VPS | — |
| **Pendência 65** | 🔴 **Login opcional — e a RNF-17.** Feito em 2026-10-02: com `Acesso:LeituraPublica` ligado, só seguir e a conta pedem login, e o login volta para onde a pessoa estava. Ligado **só** em `appsettings.Development.json`. ⚠️ **Em produção continua desligado**: a RNF-17 restringe o acesso no período eleitoral, e o 2º turno é em **25/10/2026**. Ligar em produção é decisão do autor | 🔴 Alta |
| ✅ ~~Pendência 66~~ | **Resolvida (2026-10-02)** — `conferir` na ETL e o botão `etl-conferir`: regras de plausibilidade depois da carga, ERRO derruba o comando. Primeira rodada: **0 erros, 29 avisos**, todos explicados em [`plano/09 §5.2`](plano/09-apresentacao-validacao-e-valor.md). A votação do Senado com 82 é titular e suplente de TO no dia da troca; dos 13 placares, 11 são votação secreta de fato (Pendência 69) | — |
| ✅ ~~Pendência 69~~ | **Resolvida (2026-10-02)** — `persistencia.marcar_secretas_de_fato` marca `secreta` em toda votação da Câmara com votos e nenhuma posição, no fim de cada `ingerir`, na base inteira (idempotente; a regravação não desfaz a marca). MEDIDO no banco local: **12** votações, uma ou mais em cada legislatura da 52ª à 57ª (a contagem de 11 era de uma medição anterior); o aviso `sem-posicao-nenhuma` do `conferir` caiu de 12 para 0, e a conferência de 31 para 19 avisos. O card do início deixou de dizer "N% das votações são secretas", que daria "0%" na Câmara e era percentual solto (RF-29): agora "2 de 1.597 votações são secretas" | — |
| ✅ ~~Pendência 70~~ | **Resolvida (2026-10-02)** — `palavras_chave` em `proposicoes`, comando `palavras-chave` (rotina semanal) e a busca dos votos olhando o campo. Carga completa no banco local: 7.447 proposições consultadas, 7.308 com palavras. "Reforma tributária" passou a achar a PEC 45/2019: 52 votos de um deputado de exemplo na 57ª, contra zero antes | — |
| **Pendência 71** | 🟡 **Código FEITO em 2026-10-02** (comando `sedes-brasilapi`, em lotes de 500 com carga própria, sem o quadro de sócios). Falta **rodar**: são 19.219 CNPJs, R$ 9,82 bi fora do mapa, umas duas horas a 0,35 s por CNPJ. ATENÇÃO: a BrasilAPI é projeto comunitário que repassa o cadastro aberto da Receita; a fonte citada continua sendo a Receita | 🟡 Média |
| ✅ ~~Pendência 77~~ | **Resolvida (2026-10-02)** — `hash_de_cpf` passou a **HMAC-SHA256** com a chave de `POLIGRAPH_CHAVE_CPF`, que vem do parâmetro secreto `chave-cpf` do AppHost (user-secrets `Parameters:chave-cpf`). Sem a chave, ou com menos de 32 caracteres, a ETL **para** em vez de cair no SHA-256 puro. O comando `rechavear-cpf` refaz tudo: apaga `pessoas.cpf_hash`, roda `cpf` e recarrega cota, campanha e patrimônio nos anos que estão no banco. ATENÇÃO: **perder a chave é perder a conciliação** (os hashes novos não casam com os do banco); trocar a chave exige rodar `rechavear-cpf`. MEDIDO em 2026-10-02, no banco local: 719 de 719 pessoas voltaram a ter `cpf_hash`; campanha (44.171 receitas, 31.657 de pessoa física, 718 parlamentares) e patrimônio (5.840) com as mesmas contagens de antes. Fecha também B7 e ER5, que pediam a mesma decisão. Explicação em https://claude.ai/artifact/Gc11fzR2MEZk85RFMuGjki | — |
| **Pendência 72** | **Procedência por linha — quase toda FEITA em 2026-10-02.** Tabela `cargas` (fonte, URL exata, data, SHA-256, `ETag` e `Last-Modified` da fonte, comando e, desde a Pendência 73, a versão da ETL) e `carga_id` com FK RESTRICT em votações, votos, orientações, despesas, emendas, favorecidos, receitas, patrimônios e `cnpjs_municipio`. As cargas de dinheiro leem do cache: o hash sai do arquivo, em blocos, e a data é a de chegada ao disco; a cópia em `procedencia/` só até 600 MB. MEDIDO em 2026-10-02, depois de recarregar tudo: **100%** das linhas com carga em votações (12.436), votos (2.179.300), orientações, despesas (5.600.360), emendas (76.817), favorecidos (621.021), receitas (44.171) e patrimônios (5.840); as contagens de voto por casa e legislatura ficaram idênticas às de antes da recarga. FALTA: `cnpjs_municipio` (0 de 31.574), que só ganha carga ao rodar `municipios`, gigabytes de cadastro da Receita. Desenho em [`plano/10 §2`](plano/10-procedencia-e-modo-analise.md) | Baixa |
| **Pendência 73** | **Modo análise — primeira versão FEITA em 2026-10-02.** Interruptor "Análise" no cabeçalho, guardado no navegador e válido sem conta. Ligado, o número ganha sublinhado pontilhado e abre um painel lateral: a regra da conta, quantas linhas entraram, quantas não têm carga (gravadas antes da Pendência 72) e, por arquivo, órgão, URL, data UTC, SHA-256, tamanho, `ETag`/`Last-Modified`, **versão do código** (hash dos fontes da ETL, coluna `cargas.versao`), comando e **base legal**. API: `GET /api/procedencia/{contexto}` com `votos`, `cota`, `emendas`, `campanha`, `patrimonio` e `painel`, cada um no MESMO recorte do número da tela. Ligado na ficha (votos com posição, cota, emendas, campanha, patrimônio), no painel do Início (votações por casa) e, desde 2026-10-02, no "Pago em emendas" do mapa (contexto `pagamentos`). ABERTO: (1) estender aos outros números (gastos por categoria, mapa, entidades, governo); (2) **o autor conferir as citações de base legal**, que hoje são por órgão (LAI art. 8º; Lei 9.504/1997; LC 131/2009; Decreto 8.777/2016) e não por conjunto de dados; (3) a lista das linhas, para números pequenos, que o plano/10 §3 previa | Média |
| ✅ ~~Pendência 74~~ | **Resolvida (2026-10-02)** — o favorecido da emenda traz `tambemNaCota`: o que a cota do MESMO parlamentar pagou ao MESMO CNPJ, nos anos de despesa do mandato que apresentou a emenda (`Legislaturas.DoAnoDeEmenda`). A ficha diz "A cota deste parlamentar também pagou R$ X a este CNPJ em 2023–2026", sem adjetivo (RNF-16). Só CNPJ público: o fornecedor pessoa física da cota é hash, e o empresário individual tem CNPJ de pessoa | — |
| **Pendência 75** | **Parlamentar sócio de empresa**: quadro de sócios cruzado por **nome + os 6 dígitos do meio do CPF** na ETL, gravando só o vínculo parlamentar–CNPJ. Por nome sozinho, não: homônimos. Doador pessoa física fica de fora: é cidadão privado. [`plano/10 §4.2`](plano/10-procedencia-e-modo-analise.md) | Baixa |
| ✅ ~~Pendência 76~~ | **Resolvida (2026-10-02)** — duas regras de AVISO no `conferir`: patrimônio declarado acima de R$ 500 mi (o dobro do maior medido, R$ 240 mi) e salto de 50 vezes entre eleições quando o segundo total passa de R$ 10 mi (o maior salto medido foi 14 vezes). Na base de hoje, nenhuma das duas dispara | — |
| **Pendência 80** | 🟡 **"Votos com posição" conta abstenção na ficha e não no painel.** A ficha (`ServicoParlamentares`, `Valor != null`) chama de "votos com posição" uma contagem que inclui a abstenção (`Valor = 0`); o painel do Início (`ServicoPanorama`) diz no código que "abstenção não é posição" e conta só Sim e Não. Achado ao ligar o modo análise, que repete a regra da ficha para o número bater. Decidir um termo e um recorte, e usar os dois nos dois lugares | Média |
| ✅ ~~Pendência 78~~ | **Resolvida (2026-10-02)** — [`fluxos-das-casas.md`](fluxos-das-casas.md): o caminho da proposição (apresentação, comissões, urgência, plenário, casa revisora, sanção e veto), o quórum por tipo (PL, PLP, PEC em dois turnos, MPV, PDL), a votação em plenário por dentro (simbólica e nominal, destaque e polaridade, orientação, abstenção e obstrução), o que muda no Senado (mandato de 8 anos, dois suplentes, voto secreto de autoridade, sem orientação publicada) e a emenda do empenho ao pagamento, com os tipos de emenda. Cada passo diz onde aparece na base. O glossário ganhou simbólica, turno, quórum, obstrução, liquidação, pagamento, restos a pagar, tipos de emenda, mandato e suplente. As citações de lei são da Constituição e dos regimentos, pelo artigo: conferir antes de levar ao texto do TCC | — |
| ✅ ~~Pendência 79~~ | **Resolvida (2026-10-02)** — os 282 comentários de dentro de funções da ETL e dos testes foram para a docstring da função dona; o de fim de linha leva o código que comentava. Ficam só diretivas (`noqa`, `pragma`). Uma trava no script recusava gravar arquivo em que alguma nota não chegasse à docstring | — |
| ✅ ~~Pendência 67~~ | **Resolvida (2026-10-02)** — [achado #39](achados/039-a-amostra-confere.md). Comando `amostra` (e botão `etl-amostra`): sorteio com semente fixa, 20 votações por casa e legislatura, conferidas voto a voto contra um segundo serviço oficial (Câmara: API por votação; Senado: lista por data). 267 votações e 49.109 votos, **0 diferenças**. É a versão repetível da amostra manual; a lista sorteada serve também para conferir no site, a olho | — |
| ✅ ~~Pendência 68~~ | **Resolvida (2026-10-02)** — o painel conta como votação só a que tem voto nominal, e o cartão diz quantas ficaram de fora. Não era só a 51ª: a 52ª tem 309 de 600 sem voto nominal, e a 54ª, 455 de 905 | — |

### 🖥️ Usabilidade — avaliação heurística (2026-10-01 e 02)

⚠️ Avaliação **por especialista**, com GOV.UK, USWDS e Nielsen como referência — ⛔ teste
com usuário. Os modelos e a proposta de teste estão em
[`plano/09`](plano/09-apresentacao-validacao-e-valor.md).

| # | Item | Estado |
|---|---|---|
| U1 | Grafo abre no miolo da nuvem; nomes sem sobreposição | ✅ `f7ea93e` |
| U2 | "Você responde 24, escolhidas entre 49" | ✅ `f7ea93e` |
| U3 | Celular: cabeçalho e menu em 3 colunas | ✅ `f7ea93e` |
| U4 | Ficha: nome ao lado da foto, sem capa, mandatos | ✅ `f7ea93e` |
| U5 | Esqueleto cinza no carregamento; fotos em cache no navegador | ✅ `437617a` `444ace3` |
| U6 | Cada número da ficha diz o que conta | ✅ `e0dadce` |
| U7 | Ano no rótulo do dinheiro da ficha | ✅ `e0dadce` |
| U8 | "Quem vota parecido" antes da lista de votos | ✅ `e0dadce` |
| U9 | "Quem seguir" em uma linha, botão menor | ✅ `4018075` |
| U10 | Aba "Emendas por cidade" com o nome da página | ✅ `4018075` |
| U11 | Cartões do mapa de emendas sem jargão | ✅ `4018075` |
| U12 | Navegação entre legislaturas | ✅ `4018075` |
| U13 | **A faixa do topo dizia "57ª" sobre a lista de 2015–2019** — virou o seletor de período, o mesmo em todo o site; os seletores repetidos saíram | ✅ 2026-10-02 |
| U14 | "A base · 55ª legislatura" e "Período · 55ª" diziam o mesmo duas vezes | ✅ 2026-10-02 |
| U15 | **Resultado do questionário por estado** — "Comparar com: só os de SP" recalcula as listas e a régua só com quem votou por aquele estado; o ponto no grafo continua o da casa inteira, e a tela diz isso. A casa sem ninguém do estado é dita ("Nenhum senador de AC votou nas perguntas que você respondeu"), não some. API: `uf` opcional em `POST /api/afinidade`, validada contra as 27 siglas (400 fora delas) | ✅ 2026-10-02 |
| U16 | **Votos da ficha sem busca** — busca na ementa, na descrição e na matéria, sem diferença de acento | ✅ 2026-10-02 |
| U17 | **Lista com filtros aplicados visíveis** — cada filtro vira um botão que o remove, "Limpar filtros" com mais de um, e a ordem "Mais votos com posição primeiro" na tela | ✅ 2026-10-02 |
| U18 | **Grafo: destacar partido ou estado** — os outros ficam esmaecidos no mesmo lugar, a cor continua a da comunidade (RNF-16), e a tela diz "N de M em destaque". A conferir na tela: o Chrome desta máquina não deixou capturar | ✅ 2026-10-02, a conferir na tela |
| U19 | **Base de cada linha do resultado** — "concordaram em 8 de 10 perguntas (das 17 que você respondeu nesta casa)": a proporção igual sobre base menor deixa de parecer a mesma coisa | ✅ 2026-10-02 |
| U22 | **Conferir na tela** a barra de período, a ficha aberta num mandato antigo (cota, emendas e campanha do mandato), o aviso de perfil inativo e a busca nos votos. Feito por teste automatizado; na tela, só a busca foi vista | A conferir |
| U20 | A página inicial com `?legislatura=55` travou o Chrome duas vezes. Causa provável, achada em 2026-10-02: a roda do mouse sobre o grafo dava zoom e disparava dezenas de fotos e redesenhos. Corrigido (roda com Ctrl no grafo embutido; um redesenho por quadro), mas a reprodução nunca foi confirmada: a janela do Chrome ficava oculta | Corrigido, a confirmar |
| U21 | Celular: a faixa a 390 px cortava o seletor (terminava em 401 px). Corrigido em 2026-10-02; depois a faixa virou texto e o seletor foi para a barra do conteúdo | FEITO |

### ⏳ A única com prazo

**Pendência 44** — a virada para a 58ª, em **fevereiro de 2027**. A Pendência 53 muda o problema: com
várias legislaturas no banco, a tela precisa de um jeito de dizer **de qual** está
falando, e esse mesmo mecanismo resolve a virada. ⭐ O mecanismo existe desde
2026-10-02: `/api/legislaturas` e o seletor de período. A "corrente" é a maior em
`votacoes`, e a 58ª passa a ser a padrão na primeira votação ingerida dela. ⚠️ O
questionário ⛔ vira junto: as perguntas são da 57ª.

---

## ✅ Decidido na rodada de infraestrutura e privacidade (2026-08-25)

| # | Decisão |
|---|---|
| **Pendência 2** | ✅ **Hostinger VPS KVM 2** — 2 vCPU · 8 GB · 100 GB · São Paulo |
| **Pendência 4** | ✅ Repositório privado |
| **Pendência 6** | ✅ **Clarity em produção, gravando tudo**, com consentimento prévio bloqueante |
| **Pendência 8** | ✅ Todas as telas recebem o script — a proteção é o consentimento, não a máscara |
| **Pendência 9** | ✅ Banner de consentimento **necessário e bloqueante** |
| **RQ9** | ✅ **Login Google + perfil completo em claro** — 🔄 minimização revogada em 2026-08-25 |
| **Pendência 28** | ✅ Resolvida por consequência — nome e sobrenome estão no banco |
| **Pendência 13** | ✅ **EF Core migrations** — não script SQL à mão (2026-08-26) |

> 🔑 **As duas decisões desta rodada empurram na mesma direção:** o projeto passou a
> guardar mais coisa (sessão gravada, lista de seguidos no servidor) e a compensar isso
> com **consentimento explícito**, em vez de com ausência de dado. Isso é defensável, mas
> transfere o peso para textos que ainda não existem — as **Pendência 7** e **Pendência 25** abaixo.

---

## 🔴 Bloqueiam a construção — decida antes de codar

| # | Pergunta | Onde |
|---|---|---|
| **Pendência 25** | 🔴 Escrever o **texto do banner de consentimento** cobrindo as 5 exigências | [plano/02 §4.5.2](plano/02-autenticacao-e-metricas.md) |
| ~~Pendência 26~~ | **Obsoleta (2026-10-02):** a Pendência 63 decidiu por nenhum e-mail. 🔴 Serviço de envio de e-mail (Resend, Brevo, SES) + **SPF, DKIM e DMARC** no domínio | [plano/02 §3.3.2](plano/02-autenticacao-e-metricas.md) |
| ~~Pendência 27~~ | **Obsoleta (2026-10-02):** a Pendência 63 decidiu por nenhum e-mail. 🟡 Cadência do digest — diário, semanal, ou por volume | [plano/02 §3.3](plano/02-autenticacao-e-metricas.md) |
| **Pendência 29** | 🟡 Duração do cookie de sessão (sugerido: 7 dias) | [plano/02 §3.2.4](plano/02-autenticacao-e-metricas.md) |
| **Pendência 30** | 🔴 Persistir as chaves do Data Protection — senão todo redeploy desloga todo mundo | [plano/02 §3.6.4](plano/02-autenticacao-e-metricas.md) |
| **Pendência 7** | 🔴 **Política de privacidade** — virou bloqueante: é campo obrigatório da tela do Google | [plano/02 §3.2.1](plano/02-autenticacao-e-metricas.md) |
| **Pendência 24** | 🔴 Confirmar com o orientador se o TCC precisa de **Comitê de Ética** | [plano/02 §4.5](plano/02-autenticacao-e-metricas.md) |
| **Pendência 33** | 🔴 **Novo:** os termos do Clarity dizem que ele não deve ser usado em sites dirigidos a menores de 18. No Brasil vota-se aos 16 — decidir junto com a Pendência 24 | [plano/08 §2.2](plano/08-obter-as-chaves.md) |
| **Pendência 23** | 🔴 CI como **portão** do deploy, ou os dois em paralelo? | [plano/01 §2.1.2](plano/01-arquitetura.md) |
| **Pendência 3** | 🔴 **Subiu para bloqueante** — o login com Google exige domínio, e o e-mail exige SPF/DKIM/DMARC nele | [plano/01](plano/01-arquitetura.md) |
| 🔴 **Pendência 11** | **Curar as 15–25 perguntas** — ⚠️ **o maior bloqueio de todos**, detalhado abaixo | [plano/03](plano/03-questionario.md) |
| 🔴 **RQ3** | **N final de perguntas** — a Pendência 11 não começa sem esta definida | [03-requisitos](03-requisitos.md) |

⚠️ **Pendência 7 e Pendência 25 são texto jurídico, não código** — e agora estão no caminho crítico do
login e do Clarity. São o tipo de tarefa que não dá para fazer na véspera.

---

## 🔴 O QUESTIONÁRIO — a frente mais bloqueante do projeto

> ⚠️ **Corrigido em 2026-08-26.** Estas pendências existiam, mas ficavam num bloco chamado
> *"trabalho manual"*, fora da seção de bloqueios — o que **subestimava** a única frente
> que trava o passo 8 inteiro. A RQ3 ainda aparecia como 🟡 aqui, embora seja 🔴 no
> documento de origem.

| # | Pendência | Prioridade | Esforço |
|---|---|---|---|
| 🟢 **Pendência 11** | ✅ **Resolvida (2026-08-29)** — **50 perguntas no poço**, 41 da Câmara e 9 do Senado. ⛔ O critério ⛔ não foi divisão: 106 das 703 duplas entre as candidatas dividem a Câmara IGUAL, e a seleção gulosa mediu cobertura de pares. Detalhe abaixo | 🟢 Baixa | — |
| 🟢 **RQ3** | ✅ **Resolvida (2026-08-29)** — **24 perguntas**, sendo 8 de abertura da Câmara, as 9 do Senado e 7 de desempate dirigido. Medido: 15 adaptativas valem 25 fixas | 🟢 Baixa | — |
| 🟢 **Pendência 10** | ✅ **Virou o desenho, ⛔ não experimento** — o desempate dirigido está no ar. Medido: empate mediano 6 (dirigido) contra 14 (fixo) e 16 (sorteado) | 🟢 Baixa | — |
| ~~Pendência 12~~ | ✅ **Teste do jantar** — entra se dá para discutir num jantar sem explicar a proposta | — | — |
| 🟢 **CT7** | ✅ **Resolvida (2026-08-29)** — 60%, mas do que é **OFERECIDO** (24), ⛔ não do poço (50). Sobre o poço daria 30 respostas num questionário de 24, e o resultado seria impossível de obter | 🟢 Baixa | — |
| **Pendência 18** | Usar LLM para rascunhar a reescrita das ementas? | 🟡 Média | — |
| **A2** | Regex de `categoria`, validadas contra amostra rotulada à mão | 🟡 Média | 🟡 Horas |
| **A3** | Deduplicação de PEC em dois turnos | 🟡 Média | — |
| **A4** | Quantas das 100 proposições sobrevivem ao corte de unanimidade | 🟡 Média | — |
| **Pendência 34** | 🔵 **Adiada por decisão do autor:** gravar as respostas individuais do questionário, SEM vínculo com a conta, para analisar quais perguntas dividem e quais ninguém entende (§ abaixo) | 🔵 Futuro | — |
| ~~API4~~ | ✅ **Resolvida** — cosseno no grafo, concordância simples na tela (plano/07 §4.5) | — | — |
| 🟡 **Pendência 44** | 🔄 **Avançou** — a ingestão deduz a legislatura pela data e as **consultas já filtram** (Pendência 35 ✅). ⛔ Falta a parte de **produto**: o que a tela mostra na virada, e o que acontece com quem respondeu o questionário na 57ª. ⏳ **A 57ª termina em janeiro de 2027** | 🟡 Média | 🟢 Decisão |
| ✅ ~~Pendência 45~~ | **Resolvida (2026-09-06)** — ⭐ sobrou **0**. O desempate da [Pendência 47](#-pl47-a-causa-raiz-nao-era-reconciliacao) resolveu todos: quando só um homônimo tem voto na base, é ele. ⛔ Ninguém a decidir | 🟢 Baixa | — |
| 🟢 **Pendência 50** | ✅ **Resolvida (2026-08-29)** — 359 matérias do Senado ingeridas, **421 de 421 votações vinculadas (100%)**. A colisão de id foi resolvida com chave composta `(casa, id)`, ⛔ não com deslocamento aritmético. Detalhe abaixo | 🟢 Baixa | — |
| ✅ ~~Pendência 51~~ | **Resolvida (2026-09-06)** — o autor desligou o Smart App Control. `dotnet test` e `dotnet ef` voltaram a rodar **nativos**. ⚠️ ⛔ Irreversível: no Windows 11 o SAC só religa reinstalando o sistema | 🟢 Baixa | — |
| 🟢 **Pendência 47** | ✅ **Resolvida até o limite da fonte (2026-08-29)** — as duas regras entraram: **106 → 81** deputados sem emenda, autores pendentes **169 → 101**, e **93,6%** das emendas com dono. ⛔ Os 81 restantes ⛔ não têm emenda no Portal — sondado por nome. Detalhe abaixo | 🟢 Baixa | — |
| ✅ ~~Pendência 46~~ | **Resolvida (2026-09-06)** — resolveu-se sozinha, como previsto: a Pendência 42 trouxe o Senado e ⭐ **0** dos 101 autores pendentes casa com senador. O código do autor é de **mandato** ([achado #24](achados/024-codigo-da-emenda-identifica-o-mandato.md)) | 🟢 Baixa | — |
| ~~Pendência 35~~ | ✅ **Resolvida (2026-08-27)** — `Legislaturas` DERIVA a legislatura do dado, nunca de configuração. `TestesLegislatura` semeia **duas** legislaturas e prova que a segunda ⛔ não vaza; as três mutações matam os três filtros. § abaixo mantido como registro | — | — |
| ~~Pendência 36~~ | ✅ **Resolvida (2026-08-26)** — nomes corrigidos e **verificado rodando o container contra o banco real**: monta a matriz e grava `execucoes`. Estava faltando também traduzir a connection string do Aspire (§ abaixo) | — | — |
| ~~Pendência 37~~ | ✅ **Resolvida (2026-08-27)** — `test_contrato_schema.py` cobre agora **nomes de tabela, nomes de coluna e os literais combinados** entre os dois lados (`FUNDO ESPECIAL`, `ck_autor_metodo`). ⭐ O próprio parser tem teste que morre sob mutação — sem ele, uma exceção mal posta o deixaria cego e verde | — | — |
| ~~Pendência 39~~ | ✅ **Resolvida (2026-08-26)** — legislatura 57 inteira ingerida: 470.786 votos, 5.268 arestas | — | — |
| ✅ ~~Pendência 43~~ | **Resolvida (2026-08-28)** — detalhe abaixo. O índice ficou desatualizado por uma semana, que é o defeito que esta linha corrige | 🟢 Baixa | — |
| 🟢 **Pendência 42** | ✅ **Resolvida (2026-08-27)** — ingestão, curadoria e produto. 7 perguntas do Senado ativas, questionário misto de 28, resultado com **uma lista por casa**, grafo próprio de cada uma. ⛔ Resta a ficha do parlamentar, que ainda não distingue casa. Detalhe abaixo | 🟢 Baixa | 🟡 Horas |
| ~~Pendência 41~~ | ✅ **Resolvida (2026-08-26)** — o seed foi **aposentado** por decisão do autor: com o ETL funcional, só o schema precisa ser inicializado. O semeador virou `Poligraph.Tests/Fixtures/DadosDeTeste.cs` | — | — |
| ✅ ~~Pendência 40~~ | **Resolvida (2026-08-28)** — detalhe abaixo. ⭐ **1.042** proposições no banco (683 Câmara + 359 Senado), e a ementa chegou à ficha e à curadoria | 🟢 Baixa | — |
| ~~Pendência 38~~ | ✅ **Resolvida (2026-08-26)** — `arestas_grafo` e `nos_metrica` gravadas; Louvain + layout de molas com semente fixa; 30 comunidades em 655 nós. ⚠️ `governismo` e `disciplina` seguem nulos: dependem de `votacoesOrientacoes`, ainda não ingerido | — | — |

### ✅ Pendência 50 (resolvida em 2026-08-29) — a ementa do Senado entrou

**Medido em 2026-08-29.**

⚠️ **⛔ NÃO é limitação da fonte** — ao contrário dos achados
[#17](achados/017-senado-maioria-secreta.md), [#24](achados/024-codigo-da-emenda-identifica-o-mandato.md)
e [#28](achados/028-o-senado-nao-publica-orientacao-de-bancada.md), onde o Senado
publica **menos** que a Câmara. Aqui ele publica **mais**: `/materia/{codigo}` devolve
`EmentaMateria` **e** `IndexacaoMateria`, o vocabulário controlado que diz o assunto — a
Câmara ⛔ não tem equivalente no CSV.

⭐ A lacuna é **nossa**: `proposicoes.py` tem `CASA = "CAMARA"` e lê só o CSV da Câmara.
⛔ Ninguém escreveu o caminho do Senado.

📐 A mesma votação, nos dois lugares:

> **No banco** — `SF-7101`, ementa `NULL`:
> *"Votação nominal do Substitutivo da Câmara dos Deputados ao Projeto de Lei
> Complementar nº 124, de 2022, na forma do texto consolidado apresentado pelo parecer."*
>
> **Na fonte** — matéria 171682, `PLP 124/2022`:
> *"Altera o Código Tributário Nacional, a fim de estabelecer normas gerais sobre solução
> de controvérsias, consensualidade e processo administrativo em matéria tributária e
> aduaneira."*

| | |
|---|---:|
| Votações do Senado na 57ª | 421 |
| 🔴 **Com proposição vinculada** | **0** |
| Matérias distintas nas votações | 359 |
| Chamadas a `/materia/{codigo}` para trazer tudo | 359 |

⭐ **A fonte existe e já está no código.** `senado.baixar_indexacao` foi escrita para
isto e está **órfã** desde então — ⛔ nenhum módulo a chama. O endpoint devolve `ementa`
e `IndexacaoMateria`, que é o vocabulário controlado e diz o assunto.

#### 🔴 O que trava: os dois ids vivem no mesmo namespace

`proposicoes.id` é o id da proposição **na Câmara**. O Senado tem `codigoMateria`, que é
outra numeração — e as faixas **se sobrepõem**:

| | Faixa |
|---|---|
| Proposições da Câmara (683) | 106.701 a **2.638.483** |
| 🔴 Códigos do Senado (359) | **121.883** a 175.446 |

📐 **Colisões hoje: 0.** ⚠️ Mas **3 proposições da Câmara já estão dentro da faixa do
Senado** — colisão é questão de tempo, ⛔ não hipótese. E uma colisão ⛔ não daria erro:
vincularia a votação do Senado à **ementa de um projeto da Câmara**, e a ficha exibiria
um assunto plausível e errado.

#### ✅ A saída escolhida: chave composta `(casa, id)`

⭐ **⛔ Não foi preciso coluna nova em `votacoes`** — a chave estrangeira usa a `casa` que
a votação **já tem**, e que já carrega o valor certo:

```sql
ALTER TABLE proposicoes ADD casa text NOT NULL DEFAULT 'CAMARA';
ALTER TABLE proposicoes ALTER COLUMN casa DROP DEFAULT;
ALTER TABLE proposicoes ADD CONSTRAINT ak_proposicoes_casa_id PRIMARY KEY (casa, id);
ALTER TABLE votacoes ADD CONSTRAINT fk_votacoes_proposicoes_casa_proposicao_id
    FOREIGN KEY (casa, proposicao_id) REFERENCES proposicoes (casa, id);
```

⛔ **Descartadas:** deslocar o id do Senado (`+ 1e9`) seria namespace por aritmética,
implícito na leitura; tabela separada duplicaria a mesma entidade por causa da numeração.

🔴 **O `DROP DEFAULT` ⛔ não é detalhe.** O `'CAMARA'` existe só para preencher as 683
linhas antigas — todas da Câmara, porque só ela era ingerida. Mantê-lo faria um `INSERT`
sem `casa` cair silenciosamente na Câmara, e uma matéria do Senado gravada assim viraria
proposição da casa errada **sem erro nenhum**.

⚠️ **O scaffold do EF gerou `defaultValue: ""`**, o que teria feito a migration falhar:
com `casa = ''` o `AddForeignKey` ⛔ não acharia linha para os 1.587 vínculos existentes
— e num banco com dado real ela falharia **depois** de já ter derrubado a chave antiga.

#### 🔴 A chave estrangeira ⛔ não basta

⚠️ A FK garante que o **vínculo** seja da mesma casa. Um `SELECT` que ligue as tabelas
apenas por `id` lê a linha errada **assim mesmo**. Dois lugares tinham esse ponto cego e
foram fechados junto:

| Onde | O que faria |
|---|---|
| `curadoria.py` | Mostraria a ementa de um projeto da Câmara ao lado de uma votação do Senado |
| `persistencia.desconectar_proposicoes_ausentes` | Uma proposição da Câmara faria a do Senado **parecer existente**, o vínculo sobreviveria à limpeza e a FK derrubaria a ingestão do ano |

#### 📐 O resultado

| | Câmara | Senado |
|---|---:|---:|
| Proposições | 683 | **359** |
| Votações vinculadas | 1.587 de 1.594 (99,6%) | ⭐ **421 de 421 (100%)** |


---

### ✅ Pendência 48 (resolvida em 2026-08-29) — 12 migrations viraram uma

Eram **12** arquivos, ⛔ não os 8 que esta pendência registrava — o número cresceu
durante o desenvolvimento, que é exatamente o argumento para consolidar.

| | |
|---|---:|
| Arquivos de migration | 12 → ⭐ **1** |
| Linhas | 1.193 → 40 KB numa `Inicial` |
| 🔴 Deploy já feito? | ⛔ **Não** — a Pendência 3 (domínio) ainda bloqueia |

⭐ **A janela estava aberta**, e ⛔ não estaria depois do primeiro deploy.

#### 📐 Como foi conferido, e ⛔ não presumido

⚠️ **Consolidar migration é reescrever o schema.** A verificação foi comparar o banco
real contra um banco limpo criado só pela migration nova:

```sql
-- 397 definições de cada lado: colunas (tipo, nulidade, default),
-- constraints (PK, FK, CHECK, UNIQUE) e índices
SELECT 'COL ' || table_name || '.' || column_name || ' ' || data_type ...
UNION ALL SELECT 'CON ' || conrelid::regclass || ' ' || pg_get_constraintdef(oid) ...
UNION ALL SELECT 'IDX ' || tablename || ' ' || indexdef ...
```

| | |
|---|---:|
| Schema atual (12 migrations) | **397** definições |
| Schema consolidado (1) | **397** definições |
| 🔴 **Diferenças** | ⭐ **0** |

⭐ E os **133 testes .NET** passam: eles criam Postgres novo e aplicam a migration, o que
torna a validação de ponta a ponta, ⛔ não só um diff.

#### ⚠️ O que se perde, e por que ⛔ não importa

Os comentários dentro das migrations antigas — como a armadilha do `DROP DEFAULT` em
`ProposicaoPorCasa` — somem. ⭐ Mas eles ⛔ não eram a fonte da verdade: o conteúdo vive
nos achados e aqui, e o histórico literal segue no git.

#### ⭐ E destravou a Pendência 49

⚠️ Consolidar deixou a mudança seguinte **barata**: mover **um** arquivo, ⛔ não doze com
doze `Designer` junto. ✅ A [Pendência 49](#-pl49-resolvida-em-2026-09-06--a-migration-foi-para-quem-a-aplica)
foi resolvida logo depois.

#### ⚠️ Foi preciso container para gerar

🔴 A **Pendência 51** bloqueou: `dotnet ef migrations add` ⛔ não roda nesta máquina, porque o
Smart App Control barra o binário recém-compilado. O contorno do rebuild limpo ⛔ **não
funcionou** desta vez — a geração saiu no container, pela mesma receita dos testes.

⭐ Isso reclassifica a Pendência 51: ela ⛔ não atrapalha só teste, ela **bloqueia trabalho de
schema**.



---

### ✅ CT4 (resolvida em 2026-09-06) — estágio de qualidade no CI

🔴 **Achado antes de escrever qualquer coisa: o `ci.yml` estava QUEBRADO.**

```
Your startup project 'Poligraph.Api' doesn't reference Microsoft.EntityFrameworkCore.Design.
```

O job `migration` chamava `dotnet ef … -p src/Poligraph.Api`. ⚠️ A
[Pendência 49](#-pl49-resolvida-em-2026-09-06--a-migration-foi-para-quem-a-aplica) tirou o pacote
`Design` da API no mesmo dia e ⛔ não atualizou o CI. Corrigido para
`-p src/Poligraph.Migrations` — script de **600 linhas, 24 tabelas**, conferido.

#### O primeiro relatório do Sonar, e a fábrica que ⛔ não precisava existir

⭐ **`FabricaDesignTime` foi REMOVIDA.** O Sonar apontou `Password=postgres` como
credencial versionada, e a pergunta certa veio junto: **a fábrica precisa existir?**

📐 **Medido:** renomeando o arquivo e rodando `dotnet ef migrations script --idempotent`,
o resultado é **byte a byte idêntico** — 600 linhas, `diff -q` limpo.

⚠️ `Poligraph.Migrations` é um **executável com host**: o `dotnet ef` constrói o host,
pega o `IServiceProvider` e resolve o `PoligraphDb`, com `MigrationsAssembly` e
`UseSnakeCaseNamingConvention` já declarados no `Program.cs`.

🔴 **A fábrica só fazia sentido enquanto o alvo era a API** — cujo `Program.cs` precisa da
connection string do Aspire, do Google e do Data Protection para subir. Quando a
[Pendência 49](#-pl49-resolvida-em-2026-09-06--a-migration-foi-para-quem-a-aplica) mudou o alvo
para o console, ela virou peso morto. ⛔ Ela foi **movida** em vez de questionada.

⭐ Sobrou só o `const`, em `Migracoes.Assembly` — que continua necessário: o contexto mora
em `Poligraph.Api`, e sem declarar o assembly o EF ⛔ não acharia migration nenhuma.

##### Os outros achados

| Achado | O que era |
|---|---|
| `App.css` L792 — `padding` duplicado | ⭐ **Real.** `padding: 0` era sobrescrito por `padding: .9rem` cinco linhas abaixo. O `0` saiu |
| `pip install` sem `--only-binary :all:` | ⭐ **Aplicado.** `pip install --dry-run` confirmou que todas as dependências têm wheel |
| `npm ci` sem `--ignore-scripts` | ⭐ **Aplicado.** `npm query` por `install`/`postinstall`/`preinstall` devolveu `[]` |
| `ingestao_senado.py` — HTTP inseguro | ⛔ **Falso positivo.** A linha é o CONSERTO: `f"https://{url[len('http://'):]}"`. O literal `"http://"` está numa comparação |
| Dependências sem versão travada | 🟡 **Aberto.** O `requirements.txt` usa `>=`. Travar exige `pip freeze`/`pip-compile` — decisão em aberto |

##### ⚠️ O passo `Analisar` levou 16 min

⭐ O repositório ⛔ não é o problema: são **48 `.py`, 46 `.cs`, 37 `.tsx`, 13 `.ts`** —
o `scanAll` varre isso em segundos. ⛔ Nem o `.cache` de 597 MB do ETL, que ⛔ não é
versionado e ⛔ não existe num checkout novo.

🔴 **O tempo era restore.** ⛔ Não havia cache de NuGet nenhum: Aspire, EF, Testcontainers
e Google.Apis.Auth baixados inteiros a cada execução — o cache local do autor tem **1,8 GB**.

| Entrou | O que economiza |
|---|---|
| `actions/cache` em `~/.nuget/packages` | O restore completo, nos jobs `dotnet` e `qualidade` |
| `cache: pip` no `setup-python` | O download das rodas do pandas/scipy |
| `actions/cache` em `~/.dotnet/tools` | O `dotnet tool install` do scanner, a cada execução |

⚠️ **Falta medir a próxima execução.** O `dotnet build` sob o scanner também é mais lento
que o normal — ele injeta os analisadores do Sonar —, e isso o cache ⛔ não resolve.

#### ⭐ Uma fixture global por stack — 126 containers viraram 1

Feito logo em seguida, e o número mudou de patamar:

| | Antes | Depois |
|---|---:|---:|
| Containers na suíte .NET | **126** | ⭐ **1** |
| `dotnet test` completo | **2 min 36 s** | ⭐ **34 s** |
| Testes | 159 | 159 — todos passando |

**O que mudou:** `BaseIntegracao` deixou de ser `IAsyncLifetime` com container próprio e
passou a receber uma `FixturePostgres` por `ICollectionFixture`. O container sobe **uma
vez**, a migration roda **uma vez**, e cada teste chama `LimparAsync()`.

⚠️ **O isolamento por teste ⛔ não foi afrouxado.** O `TRUNCATE ... RESTART IDENTITY
CASCADE` roda antes de cada teste, e a lista de tabelas sai do **modelo do EF**, ⛔ não
de uma lista escrita à mão — que silenciosamente deixaria de limpar toda tabela nova.

⭐ **`TRUNCATE` e ⛔ não `CREATE DATABASE ... TEMPLATE`** porque ⛔ nenhum teste faz DDL:
conferido, o único SQL cru é o `INSERT` do `TestesSchema` que deve ser barrado por
`CHECK`. Sem DDL, truncar devolve o banco ao estado pós-migration.

**Python:** já estava quase certo — `scope="module"` e `TRUNCATE` autouse. A fixture
`conexao` foi para `tests/conftest.py` com **`scope="session"`**, para valer para
qualquer módulo futuro e ficar simétrica ao .NET.

> ⭐ **Consequência:** a razão original para tirar os testes do CI ⛔ deixou de valer —
> 34 s cabem em qualquer runner. Ficaram fora porque a decisão foi rodá-los localmente,
> ⛔ não porque ⛔ não caibam. Voltar é uma linha em cada job.

#### ⚠️ Os testes de integração saíram do CI (2026-09-06)

🔴 **A causa ⛔ não é "runner fraco" — é um container por TESTE.**

`BaseIntegracao : IAsyncLifetime`, e o xUnit constrói **uma instância nova por método de
teste**. Então `InitializeAsync` roda a cada teste: sobe um Postgres novo **e aplica a
migration inteira**. São **126 testes de integração** = 126 containers e 126 migrations.

⚠️ Local isso leva ~3 min, com imagem quente e disco rápido. No runner do GitHub (2
núcleos) ⛔ não fecha.

| Job | Antes | Depois |
|---|---|---|
| `dotnet` | unitários **+ integração** | ⭐ só `~Unidade` (**33**) |
| `qualidade` | suíte inteira | ⭐ só `~Unidade` |
| `python` | 416 testes | ⭐ `-m "not integracao"` — **397**, 19 desmarcados |

✅ **O teste de polaridade (API3) ⛔ NÃO se perdeu:** `TestesPolaridade.cs` está em
`Unidade/`, ⛔ não em `Integracao/`. A regra do CLAUDE.md continua valendo no CI.

⛔ **O que o CI deixa de proteger:** `TestesSchema` (os `CHECK` chegaram ao banco),
`TestesContratoOpenApi` (a CT3 recém-escrita), autenticação, endpoints, curadoria,
legislatura e notícias. São **126 de 159**. Rodam localmente com `dotnet test`.

> ⭐ **O conserto que devolveria os testes ao CI** é fazer o container ser **um só**, via
> `IClassFixture`/`ICollectionFixture` em vez de `IAsyncLifetime` na base — com cada teste
> limpando o que escreveu. Deixa de ser 126 containers e vira 1. ⚠️ Mexe nas 11 classes de
> teste, então ⛔ não entrou junto com esta mudança.

#### 🔴 Na primeira execução real, o CI reprovou em 3 jobs

⭐ E esse é o ponto: **o `npm run build` já estava no job `web` o tempo todo.** Como o
gatilho apontava para um branch órfão, ele ⛔ nunca rodou — e 47 erros de TypeScript se
acumularam com a suíte de testes **verde**, porque o `vitest` ⛔ não faz checagem de tipo.

| Erro | Quantos | Causa |
|---|---:|---|
| `TS2339` — `toBeInTheDocument` ⛔ não existe | **38** | `vitest.setup.ts` estava **fora** do `include` do `tsconfig.app.json`. É ele que importa `@testing-library/jest-dom/vitest`, quem declara os matchers |
| `TS2304` — nome ⛔ não encontrado | **7** | `legenda.ts` referenciava `Legenda`, `FaixaDaLegenda` e `CORTE_CENTRO`, que ⛔ **nunca existiram** |
| `TS2741` — falta a chave `''` | 1 | `NA_CASA` em `Explorar.tsx`: `Parlamentar['casa']` é `Casa | ''` — vazio quando a pessoa ⛔ não tem voto |
| `TS2739` — faltam `acordou`, `discordou` | 1 | O fixture de `Avaliacao.test.tsx` ficou para trás quando os dois campos entraram na CT3 |
| `NETSDK1004` — assets file ⛔ não encontrado | 1 job | `dotnet ef` lê metadados do projeto e precisa do `project.assets.json`. Faltava `dotnet restore` antes |

⚠️ **`montarLegenda` foi REMOVIDA, ⛔ não consertada.** Ela ⛔ não era chamada por
ninguém — só `rotulosDoEixo` é importada — e dependia de um `CORTE_CENTRO` que ⛔ não
existe em lugar nenhum. Escrever o valor agora seria **inventar o limiar que decide quem
fica "no centro"** do grafo, e a regra do projeto é a oposta: primeiro se mede.
📐 Estão no histórico, se voltarem a fazer falta.

#### 🔴 E o gatilho apontava para um branch órfão

Medido em **2026-09-06**, com `git ls-tree` em cada branch remota:

| Branch remota | Commits | Arquivos | Tem `.github/` |
|---|---:|---:|---|
| **`main`** ← *padrão do GitHub* | **1** | **2** | ⛔ **não** |
| `master` | 173 | 249 | ✅ |
| `senado-enums-e-nova-interface` | 211 | 269 | ✅ |

⚠️ **`main` ⛔ não é ancestral de `master`** — são históricos separados. É o padrão de
repositório criado no GitHub com README, com o histórico local empurrado depois.

🔴 O `ci.yml` disparava em `push: branches: [main]`. **O gatilho de push ⛔ nunca
disparou, nenhuma vez.** O que rodava era só o `pull_request`, que ⛔ não tem filtro.

⭐ Corrigido para `[master]`, e entrou `workflow_dispatch`.

> ⚠️ **Falta uma ação fora do repositório:** trocar o **branch padrão** para `master` nas
> configurações do GitHub. Enquanto for `main`, o botão *"Run workflow"* ⛔ não aparece —
> o GitHub só o oferece se o arquivo com o gatilho existir no branch padrão.
>
> ⚠️ **Conferir também o Coolify**, que faz deploy por webhook no push: se ele estiver
> ouvindo `main`, está ouvindo um branch que ⛔ nunca recebe nada.

#### O que o job `qualidade` faz

| Linguagem | Cobertura | Propriedade do Sonar |
|---|---|---|
| C# | `--collect:"XPlat Code Coverage;Format=opencover"` | `sonar.cs.opencover.reportsPaths` |
| Python | `pytest --cov --cov-report=xml` | `sonar.python.coverage.reportPaths` |
| TS/React | `vitest --coverage --coverage.reporter=lcov` | `sonar.javascript.lcov.reportPaths` |

📐 Os três formatos foram gerados e conferidos localmente antes de entrar no YAML.
Cobertura medida hoje: **62,3%** no ETL, **43,6%** no front.

#### 🔴 Três coisas que ⛔ não são óbvias

| | |
|---|---|
| **O job repete build e testes** | O scanner de C# precisa **envolver** o build (`begin` → `dotnet build` → `end`): ele lê a saída do compilador, ⛔ não o código parado. Como os jobs correm em paralelo, o custo é minuto de runner, ⛔ não espera |
| **`sonar.scanner.scanAll=true`** | Sem isso o scanner de .NET olha só o que passa pelo MSBuild — ⛔ **Python e TS ficariam de fora**, que é metade do projeto |
| **`fetch-depth: 0`** | Clone raso apaga o histórico, e o quality gate decide sobre **código novo**. Sem o histórico, ⛔ não há "novo" |

⚠️ `src/Poligraph.Data/Migrations/**` está em `sonar.exclusions`: são **397 definições
geradas** pelo `dotnet ef`, que inundariam o relatório com dívida que ninguém escreveu.

#### 🔴 O que ainda bloqueia

**O plano gratuito do SonarQube Cloud cobre APENAS repositórios públicos**, e
`IgorLucasAssuncao/poligraph` está privado (`api.github.com` devolve 404 sem
autenticação). As saídas são: tornar o repositório **público**, pagar o plano por linhas
de código, ou auto-hospedar o **SonarQube Community Build** — que ⛔ não tem análise de PR
nem as regras de *taint analysis*.

⚠️ **Sem o segredo `SONAR_TOKEN` o job fica VERDE com todos os passos pulados.** ⛔ Verde
ali ⛔ não significa "analisado" — por isso o primeiro passo emite um
`::warning` dizendo exatamente isso.

#### ⭐ Como virar portão

Acrescentar `/d:sonar.qualitygate.wait=true` ao `begin`. Ficou **fora** de propósito: até
a primeira análise calibrar o que é dívida herdada, o primeiro PR reprovaria por código
que já estava lá.

#### Limpeza que veio junto

⭐ `UnitTest1.cs` removido — esqueleto do template `dotnet new xunit`, **sem asserção
nenhuma**, e fora dos filtros `~Unidade`/`~Integracao` do CI. Por isso a contagem caiu de
160 para **159**: ⛔ não se perdeu teste, tirou-se o que ⛔ nunca testou nada.

📐 As contagens de Python e front estavam **defasadas no README**: eram 282 e 37, e o
medido hoje é **416** e **97**.
---

### ✅ CT3 (resolvida em 2026-09-06) — o contrato existia, mas estava vazio

O `AddOpenApi()`/`MapOpenApi()` já estavam no `Program.cs`. ⚠️ **O documento que eles
geravam ⛔ não tinha esquema nenhum** — `components.schemas` vinha vazio.

🔴 **Motivo:** todo handler devolve `Task<IResult>`, e daí o ASP.NET ⛔ não infere forma
de resposta. O OpenAPI publicava a rota e **⛔ nada** sobre o que ela devolve.

| | Antes | Depois |
|---|---|---|
| Esquemas no documento | **0** | ⭐ **31** |
| Rotas publicadas | 17 (de 18 mapeadas) | ⭐ **18** |
| Testes .NET | 133 | ⭐ **160** |

#### O que entrou

| Peça | Papel |
|---|---|
| `Scalar.AspNetCore` 2.17.2 | ⭐ `/scalar` — documentação navegável, **só em Development** |
| `.Produces<T>()` em 17 rotas | 🔴 É o que faz o esquema existir, ⛔ não enfeite |
| `TestesContratoOpenApi.cs` | 27 testes: 17 rotas + 9 DTOs + o enum + o documento |

⚠️ **O `/scalar` ⛔ NÃO sobe em produção.** Ele expõe `DELETE /api/auth/conta` e
`POST /api/auth/sair-de-todos` num formulário pronto para disparar — está dentro do
`if (app.Environment.IsDevelopment())`, junto do `MapOpenApi()`.

#### 🔴 O que ele achou de cara

`/api/auth/logout` estava **mapeada** e mesmo assim ⛔ **fora do documento**. `MapPost`
tinha ligado na sobrecarga `RequestDelegate` — rota terminal, que **descarta o
`IResult`**. O `Results.NoContent()` ⛔ nunca era escrito: a resposta saía **200**.

⚠️ **Havia teste de logout, e ele passava.** O `SignOutAsync` roda antes do `return`,
então o acesso caía e o teste ficava verde. 📐 O caminho inteiro está no
[achado 032](achados/032-a-rota-que-o-contrato-dizia-nao-existir.md).

⭐ `ASP0016` virou `error` no `.editorconfig` — o aviso existia e estava se perdendo no
meio dos `CA1305`.

#### ⚠️ O que este teste ⛔ NÃO garante

Ele confere **metadado**, ⛔ não o corpo devolvido: `.Produces<T>()` pode mentir sobre o
tipo real. ⭐ Por isso ele ⛔ não anda sozinho — os outros 133 testes de integração
desserializam a resposta de verdade. **A lista de rotas e campos é escrita à mão a partir
de `src/web/src/api.ts`**: se o front passar a ler um campo novo e ninguém o acrescentar
aqui, o teste ⛔ não acusa. É o custo conhecido do formato.
---

### ✅ Pendência 49 (resolvida em 2026-09-06) — a migration foi para quem a aplica

O artefato estava no projeto errado: `Poligraph.Api/Data/Migrations`, com a
`FabricaDesignTime` junto — e é a fábrica que faz o `dotnet ef` eleger o projeto-alvo.

⛔ **A API ⛔ nunca migra** (regra do CLAUDE.md), mas o comando pedia
`-p src/Poligraph.Api`, contradizendo a própria regra.

| | Antes | Depois |
|---|---|---|
| Migrations | `Poligraph.Api/Data/Migrations/` | ⭐ `Poligraph.Migrations/Migrations/` |
| `FabricaDesignTime` | `Poligraph.Api/Data/` | ⭐ `Poligraph.Migrations/` |
| Namespace | `Poligraph.Api.Data.Migrations` | `Poligraph.Migrations.Migrations` |
| Comando | `dotnet ef … -p src/Poligraph.Api` | ⭐ `dotnet ef … -p src/Poligraph.Migrations` |

#### 🔴 `MigrationsAssembly` ⛔ não é detalhe

⚠️ O **contexto** (`PoligraphDb`) continua em `Poligraph.Api`, e o EF procura migration no
assembly **do contexto** por padrão. Sem declarar o assembly, ⛔ ele ⛔ não acharia
nenhuma — e `MigrateAsync` ⛔ **não daria erro**: criaria um banco **vazio**.

⭐ O nome vive num lugar só, `FabricaDesignTime.Assembly`, e os três pontos o usam:

| Onde | Por quê |
|---|---|
| `FabricaDesignTime` | Senão o scaffold geraria uma `Inicial` nova por cima do schema que já existe |
| `Poligraph.Migrations/Program.cs` | É quem aplica |
| `Poligraph.Tests/BaseIntegracao.cs` | Cada teste de integração migra um Postgres novo |

⭐ **133 testes .NET passam** — e eles criam banco do zero e aplicam a migration, então
provam o caminho inteiro, ⛔ não só a compilação.

#### ⭐ Por que agora e ⛔ não antes

A [Pendência 48](#-pl48-resolvida-em-2026-08-29--12-migrations-viraram-uma) tinha acabado de
consolidar 12 arquivos em 1. ⚠️ Mover **doze** arquivos com doze `Designer` seria a mesma
mudança com doze vezes mais superfície de erro.
---

### ✅ Pendência 51 (resolvida em 2026-09-06) — o Smart App Control foi desligado

**Medido em 2026-08-29.**

⛔ **⛔ NÃO é defeito do código.** É política de segurança do Windows, e ⛔ nenhuma
mudança no repositório contorna.

#### O que acontece

```
Unhandled exception. System.IO.FileLoadException: Could not load file or assembly
'…\Poligraph.Migrations\bin\Debug\net10.0\Poligraph.Migrations.dll'.
Uma política de Controle de Aplicativo bloqueou este arquivo. (0x800711C7)
```

📐 Medido: **8 execuções seguidas, 8 bloqueadas.** ⛔ ⛔ Não é intermitente.

| Evidência | |
|---|---|
| Registro do Windows | `Microsoft-Windows-CodeIntegrity/Operational`, eventos **3118** (*Smart App Control Block*), 3077 e 3033 |
| Bloqueios registrados | **193**, o primeiro em **2026-08-29 01:02** |
| Estado da política | `VerifiedAndReputablePolicyState = 1` — **imposição** |

#### 🔴 O efeito prático

| O quê | Estado |
|---|---|
| `dotnet build` | ✅ Compila normalmente |
| `dotnet test` | ⛔ **Bloqueado** — a suíte roda em container (skill `testes` §6.1) |
| 🔴 `dotnet run --project src/Poligraph.AppHost` | ⛔ **⛔ NÃO sobe** |

⚠️ **O sintoma engana.** O Aspire ⛔ não diz "bloqueado": o `migracoes` sai com código
diferente de zero, o `WaitForCompletion` marca a API como `FailedToStart`, e o painel
fica de pé sem API nem front. ⭐ Parece **lentidão**, e foi lido como lentidão mais de
uma vez.

#### ⭐ O contorno: rebuild limpo

🔴 **A primeira versão desta pendência afirmou que o problema era permanente e que ⛔ não
adiantava esperar. Estava errado.** O bloqueio é por **arquivo**, ⛔ não pelo projeto:

| Tentativa | Resultado |
|---|---:|
| Mesmo `.dll`, 8 execuções | ⛔ **8 bloqueadas** — ⛔ não é intermitente |
| Depois de `rm -rf bin obj` e rebuild | ⭐ **Rodou** |
| `Poligraph.Api.dll` no mesmo momento | ⭐ Carregava normalmente |

⭐ **Um binário ficou marcado, o outro ⛔ não.** Um rebuild limpo produz um arquivo que o
SAC aceita:

```bash
rm -rf src/Poligraph.Migrations/bin src/Poligraph.Migrations/obj
dotnet build src/Poligraph.Migrations
```

⚠️ **Isto ⛔ não é garantia** — foi medido uma vez, e ⛔ não há como prever qual arquivo
o SAC vai marcar. Se voltar a acontecer, o contorno é o mesmo.

#### ✅ Como terminou

📐 Verificado em **2026-09-06**, depois de o autor desligar pela interface do Windows:

| | |
|---|---:|
| `VerifiedAndReputablePolicyState` | **0** — desligado |
| Bloqueios do SAC desde 29/08 | **0** |
| `dotnet test` **nativo** | ⭐ **133 de 133** |
| `dotnet ef migrations list` | ⭐ funciona |

⚠️ **O comando de registro ⛔ não funcionou**, nem para o autor: `Set-ItemProperty` em
`HKLM:\SYSTEM\...\CI\Policy` devolve *"Acesso ao Registro solicitado ⛔ não é
permitido"* mesmo com o caminho certo — o SAC protege a chave. ⭐ **O caminho que
funciona é a interface:** *Configurações → Privacidade e segurança → Segurança do Windows
→ Controle de aplicativos e navegador → Controle de aplicativo inteligente*.

🔴 **⛔ Não tem volta.** No Windows 11 o SAC só é religado **reinstalando o sistema**.

⭐ A receita em container da skill `testes` §6.1 **fica**: ela é o que o CI usa, e é o
plano B se a máquina mudar.

#### Se o contorno parar de funcionar

| Caminho | Custo | Objeção |
|---|---|---|
| **Desligar o Smart App Control** | Um comando, com reinício | 🔴 **Irreversível**: no Windows 11 ele só volta a ser ligado **reinstalando o sistema** |
| **Assinar os binários** | Certificado de code signing | ⚠️ Custa dinheiro |
| **Rodar tudo em container** | Reescrever o fluxo local | ⛔ Joga fora o Aspire, que é a decisão de arquitetura do projeto |

```powershell
# PowerShell COMO ADMINISTRADOR, e reiniciar depois
Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\CI\Policy' `
                 -Name 'VerifiedAndReputablePolicyState' -Value 0
```

⚠️ **`dotnet test` local ⛔ não foi retestado** depois do contorno — a receita em
container da skill `testes` §6.1 continua sendo o caminho conhecido.

---

### 🟡 Pendência 47 — 92 deputados sem nenhuma emenda vinculada

**Medida em 2026-08-27**, respondendo à pergunta do autor: *"conseguimos todos os
deputados, ou teve algum caso de erro que precisamos tratar?"*

| Fonte | Cobre | Falta |
|---|---:|---:|
| `cpf_hash` · foto · grafo | 643 | **0** |
| Cota (CEAP) | 642 | 1 |
| Receitas (TSE) | 642 | 1 |
| 🔴 **Emendas** | **551** | **92** |

⭐ **As duas lacunas de 1 são AUSÊNCIA REAL, ⛔ não falha nossa** — e isso foi conferido,
⛔ não suposto:

- **Cota:** um suplente com 48 votos (abr–jul/2026). Contadas as linhas dele no arquivo da
  Câmara: **zero**. ⛔ Não é o de-para que falhou; ele ⛔ não gastou cota
- **TSE:** um suplente com 6 votos que ⛔ não foi candidato a deputado federal em 2022

### 🔴 Por que os 92 incomodam

**Emenda individual é impositiva desde a EC 86/2015** — todo deputado tem direito a um
valor. Logo, deputado de mandato inteiro sem **nenhuma** emenda é sinal de que a
reconciliação falhou, ⛔ não de que ele não apresentou.

| Sem emenda, por volume de voto | |
|---|---|
| 1 a 50 votos | 15 — ⭐ suplentes, plausível |
| 51 a 200 | 46 |
| 201 a 600 | 20 |
| 🔴 **mais de 600** | **12** — ⚠️ mandato praticamente inteiro |

### O que a checagem dos 12 revelou

Comparando o nome deles contra os 159 autores pendentes, por semelhança:

| Achado | |
|---|---|
| ✅ **Um caso REAL** | `4511 DR. ALLAN GARCES` = *Allan Garcês*. ⭐ Confirmado pelo destino das emendas: **Maranhão**, e ele é deputado por MA. Resolvido com `emendas --resolver 4511=43` |
| ⛔ **Seis falsos positivos** | `LUIZ CARLOS`, `RODRIGO CUNHA`, `LASIER MARTINS`, `CIRO NOGUEIRA`, `CARLOS VIANA`, `AUGUSTA BRITO` — todos **senadores**, ⛔ não os deputados parecidos |

> 🔴 **É a evidência empírica contra o casamento aproximado.** Um único acerto para seis
> erros — e os seis erros seriam **silenciosos**, colocando emenda de senador na ficha de
> deputado. Por isso a reconciliação automática usa **igualdade exata** do nome
> normalizado e desiste no resto.

### O que foi testado e ⛔ NÃO compensou

| Regra candidata | Resolve, dos 159 |
|---|---|
| Casar também por `nome_civil` | **0** |
| Tirar prefixo de tratamento (`DR.`, `PASTOR`, `CORONEL`…) antes de casar | **1** — e cria 9 ambiguidades novas |

⚠️ **1 de 159 ⛔ não sustenta uma heurística.** A regra do projeto é que regra medida vira
código; **1 caso ⛔ não é medição, é anedota**. O caminho manual da
[Pendência 45](#-pl45--os-9-autores-de-emenda-ambíguos) já o resolve em uma linha.

### 🔄 Análise de 2026-08-29 — a hipótese estava errada, e a causa é outra

⚠️ **A hipótese acima ⛔ não se confirmou.** ⛔ Não é "variação de grafia que a igualdade
exata ⛔ não alcança": dos 106 deputados sem emenda hoje, **0** têm o nome na lista de
autores esperando um casamento mais frouxo. Ou o nome está lá e é **ambíguo**, ou ⛔ **não
está lá de forma nenhuma**.

📐 **A conta refeita**, com o dado reingerido:

| | |
|---|---:|
| Deputados da 57ª sem nenhuma emenda | **106** (eram 92 em 27/08) |
| Autores pendentes de reconciliação | 169 |
| 🔴 Pendentes que casariam com **uma** pessoa só | **0** — o casamento automático está correto |

---

#### 🔴 Causa 1 — o homônimo histórico manufatura ambiguidade

A reconciliação compara contra as **7.993 pessoas** do banco, quase todas de legislaturas
antigas. Em **14** casos isso cria um empate que ⛔ não existe na realidade:

| Deputado da 57ª | Concorrente |
|---|---|
| **Bebeto** — Carlos Roberto Rodrigues, 1.117 votos | *BEBETO* — Adalberto Souza Galvão, **0 votos** |
| **Albuquerque** — José Francisco Lopes, 933 votos | *ALBUQUERQUE* — Manoel José de Albuquerque, **0 votos** |
| **José Guimarães** — José Nobre, 1.029 votos | *JOSÉ GUIMARÃES* — José Gomes de O. Guimarães, **0 votos** |

⭐ **Em todos os 14 o concorrente ⛔ não tem voto nenhum na base** — pessoa diferente, id
diferente na Câmara, de legislatura anterior.

🔴 **Checagem de segurança:** em **0 dos 14** o concorrente é senador em exercício. Era o
risco real — senador apresenta emenda, e roubar a dele seria erro silencioso.

📐 **Corroboração independente** — o destino da emenda contra a UF do parlamentar, o
mesmo teste que resolveu o Allan Garcês:

| | |
|---|---:|
| ✅ Destino principal bate com a UF | **50 de 56** |
| 🔴 Discorda | **2** (ambos *TEREZA CRISTINA*, senadora do MS com destino em MT) |
| — Sem UF no destino (`MÚLTIPLO`, `Nacional`) | 4 |

⚠️ **Átila Lira é ambiguidade REAL** e continua sem vínculo, corretamente: `ÁTILA DE MELO
LIRA` e `ÁTILA FREITAS LIRA` são duas pessoas, com ids distintos na Câmara.

---

#### 🔴 Causa 2 — o Portal renomeia o autor para o SUCESSOR

⭐ **A descoberta que explica a metade que faltava.** As emendas **estão no banco**; o que
está errado é o nome:

```
código 2429  ->  "TIAGO DIMAS (EX-PARLAMENTAR LAZARO BOTELHO,
                  NOS TERMOS ART. 78 LDO 2025 E DA MENSAGEM 95-CN, DE 06.11.25)"
```

Quando o parlamentar deixa o mandato, o **suplente executa** a emenda dele, e o Portal
passa a escrever o nome assim. Como `registrar_autores` faz `ON CONFLICT DO UPDATE SET
nome_autor`, **o último ano ingerido vence** — e o nome que chega ao reconciliador ⛔ não
casa com ninguém.

📐 **14 autores pendentes** trazem o padrão `(EX-PARLAMENTAR X…)`; em **12** o nome do
ex-parlamentar casa com exatamente um deputado da 57ª.

⭐ **Isto ⛔ não é heurística** — é ler um rótulo que a própria fonte escreve, citando o
art. 78 da LDO.

---

#### ✅ 📐 As duas regras entraram, e o resultado medido

| | Antes | Depois |
|---|---:|---:|
| Deputados da 57ª sem emenda | 106 | ⭐ **81** |
| Autores pendentes | 169 | ⭐ **101** |
| Autores resolvidos | 782 | **850** |
| 🔴 **Emendas com dono** | — | **23.247 de 24.825 (93,6%)** · R$ 70,8 bi |

⭐ **Corroboração na tela:** *Abilio Brunini* devolvia `ano: 0` e agora mostra 13 emendas
com destino a **Cuiabá — MT**, onde ele é prefeito desde 2024. É o caso do
`EX-PARLAMENTAR` no estado puro.

⚠️ **Sobram 8 autores ambíguos**, e ⛔ **devem** sobrar: `BILAC PINTO`, `LUIZ CARLOS`,
`PAULO RAMOS` e `RICARDO IZAR` são dois parlamentares de mesmo nome de urna, os dois com
voto. A saída é o `--resolver`.

#### ⛔ Os 81 que sobram ⛔ não são defeito nosso

Sondado direto na API do Portal, por nome:

| Deputado | No Portal |
|---|---|
| **Gisela Simona** (1.147 votos) | ⛔ **0 registros**, em ano nenhum |
| **Ronaldo Nogueira** (687 votos) | Tem de **2018**; ⛔ **0** em 2023, 2024 e 2025 |

⚠️ E a varredura ⛔ **não trunca**: em 2025 ela termina numa página parcial de 11
registros, que é o fim real do ano.

---

#### 🔴 Um defeito ATIVO, descoberto na análise

A resolução manual registrada acima — `emendas --resolver 4511=43` — **está errada
hoje**. O `43` é um `pessoa_id`, e ⛔ **ele ⛔ não sobrevive à reingestão**: `pessoas.id` é
`BIGSERIAL` e é reatribuído quando a base é recarregada.

| | |
|---|---|
| Quando foi registrado | `43` = Allan Garcês |
| 🔴 **Hoje** | `43` = **André Ferreira** · Allan Garcês é o **31** |

⛔ Reaplicar o comando documentado colocaria as emendas do Allan Garcês na ficha do
André Ferreira, **em silêncio** — a chave estrangeira aceita qualquer id que exista.

✅ **Corrigido em 2026-08-29.** O `--resolver` passou a receber o **id na Câmara**, que
vem da fonte e ⛔ nunca muda:

```bash
# ⛔ ANTES — pessoas.id, reatribuído a cada reingestão
python -m poligraph_etl emendas --resolver 4511=43

# ⭐ AGORA — o id da Câmara, o mesmo da URL do perfil oficial
python -m poligraph_etl emendas --resolver 4511=204521
```
Confirmar exige comparar os 159 pendentes com os 92 faltantes **um a um, à mão** — é
trabalho humano, como a Pendência 11, e ⛔ não escala por regra.

---

### ✅ Pendência 42 — o Senado, de ponta a ponta

**Ingerido em 2026-08-27.** O que está no ar:

| | Câmara | Senado |
|---|---:|---:|
| Votações | 1.594 | **421** — 239 secretas |
| Votos | 470.727 | **34.101** |
| Com posição utilizável | 462.867 (98,3%) | **11.848 (34,7%)** |
| Parlamentares | 643 | **104** |
| Arestas do grafo | 5.271 | **594** |
| Comunidades | 17 | **24** |

🔴 **São dois grafos, e continuarão sendo.** As duas casas ⛔ não votam as mesmas
matérias, então similaridade entre deputado e senador ⛔ não teria denominador
([achado #7](achados/007-casas-nao-sao-comparaveis.md)). Cada casa gera a própria
`execucao`, e `analisar --casa` recorta a matriz.

⚠️ **Aresta cruzando as casas ⛔ nunca é legítima** — nem para deputado que virou senador.
Aresta significa *"estes dois votam parecido"*; a mesma pessoa nas duas casas é **um nó
só**, não dois ligados. Depois da ponte do achado #18 ela apareceria nos **dois** grafos,
com os votos de cada casa separados.

### O que a ingestão revelou

| | |
|---|---|
| `Votou` é o valor **mais frequente** do Senado | Registra que houve voto **sem revelar qual** — é votação secreta. Tratá-lo como posição inventaria opinião para um terço da base |
| A lista `/senador/lista/atual` tem **81**, mas os votos alcançam **104** | Suplentes, licenciados e quem assumiu cargo no Executivo. Sem criá-los pelo próprio voto, 3.252 votos (10,5%) seriam descartados |
| ⭐ Sigla nova `LAP` apareceu em 2026 | *Licença paternidade* — o canário de domínio funcionou na primeira execução real |

### ✅ O produto, entregue no mesmo dia

| # | |
|---|---|
| 1 | Questionário **misto** — 21 da Câmara + 7 do Senado, sem seletor de casa |
| 2 | Resultado com **uma lista por casa**, e grafo próprio de cada uma |
| 3 | 7 perguntas do Senado curadas — a ementa ⛔ não bastou, foi preciso `IndexacaoMateria` |

### 🔴 Três defeitos que só apareceram ao juntar as casas

Todos do mesmo formato: **número plausível, tela intacta**.

| Defeito | Consequência |
|---|---|
| Piso de comparáveis sobre o **total** | Com 21+7 perguntas o piso era 17, e um senador tem no máximo 7 comparáveis. **Todo senador era filtrado**, e a lista do Senado nasceria vazia para sempre |
| Denominador do painel somando as casas | Pergunta da Câmara mostrava *"439 de 747"* — os 747 incluem 104 senadores que ⛔ nunca votaram aquela votação |
| Posição do cidadão na execução "mais recente" | Funcionava por acidente com uma casa só; com duas, dependia de qual ETL rodou por último |

⭐ E um quarto, do ETL: o Senado devolve `totalVotosSim` e `totalVotosNao` **NULL em todas
as votações**. Sem contar do array de votos, o painel — que é a assinatura visual do site —
renderizaria vazio para toda pergunta do Senado.

⚠️ `TestesAfinidadeDuasCasas` semeia as duas casas de propósito: o resto da suíte semeia
uma só, então o recorte poderia sumir num refactor e tudo continuaria verde.

### ⛔ O que ainda falta

| # | |
|---|---|
| ~~1~~ | ✅ **Resolvido até 2026-09-25** — a ficha e a lista dizem a casa |
| 2 | A **ponte deputado→senador** (achado #18) segue aberta: 43 nomes aparecem nas duas casas, e o Senado ⛔ não publica CPF |
| 3 | 🔄 Hoje **9** do Senado contra **40** da Câmara no poço (Pendência 11 resolvida). O questionário oferece as 9 inteiras, então o desequilíbrio é do poço, ⛔ do que o cidadão responde |

---

### ✅ Pendência 45 (resolvida em 2026-09-06) — sobrou zero ambíguo

**Medida em 2026-08-27**, na ingestão real das emendas de 2023–2026.

A reconciliação automática casa `codigo → pessoa` pelo nome normalizado, e **desiste
quando o nome casa com mais de uma pessoa**. ⛔ Chutar seria pior: o erro ficaria
congelado no código do autor e invisível — toda emenda daquele mandato iria para a ficha
errada, e nada na tela indicaria isso.

| Código | Nome no Portal | Candidatos em `pessoas` |
|---|---|---|
| `2815` | RICARDO IZAR | `883` Ricardo Izar · `1781` RICARDO IZAR |
| `2733` | MARCIO MACEDO | `825` Márcio Macêdo · `3377` MÁRCIO MACEDO |
| `2052` | ALVARO DIAS | `1839` ÁLVARO DIAS · `3502` ALVARO DIAS |
| `1338` | PAULO RAMOS | `862` Paulo Ramos · `4965` PAULO RAMOS |
| `2674` | LUIZ CARLOS | `7716` LUIZ CARLOS · `807` Luiz Carlos |
| `4015` | HELIO COSTA | `766` Hélio Costa · `2177` HÉLIO COSTA |
| `2215` | BILAC PINTO | `4230` BILAC PINTO · `683` Bilac Pinto |
| `4020` | JOAO ROMA | `4055` JOÃO ROMA · `782` João Roma |
| `2900` | CIRO NOGUEIRA | `2630` CIRO NOGUEIRA · `1632` CIRO NOGUEIRA |

⚠️ **⛔ Não são todos duplicata.** Alguns são **pai e filho** homônimos de gerações
diferentes — *Ciro Nogueira* e *Ricardo Izar* são os casos clássicos. É por isso que uma
regra automática do tipo *"prefira quem está na legislatura corrente"* ⛔ **não** serve: a
emenda para o exercício de 2023 foi apresentada em **2022**, quando o outro podia estar em
exercício.

**Como resolver, depois de decidir olhando o dado:**

```bash
python -m poligraph_etl emendas --resolver 2815=883 2900=1632
```

⭐ Fica gravado como `metodo = 'MANUAL'`, e execução automática posterior ⛔ **nunca**
sobrescreve. A procedência de cada vínculo é auditável — o que importa para o TCC.

---

### ✅ Pendência 35 (resolvida) — a legislatura não era filtrada em consulta nenhuma

> ✅ **Resolvida em 2026-08-27.** O que está abaixo é o registro do problema; a
> solução está em [`Legislaturas.cs`](../src/Poligraph.Api/Data/Legislaturas.cs) e em
> [`TestesLegislatura.cs`](../src/Poligraph.Tests/Integracao/TestesLegislatura.cs).
>
> ⭐ **A decisão de desenho:** a legislatura é **derivada do dado**, ⛔ nunca configurada —
> dado repetido em `appsettings` seria mais uma coisa a esquecer de virar na posse da 58ª,
> e o erro reapareceria como número plausível. E são **duas** derivações, porque são duas
> perguntas: o denominador do painel sai das **perguntas ativas** (na virada, o pool ainda
> é da 57ª e o denominador tem de acompanhar as votações mostradas); a lista e a ficha
> usam a **corrente** = `MAX` em `votacoes`.

**Encontrada em 2026-08-26**, a partir da pergunta do autor *"será só dessa legislatura?"*.

[`plano/06 §3`](plano/06-perguntas-lote-1.md) decidiu **só a legislatura 57**, com quatro
motivos medidos — cobertura, comparabilidade (RN-02), relevância e estabilidade
(r = 0,862 dentro da legislatura; **entre** legislaturas, não se mediu).

⛔ **Mas a decisão nunca chegou ao código.** `Votacao.Legislatura` existe e é indexada,
e só `EndpointsGrafo` a usa. Nenhuma consulta de afinidade, ficha ou painel filtra por
ela. Hoje passa porque o banco tem uma legislatura só.

| Consulta | O que acontece quando entrar uma segunda legislatura |
|---|---|
| 🔴 `PerguntaPublica.TotalPossivel` | `db.Votos.Select(PessoaId).Distinct().Count()` conta deputados das duas. O painel mostraria **"480 de 900"** — sem erro, só um número plausível e errado |
| `ParlamentarNaLista.NVotacoes` | Soma as votações de todas as legislaturas |
| `CarregarVotosAsync` | Escapa por acaso: só alcança votações ligadas a perguntas ativas |

⚠️ **É o mesmo formato do bug de polaridade:** não quebra a tela, produz número
plausível. E a regra 4 do projeto diz que regra medida vira *constraint*, não comentário.

⏳ **E tem prazo.** A 57ª termina em **janeiro de 2027**; a 58ª toma posse em fevereiro.
"Só a 57ª" é escolha com data de validade, e o sistema não tem hoje nenhum conceito de
qual legislatura está ativa.

**Encaminhamento sugerido:** derivar a legislatura da `Votacao` ligada à `Pergunta`, em
vez de configurar à parte — dado derivado é mais difícil de errar do que dado repetido.
🔴 O teste tem de semear **duas** legislaturas e provar que a segunda não vaza; sem isso,
o filtro pode sumir num refactor e ninguém percebe.

⚠️ **Vale para o questionário, não para o grafo.** O grafo de similaridade *pode* usar
histórico — são perguntas diferentes, e 2001–2026 continua disponível.

---

### ✅ Pendência 36 (resolvida) e 🔄 Pendência 37 (parcial) — o ETL Python e o banco nunca se falaram

**Encontradas em 2026-08-26**, a partir da pergunta do autor *"o script em python já
funciona?"*.

**Não funciona.** O EF Core, com `UseSnakeCaseNamingConvention()`, nomeia a tabela a
partir do `DbSet` — que é plural. O Python foi escrito no singular:

| Python usa | Existe no banco |
|---|---|
| `votacao` | `votacoes` |
| `voto` | `votos` |
| `pessoa` | `pessoas` |
| `pessoa_fonte_id` | `pessoa_fonte_ids` |
| `similaridade` | `similaridades` |
| `execucao` | `execucoes` |

⛔ **Todas as seis.** Qualquer `python -m poligraph_etl` morre no primeiro `SELECT` com
`relation "votacao" does not exist` — verificado contra o banco em execução.

#### 🔴 Por que ninguém percebeu: os testes provavam a coisa errada (Pendência 37)

`tests/test_persistencia.py` faz `CREATE TABLE pessoa (...)`, `CREATE TABLE votacao
(...)` — **com os nomes errados**. Os 104 testes passam porque testam o Python contra um
banco que o Python mesmo inventou.

> ⚠️ **A lição é maior que o bug.** O `CLAUDE.md` diz que **o EF é dono do schema** e o
> Python só lê. Um teste que cria o próprio schema abandona esse contrato e passa a
> medir consistência interna em vez de integração. Verde constante e zero informação.

**Encaminhamento:** renomear é o menor dos trabalhos e ⛔ **não basta** — sem mudar o
teste, a mesma deriva volta na próxima coluna que mudar de nome. O teste precisa subir o
schema **pelas migrations do EF** (Testcontainers, como no lado C#) e só então rodar o
Python contra ele. 🔴 Só assim a renomeação fica provada e protegida.

#### ⚠️ O segundo defeito, que só apareceu ao rodar

Com os nomes já corrigidos, o container ainda morria **antes de abrir conexão**:

```
psycopg.ProgrammingError: invalid connection option "Host"
```

O Aspire injeta `ConnectionStrings__poligraph` no formato do **Npgsql**
(`Host=...;Database=...;Username=...`) e o `psycopg` fala **libpq**
(`host=... dbname=... user=...`). Resolvido em `poligraph_etl/conexao.py`.

> 🔑 **Nenhum teste pegaria isso**, e vale entender por quê: os testes recebiam a
> conexão pronta do Testcontainers, que já vem em libpq. O formato do Aspire nunca
> passava por ali. ⚠️ **Foi preciso executar de verdade** — é o mesmo padrão do bug do
> `DOTNET_ENVIRONMENT`, que também só apareceu rodando.

---

### ✅ Pendência 11 e RQ3 (resolvidas em 2026-08-29) — o poço e o tamanho do questionário

⚠️ **O poço e o questionário ⛔ não são a mesma coisa**, e confundi-los foi o que quase
fez o trabalho render ao contrário. Com 50 perguntas curadas e o endpoint devolvendo
todas, o mínimo obrigatório — `ceil(ativas × 0,60)` — subiu **sozinho de 17 para 30**.
⛔ Curar mais perguntas tinha acabado de deixar o questionário **pior**.

#### Como as 22 novas foram escolhidas

⛔ **⛔ Não pela divisão do placar.** O [`plano/06 §2`](plano/06-perguntas-lote-1.md) já
avisava, e a medição confirmou: das **703 duplas** entre as 38 candidatas com divisão
≥ 25%, **106 têm os deputados votando igual em mais de 90%** das duas. Quase toda
votação dividida divide a Câmara **no mesmo eixo**.

📐 O critério foi cobertura de **pares de deputados que o conjunto separa**, contando só
discordância real — ⛔ ausência ⛔ não separa ninguém:

| Conjunto | Pares separados |
|---|---|
| As 21 do lote 1 | 139.667 de 194.376 (**71,9%**) |
| ⭐ + as 20 do lote 2 | **84,9%** |
| + as 18 restantes | 86,1% — por isso paramos em 20 |

#### O tamanho: 24, ⛔ não 50

📐 Medido com cada deputado no papel de cidadão, 15 perguntas da Câmara:

| Estratégia | Empate mediano no topo | Sozinho no topo |
|---|---:|---:|
| As 15 melhores, **fixas** | 14 | 4,5% |
| ⭐ 8 fixas + **7 dirigidas** | **6** | 13,4% |
| 8 fixas + 7 **sorteadas** | 16 | 10,4% |

🔴 **Sortear é o mesmo que ⛔ não adaptar.** E **15 adaptativas valem 25 fixas** — a
curva fixa só chega a empate 5 com 25 perguntas.

⚠️ Escolher **uma por vez** daria empate 5 em vez de 6, ao custo de **sete idas e voltas**
ao servidor no meio do questionário. ⛔ Não vale.

#### 🔄 "O Senado está esgotado" — afirmado e DERRUBADO no mesmo dia

⚠️ **A conclusão registrada aqui estava errada, e o motivo é instrutivo.** Ela dizia:
*"das 52 substantivas abertas da 57ª, 39 dividem menos de 5% e 7 das 8 acima de 25% já
estavam curadas — ⛔ não há mais nada a curar"*.

🔴 **As 52 eram 104.** As votações de PEC estavam classificadas como `DESTAQUE`, porque
o padrão continha `emenda` solto e *"Proposta de **Emenda** à Constituição"* casa com
ele ([achado #31](achados/031-a-pec-estava-escondida-como-destaque.md)).

| | Afirmado | Medido depois |
|---|---:|---:|
| Substantivas abertas do Senado | 52 | ⭐ **104** |
| Candidatas novas com divisão ≥ 25% | 2 | ⭐ **10** |

⭐ E as novas são de peso: **reforma tributária (PEC 45)**, número de deputados federais,
crédito fiscal de subvenção.

⚠️ **A lição ⛔ não é sobre o Senado.** É que "esgotado" foi afirmado a partir de um
recorte cuja construção ⛔ não tinha sido conferida — a regra do projeto, aplicada a si
mesma: *antes de afirmar um número, meça, e diga de onde ele veio*.

---

### ✅ Pendência 40 (resolvida em 2026-08-28) — a ementa chegou, e destrava a Pendência 11

`proposicoes` tinha **zero linhas**, e `proposicao_id` era nulo em **1.594 de 1.594**
votações da Câmara (100%). Quem cura lia só a descrição da votação:

> *"Aprovado o Substitutivo ao Projeto de Lei Complementar nº 80, de 2026, adotado pelo
> relator da Comissão de…"*

Isso diz o **número** do projeto e ⛔ **não diz sobre o que ele é**.

⭐ **A fonte certa ⛔ não era o arquivo óbvio.** `proposicoes-{ano}.csv` tem 90 MB por ano;
`votacoesProposicoes-{ano}.csv` tem **5 MB** e já traz `proposicao_ementa` embutida —
5 MB entregam o que interessa, contra 360 MB nos quatro anos para extrair as mesmas
~1.600 linhas.

| | Antes | Depois |
|---|---:|---:|
| Proposições na base | 0 | **683** |
| Votações com proposição | 0 de 1.594 (0,0%) | **1.587 de 1.594 (99,6%)** |
| 🔴 **Substantivas com ementa** | 0 de 266 (0,0%) | **263 de 266 (98,9%)** |

⚠️ O arquivo grande tem duas colunas que este ⛔ não tem: `keywords` (indexação temática)
e `ementaDetalhada`. Se a curadoria precisar delas, aí vale pagar os 90 MB — ⛔ não antes.

**O comando `curar` passa a exibir a ementa acima da descrição**, e diz explicitamente
quando a votação ⛔ não tem proposição vinculada, para quem cura saber que vai procurar
à mão.

---

### ✅ Pendência 43 (resolvida em 2026-08-28) — um layout, não dois

A pergunta era manter os dois layouts do desenho ou só o de molas. **Resolvida por um
terceiro que não existia quando ela foi escrita.**

Com `governismo` medido (achado #26), o eixo do SVD ganhou nome: ele correlaciona
−0,87 com o alinhamento ao Governo. Mas então dá para desenhar o alinhamento
**diretamente**, e foi o que se fez — o layout `Alinhamento` usa o governismo como
coordenada.

| | Componentes (SVD) | Alinhamento |
|---|---|---|
| Eixo horizontal | correlaciona −0,87 com governismo | **é** o governismo |
| Sinal do eixo | arbitrário, pode espelhar entre execuções | definido por nós |
| Precisa de ressalva sobre correlação | sim | ⛔ não |
| Eixo vertical | 2ª componente, 9,6% — sem leitura em português | ⛔ não mede nada, e diz isso |

⭐ **Os dois mostram a mesma divisão**, e o do SVD pede um parágrafo para dizer o que o
outro diz sozinho.

**Decisão:** `Componentes` sai da TELA e ⛔ não do dado. `componente1` e `componente2`
continuam calculados e gravados — são resultado do método e sustentam o achado #26.

Ficam dois layouts com funções distintas:

| | |
|---|---|
| **Molas** | Quem vota com quem — a estrutura, os grupos |
| **Alinhamento** | Quanto vota com o Governo — a medida |

⛔ No Senado sobra só o de molas: sem orientação de bancada publicada, o layout de
alinhamento ⛔ não teria coordenada.

---

### ✅ Pendência 38 (resolvida em 2026-08-26) — o grafo era calculado e jogado fora

`__main__._analisar` faz:

```python
arestas = similaridade.arestas_knn(pares)
log.info("  grafo kNN: %d arestas", len(arestas))
```

⛔ E acaba aí. `similaridade.py` diz no cabeçalho que produz `aresta_grafo` e
`no_metrica`, mas `persistencia.py` não tem função que escreva em nenhuma das duas —
só `gravar_similaridades`.

Consequência: `EndpointsGrafo` lê `arestas_grafo` e `nos_metrica`, encontra vazio e
devolve `Grafo(0, casa, 0, [], [])`. O caminho está certo — ⭐ grafo vazio, não erro —
mas seria vazio **para sempre**, mesmo com o ETL rodando sem falha e sem aviso no log.

⚠️ Falta também **comunidade** e **posição (x, y)**: `NoDoGrafo` tem `Comunidade`,
`EixoX` e `EixoY`, e nada os calcula. O `networkx` está na stack para isso e ainda não
foi usado.

⚠️ **E não há tela.** A RF-33 (visualizar o grafo, *force-directed*, filtro por limiar,
cor por comunidade) é 🔴 Essencial e o front não tem página nenhuma que consuma
`/api/grafo`.

---

> 🔑 **Por que esta é a frente mais crítica, e não uma lista de tarefas de conteúdo:**

| | |
|---|---|
| **Não escala** | É leitura humana de ementa por ementa. Nenhuma ferramenta substitui |
| **Não acelera no fim** | Uma hora por dia resolve; três dias seguidos na véspera, não |
| **Bloqueia o passo 8** | Sem perguntas curadas, o questionário não existe — e ele é a *"Mensuração de Afinidade"* do título |
| 🔴 **É o mais atacável na banca** | O passo mais subjetivo do método. Cada escolha precisa estar justificada **por escrito** |
| **Alimenta o capítulo de metodologia** | Adiar custa duas vezes: o trabalho e o texto |

⚠️ **A polaridade é a parte que não pode errar.** Em 14% das votações "Sim" significa
rejeitar — e um sinal invertido **não aparece na tela**, aparece como um número plausível
e errado. Ver [00-discovery §7](00-discovery.md) e o teste API3.

📐 **Detalhamento em [plano/03-questionario.md](plano/03-questionario.md).**

---

## 🟡 Instalação — decida com o terminal aberto, não agora

| # | Pendência |
|---|---|
| **Pendência 19** | Retenção do Prometheus (ex.: 90 dias) — sem limite ele enche o disco |
| **Pendência 20** | 🔴 Destino do backup do Postgres — **configurar no primeiro dia**. ⚠️ Com e-mails em claro na base, o backup precisa ser **criptografado** no destino |
| **Pendência 21** | Grafana público ou só por VPN/túnel |
| **Pendência 22** | Exposição do painel do Coolify — público com 2FA, allow-list, ou VPN |

---

## 🟡 Só se resolvem contra código

| # | Pendência |
|---|---|
| ✅ ~~API3~~ | **Resolvida** — `TestesPolaridade.cs`. ⭐ A Pendência 53 ⛔ a reabre: a polaridade só serve à curadoria, e as perguntas ficam na legislatura mais recente ([#35 §2](achados/035-a-57-calibrou-o-etl.md)) |
| **API7** | Medir quanto tempo o job de 207k pares leva de fato |
| ✅ ~~CT3~~ | **Resolvida (2026-09-06)** — 27 testes conferem rota por rota e campo por campo contra `src/web/src/api.ts`, e o `/scalar` renderiza o mesmo documento. 🔴 **Achou um bug na primeira execução:** `/api/auth/logout` ⛔ não existia no contrato e devolvia 200 em vez de 204 ([achado 032](achados/032-a-rota-que-o-contrato-dizia-nao-existir.md)). Detalhe abaixo |
| 🟡 **Pendência 52** | **🆕 Teste intermitente** — `TestesAfinidadeDuasCasas.Nenhuma_Lista_Mistura_Parlamentar_Da_Outra_Casa` falhou **1 vez em 3** rodadas da suíte completa (2026-09-06), em **1 ms**, e passa isolado. ⚠️ Duração de 1 ms sugere estado compartilhado entre testes, ⛔ não asserção de dado. **A mensagem ⛔ não foi capturada** — as duas rodadas seguintes passaram |
| ✅ ~~CT4~~ | **Nova, resolvida (2026-09-06)** — estágio de qualidade (SonarQube Cloud) no `ci.yml`, com cobertura das três linguagens. 🔴 **Depende de repositório público** ou de plano pago. Detalhe abaixo |
| **Pendência 16** | Como o ETL sinaliza `novas_votacoes` |
| ✅ ~~Pendência 31~~ | **Obsoleta** — o seed foi aposentado na Pendência 41 |
| ✅ ~~Pendência 48~~ | **Resolvida (2026-08-29)** — consolidadas. Eram **12** arquivos, ⛔ não 8: o número cresceu durante o desenvolvimento. Viraram **uma** `Inicial`, com o schema conferido definição por definição. Detalhe abaixo |
| ✅ ~~Pendência 49~~ | **Resolvida (2026-09-06)** — as migrations e a `FabricaDesignTime` foram para `Poligraph.Migrations`. O `dotnet ef` agora toma como alvo o projeto que **aplica**, ⛔ não a API, que ⛔ nunca migra. Detalhe abaixo |
| ~~Pendência 32~~ | 🟢 Rebaixada — só texto principal foi a decisão; o texto das emendas deixou de ser necessário |
| **C15** | Contrato do front — depende do React estar de pé |

---

## 🟡 Decisões de método — afetam o texto do TCC

| # | Pendência |
|---|---|
| ~~RQ2~~ | ✅ **Resolvida (2026-08-26)** — **as duas**: ARI 0,277 · modularidade 0,558 (comunidade) × 0,288 (partido). Ver [plano/07 §3.5.1](plano/07-grafo-e-afinidade.md) |
| **C7** | Métricas formais de comparação entre casas |
| **RQ7** | Mecanismo de recomendação e como avaliá-lo |
| **RQ6** | Critérios de aceitação dos RF essenciais |
| **ER2** | Biblioteca de *fuzzy match* e calibração do limiar |

---

## 🟢 Incrementos e refinamentos

<details>
<summary><b>Crawler</b> — N1, N3, N4, N5, N6, N7, N8, N9, N11</summary>

Feed da Agência Câmara (N1), casamento nome→parlamentar (N3), `robots.txt` (N4), limiar de
dedup (N5), cobertura da Agência Senado (N6), retenção (N7), redundância (N8), estado
vazio (N9), lista final de feeds (N11).
</details>

<details>
<summary><b>Página do parlamentar</b> — PP2 a PP6</summary>

Assimetria da página de senador (PP2), ✅ ~~apresentação de patrimônio (PP3)~~, ✅ ~~links de rede
social (PP4)~~, parlamentar com poucos votos (PP5), perfil temático por relatoria (PP6).
</details>

<details>
<summary><b>Fontes e escopo</b> — B6, C5, TS5, Pendência 5, Pendência 14, Pendência 15, Pendência 17, A5</summary>

Base dos Dados como atalho (B6, TS5), *fuzzy match*
(C5), biblioteca do grafo (Pendência 5), retenção de `execucao` (Pendência 14), `casa` em `pessoa` (Pendência 15),
*cold start* do Postgres (Pendência 17 — **já não se aplica**, o banco é container próprio),
reescrever objetivos se escolher o Cenário A (A5 — **já não se aplica**, a D3 escolheu o C).
</details>

---

## ⏳ Fatos com prazo de validade — lista separada

Não são pendências de trabalho: são coisas que **podem mudar sozinhas** entre agora e a
entrega. Vivem em [REVISAR-ANTES-DA-CONCLUSAO.md](REVISAR-ANTES-DA-CONCLUSAO.md).

Os dois que podem **mudar a conclusão**: se a **CPMI** passar a publicar votação nominal,
a unificação dos dois grafos vira possível; se o **Senado** publicar orientação de bancada,
a comparação entre casas deixa de ser assimétrica.

⚠️ E o mais provável de todos: **quase todos os números foram medidos com 2026 parcial.**

⏳ **Novo:** a retenção do Clarity (playback **30 dias**) expira antes da escrita se a
avaliação rodar cedo demais.

---

## ✅ Resolvidas — 113

`A1` `A5` `API1` `API2` `API3` `API4` `API6` `B1` `B2` `B3` `B4` `B5` `B7` `C1` `C2` `C3` `C4`
`C6` `C8` `C13` `C14` `CT1` `CT2` `CT3` `CT4` `CT5` `CT6` `CT7` `D1` `D3` `D5` `ER1` `ER3`
`ER4` `ER5` `N2` `N10` `P1` `P2` `P3` `P4` `P6` `Pendência 1` `Pendência 2` `Pendência 4` `Pendência 6` `Pendência 8` `Pendência 9` `Pendência 10`
`Pendência 11` `Pendência 12` `Pendência 13` `Pendência 17` `Pendência 28` `Pendência 31` `Pendência 32` `Pendência 35` `Pendência 36` `Pendência 37` `Pendência 38` `Pendência 39` `Pendência 40`
`Pendência 41` `Pendência 42` `Pendência 43` `Pendência 45` `Pendência 46` `Pendência 47` `Pendência 48` `Pendência 49` `Pendência 50` `Pendência 51` `Pendência 53` `Pendência 54` `Pendência 55` `Pendência 59` `Pendência 60` `Pendência 61` `Pendência 63` `Pendência 64` `Pendência 66` `Pendência 67` `Pendência 68` `Pendência 69` `Pendência 70` `Pendência 74` `Pendência 76` `Pendência 77` `Pendência 78` `Pendência 79` `Pendência 81` `PP1` `PP3` `PP4`
`RE-01` `RQ1` `RQ2` `RQ3` `RQ4` `RQ8` `RQ9` `SE1` `SE2` `SE3` `SE4` `SE5` `SE6` `TS1` `TS2`
`TS3` `TS4` `TS6`

⚠️ `A5` e `Pendência 17` estão aqui por **⛔ se aplicarem mais** — ver *Fontes e escopo* acima.

⚠️ **Convenção de prefixo** (evita a colisão que existia até 2026-08-23):

| Prefixo | Documento |
|---|---|
| `A` `B` `C` | Cenários A, B e C (`arq/01`, `arq/02`, `arq/03`) |
| `API` | `arq/10-api-e-afinidade` |
| `N` | `arq/20-crawler-noticias` |
| `PP` | `arq/30-pagina-do-parlamentar` |
| **Pendência N**, sem sigla | `plano/*`. Até 2026-10-02 era `PL`, que se confundia com Projeto de Lei; os commits antigos mantêm o nome velho |
| `RQ` | `03-requisitos` |
| `CT` | `04-contratos` |
| `SE` | `11-api-senado` |
| `TS` | `12-fonte-tse` |
| `ER` | `13-correlacao-entre-fontes` |
| `D` | Decisões — `00-discovery` §11 |
