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

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

app.post('/buscar-vagas', async (req, res) => {
    const { keywords } = req.body;
    dados_vagas = []; // Limpa os dados para evitar duplicações em chamadas subsequentes
    
    for (const keyword of keywords) {
        const palavra_formatada = keyword.replace(" ", "+");
        const palavra_codificada = encodeURIComponent(palavra_formatada);

        for (let page = 1; page <= 10; page++) {
            const url = base_url.replace('{}', palavra_codificada).replace('{}', page);
            try {
                const response = await axios.get(url, { headers });
                const $ = cheerio.load(response.data);

                const vagas = $('[data-testid=qa-hitzone]').parent(); // A classe principal da vaga individual

                if (vagas.length === 0) {
                    break;
                }

                for (let vaga of vagas) {
                    const titulo = $(vaga).find('a').attr('title') || 'Título não encontrado';
                    const local = $(vaga).find('[data-icon="location-dot"]').parent().find('span').text().trim() || 'Local não encontrado';
                    const empresa = $(vaga).find('p:first').text().trim() || 'Empresa não encontrada';
                    const link = `https://www.yourfirm.de${$(vaga).find('a').attr('href')}`;

                    let email = '-----';
                    let telefone = '-----';

                    try {
                        // Fazendo a requisição para a página de detalhes
                        const detalheResponse = await axios.get(link, { headers });
                        const detalhe$ = cheerio.load(detalheResponse.data);

                        // Extrair texto da div principal e da div alternativa
                        const contatoElemento = detalhe$('#job-ad-details-widget');
                        const contatoTexto = contatoElemento.length ? contatoElemento.html() : '';
                        const contatoElementoAlt = detalhe$('body');
                        const contatoTextoAlt = contatoElementoAlt.length ? contatoElementoAlt.html() : '';

                        // Substituir <br> por quebras de linha
                        const contatoTextoFormatado = contatoTexto.replace(/<br\s*\/?>/gi, '\n');
                        const contatoTextoAltFormatado = contatoTextoAlt.replace(/<br\s*\/?>/gi, '\n');

                        // Regex para email (na div principal ou alternativa)
                        const emailMatch = contatoTextoFormatado.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/) ||
                                           contatoTextoAltFormatado.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
                        //if (emailMatch) {
                        //    email = emailMatch[0];
                        //}

                        // Regex para telefone (na div principal ou alternativa)
                        const telefoneMatch = contatoTextoFormatado.match(/(?:\+49|\+43|\bTel\b|\bTelefon\b)\s*:?(\s*\(?\d{2,}\)?[\s.-]?\d{2,}[\s.-]?\d{2,})/) ||
                                              contatoTextoAltFormatado.match(/(?:\+49|\+43|\bTel\b|\bTelefon\b)\s*:?(\s*\(?\d{2,}\)?[\s.-]?\d{2,}[\s.-]?\d{2,})/);
                        //if (telefoneMatch) {
                        //    telefone = telefoneMatch[0];
                        //}

                    } catch (erroDetalhe) {
                        console.error(`Erro ao buscar detalhes da vaga no link ${link}:`, erroDetalhe);
                    }

                    console.log("Título:", titulo);
                    console.log("Local:", local)
                    console.log("Empresa:", empresa);
                    console.log("Link:", link);
                    console.log("Email:", email);
                    console.log("Telefone:", telefone);

                    if (titulo.toLowerCase().includes(keyword.toLowerCase())) {
                        dados_vagas.push({
                            'Keyword': keyword,
                            'Title': titulo,
                            'Location': local,
                            'Company': empresa,
                            'Link': link,
                            'Email': email,
                            'Phone': telefone
                        });
                    }
                }
            } catch (error) {
                console.error(`Erro ao buscar vagas para a palavra-chave "${keyword}" na página ${page}:`, error);
                continue;
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
        fs.unlinkSync(filePath); // Remove o arquivo após o download
    });
});

app.listen(port, () => {
    console.log(`Servidor rodando na porta ${port}`);
});
