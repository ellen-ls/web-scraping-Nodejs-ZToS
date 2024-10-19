const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const xlsx = require('xlsx');
const cors = require('cors');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

const base_url = 'https://www.yourfirm.de/suche/all/?fulltext={}&sort=Datum&page={}';
const headers = {
    'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.96 Safari/537.36'
};

let dados_vagas = [];

app.use(cors()); // Adicionando middleware CORS
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend'))); // Para servir o frontend estático

app.post('/buscar-vagas', async (req, res) => {
    const { keywords } = req.body; // Esperando um array de palavras-chave
    dados_vagas = [];
    
    for (const keyword of keywords) {
        const palavra_formatada = keyword.replace(" ", "+");
        const palavra_codificada = encodeURIComponent(palavra_formatada);

        for (let page = 1; page < 10; page++) {
            const url = base_url.replace('{}', palavra_codificada).replace('{}', page);
            try {
                const response = await axios.get(url, { headers });
                const $ = cheerio.load(response.data);
                const vagas = $('div.sc-b2039713-27');

                if (vagas.length === 0) {
                    break;
                }

                vagas.each((_, vaga) => {
                    const titulo = $(vaga).find('h2.sc-b2039713-22').text().trim() || 'Título não encontrado';
                    const local = $(vaga).find('div.sc-b2039713-16').text().trim() || 'Local não encontrado';
                    const empresa = $(vaga).find('p.sc-b2039713-8').text().trim() || 'Empresa não encontrada';
                    const data = $(vaga).find('p.sc-b2039713-10').text().trim() || 'Data não encontrada';
                    const link = $(vaga).find('a').attr('href') || 'Link não encontrado';

                    if (titulo.toLowerCase().includes(keyword.toLowerCase())) {
                        dados_vagas.push({
                            'Keyword': keyword,
                            'Title': titulo,
                            'Location': local,
                            'Company': empresa,
                            'Date': data,
                            'Link': `https://www.yourfirm.de${link}`
                        });
                    }
                });
            } catch (error) {
                return res.status(500).json({ error: 'Erro ao buscar vagas' });
            }
        }
    }

    res.json({ count: dados_vagas.length });
});

app.get('/baixar-vagas', (req, res) => {
    const { filename } = req.query;
    const workbook = xlsx.utils.book_new();
    const worksheet = xlsx.utils.json_to_sheet(dados_vagas);
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Vagas');

    const filePath = `${filename}.xlsx`;
    xlsx.writeFile(workbook, filePath);

    res.download(filePath, (err) => {
        if (err) {
            console.error('Erro ao baixar arquivo:', err);
        }
        fs.unlinkSync(filePath); // Deleta o arquivo após o download
    });
});

app.listen(port, () => {
    console.log(`Servidor rodando na porta ${port}`);
});
