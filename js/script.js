// Configuração do Supabase
const supabaseUrl = 'SUA_URL_DO_SUPABASE';
const supabaseKey = 'SUA_CHAVE_PUBLICA_DO_SUPABASE';
const supabase = supabase.createClient(supabaseUrl, supabaseKey);

// Variáveis globais
let usuarioLogado = null;
let saldo = 0;

// Função para exibir mensagens de erro
function exibirErro(mensagem) {
    const erroDiv = document.getElementById('erro');
    erroDiv.innerText = mensagem;
    erroDiv.style.display = 'block';
    setTimeout(() => erroDiv.style.display = 'none', 5000); // Oculta após 5 segundos
}

// Função para validar CPF (exemplo básico)
function validarCPF(cpf) {
    return cpf.length === 11 && !isNaN(cpf); // Valida se tem 11 dígitos numéricos
}

// Função para cadastrar usuário
async function cadastrarUsuario(email, senha, nome, cpf) {
    if (!nome || !email || !senha || !cpf) {
        exibirErro('Todos os campos são obrigatórios.');
        return;
    }
    if (!validarCPF(cpf)) {
        exibirErro('CPF inválido. Deve conter 11 dígitos.');
        return;
    }

    const { user, error } = await supabase.auth.signUp({
        email,
        password: senha,
    });
    if (error) {
        exibirErro('Erro ao cadastrar: ' + error.message);
        return;
    }

    // Salvar informações adicionais do usuário (nome e CPF)
    const { data, error: perfilError } = await supabase
        .from('usuarios')
        .insert([{ id: user.id, nome, cpf }]);
    if (perfilError) {
        exibirErro('Erro ao salvar perfil: ' + perfilError.message);
        return;
    }

    alert('Cadastro realizado com sucesso!');
    window.location.href = 'index.html';
}

// Função para fazer login
async function fazerLogin(email, senha) {
    if (!email || !senha) {
        exibirErro('E-mail e senha são obrigatórios.');
        return;
    }

    const { user, error } = await supabase.auth.signIn({
        email,
        password: senha,
    });
    if (error) {
        exibirErro('Erro ao fazer login: ' + error.message);
        return;
    }
    usuarioLogado = user;
    window.location.href = 'principal.html';
}

// Função para fazer logout
async function fazerLogout() {
    const { error } = await supabase.auth.signOut();
    if (error) {
        exibirErro('Erro ao fazer logout: ' + error.message);
        return;
    }
    usuarioLogado = null;
    window.location.href = 'index.html';
}

// Função para adicionar receita
async function adicionarReceita(valor, descricao) {
    const { data, error } = await supabase
        .from('receitas')
        .insert([{ user_id: usuarioLogado.id, valor, descricao }]);
    if (error) {
        exibirErro('Erro ao adicionar receita: ' + error.message);
        return;
    }
    saldo += valor;
    carregarTransacoes();
}

// Função para adicionar despesa
async function adicionarDespesa(valor, descricao) {
    const { data, error } = await supabase
        .from('despesas')
        .insert([{ user_id: usuarioLogado.id, valor, descricao }]);
    if (error) {
        exibirErro('Erro ao adicionar despesa: ' + error.message);
        return;
    }
    saldo -= valor;
    carregarTransacoes();
}

// Função para editar transação
async function editarTransacao(id, tipo) {
    const { data: transacao, error } = await supabase
        .from(tipo === 'receita' ? 'receitas' : 'despesas')
        .select('*')
        .eq('id', id)
        .single();

    if (error) {
        exibirErro('Erro ao carregar transação: ' + error.message);
        return;
    }

    // Preenche o modal com os dados da transação
    document.getElementById('valor').value = transacao.valor;
    document.getElementById('descricao').value = transacao.descricao;
    document.getElementById('modalTitulo').innerText = `Editar ${tipo === 'receita' ? 'Receita' : 'Despesa'}`;

    // Atualiza o formulário para salvar a edição
    document.getElementById('formTransacao').onsubmit = async (e) => {
        e.preventDefault();
        const valor = parseFloat(document.getElementById('valor').value);
        const descricao = document.getElementById('descricao').value;

        const { error: updateError } = await supabase
            .from(tipo === 'receita' ? 'receitas' : 'despesas')
            .update({ valor, descricao })
            .eq('id', id);

        if (updateError) {
            exibirErro('Erro ao atualizar transação: ' + updateError.message);
            return;
        }

        alert('Transação atualizada com sucesso!');
        carregarTransacoes();
        modal.hide();
    };

    const modal = new bootstrap.Modal(document.getElementById('modalTransacao'));
    modal.show();
}

