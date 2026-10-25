"""O CNPJ de quem assinou cada convênio de emenda — do arquivo completo de convênios do Portal.

O arquivo de emendas traz o convênio com o NOME do convenente, e nome é chave fraca. O
arquivo completo de convênios traz, para o mesmo número, o CNPJ (`CÓDIGO CONVENENTE`), a
situação e o valor liberado. A ligação é pelo número do convênio — chave forte — e o CNPJ
leva o convênio à página da entidade.

| | |
|---|---|
| Fonte | `convenios/AAAAMMDD` no Portal — um retrato por data, não todo dia |
| Tamanho | ~67 MB (2026-09-18); lido em fluxo, só as linhas dos convênios que já temos |

MEDIDO: Medido em 2026-09-25 (retrato de 2026-09-18): 16.872 de 16.872 convênios de emenda
achados; 8.036 CNPJs, 8.033 deles com página de entidade.

ATENÇÃO: O retrato não sai todo dia: `ultimo_retrato` procura para trás a partir de hoje.
"""

import csv
import io
import zipfile
from datetime import date, timedelta
from pathlib import Path

import requests

from ..nucleo import normalizacao
from ..fontes import portal
from ..nucleo.tipos import digitos

RECURSO = "convenios/{data}"
CDN = "https://dadosabertos-download.cgu.gov.br/PortalDaTransparencia/saida/convenios/{data}_Convenios.zip"
DIAS_PARA_TRAS = 30


def ultimo_retrato(hoje: date | None = None) -> str:
    """A data (`AAAAMMDD`) do retrato mais recente publicado, procurando até 30 dias atrás.

    ATENÇÃO: `GET` com `Range`, não `HEAD`: o CDN do Portal responde 403 ao `HEAD` mesmo quando o
    arquivo existe.
    """
    dia = hoje or date.today()
    for _ in range(DIAS_PARA_TRAS):
        data = dia.strftime("%Y%m%d")
        try:
            resposta = requests.get(
                CDN.format(data=data), headers={**portal.CABECALHOS, "Range": "bytes=0-100"}, timeout=30
            )
            if resposta.status_code in (200, 206):
                return data
        except requests.RequestException:
            pass
        dia -= timedelta(days=1)
    raise RuntimeError(f"Nenhum retrato de convênios nos últimos {DIAS_PARA_TRAS} dias — o Portal mudou o endereço?")


def ler(arquivo_zip: Path, numeros: set[str]) -> list[dict]:
    """As linhas de `convenios` a atualizar: só os números que já estão no banco.

    O CNPJ só entra com 14 dígitos: convenente pessoa física ou órgão sem CNPJ fica nulo.

    ATENÇÃO: O arquivo repete alguns números (3 em 2026-09-18): vale a última linha, uma por convênio.
    """
    linhas: dict[str, dict] = {}
    with zipfile.ZipFile(arquivo_zip) as zf:
        membro = next(m for m in zf.namelist() if m.endswith("_Convenios.csv"))
        with zf.open(membro) as bruto:
            for r in csv.DictReader(io.TextIOWrapper(bruto, encoding="latin-1", newline=""), delimiter=";"):
                numero = (r.get("NÚMERO CONVÊNIO") or "").strip()
                if numero not in numeros:
                    continue
                codigo = digitos(r.get("CÓDIGO CONVENENTE"))
                linhas[numero] = {
                    "numero": numero,
                    "cnpj_convenente": codigo if len(codigo) == 14 else None,
                    "situacao": (r.get("SITUAÇÃO CONVÊNIO") or "").strip() or None,
                    "valor_liberado": normalizacao.valor_pt_br(r.get("VALOR LIBERADO")),
                }
    return list(linhas.values())
