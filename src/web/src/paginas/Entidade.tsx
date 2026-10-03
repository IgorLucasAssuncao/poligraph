import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  listarConveniosDaEntidade,
  listarParlamentaresDaEntidade,
  obterEntidade,
  type Entidade as DadosDaEntidade,
} from '../api';
import { AbasDoDinheiro } from '../componentes/AbasDoDinheiro';
import { Coletivos, LinhaDoParlamentar } from '../componentes/AutoresDaEmenda';
import { BotaoBaixarCsv } from '../componentes/BotaoBaixarCsv';
import { BotaoMostrarMais } from '../componentes/BotaoMostrarMais';
import { CabecalhoDaColuna } from '../componentes/Layout';
import { LinkDeFonte } from '../componentes/LinkDeFonte';
import { Termo } from '../componentes/Termo';
import { usePaginas } from '../componentes/usePaginas';
import { baixarCsv, buscarTodas } from '../exportar';
import { dataCurta, minusculas, nomeProprio, reais, reaisCompacto } from '../formato';
import { ComProcedencia } from '../componentes/ModoAnalise';
import { EsqueletoDePainel } from '../componentes/Esqueleto';
import { LinhaDeValor, Numero } from '../componentes/Dados';

/**
 * Uma entidade: quanto recebeu de emenda, de quem, em que ano — e se aparece na cota.
 *
 * ## RISCO: A cota ao lado não é acusação
 *
 * Aparecer nas duas listas é, na maior parte, rotina: a cota paga despesas do escritório à
 * própria prefeitura, e a emenda vai para a mesma prefeitura; a companhia aérea vende a
 * passagem e presta serviço contratado com emenda. A seção diz isso antes dos números, e
 * Não destaca nem ordena ninguém por "coincidência" (RNF-16).
 */
export function Entidade() {
  const { cnpj = '' } = useParams();
  const [dados, setDados] = useState<DadosDaEntidade | null | undefined>(undefined);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    let atual = true;
    obterEntidade(cnpj)
      .then((nova) => atual && setDados(nova))
      .catch(() => atual && setErro(true));
    return () => {
      atual = false;
    };
  }, [cnpj]);

  return (
    <>
      <AbasDoDinheiro />
      {erro && <p className="erro">Não foi possível carregar esta entidade agora.</p>}
      {!erro && dados === undefined && <EsqueletoDePainel rotulo="Carregando a entidade" />}
      {!erro && dados === null && (
        <p className="vazio">
          Este CNPJ não recebeu dinheiro de emenda nos anos carregados.{' '}
          <Link to="/entidades">Ver todas as entidades</Link>
        </p>
      )}
      {dados && <PaginaDaEntidade dados={dados} />}
    </>
  );
}

function PaginaDaEntidade({ dados }: { dados: DadosDaEntidade }) {
  const maiorAno = Math.max(...dados.porAno.map((a) => a.recebido), 1);

  return (
    <>
      <CabecalhoDaColuna titulo={nomeProprio(dados.nome)} subtitulo={dados.naturezaJuridica ?? undefined} comVoltar />

      <section className="numeros-do-ano" aria-label="O que a entidade recebeu">
        <Numero
          rotulo="Recebeu de emendas"
          definicao={
            <>
              em {dados.emendas} {dados.emendas === 1 ? 'emenda' : 'emendas'}, de{' '}
              {dados.porAno[0]?.ano ?? '—'} a {dados.porAno[dados.porAno.length - 1]?.ano ?? '—'}
            </>
          }
        >
          <ComProcedencia consulta={{ contexto: 'entidade', cnpj: dados.cnpj }} rotulo={`Recebido por ${nomeProprio(dados.nome)}`}>
            {reaisCompacto(dados.recebido)}
          </ComProcedencia>
        </Numero>
        <Numero
          rotulo="Sede"
          texto
          definicao={
            <>
              <Termo nome="sedeDoFavorecido">onde fica registrada</Termo>, que pode ser diferente de onde aplicou o dinheiro
            </>
          }
        >
          {dados.sede ? (
            <Link to={`/emendas?uf=${dados.sede.uf}&cidade=${dados.sede.codigoIbge}`}>
              {nomeProprio(dados.sede.nome)} – {dados.sede.uf}
            </Link>
          ) : (
            '—'
          )}
        </Numero>
      </section>

      <section className="governo-secao">
        <h2>Por ano</h2>
        <ul className="gastos-categorias">
          {dados.porAno.map((a) => (
            <LinhaDeValor key={a.ano} nome={a.ano} valor={a.recebido} maior={maiorAno} formatar={reaisCompacto} minimo={0} />
          ))}
        </ul>
        <p className="ajuda">O ano é o da emenda: uma emenda de 2024 paga em 2025 conta em 2024.</p>
      </section>

      <section className="governo-secao">
        <h2>Quem mandou o dinheiro</h2>
        <QuemMandou dados={dados} />
        <Coletivos coletivos={dados.coletivos} />
      </section>

      <ConveniosAssinados dados={dados} />

      {dados.naCota && <NaCota dados={dados} />}

      <p className="fonte-dado">
        CNPJ {formatarCnpj(dados.cnpj)} ·{' '}
        <LinkDeFonte href={dados.urlFonte}>tudo o que esta entidade recebeu, no Portal da Transparência</LinkDeFonte>
      </p>
    </>
  );
}

