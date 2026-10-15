# Achado 39 — a amostra confere, voto a voto

**Medido em 2026-10-02**, com `py -m poligraph_etl amostra` (semente 2026, 20 votações abertas
com voto por casa e legislatura, da 51ª à 57ª). O resultado, votação por votação, fica em
`.cache/amostra-20261002.csv`; a mesma semente sorteia as mesmas votações.

---

## O que se conferiu

A ETL lê o voto de um canal só por casa. A amostra confere cada voto sorteado contra **outro**
serviço oficial da mesma casa (Pendência 67, `plano/09 §5.3`):

| Casa | Canal da carga | Canal da conferência |
|---|---|---|
| Câmara | `votacoesVotos-{ano}.csv`, em bloco | `/api/v2/votacoes/{id}/votos`, por votação |
| Senado | `/votacao?dataInicio&dataFim` | `/plenario/lista/votacao/{data}`, o serviço antigo |

A comparação é pelo id da pessoa na casa, com o voto normalizado: Sim, Não, abstenção, e
presença sem posição (obstrução, ausência no Senado) como valor próprio.

## Resultado

| Casa | Votações | Votos iguais | Diferenças |
|---|---:|---:|---:|
| Câmara | 127 | 37.789 | **0** |
| Senado | 140 | 11.320 | **0** |

A Câmara da 51ª tem só 7 votações abertas com voto nominal na base, e as 7 entraram. Nenhuma
votação ficou sem resposta do segundo canal.

## O que isso afirma, e o que não

| Afirma | Não afirma |
|---|---|
| A leitura do arquivo, a normalização do voto e a ligação de cada voto à pessoa certa batem com o que a casa publica por outro serviço | Que o acervo do Senado está completo: os dois serviços leem o mesmo acervo, e a lacuna de 2015–2016 (achado #37) é dos dois |
| Em 49.109 votos sorteados, nenhum mudou de dono ou de sentido no caminho | Que a polaridade das perguntas está certa: ela é curadoria, e tem o teste de regressão próprio (API3) |

ATENÇÃO: o `/plenario/lista/votacao/{data}` do Senado está marcado como descontinuado desde
2026-02-01 e ainda responde. Se sair do ar, a conferência do Senado para; a carga não depende dele.
