"""Cota parlamentar (CEAP) — a despesa de gabinete de cada deputado.

## ENTRADA

| | |
|---|---|
| Fonte | `www.camara.leg.br/cotas/Ano-{ano}.csv.zip` — ⚠️ **fora** de `dadosabertos` |
| Tamanho | ~6,6 MB compactado, ~233 mil linhas por ano |
| Formato | CSV `;`, aspas, `utf-8-sig` |
| Decimal | **PONTO** — o oposto do Portal e do TSE |
| ⛔ O que ⛔ não serve | `GET /deputados/{id}/despesas` responde **200** com `"dados": []` |

## TRATAMENTO

1. Casa `ideCadastro` contra o de-para de `pessoa_fonte_ids` — quem ⛔ não casa sai
2. Descarta valor zero, que violaria `ck_despesa_valor`
3. Separa CNPJ (legível) de CPF de fornecedor (**hasheado**)
4. ⚠️ Confere o **volume** contra o mínimo medido: arquivo encolhido = layout mudou

## SAÍDA

| | |
|---|---|
| Tabela | `despesas` |
| Chave de ligação | `pessoa_id`, via `ideCadastro` |
| Constraint do banco | `ck_despesa_valor` (`valor_liquido <> 0`) · FK `CASCADE` |
| Idempotência | `DELETE` por (pessoa, ano) antes do `INSERT` |

---

⭐ Valor **negativo é estorno** e é mantido — somá-lo importa para o total.

🔴 `txtCNPJCPF` mistura CNPJ de empresa com **CPF em claro** de pessoa física; a RNF-13
proíbe o segundo. Hashear os dois destruiria a análise: sem CNPJ legível ⛔ não dá para
cruzar o mesmo fornecedor entre parlamentares.

📐 [`docs/14-fontes-de-gasto.md §1`](../../../docs/14-fontes-de-gasto.md)
"""

import csv
import io
import logging
import zipfile
from pathlib import Path

import requests

from .normalizacao import hash_de_cpf, valor_com_ponto

log = logging.getLogger("poligraph")

URL = "https://www.camara.leg.br/cotas/Ano-{ano}.csv.zip"

# Medido: ~233 mil linhas por ano, 99,6% com `ideCadastro`.
MINIMO_ESPERADO = 50_000


def baixar(ano: int, destino: Path) -> Path:
    """⚠️ ~6,6 MB compactado. Vale cachear entre execuções."""
    destino.parent.mkdir(parents=True, exist_ok=True)

    resposta = requests.get(URL.format(ano=ano), timeout=300)
    resposta.raise_for_status()
    destino.write_bytes(resposta.content)

    return destino


def ler(caminho: Path) -> list[dict]:
    """Lê o CSV de dentro do ZIP.

    ⛔ Não reutiliza `camara.ler_csv`: aqui a fonte é ZIP, e carregar 233 mil linhas num
    DataFrame para depois iterar seria desperdício.
    """
    with zipfile.ZipFile(caminho) as arquivo:
        nome = arquivo.namelist()[0]
        with arquivo.open(nome) as fluxo:
            texto = io.TextIOWrapper(fluxo, encoding="utf-8-sig")

            return list(csv.DictReader(texto, delimiter=";", quotechar='"'))


def para_linhas(registros: list[dict], mapa_pessoas: dict[str, int]) -> list[dict]:
    """Converte em linhas de `despesas`, descartando o que ⛔ não liga a um parlamentar.

    Descarta, e por quê:

    | Caso | Motivo |
    |---|---|
    | Sem `ideCadastro` | São lideranças e órgãos (0,4%), ⛔ não pessoas |
    | Fora do de-para | Deputado que a ingestão de pessoas ⛔ não trouxe |
    | Valor zero | Linha administrativa sem efeito financeiro |
    """
    linhas: list[dict] = []

    for r in registros:
        id_camara = (r.get("ideCadastro") or "").strip()
        pessoa_id = mapa_pessoas.get(id_camara)
        if pessoa_id is None:
            continue

        valor = _decimal(r.get("vlrLiquido"))
        if valor == 0:
            continue

        documento, pessoa_fisica = _identificar_fornecedor(r.get("txtCNPJCPF"))

        linhas.append(
            {
                "pessoa_id": pessoa_id,
                "ano": _inteiro(r.get("numAno")),
                "mes": _inteiro(r.get("numMes")),
                "categoria": (r.get("txtDescricao") or "").strip() or "SEM CATEGORIA",
                "fornecedor": (r.get("txtFornecedor") or "").strip() or None,
                "cnpj_ou_hash": documento,
                "fornecedor_eh_pessoa_fisica": pessoa_fisica,
                "valor_liquido": valor,
                "data_emissao": (r.get("datEmissao") or "")[:10] or None,
                "url_documento": (r.get("urlDocumento") or "").strip() or None,
            }
        )

    return linhas


def conferir_volume(registros: list[dict], ano: int) -> None:
    """Canário: arquivo muito menor que o medido significa layout mudado."""
    if len(registros) < MINIMO_ESPERADO:
        raise RuntimeError(
            f"Só {len(registros)} linhas em Ano-{ano}.csv — esperado ao menos "
            f"{MINIMO_ESPERADO}. O layout do arquivo mudou?"
        )


# ═══════════════════════════════════════════════════════════════════


def _identificar_fornecedor(bruto: str | None) -> tuple[str | None, bool]:
    """Separa CNPJ de CPF e **hasheia o CPF** — a mesma regra de `receitas`.

    🔴 Usa o mesmo hash de `Pessoa.CpfHash`, o que torna os dois lados comparáveis sem
    reverter nenhum deles.
    """
    digitos = "".join(caractere for caractere in (bruto or "") if caractere.isdigit())

    if not digitos:
        return None, False

    if len(digitos) == 11:
        return hash_de_cpf(digitos), True

    return digitos, False


# 🔴 Ponto DECIMAL aqui, o oposto do Portal e do TSE. Usar `valor_pt_br` por engano daria
# um total mil vezes menor, sem erro — o nome importado é o que impede a troca silenciosa.
_decimal = valor_com_ponto


def _inteiro(valor: str | None) -> int:
    try:
        return int(valor or 0)
    except ValueError:
        return 0
