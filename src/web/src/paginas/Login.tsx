import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { NOME_DA_CASA, obterPanorama, type Panorama } from '../api';
import { BotaoGoogle } from '../componentes/BotaoGoogle';
import { Marca } from '../componentes/Icones';
import { SeletorDeTema } from '../componentes/SeletorDeTema';
import { useSessao } from '../sessao';

/**
 * Porta de entrada.
 *
 * ⚠️ O login passou a ser obrigatório por decisão do autor (2026-08-26), revertendo o
 * desenho anterior em que o questionário funcionava anônimo. Isso significa que TODA
 * pessoa que usa o site tem conta — e a tabela `segue`, que é dado sensível pela LGPD
 * art. 5º, II, deixa de ter alternativa anônima.
 *
 * Por isso esta tela diz, ANTES de entrar, o que vai ser guardado.
 *
 * ## 🔴 Os números são medidos, ⛔ não escritos à mão
 *
 * Esta tela afirmava <i>"os 513 deputados federais"</i> — duas vezes. 513 é o número de
 * cadeiras; quem exerceu mandato e votou na 57ª legislatura são <b>643</b>, com
 * suplentes e quem assumiu no meio. E o Senado ⛔ não era mencionado. Número redondo
 * escrito à mão na porta de entrada é exatamente o erro que o trabalho persegue: ele
 * ⛔ não quebra nada, só fica plausível e errado.
 *
 * ⭐ `/api/panorama` é público de propósito — todo número dele vem de registro nominal
 * publicado, e ⛔ não depende de quem está olhando.
 */
export function Login() {
  const { entrou } = useSessao();
  const [panorama, setPanorama] = useState<Panorama | null>(null);

  useEffect(() => {
    obterPanorama().then(setPanorama).catch(() => setPanorama(null));
  }, []);

  return (
    <div className="tela-login">
      {/* ⭐ Coluna da esquerda: a marca ocupa o espaço, sem imagem para carregar. */}
      <div className="login-marca">
        <Marca tamanho={88} />
      </div>

      <div className="login-conteudo">
        <div className="login-topo">
          <SeletorDeTema />
        </div>

        <h1 className="login-titulo">Quem vota como você?</h1>

        <p className="login-chamada">
          Compare sua posição com o <strong>voto registrado em plenário</strong> de
          deputados e senadores. Pelo registro nominal, não pelo discurso.
        </p>

        <div className="acao-login">
          <BotaoGoogle aoEntrar={entrou} />
        </div>

        {panorama && panorama.porCasa.length > 0 && <Base panorama={panorama} />}

        <ul className="o-que-tem">
          <li>Um questionário montado a partir de votações nominais reais</li>
          <li>O perfil de cada parlamentar, com histórico de votos e gastos do mandato</li>
          <li>O desenho de quem vota parecido com quem</li>
        </ul>

        {/* ⚠️ Dito ANTES de entrar, não depois. */}
        <p className="aviso-privacidade">
          Ao entrar, guardamos seu nome, e-mail e foto do Google, e a lista de quem você
          seguir. <strong>A lista de quem você segue indica posição política</strong> e é
          tratada como dado sensível. Você pode apagar tudo a qualquer momento.{' '}
          <Link to="/privacidade">Política de privacidade</Link>
          {' · '}
          <Link to="/metodologia">Como calculamos</Link>
        </p>

        <p className="aviso-academico">
          Trabalho de conclusão de curso. <strong>Não é recomendação de voto.</strong>
        </p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════

/**
 * O tamanho da base, antes de a pessoa entrar.
 *
 * ⭐ É a evidência que sustenta a chamada. "Compare com o voto registrado" é uma
 * promessa; 643 deputados e 463.994 votos são o que a torna verificável — e são o
 * argumento mais forte que esta tela tem para justificar pedir uma conta.
 */
function Base({ panorama }: { panorama: Panorama }) {
  return (
    <dl className="login-base">
      {panorama.porCasa.map((casa) => (
        <div key={casa.casa}>
          <dt>{NOME_DA_CASA[casa.casa].plural}</dt>
          <dd>{casa.parlamentares.toLocaleString('pt-BR')}</dd>
          <small>
            {casa.votosComPosicao.toLocaleString('pt-BR')} votos em{' '}
            {casa.votacoes.toLocaleString('pt-BR')} votações
          </small>
        </div>
      ))}
    </dl>
  );
}
