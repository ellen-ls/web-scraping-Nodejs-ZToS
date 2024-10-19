const API_url = 'https://web-scraping-nodejs-ztos.onrender.com'

async function buscarVagas() {
    const keywords = document.getElementById('keyword').value.split(',').map(word => word.trim());
    if (keywords.length === 0 || keywords[0] === '') {
        alert('Please enter one or more keywords.');
        return;
    }

    document.getElementById('status').innerText = 'Searching vacancies, bitte warten...';
    try {
        const response = await fetch(`${API_url}/buscar-vagas`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ keywords })
        });
        if (!response.ok) {
            throw new Error('Error to search vacancies');
        }
        const result = await response.json();
        document.getElementById('status').innerText = `Successful! Were found ${result.count} vacancies.`;
        document.getElementById('status').style.color = '#9ACD32';
        document.getElementById('download').style.display = 'block';
    } catch (error) {
        document.getElementById('status').innerText = 'Error to search vacancies.';
        document.getElementById('status').style.color = 'red';
        console.error('Erro:', error);
    }
}

async function baixarArquivo() {
    const filename = document.getElementById('filename').value || 'vagas';
    try {
        const response = await fetch(`${API_url}/baixar-vagas?filename=${encodeURIComponent(filename)}`);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${filename}.xlsx`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
    } catch (error) {
        console.error('Error to download file:', error);
    }
}
