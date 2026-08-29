import { useMemo, useState } from 'react';
import type { ArestaDoGrafo, NoDoGrafo } from '../api';

/** Quantos vizinhos por parlamentar. Além disto a lista vira ruído. */
const VIZINHOS = 5;

/**
 * O grafo dito em palavras.
 *
 * 🔴 **Um `<canvas>` com `role="img"` é um beco sem saída.** O leitor de tela anuncia
 * "Grafo de 643 parlamentares e 5.212 ligações" e ⛔ não há mais nada: ⛔ não dá para
 * percorrer, ⛔ não dá para saber quem está perto de quem. O desenho inteiro fica
 * inacessível, e a informação que ele carrega ⛔ não existe em nenhum outro lugar da
 * página.
 *
 * ⭐ Esta lista é a MESMA informação em DOM navegável: quem vota junto com quem, na
 * ordem em que o desenho os aproxima. ⛔ Não é resumo nem versão reduzida — é o mesmo
 * dado, e por isso serve também a quem enxerga e prefere ler a garimpar pontos.
 *
 * ⚠️ Só monta a lista quando ABERTA. Com 643 parlamentares e cinco vizinhos cada, são
 * milhares de elementos; construí-los fechados custaria em toda renderização do grafo.
 */
export function ListaDoGrafo({
  nos,
  arestas,
  aoSelecionar,
}: {
  nos: NoDoGrafo[];
  arestas: ArestaDoGrafo[];
  aoSelecionar?: (no: NoDoGrafo) => void;
}) {
  const [aberta, setAberta] = useState(false);

  const linhas = useMemo(() => {
    if (!aberta) return [];

    const porId = new Map(nos.map((n) => [n.id, n]));
    const vizinhos = new Map<number, { no: NoDoGrafo; peso: number }[]>();

    const juntar = (de: number, para: number, peso: number) => {
      const outro = porId.get(para);
      if (!outro) return;

      const lista = vizinhos.get(de) ?? [];
      lista.push({ no: outro, peso });
      vizinhos.set(de, lista);
    };

    for (const a of arestas) {
      juntar(a.de, a.para, a.peso);
      juntar(a.para, a.de, a.peso);
    }

    return nos
      .map((no) => ({
        no,
        // ⚠️ Ordena por peso, ⛔ não por nome: a ordem É a informação — quem aparece
        //    primeiro é quem mais votou junto, que é o que o desenho mostra pela
        //    proximidade.
        proximos: (vizinhos.get(no.id) ?? [])
          .sort((a, b) => b.peso - a.peso)
          .slice(0, VIZINHOS),
      }))
      // Quem tem mais ligações primeiro — a mesma regra que dita o tamanho do ponto.
      .sort((a, b) => b.proximos.length - a.proximos.length);
  }, [aberta, nos, arestas]);

  return (
    <details
      className="grafo-lista"
      onToggle={(e) => setAberta((e.currentTarget as HTMLDetailsElement).open)}
    >
      <summary>Ver o grafo como lista</summary>

      <p className="ajuda">
        A mesma informação do desenho, em texto: cada parlamentar seguido de quem mais
        votou junto com ele. ⛔ Não há ordem política nenhuma nesta lista — quem aparece
        primeiro é apenas quem tem mais ligações.
      </p>

      <ul className="lista-grafo">
        {linhas.map(({ no, proximos }) => (
          <li key={no.id}>
            {aoSelecionar ? (
              <button type="button" className="lista-grafo-nome" onClick={() => aoSelecionar(no)}>
                {no.nome}
              </button>
            ) : (
              <span className="lista-grafo-nome">{no.nome}</span>
            )}

            {/* 🔴 "comparáveis", ⛔ não "votações". 📐 Medido em 2026-08-29: este
                número é, em média, METADE do que a lista de parlamentares mostra para a
                mesma pessoa — Sargento Fahur aparece com 1.134 lá e 559 aqui. Os dois
                estão certos e contam coisas diferentes: lá é votação registrada, aqui
                são as que entram na comparação (⛔ fora as procedimentais, que pesam
                zero). ⛔ Com a mesma palavra nos dois lugares o leitor conclui que um
                deles erra. */}
            <span className="lista-grafo-filiacao">
              {no.partido}
              {no.uf && ` · ${no.uf}`} · {no.nVotacoes} votações comparáveis
            </span>

            {proximos.length === 0 ? (
              /* ⚠️ Achado #27: quem votou pouco demais ⛔ não tem par comparável, e no
                 desenho aparece solto na borda sem explicação nenhuma. */
              <span className="lista-grafo-sem-par">
                sem ligações — precisa de ao menos 20 votações em comum com alguém
              </span>
            ) : (
              <span className="lista-grafo-vizinhos">
                vota junto com {proximos.map((v) => v.no.nome).join(', ')}
              </span>
            )}
          </li>
        ))}
      </ul>
    </details>
  );
}
