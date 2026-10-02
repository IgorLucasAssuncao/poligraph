import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { NOME_DA_CASA, obterPanorama, type Panorama } from '../api';
import { BotaoGoogle } from '../componentes/BotaoGoogle';
import { Marca } from '../componentes/Icones';
import { SeletorDeTema } from '../componentes/SeletorDeTema';
import { useSessao } from '../sessao';
import { destinoSeguro } from '../componentes/useEntrar';

/**
 * Porta de entrada.
 *
 * ## Quando ela aparece
 *
 * | Leitura pública (`Acesso:LeituraPublica`) | Esta tela |
 * |---|---|
 * | RISCO: Desligada — o padrão, e o período eleitoral (RNF-17) | Para tudo: o site exige conta |
 * | Ligada | Só para seguir alguém e para a própria conta. O resto é aberto |
 *
 * ATENÇÃO: O login foi obrigatório de 2026-08-26 a 2026-10-02. Passou a ser opcional por
 * decisão do autor: a conta só existe para a lista de quem a pessoa segue, que é dado
 * sensível (LGPD art. 5º, II). Quem não segue ninguém não precisa dar dado nenhum.
 *
 * Por isso esta tela diz, ANTES de entrar, o que vai ser guardado.
 *
 * ## RISCO: Os números são medidos, não escritos à mão
 *
 * Esta tela afirmava <i>"os 513 deputados federais"</i> — duas vezes. 513 é o número de
 * cadeiras; quem exerceu mandato e votou na 57ª legislatura são <b>643</b>, com
 * suplentes e quem assumiu no meio. E o Senado não era mencionado. Número redondo
 * escrito à mão na porta de entrada é exatamente o erro que o trabalho persegue: ele
 * não quebra nada, só fica plausível e errado.
 *
 * DECISÃO: `/api/panorama` é público de propósito — todo número dele vem de registro nominal
 * publicado, e não depende de quem está olhando.
 *
 * DECISÃO: Coluna da esquerda: a marca ocupa o espaço, sem imagem para carregar.
 *
 * ATENÇÃO: Dito ANTES de entrar, não depois.
 */
export function Login() {
  const { entrou, leituraPublica } = useSessao();
  const [parametros] = useSearchParams();
  const voltar = destinoSeguro(parametros.get('voltar'));
  const [panorama, setPanorama] = useState<Panorama | null>(null);

  useEffect(() => {
    obterPanorama().then(setPanorama).catch(() => setPanorama(null));
  }, []);

  return (
    <div className="tela-login">
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

        {leituraPublica && (
          <p className="login-opcional">
            A conta serve para <strong>seguir parlamentares</strong>. O questionário e
            todos os dados funcionam sem ela. <Link to={voltar}>Continuar sem conta</Link>
          </p>
        )}

        {panorama && panorama.porCasa.length > 0 && <Base panorama={panorama} />}

        <ul className="o-que-tem">
          <li>Um questionário montado a partir de votações nominais reais</li>
          <li>O perfil de cada parlamentar, com histórico de votos e gastos do mandato</li>
          <li>O desenho de quem vota parecido com quem</li>
        </ul>

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

/**
 * O tamanho da base, antes de a pessoa entrar.
 *
 * DECISÃO: É a evidência que sustenta a chamada. "Compare com o voto registrado" é uma
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
