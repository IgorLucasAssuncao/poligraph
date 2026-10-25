import { useCarga } from '../componentes/useCarga';
import { useLegislaturas } from '../componentes/useLegislatura';
import { BaseComponent } from '../componentes/BaseDoCongresso';
import { NOME_DA_CASA, obterMetodologia, obterPanorama, type CasaNaMetodologia, type Metodologia as DadosDaMetodologia, type Panorama } from '../api';
import { LinkDeFonteComponent } from '../componentes/LinkDeFonte';
import { FONTES } from '../fontes';
import { EsqueletoDeTextoComponent } from '../componentes/Esqueleto';
import { TEXTOS_DA_METODOLOGIA as T } from '../textos/metodologia';

/**
 * "Como calculamos" — o método, com os parâmetros que o cálculo usou.
 *
 * RISCO: **Nenhum número desta página é escrito à mão.** O questionário e a afinidade vêm
 * das constantes da API, que são as que calculam; o grafo vem da execução do ETL que o
 * desenhou, que grava os próprios parâmetros. Um "10 vizinhos" digitado aqui continuaria
 * na tela depois de o ETL passar a usar 12.
 *
 * DECISÃO: Pública, como a política de privacidade: não mostra dado de ninguém, e é a página
 * que a banca e quem desconfia do site precisam ler antes de entrar.
 */
export function MetodologiaComponent() {
  const { dados, erro } = useCarga(['metodologia'], obterMetodologia);
  const panorama = useCarga(['panorama', null], () => obterPanorama());
  const pronto = dados && (panorama.dados || panorama.erro);

  return (
    <article className="documento-legal metodologia">
      <h1>{T.titulo}</h1>
      <p className="ajuda">{T.abertura}</p>

      {erro && <p className="erro">{T.erro}</p>}
      {!erro && !pronto && <EsqueletoDeTextoComponent rotulo={T.carregando} paragrafos={3} />}
      {dados && pronto && <ConteudoComponent dados={dados} panorama={panorama.dados ?? null} />}
    </article>
  );
}

/**
 * DECISÃO (2026-10-24): espera o panorama junto com a metodologia. Desenhado à parte, o bloco da base (759 px no tablet)
 * entrava no meio da página depois do resto e empurrava "O questionário": CLS de 0,155 a 768 px.
 */
function ConteudoComponent({ dados, panorama }: { dados: DadosDaMetodologia; panorama: Panorama | null }) {
  const { questionario: q, afinidade, casas } = dados;
  const oferecidas = q.perguntasDaCamara + q.perguntasDoSenado;
  const legislatura = casas[0]?.legislatura;
  const maisAntiga = useLegislaturas()?.at(-1);

  return (
    <>
      <h2>{T.dados.titulo}</h2>
      <p>{T.dados.votos(legislatura)}</p>
      <ul>
        {casas.map((c) => (
          <li key={c.casa}>
            {T.dados.casa(NOME_DA_CASA[c.casa].nome, c.votacoes, c.votacoesSecretas)}
            <LinkDeFonteComponent href={c.casa === 'SENADO' ? FONTES.senado.url : FONTES.camara.url}>
              {T.dados.dadosAbertos}
            </LinkDeFonteComponent>
          </li>
        ))}
      </ul>
      <p>{T.dados.dinheiro}</p>
      {panorama && <BaseComponent panorama={panorama} />}

      <h2>{T.questionario.titulo}</h2>
      <p>{T.questionario.oferecidas(oferecidas, q.perguntasDaCamara, q.perguntasDoSenado)}</p>
      <ul>
        <li>{T.questionario.abertura(q.aberturaDaCamara, q.desempateDaCamara)}</li>
        <li>{T.questionario.polaridade}</li>
        <li>{T.questionario.minimo(Math.round(q.fracaoMinimaDeRespostas * 100), q.minimoDeRespostas, oferecidas)}</li>
        <li>{T.questionario.painel}</li>
      </ul>

      <h2>{T.afinidade.titulo}</h2>
      <ul>
        <li>{T.afinidade.comparaveis}</li>
        <li>{T.afinidade.base}</li>
        <li>{T.afinidade.casas(afinidade.quantidadeExibida)}</li>
        <li>{T.afinidade.grafo(afinidade.vizinhosParaPosicionar)}</li>
        <li>{T.afinidade.naoERecomendacao}</li>
      </ul>

      <h2>{T.grafo.titulo}</h2>
      <p>{T.grafo.abertura}</p>
      <TabelaDoGrafoComponent casas={casas} />
      <ul>
        <li>{T.grafo.rito}</li>
        <li>{T.grafo.grupos}</li>
        <li>{T.grafo.solto}</li>
      </ul>

      <h2>{T.naoFaz.titulo}</h2>
      <ul>
        {T.naoFaz.itens.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>

      <h2>{T.limites.titulo}</h2>
      <ul>
        <li>{T.limites.historico(maisAntiga)}</li>
        {T.limites.itens.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </>
  );
}

/** Os parâmetros da execução que desenhou cada grafo — "—" quando a execução é anterior ao registro. */
function TabelaDoGrafoComponent({ casas }: { casas: CasaNaMetodologia[] }) {
  const R = T.tabela;
  const numero = (valor: number | null, casas = 0) =>
    valor === null ? R.semRegistro : valor.toLocaleString('pt-BR', { maximumFractionDigits: casas, minimumFractionDigits: casas });

  return (
    <div className="tabela-rolavel">
      <table className="tabela-orcamento">
        <caption className="sr-apenas">{R.legenda}</caption>
        <thead>
          <tr>
            <th scope="col">{R.parametro}</th>
            {casas.map((c) => (
              <th key={c.casa} scope="col">{NOME_DA_CASA[c.casa].nome}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">{R.merito}</th>
            {casas.map((c) => <td key={c.casa}>1</td>)}
          </tr>
          <tr>
            <th scope="row">{R.destaque}</th>
            {casas.map((c) => <td key={c.casa}>{numero(c.pesoDestaque, 1)}</td>)}
          </tr>
          <tr>
            <th scope="row">{R.autoridade}</th>
            {casas.map((c) => <td key={c.casa}>{numero(c.pesoAutoridade, 1)}</td>)}
          </tr>
          <tr>
            <th scope="row">{R.recencia}</th>
            {casas.map((c) => <td key={c.casa}>{numero(c.razaoRecencia, 2)}</td>)}
          </tr>
          <tr>
            <th scope="row">{R.minimo}</th>
            {casas.map((c) => <td key={c.casa}>{numero(c.minimoVotacoesComuns)}</td>)}
          </tr>
          <tr>
            <th scope="row">{R.vizinhos}</th>
            {casas.map((c) => <td key={c.casa}>{numero(c.vizinhosPorNo)}</td>)}
          </tr>
          <tr>
            <th scope="row">{R.concluida}</th>
            {casas.map((c) => (
              <td key={c.casa}>
                {c.analiseConcluidaEm ? new Date(c.analiseConcluidaEm).toLocaleDateString('pt-BR') : R.semRegistro}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
