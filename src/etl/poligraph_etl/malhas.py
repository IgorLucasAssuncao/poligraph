"""A malha do IBGE para o mapa de emendas — baixada uma vez e servida pelo próprio site.

Uso: `python -m poligraph_etl.malhas --destino ../web/public/malhas`

| Arquivo | Conteúdo | Tamanho (2026-09-25) |
|---|---|---|
| `brasil.json` | As 27 UFs | ~31 KB |
| `{codigo da UF}.json` | Os municípios da UF | 50–200 KB |

DECISÃO: **Servida por nós, não pelo IBGE no navegador.** Pelo mesmo motivo das fontes
auto-hospedadas: cada visita buscando a malha no IBGE entregaria o IP do visitante a
outro serviço, e o mapa pararia quando a API do IBGE parasse.

ATENÇÃO: TopoJSON, não GeoJSON: as fronteiras vizinhas são guardadas uma vez só, e o arquivo
fica um terço do tamanho. A propriedade `codarea` é o código IBGE — a mesma chave forte
de `municipios.codigo_ibge`.
"""

import argparse
import json
from pathlib import Path

import requests

BASE = "https://servicodados.ibge.gov.br/api"
PARAMETROS = "formato=application/json&qualidade=minima"


def ufs() -> list[dict]:
    """As UFs com código IBGE e sigla, da API de localidades do IBGE."""
    resposta = requests.get(f"{BASE}/v1/localidades/estados", timeout=60)
    resposta.raise_for_status()
    return sorted(({"codigo": str(u["id"]), "sigla": u["sigla"]} for u in resposta.json()), key=lambda u: u["codigo"])


def baixar(url: str, destino: Path) -> None:
    resposta = requests.get(url, timeout=120)
    resposta.raise_for_status()
    topologia = resposta.json()
    if topologia.get("type") != "Topology":
        raise RuntimeError(f"{url} não devolveu TopoJSON — o formato da API mudou?")
    destino.write_text(json.dumps(topologia, separators=(",", ":")), encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(prog="poligraph_etl.malhas")
    parser.add_argument("--destino", type=Path, required=True)
    destino = parser.parse_args().destino
    destino.mkdir(parents=True, exist_ok=True)

    lista = ufs()
    baixar(f"{BASE}/v3/malhas/paises/BR?{PARAMETROS}&intrarregiao=UF", destino / "brasil.json")
    for uf in lista:
        baixar(f"{BASE}/v3/malhas/estados/{uf['codigo']}?{PARAMETROS}&intrarregiao=municipio",
               destino / f"{uf['codigo']}.json")
    (destino / "ufs.json").write_text(json.dumps(lista, ensure_ascii=False), encoding="utf-8")
    print(f"{len(lista)} UFs gravadas em {destino}")


if __name__ == "__main__":
    main()
