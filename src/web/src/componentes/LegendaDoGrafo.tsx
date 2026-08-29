import { useMemo } from 'react';
import type { Grafo } from '../api';
import { montarLegenda, type FaixaDaLegenda } from './grafo/legenda';

/**
 * O que a figura mostra, em português comum.
 *
 * ## Para quem isto é escrito
 *
 * Para quem nunca ouviu falar em grafo, comunidade ou orientação de bancada. ⛔ Sem
 * percentual solto, ⛔ sem coeficiente, ⛔ sem jargão: "97 de cada 100 votações" no lugar
 * de "governismo médio 0,973".
 *
 * ## 🔴 Duas coisas que ela ⛔ não pode deixar de dizer
 *
 * 1. **⛔ Não é esquerda e direita política.** É alinhamento com ESTE governo, e o lado
 *    da tela é arbitrário — espelhar a figura ⛔ não mudaria nada.
 * 2. **O meio ⛔ não é moderação.** Medido: dos 80 mais centrais, 69 são claramente de
 *    um lado. O centro cai dentro do bloco maior porque a nuvem ⛔ não é simétrica.
 *
 * ⭐ Os números vêm do próprio desenho, ⛔ nunca escritos à mão — ver `grafo/legenda.ts`.
 */
export function LegendaDoGrafo({ grafo }: { grafo: Grafo }) {
  const legenda = useMemo(() => montarLegenda(grafo.nos), [grafo.nos]);

  if (!legenda) return null;

  return (
    <section className="legenda-grafo">
      <h3>Como ler este desenho</h3>

      <p className="legenda-regra">
        Cada ponto é um parlamentar. Dois pontos se ligam quando votaram parecido — e{' '}
        <strong>quanto mais votam junto, mais perto ficam</strong>. Ninguém escolheu
        onde cada um fica: a posição sai do voto.
      </p>

      {legenda.temAlinhamento && (
        <>
          <ul className="legenda-faixas">
            {legenda.faixas.map((faixa) => (
              <li key={faixa.chave}>
                <Faixa faixa={faixa} />
              </li>
            ))}
          </ul>

          {/* 🔴 As duas ressalvas obrigatórias. Sem elas o leitor lê espectro político
              numa figura que ⛔ não mede isso. */}
          <p className="legenda-ressalva">
            <strong>Isto não é esquerda e direita.</strong> O que separa os lados é
            votar ou não votar como o Governo pediu — e um parlamentar troca de lado na
            eleição seguinte sem mudar nenhuma opinião. Os lados da tela também são
            arbitrários: espelhar a figura não mudaria nada.
          </p>

          <p className="legenda-ressalva">
            <strong>As cores não são partido nem lado.</strong> Elas só marcam grupos de
            quem vota junto, e o número de cada grupo é apenas um rótulo.
          </p>
        </>
      )}

      {!legenda.temAlinhamento && (
        <p className="legenda-ressalva">
          Nesta casa o desenho não tem lados com nome: o Senado não publica a orientação
          das bancadas, então não há como dizer o que separa um lado do outro.
        </p>
      )}
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════

function Faixa({ faixa }: { faixa: FaixaDaLegenda }) {
  const emCada100 = faixa.governismo === null ? null : Math.round(faixa.governismo * 100);

  return (
    <>
      <b>
        {faixa.onde} <small>{faixa.quantos} parlamentares</small>
      </b>
      <p>{descrever(faixa, emCada100)}</p>
    </>
  );
}

/**
 * A frase de cada faixa.
 *
 * ⚠️ O texto é fixo, os NÚMEROS vêm do desenho. O contrário — número no texto — é o que
 * apodrece na primeira reexecução.
 */
function descrever(faixa: FaixaDaLegenda, emCada100: number | null): string {
  const votou =
    emCada100 === null
      ? ''
      : `Votaram como o Governo pediu em ${emCada100} de cada 100 votações. `;

  switch (faixa.chave) {
    case 'lado-a':
      return `${votou}É o bloco mais fechado do desenho: quase sempre juntos, quase sempre com o Governo.`;

    case 'centro':
      // 🔴 A correção mais importante desta legenda. A versão anterior da interface
      //    dizia que no centro estava quem faltou muito — e a medição mostra o
      //    contrário: quem faltou está na PONTA, e o centro é o parlamentar típico.
      return (
        `${votou}Estes não são os "moderados". A maioria também vota com o Governo — ` +
        `eles estão no meio porque são o parlamentar comum, e a maior parte da Casa ` +
        `vota assim. O meio do desenho é onde está a maioria, não onde está o meio-termo.`
      );

    case 'lado-b':
      return `${votou}É o lado que mais vota contra o que o Governo pede.`;

    case 'bordas':
      return (
        `Quase não votaram — ${faixa.votacoes} votações, contra centenas dos demais. ` +
        `São suplentes e quem assumiu por poucas semanas. O desenho empurra para fora ` +
        `quem não teve votações suficientes para ser comparado com alguém.`
      );
  }
}
