import { useEffect, useState } from 'react';
import { NOME_DA_CASA, obterMetodologia, type CasaNaMetodologia, type Metodologia as DadosDaMetodologia } from '../api';
import { LinkDeFonte } from '../componentes/LinkDeFonte';
import { FONTES } from '../fontes';
import { EsqueletoDeTexto } from '../componentes/Esqueleto';

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
export function Metodologia() {
  const [dados, setDados] = useState<DadosDaMetodologia | null>(null);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    obterMetodologia()
      .then(setDados)
      .catch(() => setErro(true));
  }, []);

  return (
    <article className="documento-legal metodologia">
      <h1>Como calculamos</h1>
      <p className="ajuda">
        O site compara o que você responde com o voto registrado de cada parlamentar. Os
        números desta página vêm do próprio cálculo: quando um parâmetro muda, ela muda
        junto.
      </p>

      {erro && <p className="erro">Não foi possível carregar os parâmetros agora.</p>}
      {!erro && !dados && <EsqueletoDeTexto rotulo="Carregando a metodologia" paragrafos={3} />}
      {dados && <Conteudo dados={dados} />}
    </article>
  );
}

function Conteudo({ dados }: { dados: DadosDaMetodologia }) {
  const { questionario: q, afinidade, casas } = dados;
  const oferecidas = q.perguntasDaCamara + q.perguntasDoSenado;
  const legislatura = casas[0]?.legislatura;

  return (
    <>
      <h2>De onde vêm os dados</h2>
      <p>
        Os votos são o <strong>registro nominal de plenário</strong>
        {legislatura && <> da {legislatura}ª legislatura</>}: cada deputado e senador, cada
        votação, como a casa publicou.
      </p>
      <ul>
        {casas.map((c) => (
          <li key={c.casa}>
            {NOME_DA_CASA[c.casa].nome}: <strong>{c.votacoes}</strong> votações em plenário
            {c.votacoesSecretas > 0 && (
              <>
                , das quais <strong>{c.votacoesSecretas}</strong> secretas — sem voto individual
                publicado, elas ficam fora de toda comparação
              </>
            )}
            .{' '}
            <LinkDeFonte href={c.casa === 'SENADO' ? FONTES.senado.url : FONTES.camara.url}>
              dados abertos
            </LinkDeFonte>
          </li>
        ))}
      </ul>
      <p>
        O dinheiro vem de outras fontes oficiais: a cota parlamentar, da Câmara e do Senado;
        as emendas, do <LinkDeFonte href={FONTES.emendas.url}>Portal da Transparência</LinkDeFonte>;
        o financiamento de campanha, do{' '}
        <LinkDeFonte href={FONTES.prestacaoDeContas.url}>TSE</LinkDeFonte>. Cada item no site
        tem um link <span aria-hidden="true">↗</span> para a página oficial onde pode ser
        conferido.
      </p>

      <h2>O questionário</h2>
      <p>
        Cada pergunta é uma afirmação sobre uma votação que aconteceu em plenário. Você
        responde <strong>{oferecidas}</strong>: <strong>{q.perguntasDaCamara}</strong> da Câmara
        e <strong>{q.perguntasDoSenado}</strong> do Senado.
      </p>
      <ul>
        <li>
          Da Câmara, <strong>{q.aberturaDaCamara}</strong> são iguais para todos. As outras{' '}
          <strong>{q.desempateDaCamara}</strong> são escolhidas depois, entre as votações que
          separam os parlamentares que ficaram empatados com você.
        </li>
        <li>
          A afirmação é escrita para que concordar corresponda a um voto definido. Em parte
          das votações, concordar é votar <strong>Não</strong>: em 14% das votações nominais,
          "Sim" significa rejeitar. O site trata isso pergunta a pergunta.
        </li>
        <li>
          "Não sei" tira a pergunta da comparação. Para haver resultado, é preciso opinar em{' '}
          {Math.round(q.fracaoMinimaDeRespostas * 100)}% das perguntas oferecidas:{' '}
          <strong>
            {q.minimoDeRespostas} de {oferecidas}
          </strong>
          .
        </li>
        <li>
          Entre uma pergunta e outra aparece quem compareceu à votação, nunca como votou: ver
          o placar faria a maioria pesar na sua próxima resposta.
        </li>
      </ul>

      <h2>A afinidade</h2>
      <ul>
        <li>
          Com cada parlamentar, contam só as perguntas <strong>comparáveis</strong>: em que
          você opinou e ele votou Sim ou Não. Abstenção, ausência e obstrução não entram.
        </li>
        <li>
          O resultado é em quantas delas vocês votaram igual, sempre com a base: "8 de 11",
          nunca um percentual solto.
        </li>
        <li>
          Deputados e senadores são comparados separadamente, porque não votam as mesmas
          matérias. A tela mostra os <strong>{afinidade.quantidadeExibida}</strong> mais
          próximos e os mais distantes de cada casa.
        </li>
        <li>
          No grafo, você é colocado entre os <strong>{afinidade.vizinhosParaPosicionar}</strong>{' '}
          parlamentares com quem mais concordou, e pesa mais quem concordou mais.
        </li>
        <li>
          <strong>Não é recomendação de voto</strong>, e não resume tudo o que um parlamentar
          defende: mede só estas votações.
        </li>
      </ul>

      <h2>O grafo</h2>
      <p>
        Dois parlamentares ficam perto quando votaram igual muitas vezes. A comparação entre
        eles usa a legislatura inteira, com estes pesos:
      </p>
      <TabelaDoGrafo casas={casas} />
      <ul>
        <li>
          Voto de rito (requerimento, adiamento) pesa zero: mede obstrução, e não posição.
        </li>
        <li>
          Os grupos, que dão a cor aos pontos, são encontrados pelo algoritmo de Louvain
          sobre as ligações. Saem do voto, e não do partido: um mesmo partido aparece em
          vários grupos.
        </li>
        <li>
          Um ponto solto na borda não é radical: votou pouco demais para ser comparado com
          alguém.
        </li>
      </ul>

      <h2>O que o site não faz</h2>
      <ul>
        <li>Não recomenda voto.</li>
        <li>Não classifica ninguém como esquerda ou direita, e nenhuma cor tem partido.</li>
        <li>Não dá nota a parlamentar, partido ou governo.</li>
      </ul>

      <h2>Limites conhecidos</h2>
      <ul>
        <li>Só votações de plenário, e só da legislatura corrente.</li>
        <li>
          Sua posição vale sobre as perguntas que você respondeu; a de cada parlamentar,
          sobre a legislatura inteira. A sua é bem menos precisa.
        </li>
        <li>
          Emenda só aparece na ficha quando o código do autor foi ligado a um parlamentar:
          emenda de bancada e de comissão não tem autor pessoa.
        </li>
        <li>
          Os dados de orçamento do governo cobrem o Poder Executivo federal. Em 2025, a
          dotação publicada deixa de fora a parcela condicionada à regra de ouro.
        </li>
      </ul>
    </>
  );
}

