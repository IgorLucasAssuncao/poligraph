"""Financiamento de campanha — o fundão eleitoral (FEFC) e o resto do dinheiro.

Responde *"quem pagou a campanha deste deputado, e quanto veio de dinheiro público?"*.

⭐ **Liga por CPF**, que é chave forte — melhor do que qualquer casamento por nome. O CPF
do deputado vem da API REST da Câmara (`api/v2/deputados/{id}`) e vive em `pessoas` já
hasheado; o do candidato vem do CSV do TSE em claro. **Hashear os dois com a mesma função
faz o join sem que o CPF em claro toque o banco** — RNF-13.

🔴 **`FUNDO ESPECIAL` e `FUNDO PARTIDARIO` são fundos DIFERENTES.** O primeiro é o
"fundão" criado em 2017; o segundo é o financiamento permanente dos partidos. O CSV os
separa em `DS_FONTE_RECEITA`, e este módulo ⛔ **não** os soma — quem quiser somar que
some, dizendo que somou.

⚠️ **Encoding é Latin-1**, ⛔ não UTF-8. É a única fonte do projeto assim, e ler como
UTF-8 estoura em `UnicodeDecodeError` no primeiro nome acentuado.

📐 Medições: [`docs/14-fontes-de-gasto.md §3`](../../../docs/14-fontes-de-gasto.md).
"""

import csv
import io
import logging
import zipfile
from pathlib import Path

from .normalizacao import hash_de_cpf, valor_pt_br

log = logging.getLogger("poligraph")

# ⚠️ O prefixo separa `receitas_candidatos_2022_AP.csv` dos outros quatro tipos que
#    dividem o mesmo ZIP — e do `doador_originario`, que ⛔ não é o mesmo arquivo.
PREFIXO = "receitas_candidatos_{ano}_"
# 🔴 Só o fragmento, ⛔ não o nome inteiro: a posição do ano no arquivo estadual
#    ainda ⛔ não foi medida no ZIP real, e prender o filtro a uma das duas grafias
#    plausíveis deixaria a outra passar — DUPLICANDO a receita de cada candidato.
IGNORAR = "doador_originario"

# ⚠️ O arquivo `_BRASIL` é o consolidado de 1,3 GB. Ler os 27 estaduais dá o mesmo
#    conteúdo com uma fração da memória — e ler os dois DUPLICARIA tudo.
CONSOLIDADO = "_BRASIL"

CARGO = "DEPUTADO FEDERAL"

# 🔴 O "fundão". ⛔ Não confundir com `FUNDO PARTIDARIO`.
FUNDO_ESPECIAL = "FUNDO ESPECIAL"

# ⚠️ Sentinela do TSE para campo ausente. Aparece como texto, ⛔ não como vazio.
NULOS = {"#NULO", "#NULO#", "#NE", "#NE#", "-1", ""}


def nomes_de_receita(caminho: Path, ano: int) -> list[str]:
    """Os 27 CSVs estaduais de receita, ⛔ sem o consolidado e sem o doador originário."""
    prefixo = PREFIXO.format(ano=ano)

    with zipfile.ZipFile(caminho) as zipe:
        return sorted(
            nome
            for nome in zipe.namelist()
            if nome.startswith(prefixo)
            and IGNORAR not in nome
            and CONSOLIDADO not in nome
            and nome.lower().endswith(".csv")
        )


def ler_receitas(caminho: Path, nome_interno: str):
    """Itera as linhas de um CSV de dentro do ZIP, **sem** carregar tudo em memória.

    ⚠️ Gerador de propósito: são centenas de milhares de linhas por UF, e só uma fração
    mínima sobrevive ao filtro de CPF. Materializar a lista antes de filtrar seria
    guardar o que já se sabe que vai fora.
    """
    with zipfile.ZipFile(caminho) as zipe, zipe.open(nome_interno) as fluxo:
        # 🔴 Latin-1. `errors="replace"` porque uma linha malformada ⛔ não pode derrubar
        #    a ingestão de um arquivo de 377 MB.
        texto = io.TextIOWrapper(fluxo, encoding="latin-1", errors="replace")

        yield from csv.DictReader(texto, delimiter=";", quotechar='"')


def para_linhas(
    registros, hashes_conhecidos: dict[str, int], ano_eleicao: int
) -> list[dict]:
    """Converte em linhas de `receitas_de_campanha`, guardando só quem casa por CPF.

    ⚠️ O que é descartado, e por quê:

    | Caso | Motivo |
    |---|---|
    | Cargo ⛔ ≠ deputado federal | Vereador, prefeito e senador ⛔ não estão em `pessoas` |
    | CPF fora do de-para | Candidato que ⛔ não se elegeu, ou de outra legislatura |
    | Valor zero | ⭐ Viola `ck_receita_valor` — o banco recusaria a linha inteira |

    🔴 O CPF em claro do candidato existe só dentro deste laço. O que sai já é hash.
    """
    linhas: list[dict] = []

    for r in registros:
        if _texto(r.get("DS_CARGO")).upper() != CARGO:
            continue

        pessoa_id = hashes_conhecidos.get(hash_de_cpf(r.get("NR_CPF_CANDIDATO")) or "")
        if pessoa_id is None:
            continue

        valor = valor_pt_br(r.get("VR_RECEITA"))
        if valor == 0:
            continue

        documento, pessoa_fisica = identificar_doador(r.get("NR_CPF_CNPJ_DOADOR"))

        linhas.append(
            {
                "pessoa_id": pessoa_id,
                "ano_eleicao": ano_eleicao,
                "fonte_receita": _texto(r.get("DS_FONTE_RECEITA")).upper()
                or "NAO INFORMADA",
                "origem_receita": _texto(r.get("DS_ORIGEM_RECEITA")) or None,
                "doador": _texto(r.get("NM_DOADOR")) or None,
                "doador_cnpj_ou_hash": documento,
                "doador_eh_pessoa_fisica": pessoa_fisica,
                "valor": valor,
            }
        )

    return linhas


def identificar_doador(bruto: str | None) -> tuple[str | None, bool]:
    """Separa CNPJ de CPF e **hasheia o CPF** — a mesma regra de `cota._identificar_fornecedor`.

    🔴 RNF-13: CPF ⛔ nunca em claro. CNPJ é dado público de empresa e fica legível — sem
    ele, ⛔ não dá para cruzar **quem financiou a campanha** com **quem recebeu verba de
    gabinete depois**, que é a pergunta que justifica ingerir isto.
    """
    digitos = "".join(c for c in (bruto or "") if c.isdigit())

    if not digitos or set(digitos) == {"0"}:
        return None, False

    if len(digitos) == 11:
        return hash_de_cpf(digitos), True

    return digitos, False


def resumir(linhas: list[dict]) -> dict[str, float]:
    """⭐ Canário de ingestão, e a resposta que o TCC vai citar.

    ⚠️ Separa o fundão do resto **de propósito**. Um total único esconderia justamente a
    distinção que dá sentido ao dado.
    """
    fundao = sum(l["valor"] for l in linhas if l["fonte_receita"] == FUNDO_ESPECIAL)

    return {
        "linhas": float(len(linhas)),
        "total": sum(l["valor"] for l in linhas),
        "fundo_especial": fundao,
        "parlamentares": float(len({l["pessoa_id"] for l in linhas})),
    }


# ═══════════════════════════════════════════════════════════════════


def _texto(bruto: str | None) -> str:
    """⚠️ `#NULO` do TSE é texto, ⛔ não vazio — sem isto ele viraria o nome do doador."""
    valor = (bruto or "").strip()

    return "" if valor.upper() in NULOS else valor
