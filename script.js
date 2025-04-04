let disciplinas = JSON.parse(localStorage.getItem("disciplinas")) || [];
let totalTempoEstudado = parseInt(localStorage.getItem("tempoTotal")) || 0;
let ciclosConcluidos = parseInt(localStorage.getItem("ciclosConcluidos")) || 0;
let historico = JSON.parse(localStorage.getItem("historico")) || {};
const duploCliqueTempo = 400;
let ultimoClique = 0;
let relatorioAtualizado = false;

function salvarDisciplinas() {
    localStorage.setItem("disciplinas", JSON.stringify(disciplinas));
}
function salvarTempoTotal() {
    localStorage.setItem("tempoTotal", totalTempoEstudado);
}
function salvarCiclos() {
    localStorage.setItem("ciclosConcluidos", ciclosConcluidos);
}
function salvarHistorico() {
    localStorage.setItem("historico", JSON.stringify(historico));
}
function obterDataAtual() {
    const hoje = new Date();
    return hoje.toLocaleDateString('pt-BR');
}
function atualizarHistorico(ciclosDoDia, tempoDoDia) {
    const dataAtual = obterDataAtual();
    if (!historico[dataAtual]) {
        historico[dataAtual] = { ciclos: 0, tempo: 0 };
    }
    historico[dataAtual].ciclos += ciclosDoDia;
    historico[dataAtual].tempo += tempoDoDia;
    salvarHistorico();
}

function atualizarTela() {
    const lista = document.getElementById("listaDisciplinas");
    lista.innerHTML = "";
    disciplinas.forEach((disciplina, index) => {
        const div = document.createElement("div");
        div.className = "disciplina";
        if (disciplina.tempoRestante <= 0) {
            div.classList.add("concluido");
        } else if (disciplina.pausado) {
            div.classList.add("pausado");
        }

        div.innerHTML = `
            <div class="disciplina-info">
                <strong>${disciplina.nome}</strong>
            </div>
            <div class="disciplina-controles">
                <span class="timer">${formatarTempo(disciplina.tempoRestante)}</span>
                ${disciplina.interval ?
                    '<button onclick="pausarTemporizador(' + index + ')">⏸</button>' :
                    '<button onclick="iniciarTemporizador(' + index + ')">▶</button>'
                }
                <button ondblclick="resetarDisciplina(${index})" onclick="encerrarDisciplina(${index})">⏹</button>
            </div>
        `;
        lista.appendChild(div);
    });

    document.getElementById("totalHoras").textContent = `${Math.floor(totalTempoEstudado / 3600)}h ${Math.floor((totalTempoEstudado % 3600) / 60)}min`;
    document.getElementById("totalCiclos").textContent = ciclosConcluidos;

    if (!relatorioAtualizado) {
        atualizarRelatorio();
        relatorioAtualizado = true;
    }
}

function adicionarDisciplina() {
    const nome = document.getElementById("nomeDisciplina").value;
    const minutos = parseInt(document.getElementById("minutosDisciplina").value);

    if (nome && minutos > 0) {
        disciplinas.push({
            nome,
            minutos,
            tempoRestante: minutos * 60,
            tempoEstudado: 0,
            interval: null,
            pausado: false
        });
        salvarDisciplinas();
        relatorioAtualizado = false;
        atualizarTela();
        document.getElementById("nomeDisciplina").value = "";
        document.getElementById("minutosDisciplina").value = "";
    }
}

function iniciarTemporizador(index) {
    const disciplina = disciplinas[index];
    disciplina.pausado = false;
    if (disciplina.interval) return;

    disciplina.interval = setInterval(() => {
        if (disciplina.tempoRestante > 0 && !disciplina.pausado) {
            disciplina.tempoRestante--;
            disciplina.tempoEstudado++;
            totalTempoEstudado++;
            salvarDisciplinas();
            salvarTempoTotal();
            atualizarTela();
            verificarCicloCompleto();
        } else if (disciplina.tempoRestante <= 0) {
            clearInterval(disciplina.interval);
            disciplina.interval = null;
            salvarDisciplinas();
            relatorioAtualizado = false;
            atualizarTela();
        }
    }, 1000);
    atualizarTela();
}

function pausarTemporizador(index) {
    const disciplina = disciplinas[index];
    if (disciplina.interval) {
        clearInterval(disciplina.interval);
        disciplina.interval = null;
        disciplina.pausado = true;
        salvarDisciplinas();
        relatorioAtualizado = false;
        atualizarTela();
    }
}

