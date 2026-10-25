"""Sincroniza `mapa_do_sistema.html` com o código: o modelo do banco e as rotas da API.

Uso, da raiz do repositório:

    py infra/mapa/atualizar.py

| Parte do mapa | De onde sai | Como |
|---|---|---|
| `const MODELO` (tabelas, colunas, CHECK, FK) | snapshot das migrations do EF | `modelo_do_banco.py`, automático |
| `const ROTAS` (rota, proteção, tabelas lidas e gravadas, código) | `src/api/Poligraph.Api` | `rotas_da_api.py`, automático |
| Fontes, comandos, etapas, entradas e saídas da ETL | conhecimento da fonte | à mão, no próprio HTML |

DECISÃO (autor, 2026-10-09): o mapa é o documento central, e toda mudança de fonte, comando,
tabela ou rota chega a ele no mesmo commit. A parte que dá para ler do código é gerada aqui, para
a regra não depender de memória.

ATENÇÃO: tabela nova precisa de lugar em `GRUPOS_DO_MODELO` e `PAPEL`, e rota nova em
`GRUPOS_DE_ROTAS`; o script falha e diz o que ficou sem grupo.
"""

import json
import re
import runpy
from pathlib import Path

PASTA = Path(__file__).resolve().parent
MAPA = PASTA.parents[1] / "mapa_do_sistema.html"

QUEBRA = chr(10)


def gerar(script: str, saida: str) -> list:
    """Roda o extrator e devolve o JSON que ele grava ao lado."""
    runpy.run_path(str(PASTA / script))
    caminho = PASTA / saida
    dados = json.loads(caminho.read_text(encoding="utf-8"))
    caminho.unlink()
    return dados


def trocar_linha(html: str, constante: str, dados: list) -> str:
    """Troca a linha `const NOME = [...];` inteira pelo JSON novo."""
    padrao = re.compile(rf"^const {constante} = .*;$", re.MULTILINE)
    if not padrao.search(html):
        raise SystemExit(f"const {constante} não está no mapa em uma linha só.")
    return padrao.sub(lambda _: f"const {constante} = {json.dumps(dados, ensure_ascii=False)};", html, count=1)


def sem_grupo(html: str, constante: str, nomes: list[str]) -> list[str]:
    """Os nomes que não aparecem no bloco da constante: como texto numa lista, ou como chave de objeto."""
    inicio = html.index(f"const {constante}")
    eh_objeto = html[inicio:].split("=", 1)[1].lstrip().startswith("{")
    fim = html.index(QUEBRA + "}", inicio) if eh_objeto else html.index("];", inicio)
    bloco = html[inicio:fim]
    return [nome for nome in nomes if f"'{nome}'" not in bloco and f"{QUEBRA}  {nome}:" not in bloco]


def principal() -> None:
    modelo = gerar("modelo_do_banco.py", "modelo_do_banco.json")
    rotas = gerar("rotas_da_api.py", "rotas.json")

    html = MAPA.read_text(encoding="utf-8")
    html = trocar_linha(html, "MODELO", modelo)
    html = trocar_linha(html, "ROTAS", rotas)
    MAPA.write_text(html, encoding="utf-8", newline="\n")

    print(f"Mapa atualizado: {len(modelo)} tabelas, {len(rotas)} rotas.")
    sem_lugar = []
    for constante, nomes in (("GRUPOS_DO_MODELO", [t["tabela"] for t in modelo]),
                             ("PAPEL", [t["tabela"] for t in modelo]),
                             ("GRUPOS_DE_ROTAS", sorted({r["arquivo"] for r in rotas}))):
        faltam = sem_grupo(html, constante, nomes)
        if faltam:
            sem_lugar.append(f"sem lugar em {constante}: {', '.join(faltam)}")
    if sem_lugar:
        raise SystemExit("O mapa não desenha nó sem lugar, e para de desenhar no primeiro."
                         + QUEBRA + QUEBRA.join(sem_lugar))


if __name__ == "__main__":
    principal()