const POR_PAGINA = 20;

function QuemMandou({ dados }: { dados: DadosDaEntidade }) {
  const lista = usePaginas(dados.parlamentares.itens, dados.parlamentares.total, POR_PAGINA, (pagina) =>
    listarParlamentaresDaEntidade(dados.cnpj, pagina),
  );

  if (dados.parlamentares.total === 0) return null;

  return (
    <div>
      <h3>Deputados e senadores</h3>
      <p className="ajuda">
        {dados.parlamentares.total} parlamentares, {reaisCompacto(dados.deParlamentares)} em{' '}
        <Termo nome="emendaIndividual">emendas individuais</Termo>. O nome leva à página de cada um.
      </p>
      <ul className="lista-autores">
        {lista.itens.map((p) => (
          <LinhaDoParlamentar key={p.pessoaId ?? p.nome} parlamentar={p} />
        ))}
      </ul>
      <BotaoMostrarMais
        proximos={lista.proximos}
        restantes={lista.restantes}
        carregando={lista.carregando}
        erro={lista.erro}
        aoClicar={lista.carregarMais}
      />
      <BotaoBaixarCsv
        rotulo="Baixar a lista (CSV)"
        montar={async () => {
          const todos = await buscarTodas((pagina) => listarParlamentaresDaEntidade(dados.cnpj, pagina));
          baixarCsv(
            `entidade-${dados.cnpj}-parlamentares.csv`,
            ['Parlamentar', 'Partido', 'UF', 'Casa', 'Emendas', 'Recebido'],
            todos.map((p) => [p.nome, p.partido, p.uf, p.casa, p.emendas, p.recebido]),
          );
        }}
      />
    </div>
  );
}

/** O que parlamentares pagaram a esta mesma entidade com a cota — pelo CNPJ, e com a ressalva antes. */
function NaCota({ dados }: { dados: DadosDaEntidade }) {
  const cota = dados.naCota!;

  return (
    <section className="governo-secao">
      <h2>Também aparece na cota parlamentar</h2>
      <p className="aviso" role="note">
        Parlamentares pagaram {reaisCompacto(cota.total)} a esta mesma entidade com a{' '}
        <Termo nome="cota">cota</Termo>, em {cota.lancamentos} {cota.lancamentos === 1 ? 'nota' : 'notas'}. Isso,
        sozinho, não indica irregularidade: a cota paga despesas do escritório à própria prefeitura, passagens à
        companhia aérea, combustível ao posto.
      </p>
      <ul className="lista-autores">
        {cota.porParlamentar.map((p) => (
          <li key={p.pessoaId}>
            <Link className="autor-nome" to={`/parlamentar/${p.pessoaId}`}>
              {nomeProprio(p.nome)}
            </Link>
            <span className="autor-detalhe">
              {[p.partido, p.casa === 'SENADO' ? 'Senado' : p.casa === 'CAMARA' ? 'Câmara' : null]
                .filter(Boolean)
                .join(' · ')}{' '}
              · {p.lancamentos} {p.lancamentos === 1 ? 'nota' : 'notas'}
            </span>
            <span className="valor">{reaisCompacto(p.total)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * O que foi combinado com o dinheiro: o objeto de cada convênio que a entidade assinou.
 *
 * DECISÃO: Responde "comprou o quê, construiu o quê" — o que o valor sozinho não diz. Ligado pelo CNPJ
 * do convenente, não pelo nome. O liberado vem ao lado do combinado: convênio assinado não é
 * dinheiro que chegou.
 */
function ConveniosAssinados({ dados }: { dados: DadosDaEntidade }) {
  const lista = usePaginas(dados.convenios.itens, dados.convenios.total, dados.convenios.tamanho || 20, (pagina) =>
    listarConveniosDaEntidade(dados.cnpj, pagina),
  );

  if (dados.convenios.total === 0) return null;

  return (
    <section className="governo-secao">
      <h2>O que foi combinado</h2>
      <p className="ajuda">
        {dados.convenios.total} {dados.convenios.total === 1 ? 'convênio assinado' : 'convênios assinados'} com dinheiro
        de emenda.
      </p>
      <ul className="lista-convenios-entidade">
        {lista.itens.map((c) => (
          <li key={c.numero}>
            <p className="convenio-objeto">{c.objeto ? minusculas(c.objeto) : 'Objeto não informado'}</p>
            <p className="convenio-detalhe">
              {[c.situacao && minusculas(c.situacao), `assinado em ${dataCurta(c.dataPublicacao)}`]
                .filter(Boolean)
                .join(' · ')}{' '}
              · <LinkDeFonte href={c.urlFonte}>convênio {c.numero}</LinkDeFonte>
            </p>
            <p className="convenio-valores">
              <span>{reais(c.valor)} combinados</span>
              {c.valorLiberado !== null && <span>{reais(c.valorLiberado)} liberados</span>}
            </p>
          </li>
        ))}
      </ul>
      <BotaoMostrarMais
        proximos={lista.proximos}
        restantes={lista.restantes}
        carregando={lista.carregando}
        erro={lista.erro}
        aoClicar={lista.carregarMais}
      />
    </section>
  );
}

function formatarCnpj(cnpj: string): string {
  return cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}
