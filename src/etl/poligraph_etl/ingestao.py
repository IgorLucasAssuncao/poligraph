"""TRATAMENTO — do CSV bruto da Câmara para as linhas que vão ao banco.

RISCO: **É o núcleo do trabalho.** O título do TCC mede afinidade por comportamento revelado
de voto, e é aqui que o voto vira dado comparável. Tudo o que este módulo classifica
errado reaparece como número plausível na tela.

## ENTRADA

| | |
|---|---|
| Vem de | `fontes/camara.ler_csv` — já validado no volume, nunca lido por linha |
| `votacoes-{ano}` | Uma linha por votação, nominal **ou não** |
| `votacoesVotos-{ano}` | Uma linha por voto individual |
| `deputados` | ATENÇÃO: não **Não é anual**, e não **não tem coluna `id`** — ele vive na `uri` |

## TRATAMENTO

1. **Descarta a votação simbólica** — não registra quem votou, e sem isso não há o
   que comparar. É a maioria delas
2. **Deduz a legislatura pela DATA**, nunca por parâmetro — ver `legislatura_da_data`
3. Classifica a **categoria** (procedimental · destaque · autoridade · substantiva), que
   define o **peso** da votação na matriz
4. Infere a **polaridade** — RISCO: o campo mais perigoso do sistema
5. Converte o voto para o domínio fechado `{-1, 0, 1, None}`; `None` é *fora do cálculo*,
   Não **não** *discordou*
6. Descarta voto de deputado fora do de-para, e o chamador **loga a contagem**

## SAÍDA

| | |
|---|---|
| Tabelas | `pessoas` · `pessoa_fonte_ids` · `votacoes` · `votos` |
| Chave de ligação | `id` da Câmara, extraído da `uri` |
| Constraint do banco | `ck_voto_valor` (`valor IN (-1,0,1)`) · `ck_votacao_categoria` |
| Idempotência | `ON CONFLICT (id) DO UPDATE` — a Câmara corrige dado retroativo |

---

ATENÇÃO: **Nada aqui inventa dado.** Só normaliza, classifica e descarta o que não entra na
matriz — e todo descarte é contado e registrado.

MEDIDO: [`docs/04-contratos.md`](../../../docs/04-contratos.md) ·
[achado #12](../../../docs/achados/012-polaridade-nao-e-constante.md) ·
[achado #22](../../../docs/achados/022-deputados-nao-e-arquivo-anual.md)
"""

from datetime import date

import pandas as pd

from .normalizacao import (
    classificar_categoria,
    inteiro,
    inteiro_ou_nulo,
    normalizar_voto,
)

LEGISLATURA_57_INICIO = date(2023, 2, 1)


# RISCO: A legislatura NÃO é escolhida: ela é uma função da data.
#
# ATENÇÃO: Até 2026-08-27 isto era um parâmetro com valor padrão 57, e o `__main__` nunca o
# passava. Ingerir 2027 gravaria as votações da 58ª legislatura COMO SE FOSSEM DA 57ª —
# sem erro, sem aviso, e a matriz de similaridade passaria a misturar duas Câmaras
# diferentes. A 57ª termina em janeiro de 2027, então o prazo era real.
#
# A 57ª vai de 01/02/2023 a 31/01/2027; cada legislatura dura quatro anos.
PRIMEIRO_ANO_DA_57 = 2023
NUMERO_DA_57 = 57


def legislatura_da_data(data: str) -> int:
    """Deduz a legislatura a partir da data da votação (`AAAA-MM-DD`).

    ATENÇÃO: A virada é em **fevereiro**, não em janeiro: a posse é em 1º de fevereiro. Uma
    votação de janeiro de 2027 ainda pertence à 57ª.
    """
    ano, mes = int(data[:4]), int(data[5:7])
    ano_efetivo = ano if mes >= 2 else ano - 1

    return NUMERO_DA_57 + (ano_efetivo - PRIMEIRO_ANO_DA_57) // 4


def votacoes_para_linhas(df: pd.DataFrame, legislatura: int | None = None) -> list[dict]:
    """Converte o CSV de votações nas linhas da tabela `votacao`.

    ATENÇÃO: Só entram votações NOMINAIS — as que têm contagem de votos. Votação simbólica
    não registra quem votou o quê, então não serve para medir afinidade.

    DECISÃO: `legislatura=None` (o normal) deduz de cada votação pela data. Passar um valor
    força — serve só para teste.
    """
    linhas: list[dict] = []

    for _, registro in df.iterrows():
        sim, nao, outros = inteiro(registro.get("votosSim")), inteiro(registro.get("votosNao")), inteiro(registro.get("votosOutros"))
        if sim + nao + outros == 0:
            continue                       # simbólica: sem registro individual

        descricao = _texto(registro.get("descricao"))
        linhas.append(
            {
                "id": registro["id"],
                "casa": "CAMARA",
                "legislatura": legislatura or legislatura_da_data(str(registro["data"])),
                "data": registro["data"],
                "orgao": registro.get("siglaOrgao"),
                "descricao": descricao,
                "proposicao_id": inteiro_ou_nulo(
                    registro.get("ultimaApresentacaoProposicao_idProposicao")
                ),
                "categoria": classificar_categoria(descricao),
                "secreta": False,          # ATENÇÃO: a Câmara não marca; o Senado sim
                "plenario": registro.get("siglaOrgao") == "PLEN",
                "votos_sim": sim,
                "votos_nao": nao,
            }
        )

    return linhas


