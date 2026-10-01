using Microsoft.EntityFrameworkCore;
using Poligraph.Api.Dtos;
using Poligraph.Data;

namespace Poligraph.Api.Services;

/// <summary>
/// A cota parlamentar do deputado, agregada por ano.
///
/// **Agregação no banco, não em memória.** São 209 mil linhas por ano no total;
/// trazer as de um deputado e somar em C# seria desperdício, e a consulta usa o índice
/// `ix_despesa_pessoa_ano`.
/// </summary>
public class ServicoGastosDeCota(PoligraphDb db)
{
    /// <summary>Quantos lançamentos vêm por página.</summary>
    public const int LancamentosPorPagina = 20;

    /// <summary>Quantos fornecedores da cota aparecem na ficha.</summary>
    private const int FornecedoresExibidos = 8;

    private const int TamanhoMaximo = 100;

    private readonly PoligraphDb _db = db;

    /// <summary>
    /// O ano é opcional: sem ele, devolve o mais recente que existir para a pessoa —
    /// que é o que a ficha quer mostrar por padrão.
    /// </summary>
    /// <remarks>
    /// <para>Sem despesa é caso NORMAL — deputado que não usou cota, ou ano ainda não ingerido. A tela mostra estado vazio, não erro.</para>
    /// <para>Projeta em tipo ANÔNIMO, não direto no `record`: o EF não traduz `GroupBy` com construtor posicional — devolve `could not be translated` em runtime, não em compilação. O `record` é montado depois, em memória.</para>
    /// </remarks>
    public async Task<GastoDeCotaDto> ObterAsync(long id, int? ano, CancellationToken ct)
    {
        var alvo = ano ?? await _db.Despesas.AsNoTracking()
            .Where(d => d.PessoaId == id)
            .MaxAsync(d => (int?)d.Ano, ct);

        if (alvo is null) return new GastoDeCotaDto(0, 0, 0, [], []);

        var doAno = _db.Despesas.AsNoTracking().Where(d => d.PessoaId == id && d.Ano == alvo);

        var categorias = await doAno
            .GroupBy(d => d.Categoria)
            .Select(g => new
            {
                Categoria = g.Key,
                Total = g.Sum(d => d.ValorLiquido),
                Lancamentos = g.Count()
            })
            .OrderByDescending(c => c.Total)
            .ToListAsync(ct);

        var porCategoria = categorias
            .Select(c => new GastoPorCategoriaDto(c.Categoria, c.Total, c.Lancamentos))
            .ToList();

        var brutos = await doAno
            .Where(d => d.Fornecedor != null)
            .GroupBy(d => new { d.Fornecedor, d.FornecedorEhPessoaFisica })
            .Select(g => new
            {
                g.Key.Fornecedor,
                g.Key.FornecedorEhPessoaFisica,
                Total = g.Sum(d => d.ValorLiquido),
                Lancamentos = g.Count()
            })
            .OrderByDescending(f => f.Total)
            .Take(FornecedoresExibidos)
            .ToListAsync(ct);

        var fornecedores = brutos
            .Select(f => new FornecedorDoParlamentarDto(
                TextoSemCpf.Limpar(f.Fornecedor!), f.Total, f.Lancamentos, f.FornecedorEhPessoaFisica))
            .ToList();

        return new GastoDeCotaDto(
            Ano: alvo.Value,
            Total: porCategoria.Sum(c => c.Total),
            Lancamentos: porCategoria.Sum(c => c.Lancamentos),
            PorCategoria: porCategoria,
            MaioresFornecedores: fornecedores);
    }

    /// <summary>Os lançamentos do ano, do mais recente, com o documento fiscal de cada um.</summary>
    /// <remarks>
    /// <para>É o caminho de volta à fonte: a ficha mostra somas por categoria, e cada soma se confere aqui, nota por nota.</para>
    /// </remarks>
    public async Task<PaginaDto<LancamentoDaCotaDto>> ListarLancamentosAsync(
        long id, int? ano, int pagina, int tamanho, CancellationToken ct)
    {
        pagina = Math.Max(pagina, 1);
        tamanho = Math.Clamp(tamanho, 1, TamanhoMaximo);

        var alvo = ano ?? await _db.Despesas.AsNoTracking()
            .Where(d => d.PessoaId == id)
            .MaxAsync(d => (int?)d.Ano, ct);

        if (alvo is null) return new PaginaDto<LancamentoDaCotaDto>([], pagina, tamanho, 0);

        var doAno = _db.Despesas.AsNoTracking().Where(d => d.PessoaId == id && d.Ano == alvo);

        var itens = await doAno
            .OrderByDescending(d => d.Mes)
            .ThenByDescending(d => d.DataEmissao)
            .ThenByDescending(d => d.Id)
            .Skip((pagina - 1) * tamanho)
            .Take(tamanho)
            .Select(d => new LancamentoDaCotaDto(
                d.DataEmissao, d.Mes, d.Categoria, d.Fornecedor, d.ValorLiquido, d.UrlDocumento))
            .ToListAsync(ct);

        return new PaginaDto<LancamentoDaCotaDto>(
            [.. itens.Select(l => l with { Fornecedor = TextoSemCpf.LimparOuNulo(l.Fornecedor) })],
            pagina, tamanho, await doAno.CountAsync(ct));
    }
}