/** Os parâmetros da execução que desenhou cada grafo — "—" quando a execução é anterior ao registro. */
function TabelaDoGrafo({ casas }: { casas: CasaNaMetodologia[] }) {
  const numero = (valor: number | null, casas = 0) =>
    valor === null ? '—' : valor.toLocaleString('pt-BR', { maximumFractionDigits: casas, minimumFractionDigits: casas });

  return (
    <div className="tabela-rolavel">
      <table className="tabela-orcamento">
        <caption className="sr-apenas">Parâmetros do grafo por casa</caption>
        <thead>
          <tr>
            <th scope="col">Parâmetro</th>
            {casas.map((c) => (
              <th key={c.casa} scope="col">{NOME_DA_CASA[c.casa].nome}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">Voto de mérito</th>
            {casas.map((c) => <td key={c.casa}>1</td>)}
          </tr>
          <tr>
            <th scope="row">Voto em destaque (um trecho)</th>
            {casas.map((c) => <td key={c.casa}>{numero(c.pesoDestaque, 1)}</td>)}
          </tr>
          <tr>
            <th scope="row">Voto em autoridade (em pessoa)</th>
            {casas.map((c) => <td key={c.casa}>{numero(c.pesoAutoridade, 1)}</td>)}
          </tr>
          <tr>
            <th scope="row">Cada ano a mais de distância multiplica o peso por</th>
            {casas.map((c) => <td key={c.casa}>{numero(c.razaoRecencia, 2)}</td>)}
          </tr>
          <tr>
            <th scope="row">Mínimo de votações em comum para comparar dois</th>
            {casas.map((c) => <td key={c.casa}>{numero(c.minimoVotacoesComuns)}</td>)}
          </tr>
          <tr>
            <th scope="row">Ligações mantidas por parlamentar</th>
            {casas.map((c) => <td key={c.casa}>{numero(c.vizinhosPorNo)}</td>)}
          </tr>
          <tr>
            <th scope="row">Análise concluída em</th>
            {casas.map((c) => (
              <td key={c.casa}>
                {c.analiseConcluidaEm ? new Date(c.analiseConcluidaEm).toLocaleDateString('pt-BR') : '—'}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
