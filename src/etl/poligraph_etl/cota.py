"""Cota parlamentar (CEAP) — a despesa de gabinete de cada deputado.

⚠️ **A API não serve.** `GET /deputados/{id}/despesas?ano=` responde **200** e devolve
`"dados": []` para todo deputado e todo ano testado. O dado existe só no arquivo em
bloco — e ele fica **fora** de `dadosabertos.camara.leg.br`:

    https://www.camara.leg.br/cotas/Ano-{ano}.csv.zip

⭐ **Liga a `pessoas` por `ideCadastro`**, que é o mesmo id da Câmara já usado em
`pessoa_fonte_ids`. A ligação sai de graça — foi o critério que o autor deu: *o que não
se associa ao perfil do político não entra*.

🔴 **`txtCNPJCPF` mistura CNPJ e CPF.** Fornecedor pessoa jurídica traz CNPJ; pessoa
física traz **CPF em claro**. A RNF-13 proíbe guardar CPF assim.
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

# ⚠️ Medido em 2025: 209.176 linhas, das quais 99,6% com `ideCadastro`. Serve de canário
#    — se cair muito abaixo, o layout mudou.
MINIMO_ESPERADO = 50_000


def baixar(ano: int, destino: Path) -> Path:
    """⚠️ 6,6 MB compactado em 2025. Vale cachear entre execuções."""
    destino.parent.mkdir(parents=True, exist_ok=True)

    resposta = requests.get(URL.format(ano=ano), timeout=300)
    resposta.raise_for_status()
    destino.write_bytes(resposta.content)

    return destino


def ler(caminho: Path) -> list[dict]:
    """Lê o CSV de dentro do ZIP.

    ⚠️ Mesmos parâmetros do resto da Câmara: `;`, aspas, BOM. ⛔ Não reutiliza
    `camara.ler_csv` porque aqui a fonte é ZIP, não CSV solto, e carregar 209 mil linhas
    num DataFrame para depois iterar seria desperdício.
    """
    with zipfile.ZipFile(caminho) as arquivo:
        nome = arquivo.namelist()[0]
        with arquivo.open(nome) as fluxo:
            texto = io.TextIOWrapper(fluxo, encoding="utf-8-sig")

            return list(csv.DictReader(texto, delimiter=";", quotechar='"'))


def para_linhas(registros: list[dict], mapa_pessoas: dict[str, int]) -> list[dict]:
    """Converte em linhas de `despesas`, descartando o que não liga a um parlamentar.

    ⚠️ O que é descartado, e por quê:

    | Caso | Motivo |
    |---|---|
    | Sem `ideCadastro` | São lideranças e órgãos (0,4% em 2025), ⛔ não pessoas |
    | Fora do de-para | Deputado que a ingestão de pessoas não trouxe |
    | Valor zero | Linha administrativa sem efeito financeiro |

    ⭐ Valor **negativo** é mantido: é estorno, e some-lo importa para o total.
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
    """⭐ Canário: se o arquivo encolher demais, o layout mudou."""
    if len(registros) < MINIMO_ESPERADO:
        raise RuntimeError(
            f"Só {len(registros)} linhas em Ano-{ano}.csv — esperado ao menos "
            f"{MINIMO_ESPERADO}. O layout do arquivo mudou?"
        )


# ═══════════════════════════════════════════════════════════════════


def _identificar_fornecedor(bruto: str | None) -> tuple[str | None, bool]:
    """Separa CNPJ de CPF, e **hasheia o CPF**.

    🔴 RNF-13: CPF ⛔ nunca em claro no banco. CNPJ é dado público de empresa e fica
    legível — sem ele, não dá para cruzar fornecedor entre parlamentares, que é
    justamente a análise que interessa.

    ⚠️ O mesmo hash de `Pessoa.CpfHash`, para que os dois lados possam ser comparados
    sem nunca reverter nenhum dos dois.
    """
    digitos = "".join(c for c in (bruto or "") if c.isdigit())

    if not digitos:
        return None, False

    if len(digitos) == 11:
        # ⭐ Mesmo hash de `Pessoa.CpfHash` — é o que torna os dois lados comparáveis.
        return hash_de_cpf(digitos), True

    return digitos, False


# ⚠️ **Aqui o ponto é DECIMAL** — conferido no arquivo real da CEAP, e é o oposto do
#   Portal e do TSE. Usar `valor_pt_br` por engano daria um total mil vezes menor, sem
#   erro nenhum. O nome da função importada é o que impede a troca silenciosa.
_decimal = valor_com_ponto


def _inteiro(valor: str | None) -> int:
    try:
        return int(valor or 0)
    except ValueError:
        return 0
