let disciplinas = JSON.parse(localStorage.getItem("disciplinas")) || [];
        let totalTempoEstudado = parseInt(localStorage.getItem("tempoTotal")) || 0;
        let ciclosConcluidos = parseInt(localStorage.getItem("ciclosConcluidos")) || 0;
        let historicoEstudos = JSON.parse(localStorage.getItem("historicoEstudos")) || {};
        let eventos = JSON.parse(localStorage.getItem("eventos")) || [];
        const duploCliqueTempo = 400;
        let ultimoClique = 0;
        let relatorioAtualizado = false;
        let timerWorker;
        let eventoEditandoId = null;

        // Inicializa o Web Worker se suportado
        if (window.Worker) {
            timerWorker = new Worker(URL.createObjectURL(new Blob([`
                let intervalIds = {};
                
                self.onmessage = function(e) {
                    const { command, disciplinaIndex } = e.data;
                    
                    if (command === 'start') {
                        if (intervalIds[disciplinaIndex]) {
                            clearInterval(intervalIds[disciplinaIndex]);
                        }
                        
                        intervalIds[disciplinaIndex] = setInterval(() => {
                            self.postMessage({ disciplinaIndex });
                        }, 1000);
                    }
                    else if (command === 'pause') {
                        if (intervalIds[disciplinaIndex]) {
                            clearInterval(intervalIds[disciplinaIndex]);
                            delete intervalIds[disciplinaIndex];
                        }
                    }
                    else if (command === 'stop') {
                        if (intervalIds[disciplinaIndex]) {
                            clearInterval(intervalIds[disciplinaIndex]);
                            delete intervalIds[disciplinaIndex];
                        }
                    }
                };
            `], { type: 'text/javascript' })));

            timerWorker.onmessage = function(e) {
                const { disciplinaIndex } = e.data;
                atualizarTemporizador(disciplinaIndex);
            };
        }

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
            localStorage.setItem("historicoEstudos", JSON.stringify(historicoEstudos));
        }

        function salvarEventos() {
            localStorage.setItem("eventos", JSON.stringify(eventos));
            atualizarEventosDestaque();
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
                if (disciplina.editando) {
                    div.classList.add("editando");
                }

                if (disciplina.editando) {
                    div.innerHTML = `
                        <div class="disciplina-info">
                            <strong>${disciplina.nome}</strong>
                        </div>
                        <div class="disciplina-controles">
                            <div class="form-edicao">
                                <input type="number" id="minutosEditados-${index}" value="${Math.ceil(disciplina.tempoRestante / 60)}" min="1">
                                <button class="btn-confirmar" onclick="salvarEdicao(${index})">✓</button>
                                <button class="btn-cancelar" onclick="cancelarEdicao(${index})">✗</button>
                            </div>
                        </div>
                    `;
                } else {
                    div.innerHTML = `
                        <div class="disciplina-info">
                            <strong>${disciplina.nome}</strong>
                        </div>
                        <div class="disciplina-controles">
                            <span class="timer">${formatarTempo(disciplina.tempoRestante)}</span>
                            ${disciplina.tempoRestante <= 0 ? '' : 
                                (disciplina.interval || (disciplina.inicioTimestamp && !disciplina.pausado) ?
                                    '<button onclick="pausarTemporizador(' + index + ')">⏸</button>' :
                                    '<button onclick="iniciarTemporizador(' + index + ')">▶</button>')
                            }
                            <button ondblclick="resetarDisciplina(${index})" onclick="encerrarDisciplina(${index})">⏹</button>
                            <button onclick="editarDisciplina(${index})">✏️</button>
                            <button onclick="excluirDisciplina(${index})">🗑</button>
                        </div>
                    `;
                }
                lista.appendChild(div);
            });

            document.getElementById("totalHoras").textContent = `${Math.floor(totalTempoEstudado / 3600)}h ${Math.floor((totalTempoEstudado % 3600) / 60)}min`;
            document.getElementById("totalCiclos").textContent = ciclosConcluidos;
            
            if (!relatorioAtualizado) {
                atualizarRelatorio();
                relatorioAtualizado = true;
            }
            
            atualizarEventosDestaque();
        }

        function atualizarEventosDestaque() {
            const container = document.getElementById("eventosDestaque");
            container.innerHTML = "";
            
            if (eventos.length === 0) {
                container.innerHTML = '<p class="sem-eventos">Nenhum evento cadastrado</p>';
                return;
            }
            
            // Ordena eventos por data (mais próximos primeiro)
            const eventosOrdenados = [...eventos].sort((a, b) => a.data - b.data);
            
            const hoje = new Date();
            hoje.setHours(0, 0, 0, 0);
            
            // Mostra apenas os 3 eventos mais próximos
            const eventosParaMostrar = eventosOrdenados.slice(0, 3);
            
            eventosParaMostrar.forEach(evento => {
                const dataEvento = new Date(evento.data);
                const diffTime = dataEvento - hoje;
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                
                const span = document.createElement("span");
                span.className = "evento-destaque";
                
                if (diffDays < 0) {
                    span.textContent = `${evento.nome} (passou)`;
                    span.classList.add("evento-passado-destaque");
                } else if (diffDays === 0) {
                    span.textContent = `${evento.nome} (hoje!)`;
                    span.classList.add("evento-hoje");
                } else if (diffDays <= 7) {
                    span.textContent = `${evento.nome}: ${diffDays} dia(s)`;
                    span.classList.add("evento-proximo-destaque");
                } else {
                    span.textContent = `${evento.nome}: ${diffDays} dia(s)`;
                }
                
                container.appendChild(span);
            });
            
            // Se houver mais eventos, mostra um indicador
            if (eventos.length > 3) {
                const maisEventos = document.createElement("p");
                maisEventos.textContent = `+ ${eventos.length - 3} outros eventos...`;
                maisEventos.style.marginTop = "10px";
                maisEventos.style.fontSize = "0.9em";
                container.appendChild(maisEventos);
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
                    pausado: false,
                    editando: false,
                    inicioTimestamp: null
                });
                salvarDisciplinas();
                relatorioAtualizado = false;
                atualizarTela();
                document.getElementById("nomeDisciplina").value = "";
                document.getElementById("minutosDisciplina").value = "";
            }
        }

        function editarDisciplina(index) {
            const disciplina = disciplinas[index];
            if (disciplina.interval) {
                clearInterval(disciplina.interval);
                disciplina.interval = null;
            }
            
            if (timerWorker) {
                timerWorker.postMessage({
                    command: 'stop',
                    disciplinaIndex: index
                });
            }
            
            disciplina.editando = true;
            disciplina.inicioTimestamp = null;
            atualizarTela();
        }

        function salvarEdicao(index) {
            const disciplina = disciplinas[index];
            const minutosEditados = parseInt(document.getElementById(`minutosEditados-${index}`).value);
            
            if (minutosEditados > 0) {
                disciplina.minutos = minutosEditados;
                disciplina.tempoRestante = minutosEditados * 60;
                disciplina.editando = false;
                disciplina.inicioTimestamp = null;
                salvarDisciplinas();
                relatorioAtualizado = false;
                atualizarTela();
            } else {
                alert("Por favor, insira um valor válido (maior que 0)");
            }
        }

        function cancelarEdicao(index) {
            disciplinas[index].editando = false;
            atualizarTela();
        }

        function excluirDisciplina(index) {
            if (confirm("Tem certeza que deseja excluir esta disciplina?")) {
                const disciplina = disciplinas[index];
                if (disciplina.interval) {
                    clearInterval(disciplina.interval);
                }
                
                if (timerWorker) {
                    timerWorker.postMessage({
                        command: 'stop',
                        disciplinaIndex: index
                    });
                }
                
                disciplinas.splice(index, 1);
                salvarDisciplinas();
                relatorioAtualizado = false;
                atualizarTela();
            }
        }

        function iniciarTemporizador(index) {
            const disciplina = disciplinas[index];
            disciplina.pausado = false;
            disciplina.inicioTimestamp = Date.now();
            
            salvarDisciplinas();
            
            if (timerWorker) {
                timerWorker.postMessage({
                    command: 'start',
                    disciplinaIndex: index
                });
            } else {
                // Fallback para navegadores sem suporte a Worker
                if (disciplina.interval) clearInterval(disciplina.interval);
                
                disciplina.interval = setInterval(() => {
                    atualizarTemporizador(index);
                }, 1000);
            }
            
            atualizarTela();
        }

        function pausarTemporizador(index) {
            const disciplina = disciplinas[index];
            disciplina.pausado = true;
            
            if (disciplina.interval) {
                clearInterval(disciplina.interval);
                disciplina.interval = null;
            }
            
            if (timerWorker) {
                timerWorker.postMessage({
                    command: 'pause',
                    disciplinaIndex: index
                });
            }
            
            // Atualiza o tempo restante com base no tempo decorrido
            if (disciplina.inicioTimestamp) {
                const agora = Date.now();
                const segundosDecorridos = Math.floor((agora - disciplina.inicioTimestamp) / 1000);
                const decremento = Math.min(segundosDecorridos, disciplina.tempoRestante);
                
                disciplina.tempoRestante -= decremento;
                disciplina.tempoEstudado += decremento;
                totalTempoEstudado += decremento;
                
                // Atualiza o histórico
                const hoje = new Date().toLocaleDateString('pt-BR');
                if (!historicoEstudos[hoje]) {
                    historicoEstudos[hoje] = { tempo: 0, ciclos: 0 };
                }
                historicoEstudos[hoje].tempo += decremento;
                
                disciplina.inicioTimestamp = null;
            }
            
            salvarDisciplinas();
            salvarTempoTotal();
            salvarHistorico();
            relatorioAtualizado = false;
            atualizarTela();
        }

        function encerrarDisciplina(index) {
            const agora = Date.now();
            const disciplina = disciplinas[index];
            
            // Verifica se foi um clique duplo
            if (agora - ultimoClique < duploCliqueTempo) {
                resetarDisciplina(index);
                return;
            }
            
            disciplina.pausado = false;
            
            if (disciplina.interval) {
                clearInterval(disciplina.interval);
                disciplina.interval = null;
            }
            
            if (timerWorker) {
                timerWorker.postMessage({
                    command: 'stop',
                    disciplinaIndex: index
                });
            }
            
            // Atualiza o tempo restante com base no tempo decorrido
            if (disciplina.inicioTimestamp) {
                const segundosDecorridos = Math.floor((agora - disciplina.inicioTimestamp) / 1000);
                const decremento = Math.min(segundosDecorridos, disciplina.tempoRestante);
                
                disciplina.tempoRestante -= decremento;
                disciplina.tempoEstudado += decremento;
                totalTempoEstudado += decremento;
                
                // Atualiza o histórico
                const hoje = new Date().toLocaleDateString('pt-BR');
                if (!historicoEstudos[hoje]) {
                    historicoEstudos[hoje] = { tempo: 0, ciclos: 0 };
                }
                historicoEstudos[hoje].tempo += decremento;
                
                disciplina.inicioTimestamp = null;
            }
            
            salvarDisciplinas();
            salvarTempoTotal();
            salvarHistorico();
            relatorioAtualizado = false;
            atualizarTela();
            ultimoClique = agora;
        }

        function resetarDisciplina(index) {
            const disciplina = disciplinas[index];
            disciplina.tempoRestante = disciplina.minutos * 60;
            disciplina.tempoEstudado = 0;
            disciplina.interval = null;
            disciplina.pausado = false;
            disciplina.inicioTimestamp = null;
            
            if (timerWorker) {
                timerWorker.postMessage({
                    command: 'stop',
                    disciplinaIndex: index
                });
            }
            
            salvarDisciplinas();
            relatorioAtualizado = false;
            atualizarTela();
        }

        function resetarTodasDisciplinas() {
            disciplinas.forEach(disciplina => {
                disciplina.tempoRestante = disciplina.minutos * 60;
                disciplina.tempoEstudado = 0;
                disciplina.interval = null;
                disciplina.pausado = false;
                disciplina.inicioTimestamp = null;
            });
            
            if (timerWorker) {
                disciplinas.forEach((_, index) => {
                    timerWorker.postMessage({
                        command: 'stop',
                        disciplinaIndex: index
                    });
                });
            }
            
            salvarDisciplinas();
            relatorioAtualizado = false;
            atualizarTela();
        }

        function zerarProgresso() {
            if (confirm("Tem certeza que deseja zerar todo o progresso? Isso apagará todas as disciplinas e o histórico.")) {
                disciplinas = [];
                totalTempoEstudado = 0;
                ciclosConcluidos = 0;
                historicoEstudos = {};
                eventos = [];
                
                if (timerWorker) {
                    timerWorker.terminate();
                    timerWorker = new Worker(URL.createObjectURL(new Blob([`
                        let intervalIds = {};
                        
                        self.onmessage = function(e) {
                            const { command, disciplinaIndex } = e.data;
                            
                            if (command === 'start') {
                                if (intervalIds[disciplinaIndex]) {
                                    clearInterval(intervalIds[disciplinaIndex]);
                                }
                                
                                intervalIds[disciplinaIndex] = setInterval(() => {
                                    self.postMessage({ disciplinaIndex });
                                }, 1000);
                            }
                            else if (command === 'pause') {
                                if (intervalIds[disciplinaIndex]) {
                                    clearInterval(intervalIds[disciplinaIndex]);
                                    delete intervalIds[disciplinaIndex];
                                }
                            }
                            else if (command === 'stop') {
                                if (intervalIds[disciplinaIndex]) {
                                    clearInterval(intervalIds[disciplinaIndex]);
                                    delete intervalIds[disciplinaIndex];
                                }
                            }
                        };
                    `], { type: 'text/javascript' })));
                    
                    timerWorker.onmessage = function(e) {
                        const { disciplinaIndex } = e.data;
                        atualizarTemporizador(disciplinaIndex);
                    };
                }
                
                localStorage.removeItem("disciplinas");
                localStorage.removeItem("tempoTotal");
                localStorage.removeItem("ciclosConcluidos");
                localStorage.removeItem("historicoEstudos");
                localStorage.removeItem("eventos");
                relatorioAtualizado = false;
                atualizarTela();
            }
        }

        function atualizarRelatorio() {
            const lista = document.getElementById("listaRelatorio");
            lista.innerHTML = "";

            document.getElementById("totalCiclos").textContent = ciclosConcluidos;

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
                
                // Atualiza o histórico do dia atual
                const hoje = new Date().toLocaleDateString('pt-BR');
                if (!historicoEstudos[hoje]) {
                    historicoEstudos[hoje] = { tempo: 0, ciclos: 0 };
                }
                historicoEstudos[hoje].ciclos++;
                
                salvarCiclos();
                salvarHistorico();
                relatorioAtualizado = false;
                alert("🎉 Ciclo de estudos concluído!");
            }
        }

        function atualizarTemporizador(index) {
            const disciplina = disciplinas[index];
            
            if (disciplina.pausado || disciplina.tempoRestante <= 0) {
                if (disciplina.interval) {
                    clearInterval(disciplina.interval);
                    disciplina.interval = null;
                }
                return;
            }
            
            // Calcula o tempo decorrido desde o início
            const agora = Date.now();
            const segundosDecorridos = Math.floor((agora - disciplina.inicioTimestamp) / 1000);
            
            // Atualiza os valores
            const decremento = Math.min(segundosDecorridos, disciplina.tempoRestante);
            disciplina.tempoRestante -= decremento;
            disciplina.tempoEstudado += decremento;
            totalTempoEstudado += decremento;
            disciplina.inicioTimestamp = agora - ((segundosDecorridos - decremento) * 1000);
            
            // Atualiza o histórico
            const hoje = new Date().toLocaleDateString('pt-BR');
            if (!historicoEstudos[hoje]) {
                historicoEstudos[hoje] = { tempo: 0, ciclos: 0 };
            }
            historicoEstudos[hoje].tempo += decremento;
            
            salvarDisciplinas();
            salvarTempoTotal();
            salvarHistorico();
            atualizarTela();
            verificarCicloCompleto();
            
            if (disciplina.tempoRestante <= 0) {
                if (disciplina.interval) {
                    clearInterval(disciplina.interval);
                    disciplina.interval = null;
                }
                
                if (timerWorker) {
                    timerWorker.postMessage({
                        command: 'stop',
                        disciplinaIndex: index
                    });
                }
            }
        }

        function verificarTemporizadoresAtivos() {
            const agora = Date.now();
            
            disciplinas.forEach((disciplina, index) => {
                if (disciplina.inicioTimestamp && !disciplina.pausado && disciplina.tempoRestante > 0) {
                    const segundosDecorridos = Math.floor((agora - disciplina.inicioTimestamp) / 1000);
                    const decremento = Math.min(segundosDecorridos, disciplina.tempoRestante);
                    
                    disciplina.tempoRestante -= decremento;
                    disciplina.tempoEstudado += decremento;
                    totalTempoEstudado += decremento;
                    disciplina.inicioTimestamp = agora - ((segundosDecorridos - decremento) * 1000);
                    
                    // Atualiza o histórico
                    const hoje = new Date().toLocaleDateString('pt-BR');
                    if (!historicoEstudos[hoje]) {
                        historicoEstudos[hoje] = { tempo: 0, ciclos: 0 };
                    }
                    historicoEstudos[hoje].tempo += decremento;
                    
                    // Se ainda houver tempo restante, reinicie o temporizador
                    if (disciplina.tempoRestante > 0) {
                        disciplina.inicioTimestamp = agora;
                        iniciarTemporizador(index);
                    }
                }
            });
            
            salvarDisciplinas();
            salvarTempoTotal();
            salvarHistorico();
            atualizarTela();
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
            
            // Configurações do PDF
            doc.setFontSize(16);
            doc.text("Histórico de Estudos", 105, 15, { align: 'center' });
            
            doc.setFontSize(12);
            doc.text(`Total de tempo estudado: ${Math.floor(totalTempoEstudado / 3600)}h ${Math.floor((totalTempoEstudado % 3600) / 60)}min`, 20, 25);
            doc.text(`Total de ciclos concluídos: ${ciclosConcluidos}`, 20, 35);
            
            doc.line(20, 40, 190, 40); // Linha divisória
            
            // Ordena as datas por mês/ano
            const historicoPorMes = {};
            Object.keys(historicoEstudos).forEach(data => {
                const [dia, mes, ano] = data.split('/');
                const chaveMes = `${mes}/${ano}`;
                
                if (!historicoPorMes[chaveMes]) {
                    historicoPorMes[chaveMes] = [];
                }
                
                historicoPorMes[chaveMes].push({
                    data: `${dia}/${mes}/${ano}`,
                    info: historicoEstudos[data]
                });
            });
            
            // Ordena os meses do mais recente para o mais antigo
            const mesesOrdenados = Object.keys(historicoPorMes).sort((a, b) => {
                return new Date(b.split('/').reverse().join('-')) - new Date(a.split('/').reverse().join('-'));
            });
            
            let y = 50;
            
            // Adiciona cada mês ao PDF
            mesesOrdenados.forEach(mes => {
                doc.setFontSize(12);
                doc.setTextColor(100);
                doc.text(`Mês: ${mes}`, 20, y);
                y += 10;
                doc.setTextColor(0);
                
                // Ordena os dias do mês
                historicoPorMes[mes].sort((a, b) => {
                    return new Date(b.data.split('/').reverse().join('-')) - new Date(a.data.split('/').reverse().join('-'));
                });
                
                // Adiciona cada dia do mês
                historicoPorMes[mes].forEach(dia => {
                    const horas = Math.floor(dia.info.tempo / 3600);
                    const minutos = Math.floor((dia.info.tempo % 3600) / 60);
                    
                    doc.setFontSize(10);
                    doc.text(`- ${dia.data}: ${horas}h ${minutos}min | ${dia.info.ciclos || 0} ciclo(s)`, 25, y);
                    y += 7;
                    
                    // Quebra de página se necessário
                    if (y > 280) {
                        doc.addPage();
                        y = 20;
                    }
                });
                
                y += 5;
            });
            
            if (mesesOrdenados.length === 0) {
                doc.text("Nenhum registro de estudo encontrado.", 20, 60);
            }
            
            doc.save("historico_estudos.pdf");
        }

        // Funções para eventos
        function abrirModalEventos() {
            const modal = document.getElementById("modalEventos");
            modal.style.display = "block";
            
            // Configura a data mínima como hoje
            const hoje = new Date();
            const dataFormatada = hoje.toISOString().split('T')[0];
            document.getElementById("dataEvento").min = dataFormatada;
            
            atualizarListaEventos();
        }

        function fecharModalEventos() {
            document.getElementById("modalEventos").style.display = "none";
        }

        function abrirModalEdicaoEvento(id) {
            const evento = eventos.find(e => e.id === id);
            if (!evento) return;
            
            eventoEditandoId = id;
            const modal = document.getElementById("modalEdicaoEvento");
            const dataEvento = new Date(evento.data);
            const dataFormatada = dataEvento.toISOString().split('T')[0];
            
            document.getElementById("editarNomeEvento").value = evento.nome;
            document.getElementById("editarDataEvento").value = dataFormatada;
            
            // Configura a data mínima como hoje
            const hoje = new Date();
            const hojeFormatada = hoje.toISOString().split('T')[0];
            document.getElementById("editarDataEvento").min = hojeFormatada;
            
            modal.style.display = "block";
        }

        function fecharModalEdicaoEvento() {
            document.getElementById("modalEdicaoEvento").style.display = "none";
            eventoEditandoId = null;
        }

        function salvarEdicaoEvento() {
            if (eventoEditandoId === null) return;
            
            const eventoIndex = eventos.findIndex(e => e.id === eventoEditandoId);
            if (eventoIndex === -1) return;
            
            const novoNome = document.getElementById("editarNomeEvento").value.trim();
            const novaData = document.getElementById("editarDataEvento").value;
            
            if (novoNome && novaData) {
                const dataEvento = new Date(novaData);
                const hoje = new Date();
                hoje.setHours(0, 0, 0, 0);
                
                eventos[eventoIndex].nome = novoNome;
                eventos[eventoIndex].data = dataEvento.getTime();
                
                salvarEventos();
                atualizarListaEventos();
                fecharModalEdicaoEvento();
            } else {
                alert("Por favor, preencha todos os campos.");
            }
        }

        function adicionarEvento() {
            const nome = document.getElementById("nomeEvento").value.trim();
            const data = document.getElementById("dataEvento").value;
            
            if (nome && data) {
                const dataEvento = new Date(data);
                const hoje = new Date();
                hoje.setHours(0, 0, 0, 0);
                
                if (dataEvento < hoje) {
                    alert("Por favor, selecione uma data futura.");
                    return;
                }
                
                eventos.push({
                    nome,
                    data: dataEvento.getTime(),
                    id: Date.now()
                });
                
                salvarEventos();
                atualizarListaEventos();
                
                // Limpa os campos
                document.getElementById("nomeEvento").value = "";
                document.getElementById("dataEvento").value = "";
            } else {
                alert("Por favor, preencha todos os campos.");
            }
        }

        function editarEvento(id) {
            abrirModalEdicaoEvento(id);
        }

        function excluirEvento(id) {
            if (confirm("Tem certeza que deseja excluir este evento?")) {
                eventos = eventos.filter(e => e.id !== id);
                salvarEventos();
                atualizarListaEventos();
            }
        }

        function atualizarListaEventos() {
            const lista = document.getElementById("eventosLista");
            lista.innerHTML = "";
            
            if (eventos.length === 0) {
                lista.innerHTML = "<p>Nenhum evento cadastrado.</p>";
                return;
            }
            
            // Ordena eventos por data (mais próximos primeiro)
            eventos.sort((a, b) => a.data - b.data);
            
            const hoje = new Date();
            hoje.setHours(0, 0, 0, 0);
            
            eventos.forEach(evento => {
                const dataEvento = new Date(evento.data);
                const diffTime = dataEvento - hoje;
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                
                const div = document.createElement("div");
                div.className = "evento";
                
                // Adiciona classes CSS baseadas na proximidade do evento
                if (diffDays <= 0) {
                    div.classList.add("evento-passado");
                } else if (diffDays <= 7) {
                    div.classList.add("evento-proximo");
                }
                
                let textoContagem;
                if (diffDays < 0) {
                    textoContagem = "Evento passado";
                } else if (diffDays === 0) {
                    textoContagem = "Evento é hoje!";
                } else {
                    textoContagem = `Faltam ${diffDays} dia(s)`;
                }
                
                div.innerHTML = `
                    <div class="evento-info">
                        <strong>${evento.nome}</strong>
                        <div>${dataEvento.toLocaleDateString('pt-BR')}</div>
                        <div class="contagem-regressiva">${textoContagem}</div>
                    </div>
                    <div class="evento-controles">
                        <button onclick="editarEvento(${evento.id})">✏️</button>
                        <button onclick="excluirEvento(${evento.id})">🗑</button>
                    </div>
                `;
                
                lista.appendChild(div);
            });
        }

        // Inicialização
        window.addEventListener('load', function() {
            if (!localStorage.getItem("historicoEstudos")) {
                salvarHistorico();
            }
            
            if (!localStorage.getItem("eventos")) {
                salvarEventos();
            }
            
            // Verifica se há temporizadores ativos ao carregar a página
            verificarTemporizadoresAtivos();
            atualizarTela();
        });

        // Atualiza os temporizadores quando a página ganha foco
        window.addEventListener('focus', verificarTemporizadoresAtivos);
        
        document.getElementById("ano").textContent = new Date().getFullYear(); //Atualiza ano no footer
