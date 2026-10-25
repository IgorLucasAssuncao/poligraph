"""O patrimônio que cada parlamentar declarou ao TSE ao se candidatar — por tipo de bem.

## A cadeia (chave forte do começo ao fim)

| Passo | Chave | De onde |
|---|---|---|
| Bem → candidatura | `SQ_CANDIDATO` | `bem_candidato_{ano}.zip` |
| Candidatura → CPF → hash | `NR_CPF_CANDIDATO` | `consulta_cand_{ano}.zip` |
| Hash → parlamentar | `cpf_hash` | `pessoas` |

MEDIDO: Medido em 2026-09-25: 696 dos 747 parlamentares que votaram na 57ª têm bem declarado
(643 em 2022, 426 em 2018).

## RISCO: O que não entra

- **A descrição do bem.** É texto livre e traz endereço ("prédio comercial situado à rua…").
  A pergunta da tela é quanto e em quê, não onde. Minimização (LGPD).
- **O CPF em claro.** Vira hash na leitura e não sai da memória.

ATENÇÃO: O TSE publica um arquivo por UF, e às vezes também um `BRASIL`. Com o `BRASIL` presente,
lê-se só ele: somar os dois contaria cada bem duas vezes.
"""

import csv
import io
import zipfile
from collections import defaultdict
from pathlib import Path

from ..nucleo import normalizacao
from ..nucleo.tipos import CARGOS_DO_CONGRESSO, TipoCargo, cargo_do_tse, tipo_de_bem

RECURSO_CANDIDATOS = "consulta_cand/consulta_cand_{ano}.zip"
RECURSO_BENS = "bem_candidato/bem_candidato_{ano}.zip"

Candidatura = tuple[str, str]
"""(`SG_UE`, `SQ_CANDIDATO`). RISCO: até 2008 o `SQ_CANDIDATO` só é único dentro da UE (`mandatos.candidatura`)."""


def membros(zf: zipfile.ZipFile) -> list[str]:
    """Os CSVs a ler: o `BRASIL`, se existir; senão, os de cada UF."""
    csvs = [m for m in zf.namelist() if m.lower().endswith(".csv")]
    brasil = [m for m in csvs if "BRASIL" in m.upper()]
    return brasil or csvs


def linhas_do_zip(arquivo_zip: Path):
    with zipfile.ZipFile(arquivo_zip) as zf:
        for membro in membros(zf):
            with zf.open(membro) as bruto:
                yield from csv.DictReader(io.TextIOWrapper(bruto, encoding="latin-1", newline=""), delimiter=";")


def chave(registro: dict) -> Candidatura:
    return registro.get("SG_UE") or "", registro.get("SQ_CANDIDATO") or ""


def candidaturas(arquivo_zip: Path, hashes: dict[str, int], cargos: frozenset[TipoCargo] = CARGOS_DO_CONGRESSO) -> dict[Candidatura, int]:
    """Candidatura → `pessoas.id`, para as candidaturas de parlamentar que estão na base, eleitas ou não.

    RISCO: O CPF vira hash aqui mesmo e não é guardado: só o hash é comparado.
    """
    ligadas = {}
    for r in linhas_do_zip(arquivo_zip):
        if cargo_do_tse(r.get("CD_CARGO")) not in cargos:
            continue
        pessoa = hashes.get(normalizacao.hash_de_cpf(r.get("NR_CPF_CANDIDATO")) or "")
        if pessoa is not None:
            ligadas[chave(r)] = pessoa
    return ligadas


def bens_para_linhas(linhas, candidaturas_ligadas: dict[Candidatura, int], ano: int) -> list[dict]:
    """Soma os bens por pessoa e tipo. Não lê `DS_BEM_CANDIDATO`, que traz endereço."""
    somas: dict[tuple[int, str], list] = defaultdict(lambda: [0.0, 0])
    for r in linhas:
        pessoa = candidaturas_ligadas.get(chave(r))
        if pessoa is None:
            continue
        tipo = tipo_de_bem(r.get("DS_TIPO_BEM_CANDIDATO"))
        soma = somas[(pessoa, tipo)]
        soma[0] += normalizacao.valor_pt_br(r.get("VR_BEM_CANDIDATO"))
        soma[1] += 1

    return [
        {"pessoa_id": pessoa, "ano_eleicao": ano, "tipo_bem": tipo, "valor": round(valor, 2), "quantidade": quantidade}
        for (pessoa, tipo), (valor, quantidade) in somas.items()
    ]
