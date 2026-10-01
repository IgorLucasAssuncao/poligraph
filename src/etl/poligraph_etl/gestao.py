"""Quem governa — presidente e vice eleitos, do cadastro de candidatos do TSE.

Responde *"de quem é a gestão cujo orçamento a página mostra?"*.

## ENTRADA

| | |
|---|---|
| Fonte | `consulta_cand/consulta_cand_{eleicao}.zip`, no CDN do TSE — ver [`fontes/tse.py`](fontes/tse.py) |
| Arquivo lido | `consulta_cand_{eleicao}_BR.csv` — os cargos de abrangência nacional |
| Volume | 4,4 MB compactado (2022) |

## SAÍDA

`gestoes` — uma linha por eleição presidencial.

---

⭐ **Da fonte, ⛔ escrito à mão.** Um nome de presidente fixo no código continuaria na
tela depois da próxima posse, e a página afirmaria quem governa sem que ninguém
tivesse conferido.

🔴 O arquivo traz o **CPF** dos candidatos em claro. Ele ⛔ é lido para lugar nenhum: o
projeto só guarda CPF em hash, e aqui nem isso é preciso.

⚠️ O eleito aparece duas vezes — `2º TURNO` na linha do 1º turno e `ELEITO` na do 2º.
Vale a de `ELEITO`. O vice é a linha de `VICE-PRESIDENTE` eleita com o mesmo número.
"""

import io
import zipfile
from pathlib import Path

import pandas as pd

RECURSO = "consulta_cand/consulta_cand_{eleicao}.zip"

COLUNAS = [
    "ANO_ELEICAO", "DS_CARGO", "NR_CANDIDATO", "NM_CANDIDATO", "NM_URNA_CANDIDATO",
    "SG_PARTIDO", "DS_SIT_TOT_TURNO", "DS_COMPOSICAO_COLIGACAO",
]


def ler(arquivo_zip: Path, eleicao: int) -> pd.DataFrame:
    """Lê só as colunas usadas — o CPF fica no ZIP."""
    with zipfile.ZipFile(arquivo_zip) as zf:
        with zf.open(f"consulta_cand_{eleicao}_BR.csv") as bruto:
            return pd.read_csv(
                io.TextIOWrapper(bruto, encoding="latin-1"),
                sep=";",
                quotechar='"',
                dtype=str,
                keep_default_na=False,
                usecols=COLUNAS,
            )


def eleitos(df: pd.DataFrame) -> dict:
    """Presidente e vice eleitos, numa linha de `gestoes`.

    ⚠️ O mandato é contado em anos, ⛔ em datas: a posse passou de 1º para 5 de janeiro,
    e gravar um dia de fim arrisca afirmar uma data errada. O primeiro ano é o seguinte
    ao da eleição; o mandato tem quatro.
    """
    presidente = _eleito(df, "PRESIDENTE")
    vice = _eleito(df, "VICE-PRESIDENTE", numero=presidente["NR_CANDIDATO"])
    eleicao = int(presidente["ANO_ELEICAO"])

    return {
        "eleicao": eleicao,
        "primeiro_ano": eleicao + 1,
        "ultimo_ano": eleicao + 4,
        "presidente_nome": presidente["NM_CANDIDATO"],
        "presidente_nome_de_urna": presidente["NM_URNA_CANDIDATO"],
        "presidente_partido": presidente["SG_PARTIDO"],
        "vice_nome": vice["NM_CANDIDATO"],
        "vice_nome_de_urna": vice["NM_URNA_CANDIDATO"],
        "vice_partido": vice["SG_PARTIDO"],
        "coligacao": presidente["DS_COMPOSICAO_COLIGACAO"] or None,
    }


def _eleito(df: pd.DataFrame, cargo: str, numero: str | None = None) -> dict:
    linhas = df[(df["DS_CARGO"] == cargo) & (df["DS_SIT_TOT_TURNO"] == "ELEITO")]
    if numero is not None:
        linhas = linhas[linhas["NR_CANDIDATO"] == numero]

    if len(linhas) != 1:
        raise ValueError(
            f"Esperava um {cargo} eleito no arquivo do TSE e achei {len(linhas)} — "
            "o formato mudou, ou a eleição ainda não terminou."
        )

    return linhas.iloc[0].to_dict()