// Função para excluir transação
async function excluirTransacao(id, tipo) {
    if (!confirm('Tem certeza que deseja excluir esta transação?')) return;

    const { error } = await supabase
        .from(tipo === 'receita' ? 'receitas' : 'despesas')
        .delete()
        .eq('id', id);

    if (error) {
        exibirErro('Erro ao excluir transação: ' + error.message);
        return;
    }

    alert('Transação excluída com sucesso!');
    carregarTransacoes();
}

// Função para carregar transações
async function carregarTransacoes() {
    const { data: receitas, error: receitasError } = await supabase
        .from('receitas')
        .select('*')
        .eq('user_id', usuarioLogado.id);
    const { data: despesas, error: despesasError } = await supabase
        .from('despesas')
        .select('*')
        .eq('user_id', usuarioLogado.id);

    if (receitasError || despesasError) {
        exibirErro('Erro ao carregar transações');
        return;
    }

    // Calcular saldo
    saldo = receitas.reduce((total, receita) => total + receita.valor, 0);
    saldo -= despesas.reduce((total, despesa) => total + despesa.valor, 0);

    // Exibir transações
    const transacoes = [...receitas.map(r => ({ ...r, tipo: 'receita' })), ...despesas.map(d => ({ ...d, tipo: 'despesa' }))];
    transacoes.sort((a, b) => new Date(b.data) - new Date(a.data)); // Ordenar por data
    atualizarTela(transacoes);
}

// Função para filtrar transações por período
async function filtrarTransacoes() {
    const dataInicio = document.getElementById('dataInicio').value;
    const dataFim = document.getElementById('dataFim').value;

    if (!dataInicio || !dataFim) {
        exibirErro('Selecione um período válido.');
        return;
    }

    const { data: receitas, error: receitasError } = await supabase
        .from('receitas')
        .select('*')
        .eq('user_id', usuarioLogado.id)
        .gte('data', dataInicio)
        .lte('data', dataFim);

    const { data: despesas, error: despesasError } = await supabase
        .from('despesas')
        .select('*')
        .eq('user_id', usuarioLogado.id)
        .gte('data', dataInicio)
        .lte('data', dataFim);

    if (receitasError || despesasError) {
        exibirErro('Erro ao filtrar transações.');
        return;
    }

    // Calcular saldo
    saldo = receitas.reduce((total, receita) => total + receita.valor, 0);
    saldo -= despesas.reduce((total, despesa) => total + despesa.valor, 0);

    // Exibir transações filtradas
    const transacoes = [...receitas.map(r => ({ ...r, tipo: 'receita' })), ...despesas.map(d => ({ ...d, tipo: 'despesa' }))];
    transacoes.sort((a, b) => new Date(b.data) - new Date(a.data)); // Ordenar por data
    atualizarTela(transacoes);
}

// Função para atualizar a tela
function atualizarTela(transacoes = []) {
    document.getElementById('saldo').innerText = `R$ ${saldo.toFixed(2)}`;
    const listaTransacoes = document.getElementById('transacoes');
    listaTransacoes.innerHTML = transacoes.map(transacao => `
        <li class="list-group-item">
            ${transacao.tipo === 'receita' ? '➕' : '➖'} ${transacao.descricao}: R$ ${transacao.valor.toFixed(2)}
            <button class="btn btn-sm btn-warning ms-2" onclick="editarTransacao('${transacao.id}', '${transacao.tipo}')">Editar</button>
            <button class="btn btn-sm btn-danger ms-2" onclick="excluirTransacao('${transacao.id}', '${transacao.tipo}')">Excluir</button>
        </li>
    `).join('');
}

// Eventos
document.getElementById('loginForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const senha = document.getElementById('senha').value;
    fazerLogin(email, senha);
});

document.getElementById('cadastroForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const nome = document.getElementById('nome').value;
    const email = document.getElementById('email').value;
    const senha = document.getElementById('senha').value;
    const cpf = document.getElementById('cpf').value;
    cadastrarUsuario(email, senha, nome, cpf);
});

document.getElementById('formTransacao')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const valor = parseFloat(document.getElementById('valor').value);
    const descricao = document.getElementById('descricao').value;
    const tipo = document.getElementById('modalTitulo').innerText.includes('Receita') ? 'receita' : 'despesa';
    if (tipo === 'receita') {
        adicionarReceita(valor, descricao);
    } else {
        adicionarDespesa(valor, descricao);
    }
});

// Carregar transações ao entrar na tela principal
if (window.location.pathname.includes('principal.html')) {
    supabase.auth.onAuthStateChange((event, session) => {
        if (session) {
            usuarioLogado = session.user;
            carregarTransacoes();
        } else {
            window.location.href = 'index.html';
        }
    });
}