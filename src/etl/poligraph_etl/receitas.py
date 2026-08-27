"""Financiamento de campanha — o fundão (FEFC) e o resto.

## ENTRADA

| | |
|---|---|
| Fonte | `cdn.tse.jus.br/.../prestacao_de_contas_eleitorais_candidatos_{ano}.zip` |
| Tamanho | **396 MB**, lidos em fluxo — ⛔ nunca em memória |
| Formato | CSV `;`, aspas, **Latin-1** — a única fonte do projeto assim |
| Recorte | O arquivo **consolidado**, ⛔ nunca ele *mais* os estaduais |
| Sentinelas | `#NULO`, `#NE`, `-1` chegam como **texto** |

## TRATAMENTO

1. Descarta cargo ⛔ ≠ `DEPUTADO FEDERAL`
2. **Hasheia o CPF do candidato** e casa contra `pessoas.cpf_hash` — quem ⛔ não casa sai
3. Descarta valor zero, que violaria `ck_receita_valor`
4. Separa CNPJ (legível) de CPF do doador (**hasheado**); `00000000000` vira `NULL`
5. Normaliza `DS_FONTE_RECEITA` para caixa alta

## SAÍDA

| | |
|---|---|
| Tabela | `receitas_de_campanha` |
| Chave de ligação | `pessoa_id`, via **hash de CPF** |
| Constraint do banco | `ck_receita_valor` (`valor <> 0`) · FK `CASCADE` |
| Idempotência | `DELETE` por `ano_eleicao` antes do `INSERT` |

---

🔴 `FUNDO ESPECIAL` e `FUNDO PARTIDARIO` são fundos **diferentes**, e este módulo ⛔ não
os soma: o primeiro é o "fundão" eleitoral de 2017, o segundo custeia o partido o ano
inteiro. Somá-los é decisão de quem analisa.

🔴 O CPF em claro existe **só em memória**, durante a leitura — RNF-13.

📐 [`docs/14-fontes-de-gasto.md §3`](../../../docs/14-fontes-de-gasto.md) ·
[achado #23](../../../docs/achados/023-consolidado-do-tse-e-o-unico-com-df.md)
"""

import csv
import io
import logging
import zipfile
from pathlib import Path

from .normalizacao import hash_de_cpf, valor_pt_br

log = logging.getLogger("poligraph")

PREFIXO = "receitas_candidatos_{ano}_"

# Fragmento, ⛔ não o nome inteiro: a posição do ano no arquivo estadual ainda não foi
# medida, e prender o filtro a uma das duas grafias plausíveis deixaria a outra passar.
IGNORAR = "doador_originario"

CONSOLIDADO = "_BRASIL"
CARGO = "DEPUTADO FEDERAL"
FUNDO_ESPECIAL = "FUNDO ESPECIAL"

# Sentinelas do TSE para campo ausente. Chegam como TEXTO, ⛔ não como vazio.
NULOS = {"#NULO", "#NULO#", "#NE", "#NE#", "-1", ""}


def nomes_de_receita(caminho: Path, ano: int) -> list[str]:
    """Os CSVs de receita a ler — o consolidado, se existir; senão, os estaduais.

    🔴 ⛔ **Nunca os dois, e nunca só os estaduais.** Medido no ZIP de 2022: são **26**
    arquivos estaduais mais um `_BRASIL`, e o consolidado **repete** os estaduais linha
    por linha (SP: 17.609 × 17.609). Só ele traz o **Distrito Federal**, que ⛔ não tem
    arquivo próprio. Ler os dois dobra tudo; ler só os estaduais perdia R$ 17,2 milhões
    e 10 parlamentares, em silêncio.
    """
    prefixo = PREFIXO.format(ano=ano)

    with zipfile.ZipFile(caminho) as pacote:
        candidatos = [
            nome
            for nome in pacote.namelist()
            if nome.startswith(prefixo)
            and IGNORAR not in nome
            and nome.lower().endswith(".csv")
        ]

    consolidado = [nome for nome in candidatos if CONSOLIDADO in nome]

    return consolidado or sorted(candidatos)