def votos_para_linhas(df: pd.DataFrame, mapa_pessoas: dict[str, int]) -> list[dict]:
    """Converte o CSV de votos nas linhas da tabela `voto`.

    `mapa_pessoas` liga o ID da Câmara ao ID sintético do projeto (RF-11).

    ATENÇÃO: Votos de pessoas fora do mapa são DESCARTADOS, não inventados. Se isso
    acontecer em volume, o problema está na ingestão de deputados — e o resumo
    devolve a contagem para que dê para perceber.
    """
    linhas: list[dict] = []

    for _, registro in df.iterrows():
        id_camara = str(registro.get("deputado_id") or "")
        pessoa_id = mapa_pessoas.get(id_camara)
        if pessoa_id is None:
            continue

        linhas.append(
            {
                "votacao_id": registro["idVotacao"],
                "pessoa_id": pessoa_id,
                "valor": normalizar_voto(registro.get("voto")),
                # A Câmara lista só quem estava: toda linha é presença, e o ausente não tem linha.
                "presenca": "PRESENTE",
                "partido_no_voto": _texto(registro.get("deputado_siglaPartido")),
                "uf_no_voto": _texto(registro.get("deputado_siglaUf"))[:2],
            }
        )

    return linhas


def _texto(valor) -> str:
    """A célula como texto, e vazia quando não há texto.

    ATENÇÃO: `valor or ""` não basta: célula vazia chega como NaN, que é float e é verdadeiro.
    Na 57ª nenhum voto vinha sem partido ou UF; em 2010 vem (achado #35), e o `[:2]`
    derrubava a ingestão.
    """
    return valor if isinstance(valor, str) else ""


def deputados_para_linhas(df: pd.DataFrame) -> list[dict]:
    """Converte o CSV de deputados nas linhas de `pessoa` + `pessoa_fonte_id`.

    ATENÇÃO: A coluna `cpf` do CSV vem VAZIA (medido: 0 de 7.889 preenchidos). O CPF só
    existe na API REST, uma chamada por deputado. Por isso `cpf_hash` fica nulo aqui
    e a conciliação com o TSE é feita em passo separado.
    """
    linhas: list[dict] = []
    vistos: set[str] = set()

    for _, registro in df.iterrows():
        id_externo = id_do_deputado(registro)
        if not id_externo or id_externo in vistos:
            continue                       # ATENÇÃO: o CSV repete a pessoa por partido (achado #20)
        vistos.add(id_externo)

        nome = registro.get("nomeCivil") or registro.get("nome") or ""
        linhas.append(
            {
                "nome_civil": nome,
                "nome_exibicao": registro.get("nome") or nome,
                "cpf_hash": None,
                "url_foto": url_da_foto(id_externo),
                "fonte": "CAMARA",
                "id_externo": id_externo,
                "metodo": "MANUAL",
                "confianca": 1.0,
            }
        )

    return linhas


# ═══════════════════════════════════════════════════════════════════


# DECISÃO: A URL da foto é DETERMINÍSTICA a partir do id — não precisa de requisição.
#
# ATENÇÃO: O CSV de deputados NÃO traz a foto (conferido: só `urlRedeSocial` e `urlWebsite`).
#    Ela aparece em `ultimoStatus.urlFoto` na API REST, um deputado por chamada — o que
#    seria 7.889 requisições para obter algo que se monta com uma f-string.
FOTO = "https://www.camara.leg.br/internet/deputado/bandep/{id}.jpg"


def url_da_foto(id_camara: str) -> str | None:
    """Monta a URL da foto oficial. `None` quando não há id."""
    return FOTO.format(id=id_camara) if id_camara else None


def id_do_deputado(linha) -> str:
    """Extrai o id da Câmara da linha de `deputados.csv`.

    RISCO: O arquivo **não tem coluna `id`.** Tem `uri`, e o id é o último segmento:

        https://dadosabertos.camara.leg.br/api/v2/deputados/220593  →  220593

    ATENÇÃO: Ler `registro.get("id")` devolvia vazio para toda linha, o laço pulava todas, e o ETL
    registrava `0 deputados no arquivo, 0 novos` — em **INFO**, sem erro. Como a tabela
    de-para ficava vazia, os 13.825 votos de 2025 também não casavam com ninguém e o
    log dizia `0 votos`. Dois zeros plausíveis, nenhuma exceção.

    DECISÃO: Aceita `id` se existir: se a Câmara passar a publicar a coluna, funciona sem
    mudança.
    """
    direto = str(linha.get("id") or "").strip()
    if direto:
        return direto

    uri = str(linha.get("uri") or "").strip().rstrip("/")

    return uri.rsplit("/", 1)[-1] if "/" in uri else ""


