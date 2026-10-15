"""CONTRATOS — o que entra de cada fonte e o que sai para cada tabela.

Toda carga tem três partes, e cada uma tem lugar próprio:

| Parte | O que é | Onde |
|---|---|---|
| Entrada | A linha como a fonte publica: um campo por coluna lida, com o nome da coluna no arquivo | `contratos/<fonte>.py` |
| Transformação | Uma função pura que leva a linha de entrada à linha do banco, ou a um descarte com motivo | o módulo do assunto (`cota.py`) |
| Saída | A linha como fica no banco: os campos são as colunas da tabela que o EF cria | `contratos/banco.py` |

DECISÃO: a entrada guarda o texto como a fonte mandou (sem espaço nas pontas, vazio vira
`None`). Converter número, data e documento é transformação: é ali que mora a regra de
decimal com ponto ou vírgula, e ela precisa estar num lugar só.

DECISÃO: o descarte é um valor, não um `continue`. A reconciliação (regra 5 do projeto)
soma o que ficou fora pelo motivo que a transformação deu; antes, a mesma regra de descarte
era escrita duas vezes, uma para gravar e outra para reconciliar.

RISCO: coluna que some do arquivo derruba a carga com `LayoutMudou`. Ler `None` em silêncio
gravaria a despesa sem fornecedor, ou sem dono, e o número sairia plausível e errado.
"""
