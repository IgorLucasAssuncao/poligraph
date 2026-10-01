"""O patrimônio que cada parlamentar declarou ao TSE ao se candidatar — por tipo de bem.

## A cadeia (chave forte do começo ao fim)

| Passo | Chave | De onde |
|---|---|---|
| Bem → candidatura | `SQ_CANDIDATO` | `bem_candidato_{ano}.zip` |
| Candidatura → CPF → hash | `NR_CPF_CANDIDATO` | `consulta_cand_{ano}.zip` |
| Hash → parlamentar | `cpf_hash` | `pessoas` |

📐 Medido em 2026-09-25: 696 dos 747 parlamentares que votaram na 57ª têm bem declarado
(643 em 2022, 426 em 2018).

## 🔴 O que ⛔ entra

- **A descrição do bem.** É texto livre e traz endereço ("prédio comercial situado à rua…").
  A pergunta da tela é quanto e em quê, ⛔ onde. Minimização (LGPD).
- **O CPF em claro.** Vira hash na leitura e ⛔ sai da memória.

⚠️ O TSE publica um arquivo por UF, e às vezes também um `BRASIL`. Com o `BRASIL` presente,
lê-se só ele: somar os dois contaria cada bem duas vezes.
"""

import csv
import io
import zipfile
from collections import defaultdict
from pathlib import Path

from . import normalizacao

RECURSO_CANDIDATOS = "consulta_cand/consulta_cand_{ano}.zip"
RECURSO_BENS = "bem_candidato/bem_candidato_{ano}.zip"

# Os cargos do Congresso no TSE: 5 = senador, 6 = deputado federal.
CARGOS_DO_CONGRESSO = {"5", "6"}


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


def candidaturas(arquivo_zip: Path, hashes: dict[str, int], cargos: set[str] = CARGOS_DO_CONGRESSO) -> dict[str, int]:
    """`SQ_CANDIDATO` → `pessoas.id`, para as candidaturas de parlamentar que estão na base.

    🔴 O CPF vira hash aqui mesmo e ⛔ é guardado: só o hash é comparado.
    """
    ligadas = {}
    for r in linhas_do_zip(arquivo_zip):
        if r.get("CD_CARGO") not in cargos:
            continue
        pessoa = hashes.get(normalizacao.hash_de_cpf(r.get("NR_CPF_CANDIDATO")))
        if pessoa is not None:
            ligadas[r["SQ_CANDIDATO"]] = pessoa
    return ligadas


def bens_para_linhas(linhas, candidaturas_ligadas: dict[str, int], ano: int) -> list[dict]:
    """Soma os bens por pessoa e tipo. ⛔ Lê `DS_BEM_CANDIDATO`, que traz endereço."""
    somas: dict[tuple[int, str], list] = defaultdict(lambda: [0.0, 0])
    for r in linhas:
        pessoa = candidaturas_ligadas.get(r.get("SQ_CANDIDATO"))
        if pessoa is None:
            continue
        tipo = (r.get("DS_TIPO_BEM_CANDIDATO") or "").strip() or "Não informado"
        soma = somas[(pessoa, tipo)]
        soma[0] += normalizacao.valor_pt_br(r.get("VR_BEM_CANDIDATO"))
        soma[1] += 1

    return [
        {"pessoa_id": pessoa, "ano_eleicao": ano, "tipo_bem": tipo, "valor": round(valor, 2), "quantidade": quantidade}
        for (pessoa, tipo), (valor, quantidade) in somas.items()
    ]
