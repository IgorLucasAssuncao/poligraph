using Microsoft.EntityFrameworkCore;
using Poligraph.Api.Dtos;
using Poligraph.Data;

namespace Poligraph.Api.Services;

/// <summary>
/// A cota parlamentar do deputado, agregada por ano.
///
/// ⚠️ **Agregação no banco, ⛔ não em memória.** São 209 mil linhas por ano no total;
/// trazer as de um deputado e somar em C# seria desperdício, e a consulta usa o índice
/// `ix_despesa_pessoa_ano`.
/// </summary>
public class ServicoGastosDeCota(PoligraphDb db)
{
    /// <summary>Quantos fornecedores da cota aparecem na ficha.</summary>
    private const int FornecedoresExibidos = 8;

    private readonly PoligraphDb _db = db;

    /// <summary>
    /// ⭐ O ano é opcional: sem ele, devolve o mais recente que existir para a pessoa —
    /// que é o que a ficha quer mostrar por padrão.
    /// </summary>
    public async Task<GastoDeCotaDto> ObterAsync(long id, int? ano, CancellationToken ct)
    {
        var alvo = ano ?? await _db.Despesas.AsNoTracking()
            .Where(d => d.PessoaId == id)
            .MaxAsync(d => (int?)d.Ano, ct);

        // ⭐ Sem despesa é caso NORMAL — deputado que não usou cota, ou ano ainda não
        //    ingerido. A tela mostra estado vazio, ⛔ não erro.
        if (alvo is null) return new GastoDeCotaDto(0, 0, 0, [], []);

        var doAno = _db.Despesas.AsNoTracking().Where(d => d.PessoaId == id && d.Ano == alvo);

        // ⚠️ Projeta em tipo ANÔNIMO, não direto no `record`: o EF não traduz `GroupBy`
        //    com construtor posicional — devolve `could not be translated` em runtime,
        //    ⛔ não em compilação. O `record` é montado depois, em memória.
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
                f.Fornecedor!, f.Total, f.Lancamentos, f.FornecedorEhPessoaFisica))
            .ToList();

        return new GastoDeCotaDto(
            Ano: alvo.Value,
            Total: porCategoria.Sum(c => c.Total),
            Lancamentos: porCategoria.Sum(c => c.Lancamentos),
            PorCategoria: porCategoria,
            MaioresFornecedores: fornecedores);
    }
}
