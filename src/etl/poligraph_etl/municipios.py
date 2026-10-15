"""Municípios e a sede de quem recebeu emenda — só por chave forte.

Responde *"para que cidade foi o dinheiro desta emenda?"* sem casar nome nem UF.

## A cadeia

| Passo | Chave | De onde |
|---|---|---|
| Pagamento → quem recebeu | CNPJ | `emendas_favorecidos.documento` |
| CNPJ → município da sede | código TOM | cadastro de estabelecimentos da Receita |
| TOM → município do mapa | código IBGE | tabela de municípios da Receita |

MEDIDO: Medido em 2026-09-25: 31.576 de 31.576 CNPJs achados no cadastro, 31.574 com IBGE —
100,00% do valor pago a pessoa jurídica fora do intermediário.

## SAÍDA

`municipios` (IBGE, TOM, nome, UF) e `cnpjs_municipio` (CNPJ → IBGE).

---

ATENÇÃO: **É a sede, não o lugar da obra.** Para 74,9% do valor o favorecido é a própria
prefeitura ou um fundo municipal, e a sede é a cidade. Fundo estadual tem sede na
capital; empresa, onde foi aberta. A tela diz isso.
"""

import re
from datetime import date


def municipios_para_linhas(tabela: list[dict]) -> list[dict]:
    """A tabela TOM ↔ IBGE da Receita, em linhas de `municipios`.

    ATENÇÃO: O TOM vem sem zeros à esquerda ("1", "5") e o cadastro de CNPJ o grava com quatro
    dígitos ("0001"): normaliza para quatro, senão a chave não casa.
    """
    linhas = []
    for r in tabela:
        ibge = r["CÓDIGO DO MUNICÍPIO - IBGE"].strip()
        tom = r["CÓDIGO DO MUNICÍPIO - TOM"].strip().zfill(4)
        if not re.fullmatch(r"\d{7}", ibge) or not re.fullmatch(r"\d{4}", tom):
            continue
        linhas.append({
            "codigo_ibge": ibge,
            "codigo_tom": tom,
            "nome": r["MUNICÍPIO - IBGE"].strip(),
            "uf": r["UF"].strip().upper(),
        })
    return linhas


def sedes_para_linhas(sedes: dict[str, str], tom_para_ibge: dict[str, str], pasta: str) -> list[dict]:
    """CNPJ → IBGE, pela sede do cadastro. CNPJ cuja sede não está na tabela fica de fora.

    `pasta` é o mês do cadastro (`AAAA-MM`), gravado para dizer de quando é a sede.
    """
    ano, mes = pasta.split("-")
    cadastro_de = date(int(ano), int(mes), 1).isoformat()
    return [
        {"cnpj": cnpj, "codigo_ibge": tom_para_ibge[tom.zfill(4)], "cadastro_de": cadastro_de}
        for cnpj, tom in sedes.items()
        if tom.zfill(4) in tom_para_ibge
    ]
