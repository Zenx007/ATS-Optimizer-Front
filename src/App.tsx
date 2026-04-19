import { DragEvent, useEffect, useMemo, useState } from 'react';

type UploadResponse = {
  resumeId: string;
  originalHtml: string;
};

type OptimizeResponse = {
  resumeId: string;
  optimizedHtml: string;
};

type GeneratePdfResponse = {
  resumeId: string;
  downloadUrl: string;
  fileName: string;
};

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') || 'http://localhost:3000';

const fallbackCopyToClipboard = (value: string): boolean => {
  const textArea = document.createElement('textarea');
  textArea.value = value;
  textArea.setAttribute('readonly', '');
  textArea.style.position = 'fixed';
  textArea.style.top = '-9999px';
  textArea.style.left = '-9999px';
  document.body.appendChild(textArea);

  const selection = document.getSelection();
  const selectedRange = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

  textArea.focus();
  textArea.select();
  textArea.setSelectionRange(0, textArea.value.length);

  const copied = document.execCommand('copy');
  document.body.removeChild(textArea);

  if (selection && selectedRange) {
    selection.removeAllRanges();
    selection.addRange(selectedRange);
  }

  return copied;
};

function App() {
  const [file, setFile] = useState<File | null>(null);
  const [resumeId, setResumeId] = useState<string>('');
  const [jobDescription, setJobDescription] = useState<string>('');
  const [immutableData, setImmutableData] = useState<string>('');
  const [originalHtml, setOriginalHtml] = useState<string>('');
  const [optimizedHtml, setOptimizedHtml] = useState<string>('');
  const [downloadUrl, setDownloadUrl] = useState<string>('');
  const [downloadFileName, setDownloadFileName] = useState<string>('curriculo-otimizado.pdf');
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [isOptimizing, setIsOptimizing] = useState<boolean>(false);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [copyMessage, setCopyMessage] = useState<string>('');

  const hasOptimizedResult = Boolean(optimizedHtml.trim());

  useEffect(() => {
    document.documentElement.lang = 'pt-BR';
  }, []);

  const canOptimize = useMemo(() => {
    return Boolean(jobDescription.trim() && immutableData.trim() && !isUploading && !isOptimizing);
  }, [jobDescription, immutableData, isOptimizing, isUploading]);

  const uploadResume = async (): Promise<UploadResponse> => {
    if (!file) {
      throw new Error('Selecione um arquivo PDF para continuar.');
    }

    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_BASE_URL}/resumes/upload`, {
      method: 'POST',
      body: formData,
    });

    const payload = (await response.json()) as UploadResponse & { message?: string };

    if (!response.ok) {
      throw new Error(payload.message || 'Falha no upload do currículo.');
    }

    setResumeId(payload.resumeId);
    setOriginalHtml(payload.originalHtml || '');

    return payload;
  };

  const handleOptimize = async () => {
    setErrorMessage('');
    setSuccessMessage('');
    setCopyMessage('');

    if (!canOptimize) {
      setErrorMessage('Preencha todos os campos para otimizar.');
      return;
    }

    if (!file && !resumeId) {
      setErrorMessage('Adicione o PDF do currículo para continuar.');
      return;
    }

    setIsOptimizing(true);

    try {
      let currentResumeId = resumeId;

      if (!currentResumeId) {
        setIsUploading(true);
        const uploadPayload = await uploadResume();
        currentResumeId = uploadPayload.resumeId;
      }

      const optimizeResponse = await fetch(`${API_BASE_URL}/resumes/${currentResumeId}/optimize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jobDescription,
          immutableData,
        }),
      });

      const optimizePayload = (await optimizeResponse.json()) as OptimizeResponse & {
        message?: string;
      };

      if (!optimizeResponse.ok) {
        throw new Error(optimizePayload.message || 'Erro ao otimizar currículo.');
      }

      setOptimizedHtml(optimizePayload.optimizedHtml);

      const generateResponse = await fetch(`${API_BASE_URL}/resumes/${currentResumeId}/generate-pdf`, {
        method: 'POST',
      });

      const generatePayload = (await generateResponse.json()) as GeneratePdfResponse & {
        message?: string;
      };

      if (!generateResponse.ok) {
        throw new Error(generatePayload.message || 'Erro ao gerar PDF final.');
      }

      setDownloadUrl(`${API_BASE_URL}${generatePayload.downloadUrl}`);
      setDownloadFileName(generatePayload.fileName || 'curriculo-otimizado.pdf');
      setSuccessMessage('Currículo otimizado com sucesso.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro inesperado no processamento.';
      setErrorMessage(message);
    } finally {
      setIsUploading(false);
      setIsOptimizing(false);
    }
  };

  const copyOptimizedHtml = async () => {
    setCopyMessage('');

    if (!optimizedHtml.trim()) {
      setCopyMessage('Nenhum conteúdo otimizado disponível para copiar.');
      return;
    }

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(optimizedHtml);
        setCopyMessage('Conteúdo otimizado copiado.');
        return;
      }
    } catch {
      // Fallback abaixo.
    }

    if (fallbackCopyToClipboard(optimizedHtml)) {
      setCopyMessage('Conteúdo otimizado copiado.');
    } else {
      setCopyMessage('Não foi possível copiar automaticamente.');
    }
  };

  const handleEditAgain = () => {
    setOptimizedHtml('');
    setDownloadUrl('');
    setCopyMessage('');
    setSuccessMessage('');
    setErrorMessage('');
  };

  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(false);

    const droppedFile = event.dataTransfer.files?.[0];
    if (!droppedFile) {
      return;
    }

    if (droppedFile.type !== 'application/pdf') {
      setErrorMessage('Apenas arquivos PDF são suportados.');
      return;
    }

    setFile(droppedFile);
    setResumeId('');
    setOriginalHtml('');
    setSuccessMessage('PDF selecionado e pronto para otimização.');
  };

  const handleFileSelection = (selectedFile: File | null) => {
    setFile(selectedFile);
    setResumeId('');
    setOriginalHtml('');

    if (!selectedFile) {
      setSuccessMessage('');
      return;
    }

    if (selectedFile.type !== 'application/pdf') {
      setErrorMessage('Apenas arquivos PDF são suportados.');
      return;
    }

    setErrorMessage('');
    setSuccessMessage('PDF selecionado e pronto para otimização.');
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">ATS Optimizer</div>
      </header>

      {!hasOptimizedResult ? (
        <main className="hero-layout">
          <section className="hero-copy">
            <span className="eyebrow">INTELIGÊNCIA ARTIFICIAL</span>
            <h1>
              Otimização
              <br />
              <span>de precisão.</span>
            </h1>
            <p>
              Upload do seu currículo atual, cole a vaga alvo e defina os limites.
              Nossa arquitetura executiva alinha sua experiência com precisão.
            </p>

            <div className="stats">
              <div>
                <strong>98%</strong>
                <small>TAXA DE COMPATIBILIDADE ATS</small>
              </div>
              <div>
                <strong>&lt; 2s</strong>
                <small>TEMPO DE OTIMIZAÇÃO</small>
              </div>
            </div>
          </section>

          <section className="optimizer-panel">
            <p className="panel-title">CURRÍCULO ATUAL</p>

            <label
              htmlFor="resume-file"
              className={`dropzone ${isDragOver ? 'drag-over' : ''}`}
              onDragEnter={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setIsDragOver(true);
              }}
              onDragOver={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setIsDragOver(true);
              }}
              onDragLeave={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setIsDragOver(false);
              }}
              onDrop={handleDrop}
            >
              <input
                id="resume-file"
                type="file"
                accept="application/pdf"
                onChange={(event) => handleFileSelection(event.target.files?.[0] || null)}
              />
              <span className="drop-icon">PDF</span>
              <strong>Arraste e solte o seu currículo em PDF</strong>
              <small>ou clique para selecionar no computador</small>
              {file && <em>Arquivo: {file.name}</em>}
            </label>

            <div className="field-grid">
              <div>
                <label htmlFor="job-description">DESCRIÇÃO DA VAGA</label>
                <textarea
                  id="job-description"
                  value={jobDescription}
                  onChange={(event) => setJobDescription(event.target.value)}
                  placeholder="Cole aqui a descrição da vaga para análise de palavras-chave e tom"
                  rows={6}
                />
              </div>

              <div>
                <label htmlFor="immutable-data">REGRAS DE RESTRIÇÃO (NÃO MUDAR)</label>
                <textarea
                  id="immutable-data"
                  value={immutableData}
                  onChange={(event) => setImmutableData(event.target.value)}
                  placeholder="Ex.: não alterar contato, cargos anteriores ou datas de emprego"
                  rows={6}
                />
              </div>
            </div>

            <button
              type="button"
              className="optimize-button"
              disabled={!canOptimize}
              onClick={handleOptimize}
            >
              {isOptimizing || isUploading ? 'Processando...' : 'Otimizar Currículo'}
            </button>

            {errorMessage && <p className="message error">{errorMessage}</p>}
            {successMessage && <p className="message success">{successMessage}</p>}
          </section>
        </main>
      ) : (
        <main className="result-layout">
          <section className="result-header">
            <span>ANÁLISE CONCLUÍDA</span>
            <h2>Novo Currículo Otimizado</h2>
            <p>
              A IA refinou o perfil, melhorando clareza, impacto e aderência para ATS.
            </p>
          </section>

          <div className="result-grid">
            <section className="resume-card">
              <div className="resume-badge">Otimizado para ATS</div>
              <iframe
                title="Preview do currículo otimizado"
                srcDoc={optimizedHtml}
                className="resume-preview"
              />
            </section>

            <aside className="insights-column">
              <section className="insight-card">
                <h3>Impacto da Otimização</h3>
                <p>Seu currículo agora possui maior densidade de palavras-chave e foco em resultados.</p>
                <div className="mini-stats">
                  <div>
                    <small>SCORE ATS</small>
                    <strong>92/100</strong>
                  </div>
                  <div>
                    <small>MÉTRICAS ADICIONADAS</small>
                    <strong>+4</strong>
                  </div>
                </div>
              </section>

              <section className="insight-card">
                <h3>Principais Mudanças</h3>
                <ul>
                  <li>Resumo reescrito para liderança e clareza executiva.</li>
                  <li>Métricas quantificadas adicionadas em experiências-chave.</li>
                  <li>Estrutura organizada para leitura ATS automatizada.</li>
                </ul>
              </section>

              <section className="actions-card">
                {downloadUrl && (
                  <a className="download-button" href={downloadUrl} download={downloadFileName}>
                    Baixar PDF
                  </a>
                )}
                <button type="button" className="secondary-button" onClick={copyOptimizedHtml}>
                  Copiar Texto
                </button>
                <button type="button" className="link-style" onClick={handleEditAgain}>
                  Editar Novamente
                </button>
                {copyMessage && <p className="message info">{copyMessage}</p>}
                {errorMessage && <p className="message error">{errorMessage}</p>}
                {successMessage && <p className="message success">{successMessage}</p>}
              </section>
            </aside>
          </div>
        </main>
      )}

      <footer className="footer">
        <div>
          <strong>ATS Optimizer</strong>
          <p>© 2024 ATS Optimizer AI.</p>
        </div>
      </footer>
    </div>
  );
}

export default App;
