"""Cota parlamentar (CEAP) — a despesa de gabinete de cada deputado.

## ENTRADA

| | |
|---|---|
| Fonte | DECISÃO: `fontes.camara.baixar_cota` — o download é ENTRADA e mora lá, com as demais |
| Tamanho | ~6,6 MB compactado, ~233 mil linhas por ano |
| Formato | CSV `;`, aspas, `utf-8-sig` |
| Decimal | **PONTO** — o oposto do Portal e do TSE |
| não O que não serve | `GET /deputados/{id}/despesas` responde **200** com `"dados": []` |

DECISÃO: Este módulo é **só TRATAMENTO**. O download e o canário de volume vivem em
`fontes/camara.py`, junto do resto do que vem da Câmara — a cota é um recurso da
Câmara como os outros, e ter a entrada aqui era a única fonte do projeto que
misturava as duas fases no mesmo arquivo.

## TRATAMENTO

1. Casa `ideCadastro` contra o de-para de `pessoa_fonte_ids` — quem não casa sai
2. Descarta valor zero, que violaria `ck_despesa_valor`
3. Separa CNPJ (legível) de CPF de fornecedor (**hasheado**)
4. ATENÇÃO: Confere o **volume** contra o mínimo medido: arquivo encolhido = layout mudou

## SAÍDA

| | |
|---|---|
| Tabela | `despesas` |
| Chave de ligação | `pessoa_id`, via `ideCadastro` |
| Constraint do banco | `ck_despesa_valor` (`valor_liquido <> 0`) · FK `CASCADE` |
| Idempotência | `DELETE` por (pessoa, ano) antes do `INSERT` |

---

DECISÃO: Valor **negativo é estorno** e é mantido — somá-lo importa para o total.

RISCO: `txtCNPJCPF` mistura CNPJ de empresa com **CPF em claro** de pessoa física; a RNF-13
proíbe o segundo. Hashear os dois destruiria a análise: sem CNPJ legível não dá para
cruzar o mesmo fornecedor entre parlamentares.

MEDIDO: [`docs/14-fontes-de-gasto.md §1`](../../../docs/14-fontes-de-gasto.md)
"""

import logging

from .normalizacao import hash_de_cpf, inteiro, sem_acento_maiusculo, sem_cpf, valor_com_ponto

log = logging.getLogger("poligraph")

def para_linhas(registros: list[dict], mapa_pessoas: dict[str, int]) -> list[dict]:
    """Converte em linhas de `despesas`, descartando o que não liga a um parlamentar.

    Descarta, e por quê:

    | Caso | Motivo |
    |---|---|
    | Sem `ideCadastro` | São lideranças e órgãos (0,4%), não pessoas |
    | Fora do de-para | Deputado que a ingestão de pessoas não trouxe |
    | Valor zero | Linha administrativa sem efeito financeiro |
    """
    linhas: list[dict] = []

    for registro in registros:
        id_camara = (registro.get("ideCadastro") or "").strip()
        pessoa_id = mapa_pessoas.get(id_camara)
        if pessoa_id is None:
            continue

        valor = _decimal(registro.get("vlrLiquido"))
        if valor == 0:
            continue

        documento, pessoa_fisica = _identificar_fornecedor(registro.get("txtCNPJCPF"))

        linhas.append(
            {
                "pessoa_id": pessoa_id,
                "ano": inteiro(registro.get("numAno")),
                "mes": inteiro(registro.get("numMes")),
                "categoria": (registro.get("txtDescricao") or "").strip() or "SEM CATEGORIA",
                "fornecedor": sem_cpf((registro.get("txtFornecedor") or "").strip() or None),
                "cnpj_ou_hash": documento,
                "fornecedor_eh_pessoa_fisica": pessoa_fisica,
                "valor_liquido": valor,
                "data_emissao": (registro.get("datEmissao") or "")[:10] or None,
                "url_documento": (registro.get("urlDocumento") or "").strip() or None,
            }
        )

    return linhas


# ═══════════════════════════════════════════════════════════════════


def para_linhas_do_senado(
    registros: list[dict], por_nome: dict[str, int]
) -> list[dict]:
    """Converte a CEAPS em linhas de `despesas` — a mesma tabela da Camara.

    A CEAPS nao tem id de parlamentar: a chave e a coluna `SENADOR`, o nome
    parlamentar em caixa alta. O casamento e por nome normalizado, e quem nao casa
    e descartado — atribuir gasto por semelhanca seria inventar dono.

    O resto do layout difere da Camara em tudo: `VALOR_REEMBOLSADO` em pt-BR,
    `DATA` em dd/mm/aaaa, e nao ha URL de documento.
    """
    linhas: list[dict] = []

    for registro in registros:
        nome = sem_acento_maiusculo(registro.get("SENADOR"))
        pessoa_id = por_nome.get(nome)
        if pessoa_id is None:
            continue

        valor = _decimal(str(registro.get("VALOR_REEMBOLSADO") or "").replace(",", "."))
        if valor == 0:
            continue

        documento, pessoa_fisica = _identificar_fornecedor(registro.get("CNPJ_CPF"))

        linhas.append(
            {
                "pessoa_id": pessoa_id,
                "ano": inteiro(registro.get("ANO")),
                "mes": inteiro(registro.get("MES")),
                "categoria": (registro.get("TIPO_DESPESA") or "").strip()
                or "SEM CATEGORIA",
                "fornecedor": sem_cpf((registro.get("FORNECEDOR") or "").strip() or None),
                "cnpj_ou_hash": documento,
                "fornecedor_eh_pessoa_fisica": pessoa_fisica,
                "valor_liquido": valor,
                "data_emissao": _data_iso(registro.get("DATA")),
                # A CEAPS publica so o numero do documento, nao o link da imagem.
                "url_documento": None,
            }
        )

    return linhas


def _data_iso(bruto: str | None) -> str | None:
    """`dd/mm/aaaa` -> `aaaa-mm-dd`. Devolve `None` para o que nao converte."""
    partes = (bruto or "").strip().split("/")
    if len(partes) != 3 or not all(partes):
        return None

    dia, mes, ano = partes

    return f"{ano}-{mes.zfill(2)}-{dia.zfill(2)}"


def _identificar_fornecedor(bruto: str | None) -> tuple[str | None, bool]:
    """Separa CNPJ de CPF e **hasheia o CPF** — a mesma regra de `receitas`.

    RISCO: Usa o mesmo hash de `Pessoa.CpfHash`, o que torna os dois lados comparáveis sem
    reverter nenhum deles.
    """
    digitos = "".join(caractere for caractere in (bruto or "") if caractere.isdigit())

    if not digitos:
        return None, False

    if len(digitos) == 11:
        return hash_de_cpf(digitos), True

    return digitos, False


# RISCO: Ponto DECIMAL aqui, o oposto do Portal e do TSE. Usar `valor_pt_br` por engano daria
# um total mil vezes menor, sem erro — o nome importado é o que impede a troca silenciosa.
_decimal = valor_com_ponto