def ler_receitas(caminho: Path, nome_interno: str):
    """Itera as linhas de um CSV de dentro do ZIP, sem carregar tudo em memória.

    ⚠️ **Latin-1**, a única fonte do projeto assim — lida como UTF-8, estoura na primeira
    linha acentuada de um arquivo de 396 MB. `errors="replace"` porque uma linha
    malformada ⛔ não pode derrubar a ingestão inteira.
    """
    with zipfile.ZipFile(caminho) as pacote, pacote.open(nome_interno) as fluxo:
        texto = io.TextIOWrapper(fluxo, encoding="latin-1", errors="replace")

        yield from csv.DictReader(texto, delimiter=";", quotechar='"')


def para_linhas(
    registros, hashes_conhecidos: dict[str, int], ano_eleicao: int
) -> list[dict]:
    """Converte em linhas de `receitas_de_campanha`, guardando só quem casa por CPF.

    Descarta, e por quê:

    | Caso | Motivo |
    |---|---|
    | Cargo ⛔ ≠ deputado federal | Vereador, prefeito e senador ⛔ não estão em `pessoas` |
    | CPF fora do de-para | Candidato que ⛔ não se elegeu, ou de outra legislatura |
    | Valor zero | ⭐ Viola `ck_receita_valor`, e o lote inteiro seria recusado |

    🔴 O CPF em claro do candidato existe só dentro deste laço; o que sai já é hash.
    """
    linhas: list[dict] = []

    for registro in registros:
        if _texto(registro.get("DS_CARGO")).upper() != CARGO:
            continue

        chave = hash_de_cpf(registro.get("NR_CPF_CANDIDATO")) or ""
        pessoa_id = hashes_conhecidos.get(chave)
        if pessoa_id is None:
            continue

        valor = valor_pt_br(registro.get("VR_RECEITA"))
        if valor == 0:
            continue

        documento, pessoa_fisica = identificar_doador(registro.get("NR_CPF_CNPJ_DOADOR"))

        linhas.append(
            {
                "pessoa_id": pessoa_id,
                "ano_eleicao": ano_eleicao,
                "fonte_receita": _texto(registro.get("DS_FONTE_RECEITA")).upper()
                or "NAO INFORMADA",
                "origem_receita": _texto(registro.get("DS_ORIGEM_RECEITA")) or None,
                "doador": _texto(registro.get("NM_DOADOR")) or None,
                "doador_cnpj_ou_hash": documento,
                "doador_eh_pessoa_fisica": pessoa_fisica,
                "valor": valor,
            }
        )

    return linhas


def identificar_doador(bruto: str | None) -> tuple[str | None, bool]:
    """Separa CNPJ de CPF e **hasheia o CPF** — a mesma regra de `cota`.

    🔴 CNPJ fica legível de propósito: é dado público de empresa, e é ele que permite
    cruzar quem financiou a campanha com quem recebeu verba de gabinete depois.

    ⚠️ `00000000000` (doação sem doador identificado) vira `None`. Hasheá-lo daria um
    valor **constante** em milhares de linhas, que casaria todas entre si e inventaria um
    doador comum inexistente.
    """
    digitos = "".join(caractere for caractere in (bruto or "") if caractere.isdigit())

    if not digitos or set(digitos) == {"0"}:
        return None, False

    if len(digitos) == 11:
        return hash_de_cpf(digitos), True

    return digitos, False


def resumir(linhas: list[dict]) -> dict[str, float]:
    """Canário de ingestão, e a resposta que o TCC cita.

    ⚠️ Separa o fundão do resto de propósito: um total único esconderia justamente a
    distinção que dá sentido ao dado.
    """
    fundao = sum(
        linha["valor"] for linha in linhas if linha["fonte_receita"] == FUNDO_ESPECIAL
    )

    return {
        "linhas": float(len(linhas)),
        "total": sum(linha["valor"] for linha in linhas),
        "fundo_especial": fundao,
        "parlamentares": float(len({linha["pessoa_id"] for linha in linhas})),
    }


# ═══════════════════════════════════════════════════════════════════


def _texto(bruto: str | None) -> str:
    """Trata a sentinela do TSE. Sem isto, `#NULO` viraria o nome do doador na ficha."""
    valor = (bruto or "").strip()

    return "" if valor.upper() in NULOS else valor
