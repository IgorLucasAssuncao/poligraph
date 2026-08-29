"""ANÁLISE — candidatas a pergunta do questionário.

Não escreve pergunta: **ordena e instrui**. Escrever a afirmação em linguagem leiga é
leitura humana de ementa por ementa (PL11), e o que este módulo faz é reduzir o universo
de centenas de votações às poucas dezenas que valem a leitura.

## ENTRADA

Tabelas `votacoes`, `votos` e `proposicoes` de uma casa e legislatura.

⭐ A **ementa** vem de `proposicoes`, ligada por `votacoes.proposicao_id`. Sem ela a
curadoria lê só a descrição da votação, que ⛔ não diz sobre o que a matéria é.

## CRITÉRIO

Uma boa pergunta discrimina. Votação em que todos votaram igual não separa ninguém, e
ocupa uma das 15 a 25 posições do questionário sem devolver informação.

| Filtro | Por quê |
|---|---|
| Aberta e de plenário | Sem voto individual não há como comparar |
| `SUBSTANTIVA` | Requerimento é rito, não posição. Destaque inverte a polaridade |
| Mínimo de votos | Sessão esvaziada não representa a casa |
| Ordenado por **divisão** | `min(sim, não) / total` — 50% é o máximo possível |

## SAÍDA

Uma lista para leitura humana. **Não grava pergunta**, e é de propósito: a polaridade é
o campo mais perigoso do sistema, e atribuí-la automaticamente é exatamente o erro que
o projeto persegue.

---

A polaridade sugerida é **auxílio**, nunca decisão. A regra vem do texto da descrição:
voto no texto principal (*"nos termos do parecer"*) é `+1`; *"Mantido o texto"* é `-1`,
porque quem votou Sim quis manter, ou seja, votou contra a supressão proposta.
"""

from dataclasses import dataclass

import psycopg

from .normalizacao import inferir_polaridade

# Abaixo disto a sessão estava esvaziada e o resultado não representa a casa. O Senado
# tem 81 cadeiras e mediana de 64 votantes por votação; a Câmara, 513.
MINIMO_DE_VOTOS = {"SENADO": 40, "CAMARA": 250}


@dataclass(frozen=True)
class Candidata:
    votacao_id: str
    data: str
    descricao: str
    sim: int
    nao: int
    polaridade_sugerida: int

    # ⭐ A EMENTA — é ela que torna a leitura humana possível.
    #
    # 🔴 A `descricao` diz o NÚMERO do projeto e ⛔ não diz sobre o que ele é:
    # *"Aprovado o Substitutivo ao Projeto de Lei Complementar nº 80, de 2026, adotado
    # pelo relator da Comissão de…"*. Escrever pergunta em linguagem leiga a partir
    # disso é adivinhação — e a PL11 é o maior bloqueio do projeto.
    #
    # ⚠️ Nula em 3 das 266 substantivas da 57ª (98,9% têm) — ver achado sobre PL40.
    ementa: str | None = None

    @property
    def divisao(self) -> float:
        """`min(sim, não) / total` — 0,5 é o máximo, e significa casa dividida ao meio."""
        total = self.sim + self.nao

        return min(self.sim, self.nao) / total if total else 0.0


def candidatas(
    conexao: psycopg.Connection, casa: str, legislatura: int, limite: int = 40
) -> list[Candidata]:
    """As votações mais divididas que sobrevivem aos filtros, da mais dividida à menos."""
    minimo = MINIMO_DE_VOTOS.get(casa, 40)

    linhas = conexao.execute(
        """
        SELECT vt.id, vt.data, vt.descricao, p.ementa,
               count(*) FILTER (WHERE v.valor = 1)  AS sim,
               count(*) FILTER (WHERE v.valor = -1) AS nao
          FROM votacoes vt
          JOIN votos v ON v.votacao_id = vt.id
          -- 🔴 `AND p.casa = vt.casa` ⛔ NÃO é redundante com a chave estrangeira.
          --    A FK garante que o VÍNCULO seja da mesma casa; ligar apenas por `id`
          --    leria a linha errada assim mesmo, porque as duas fontes numeram no
          --    mesmo espaço e as faixas se sobrepõem. A curadoria mostraria a ementa
          --    de um projeto da Câmara ao lado de uma votação do Senado.
          LEFT JOIN proposicoes p
                 ON p.id = vt.proposicao_id AND p.casa = vt.casa
         WHERE vt.casa = %s
           AND vt.legislatura = %s
           AND vt.plenario
           AND NOT vt.secreta
           AND vt.categoria = 'SUBSTANTIVA'
           AND v.valor IN (1, -1)
         GROUP BY vt.id, vt.data, vt.descricao, p.ementa
        HAVING count(*) >= %s
        """,
        (casa, legislatura, minimo),
    ).fetchall()

    achadas = [
        Candidata(
            votacao_id=vid,
            data=str(data),
            descricao=descricao or "",
            sim=sim,
            nao=nao,
            polaridade_sugerida=inferir_polaridade(descricao),
            ementa=ementa,
        )
        for vid, data, descricao, ementa, sim, nao in linhas
    ]

    return sorted(achadas, key=lambda c: c.divisao, reverse=True)[:limite]


def ja_curadas(conexao: psycopg.Connection) -> set[str]:
    """As votações que já viraram pergunta — para não sugerir duas vezes a mesma."""
    return {
        linha[0]
        for linha in conexao.execute("SELECT votacao_id FROM perguntas").fetchall()
    }