function encerrarDisciplina(index) {
    const agora = Date.now();
    const disciplina = disciplinas[index];
    if (disciplina.interval) {
        clearInterval(disciplina.interval);
        disciplina.interval = null;
        disciplina.pausado = false;
        salvarDisciplinas();
        relatorioAtualizado = false;
        atualizarTela();
    }
    ultimoClique = agora;
}

function resetarDisciplina(index) {
    const disciplina = disciplinas[index];
    disciplina.tempoRestante = disciplina.minutos * 60;
    disciplina.tempoEstudado = 0;
    disciplina.interval = null;
    disciplina.pausado = false;
    salvarDisciplinas();
    relatorioAtualizado = false;
    atualizarTela();
}

function resetarTodasDisciplinas() {
    disciplinas.forEach(d => {
        d.tempoRestante = d.minutos * 60;
        d.tempoEstudado = 0;
        d.interval = null;
        d.pausado = false;
    });
    salvarDisciplinas();
    relatorioAtualizado = false;
    atualizarTela();
}

function zerarProgresso() {
    disciplinas = [];
    totalTempoEstudado = 0;
    ciclosConcluidos = 0;
    historico = {};
    localStorage.removeItem("disciplinas");
    localStorage.removeItem("tempoTotal");
    localStorage.removeItem("ciclosConcluidos");
    localStorage.removeItem("historico");
    relatorioAtualizado = false;
    atualizarTela();
}

function atualizarRelatorio() {
    const lista = document.getElementById("listaRelatorio");
    lista.innerHTML = "";
    disciplinas.forEach(d => {
        const li = document.createElement("li");
        const porcentagem = ((d.minutos * 60 - d.tempoRestante) / (d.minutos * 60)) * 100;
        li.innerHTML = `
            ${d.nome}: ${porcentagem.toFixed(0)}%
            <div class="barra-progresso-relatorio">
                <div class="barra-preenchida-relatorio" style="width:${porcentagem}%"></div>
            </div>
        `;
        lista.appendChild(li);
    });
    document.getElementById("relatorio").classList.toggle("hidden", disciplinas.length === 0);
}

function verificarCicloCompleto() {
    const todasConcluidas = disciplinas.every(d => d.tempoRestante <= 0);
    if (todasConcluidas && disciplinas.length > 0) {
        ciclosConcluidos++;
        salvarCiclos();
        const tempoCiclo = disciplinas.reduce((total, d) => total + d.minutos * 60, 0);
        atualizarHistorico(1, tempoCiclo);
        alert("🎉 Ciclo de estudos concluído!");
        relatorioAtualizado = false;
        atualizarTela();
    }
}

function formatarTempo(segundos) {
    if (segundos <= 0) return "Disciplina concluída";
    const h = String(Math.floor(segundos / 3600)).padStart(2, '0');
    const m = String(Math.floor((segundos % 3600) / 60)).padStart(2, '0');
    const s = String(segundos % 60).padStart(2, '0');
    return `${h}:${m}:${s}`;
}

function gerarPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text("Relatório de Estudos", 20, 20);
    doc.text(`Total de tempo estudado: ${Math.floor(totalTempoEstudado / 3600)}h ${Math.floor((totalTempoEstudado % 3600) / 60)}min`, 20, 30);
    doc.text(`Total de ciclos concluídos: ${ciclosConcluidos}`, 20, 40);

    let y = 60;
    doc.text("Histórico por data:", 20, y);
    y += 10;

    const datasOrdenadas = Object.keys(historico).sort((a, b) => {
        return new Date(b.split('/').reverse().join('-')) - new Date(a.split('/').reverse().join('-'));
    });

    datasOrdenadas.forEach(data => {
        const dia = historico[data];
        const horas = Math.floor(dia.tempo / 3600);
        const minutos = Math.floor((dia.tempo % 3600) / 60);
        doc.text(`${data}: ${dia.ciclos} ciclos, ${horas}h ${minutos}min`, 20, y);
        y += 10;
        if (y > 270) {
            doc.addPage();
            y = 20;
        }
    });

    y += 10;
    doc.text("Progresso por disciplina:", 20, y);
    y += 10;

    disciplinas.forEach((d, i) => {
        const porcentagem = ((d.minutos * 60 - d.tempoRestante) / (d.minutos * 60)) * 100;
        doc.text(`${i + 1}. ${d.nome}: ${porcentagem.toFixed(0)}% concluído`, 20, y);
        y += 10;
        if (y > 270) {
            doc.addPage();
            y = 20;
        }
    });

    doc.save("relatorio_estudos.pdf");
}

// Inicializa a tela ao carregar
atualizarTela();
