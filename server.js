const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
const port = 3000;

const supabaseUrl = 'SUA_URL_DO_SUPABASE';
const supabaseKey = 'SUA_CHAVE_PUBLICA_DO_SUPABASE';
const supabase = createClient(supabaseUrl, supabaseKey);

app.use(cors());
app.use(bodyParser.json());

app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    const { user, error } = await supabase.auth.signIn({ email, password });
    if (error) return res.status(400).json({ error: error.message });
    res.json({ user });
});

app.post('/signup', async (req, res) => {
    const { email, password, nome, cpf } = req.body;
    const { user, error } = await supabase.auth.signUp({ email, password });
    if (error) return res.status(400).json({ error: error.message });

    const { data, error: perfilError } = await supabase
        .from('usuarios')
        .insert([{ id: user.id, nome, cpf }]);
    if (perfilError) return res.status(400).json({ error: perfilError.message });

    res.json({ user });
});

// Adicione outros endpoints conforme necessário

app.listen(port, () => {
    console.log(`Servidor rodando em http://localhost:${port}`);
});
