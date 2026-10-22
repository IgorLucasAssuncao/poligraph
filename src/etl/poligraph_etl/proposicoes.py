"""Proposições — a ementa que diz sobre o que a votação era.

## ENTRADA

| | |
|---|---|
| Fonte | `dadosabertos.camara.leg.br/arquivos/votacoesProposicoes/csv/votacoesProposicoes-{ano}.csv` |
| Tamanho | ~5 MB por ano |
| Formato | CSV `;`, aspas, `utf-8-sig` |

DECISÃO: **NÃO é o arquivo `proposicoes`, que tem 90 MB por ano.** O de ligação já traz
`proposicao_ementa`, `proposicao_titulo` e o tipo embutidos — 5 MB entregam o que
interessa, contra 360 MB nos quatro anos para extrair as mesmas ~1.600 linhas.

ATENÇÃO: O arquivo grande tem duas colunas que este não tem: `keywords` (indexação temática)
e `ementaDetalhada`. Se a curadoria precisar delas, aí vale pagar os 90 MB — não antes.

## TRATAMENTO

1. Deduplica por votação: a mesma votação aparece várias vezes quando tem mais de um objeto
2. Descarta linha sem `proposicao_id` ou sem votação conhecida
3. Normaliza espaço na ementa — a fonte traz quebra de linha dentro do campo

## SAÍDA

| | |
|---|---|
| Tabelas | `proposicoes` · e o `proposicao_id` de `votacoes` |
| Chave | `id` da proposição na Câmara |
| Idempotência | `ON CONFLICT (id) DO UPDATE` |

---

## RISCO: Por que isto destrava a curadoria (Pendência 11)

Sem a ementa, quem cura lê só a **descrição da votação**:

> *"Aprovado o Substitutivo ao Projeto de Lei Complementar nº 80, de 2026, adotado pelo
> relator da Comissão de…"*

Isso diz o **número** do projeto e não **não diz sobre o que ele é**. Escrever uma pergunta
em linguagem leiga a partir disso é adivinhação — e a Pendência 11 é o maior bloqueio do projeto.

MEDIDO: Medido em 2026-08-28: das 266 votações substantivas da 57ª, **263 ganham ementa**
(98,9%). Antes, `proposicao_id` era nulo em **1.594 de 1.594** (100%).
"""

import logging
from .tipos import TipoCasa

log = logging.getLogger("poligraph")

CASA = TipoCasa.CAMARA
CASA_SENADO = TipoCasa.SENADO


def para_linhas(
    registros, votacoes_conhecidas: set[str]
) -> tuple[list[dict], dict[str, int]]:
    """Devolve as proposições e o de-para `votacao_id -> proposicao_id`.

    DECISÃO: Os dois juntos porque saem da mesma leitura: separar exigiria percorrer o arquivo
    duas vezes para reconstruir o vínculo que a linha já traz.

    Descarta, e por quê:

    | Caso | Motivo |
    |---|---|
    | Sem `proposicao_id` | Não há proposição a gravar nem a vincular |
    | Votação fora da base | A ligação apontaria para votação que não existe (FK) |
    | Votação repetida | A mesma votação com vários objetos — o primeiro vence |

    ATENÇÃO: A proposição repete entre votações — várias votações do mesmo projeto. O
    dicionário deduplica; não é acidente que a última leitura vença, porque
    o conteúdo é idêntico.

    RISCO: Parte da chave — ver `gravar_proposicoes`. As duas fontes numeram no
    mesmo espaço e as faixas se sobrepõem.
    """
    proposicoes: dict[int, dict] = {}
    vinculo: dict[str, int] = {}

    for registro in registros:
        votacao_id = _texto(registro.get("idVotacao"))
        bruto = _texto(registro.get("proposicao_id"))

        if not votacao_id or not bruto or votacao_id not in votacoes_conhecidas:
            continue
        if votacao_id in vinculo:
            continue

        try:
            proposicao_id = int(bruto)
        except ValueError:
            continue

        vinculo[votacao_id] = proposicao_id

        proposicoes[proposicao_id] = {
            "casa": CASA,
            "id": proposicao_id,
            "sigla_tipo": _texto(registro.get("proposicao_siglaTipo")) or None,
            "numero": _inteiro_ou_nulo(registro.get("proposicao_numero")),
            "ano": _inteiro_ou_nulo(registro.get("proposicao_ano")),
            "ementa": _texto(registro.get("proposicao_ementa")) or None,
            "url_inteiro_teor": None,
        }

    return list(proposicoes.values()), vinculo


def do_senado(materias, vinculo_bruto: dict[str, str]) -> tuple[list[dict], dict[str, int]]:
    """As proposições do Senado, no mesmo formato das da Câmara.

    ATENÇÃO: **A forma da entrada é outra.** Na Câmara o vínculo vem embutido em cada linha do
    CSV; aqui vêm duas coisas separadas: as matérias já baixadas de `/materia/{codigo}`
    e o de-para `votacao_id -> codigo_materia` extraído da listagem de votações.

    Não Matéria sem código ou sem ementa é descartada: gravar linha sem ementa não
    resolve nada — a ficha continuaria mostrando o número.

    MEDIDO: Medido em 2026-08-29: 421 votações do Senado apontam para **359 matérias
    distintas**.

    DECISÃO: Só vincula o que foi de fato gravado: apontar para matéria descartada deixaria
    `proposicao_id` preenchido e a FK recusaria a linha inteira.
    """
    proposicoes: dict[int, dict] = {}

    for materia in materias:
        if not materia:
            continue

        codigo = _inteiro_ou_nulo(materia.get("codigo"))
        ementa = _texto(materia.get("ementa"))
        if codigo is None or not ementa:
            continue

        proposicoes[codigo] = {
            "casa": CASA_SENADO,
            "id": codigo,
            "sigla_tipo": _texto(materia.get("sigla_tipo")) or None,
            "numero": _inteiro_ou_nulo(materia.get("numero")),
            "ano": _inteiro_ou_nulo(materia.get("ano")),
            "ementa": ementa,
            "url_inteiro_teor": None,
        }

    vinculo = {
        votacao_id: _inteiro_ou_nulo(codigo)
        for votacao_id, codigo in vinculo_bruto.items()
        if _inteiro_ou_nulo(codigo) in proposicoes
    }

    return list(proposicoes.values()), vinculo


def _texto(valor) -> str:
    """ATENÇÃO: Colapsa espaço: a ementa vem com quebra de linha DENTRO do campo."""
    return "" if valor is None else " ".join(str(valor).split())


def _inteiro_ou_nulo(valor) -> int | None:
    try:
        return int(float(valor)) or None
    except (TypeError, ValueError):
        return None
