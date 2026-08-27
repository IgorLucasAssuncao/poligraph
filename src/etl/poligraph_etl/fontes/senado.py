"""ENTRADA — dados abertos do Senado Federal.

Baixa e lê. Não interpreta e não descarta: isso é `ingestao_senado`.

## O que entrega

| Recurso | Forma |
|---|---|
| `votacao?dataInicio=&dataFim=` | JSON, o **ano inteiro em uma chamada** — 1 a 3 MB |
| `senador/lista/atual` | JSON dentro de envelope, 81 senadores em exercício |

O endpoint de votação devolve um array de objetos de votação, cada um com um array
aninhado `votos[]`. Não é um array plano de votos — a versão 1.0 da documentação afirmava
o contrário e estava errada.

## Duas armadilhas medidas

`?data=YYYYMMDD` responde 200 e devolve **dados de outra data**. Use `dataInicio`/`dataFim`.

`CodigoParlamentar` e `CodigoPublicoNaLegAtual` são identificadores diferentes no mesmo
objeto (5672 e 800). O que aparece em `/votacao` é o `CodigoParlamentar`; escolher o outro
quebra o join sem erro.

Os campos vêm sem higienização — `FormaTratamento` chega como `"Senador "`, com espaço à
direita. Tudo passa por `strip()`.

Documentação: [`docs/11-api-senado.md`](../../../../docs/11-api-senado.md)
"""

import logging

import requests

log = logging.getLogger("poligraph")

BASE = "https://legis.senado.leg.br/dadosabertos"
CABECALHOS = {"Accept": "application/json"}

# Medido na legislatura 57: 57 votações em 2026 (ano parcial) a 141 em 2023. Um ano com
# menos que isto significa recorte errado ou mudança de contrato, não Senado parado.
MINIMO_POR_ANO = 20


def baixar_votacoes(ano: int) -> list[dict]:
    """As votações de um ano inteiro, em uma requisição.

    Devolve o array como veio, incluindo as secretas: filtrar é decisão do tratamento,
    e a contagem de secretas é o próprio achado #17.
    """
    resposta = requests.get(
        f"{BASE}/votacao",
        params={"dataInicio": f"{ano}-01-01", "dataFim": f"{ano}-12-31"},
        headers=CABECALHOS,
        timeout=300,
    )
    resposta.raise_for_status()

    if not resposta.content.strip():
        return []

    dados = resposta.json() or []
    _registrar_descontinuacao(dados)

    return dados


def baixar_senadores() -> list[dict]:
    """Os senadores em exercício, já desembrulhados do envelope.

    O Senado aninha a resposta em `ListaParlamentarEmExercicio.Parlamentares.Parlamentar`,
    e cada item ainda embrulha os campos em `IdentificacaoParlamentar`. Esta função
    devolve a lista de identificações, que é o que interessa.
    """
    resposta = requests.get(
        f"{BASE}/senador/lista/atual", headers=CABECALHOS, timeout=120
    )
    resposta.raise_for_status()

    envelope = resposta.json().get("ListaParlamentarEmExercicio", {})
    _registrar_descontinuacao(envelope)

    parlamentares = (envelope.get("Parlamentares") or {}).get("Parlamentar") or []

    return [
        item["IdentificacaoParlamentar"]
        for item in parlamentares
        if "IdentificacaoParlamentar" in item
    ]


def baixar_indexacao(codigo_materia: int) -> str:
    """A indexação temática da matéria — o que a ementa quase nunca diz.

    A ementa costuma ser a lista de leis alteradas: *"Altera dispositivos da Lei nº
    7.210 (Lei de Execução Penal) e do Decreto-Lei nº 2.848 (Código Penal)"*. Isso não
    permite escrever pergunta nenhuma.

    `IndexacaoMateria` é o vocabulário controlado do Senado e diz o assunto:
    *"CAUSA DE DIMINUIÇÃO DE PENA, CRIME CONTRA AS INSTITUIÇÕES DEMOCRÁTICAS"* — que é a
    dosimetria dos atos de 8 de janeiro, e aí a pergunta se escreve.

    Devolve string vazia em qualquer falha: é insumo de curadoria, e derrubar a listagem
    inteira porque uma matéria não respondeu seria pior que listá-la sem indexação.
    """
    try:
        resposta = requests.get(
            f"{BASE}/materia/{codigo_materia}", headers=CABECALHOS, timeout=60
        )
        resposta.raise_for_status()
        basicos = (
            resposta.json()
            .get("DetalheMateria", {})
            .get("Materia", {})
            .get("DadosBasicosMateria", {})
        )
    except (requests.RequestException, ValueError, AttributeError):
        return ""

    return " ".join((basicos.get("IndexacaoMateria") or "").split())


def conferir_volume(votacoes: list[dict], ano: int) -> None:
    """Canário: ano com volume muito abaixo do medido indica contrato alterado.

    O endpoint de plenário já foi descontinuado uma vez (achado #4) e o substituto respondeu
    200 o tempo todo. Um sucessor que passe a devolver vazio faria a ingestão registrar
    zero votações sem erro.
    """
    if len(votacoes) < MINIMO_POR_ANO:
        raise RuntimeError(
            f"Só {len(votacoes)} votações em {ano} — esperado ao menos {MINIMO_POR_ANO}. "
            "O contrato do endpoint mudou?"
        )


# ═══════════════════════════════════════════════════════════════════


def _registrar_descontinuacao(dados) -> None:
    """RNF-11: o bloco `Descontinuacao` vai para o log.

    O endpoint anterior respondia 200 e só avisava da depreciação nos metadados. Sem
    registrar, o próximo a ser descontinuado morre em silêncio.
    """
    metadados = dados.get("Metadados") if isinstance(dados, dict) else None
    aviso = (metadados or {}).get("Descontinuacao")

    if aviso:
        log.warning("Senado sinaliza DESCONTINUACAO deste endpoint: %s", aviso)
