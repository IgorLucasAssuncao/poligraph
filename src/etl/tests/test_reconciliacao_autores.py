"""PL47 — as duas regras que tiram autor de emenda do limbo.

🔴 **A hipótese antiga era outra.** A PL47 registrava que o `nomeAutor` do Portal usaria
variação de grafia que a igualdade exata ⛔ não alcançaria. Medido em 2026-08-29: dos 106
deputados sem emenda, **zero** tinham o nome esperando um casamento mais frouxo, e dos
169 autores pendentes, **zero** casariam com uma pessoa só. O casamento automático estava
**correto** — o problema era outro, e eram dois.
"""

from poligraph_etl.__main__ import _desempatar
from poligraph_etl.emendas import autor_original

# ═══════════════════════════════════════════════════════════════════
# 🔴 REGRA B — o Portal renomeia o autor para o SUCESSOR
# ═══════════════════════════════════════════════════════════════════

SUCESSOR = (
    "TIAGO DIMAS (EX-PARLAMENTAR LAZARO BOTELHO, NOS TERMOS ART. 78 LDO 2025 "
    "E DA MENSAGEM 95-CN, DE 06.11.25)"
)


def test_extrai_o_nome_de_quem_apresentou():
    """⭐ A emenda é de quem APRESENTOU, ⛔ não de quem executa.

    Quando o parlamentar deixa o mandato, o suplente executa a emenda dele e o Portal
    passa a escrever assim. Como `registrar_autores` atualiza o nome a cada ano, o do
    sucessor vence — e o registro ⛔ não casa com ninguém.

    📐 Medido: **14** autores pendentes trazem o padrão; em **12** o nome extraído casa
    com exatamente um deputado da 57ª — 229 emendas, R$ 656 mi.
    """
    assert autor_original(SUCESSOR) == "LAZARO BOTELHO"


def test_nome_comum_nao_e_tocado():
    """⛔ Quem ⛔ não tem o padrão segue pelo caminho normal."""
    assert autor_original("LAZARO BOTELHO") is None


def test_ausencia_de_nome_nao_estoura():
    assert autor_original(None) is None
    assert autor_original("") is None


def test_o_padrao_e_da_fonte_nao_uma_adivinhacao():
    """⭐ ⛔ ⛔ Não é similaridade: o Portal escreve o rótulo com a base legal junto.

    ⚠️ Por isso a extração exige o literal `EX-PARLAMENTAR` — parêntese com qualquer
    outra coisa dentro ⛔ não vira palpite.
    """
    assert autor_original("FULANO (SUPLENTE DE BELTRANO)") is None
    assert autor_original("COMISSAO DE ORCAMENTO (RELATOR GERAL)") is None


# ═══════════════════════════════════════════════════════════════════
# 🔴 REGRA A — o homônimo histórico manufatura ambiguidade
# ═══════════════════════════════════════════════════════════════════


def test_candidato_unico_passa_direto():
    assert _desempatar([7], com_voto=set()) == 7


def test_sem_candidato_nao_resolve():
    assert _desempatar([], com_voto={1, 2}) is None


def test_homonimo_sem_voto_nao_disputa():
    """🔴 O empate que ⛔ não existe na realidade.

    📐 Medido em 2026-08-29, em 14 casos: *Bebeto* (Carlos Roberto Rodrigues, 1.117
    votos) empatava com um *BEBETO* de outra legislatura (Adalberto Souza Galvão, **0
    votos**). ⭐ Quem ⛔ não tem voto nenhum na base ⛔ não aparece em tela nenhuma — e ⛔
    não é o autor de emenda de 2024.
    """
    assert _desempatar([66, 965], com_voto={66}) == 66


def test_ambiguidade_real_continua_sem_vinculo():
    """⚠️ E **deve** continuar.

    `ÁTILA DE MELO LIRA` e `ÁTILA FREITAS LIRA` são duas pessoas, com ids distintos na
    Câmara. Se as duas têm voto, o desempate ⛔ desiste — a saída é o `--resolver`.
    """
    assert _desempatar([59, 666], com_voto={59, 666}) is None


def test_nenhum_dos_homonimos_tem_voto():
    """⛔ Sem sinal nenhum, ⛔ não escolhe. Chutar congelaria o erro no banco."""
    assert _desempatar([100, 200], com_voto=set()) is None


def test_tres_candidatos_com_um_so_votante():
    """⭐ A regra é "sobra exatamente um com voto", ⛔ não "são só dois"."""
    assert _desempatar([1, 2, 3], com_voto={2}) == 2


def test_tres_candidatos_com_dois_votantes():
    assert _desempatar([1, 2, 3], com_voto={2, 3}) is None
