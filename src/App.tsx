import { FormEvent, useMemo, useState } from 'react';

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
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [copyMessage, setCopyMessage] = useState<string>('');
  const [copyMessageType, setCopyMessageType] = useState<'success' | 'error'>('success');

  const canOptimize = useMemo(() => {
    return Boolean(resumeId && jobDescription.trim() && immutableData.trim() && !isOptimizing);
  }, [resumeId, jobDescription, immutableData, isOptimizing]);

  const handleUpload = async (event: FormEvent) => {
    event.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!file) {
      setErrorMessage('Selecione um arquivo PDF para continuar.');
      return;
    }

    setIsUploading(true);

    try {
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
      setOptimizedHtml('');
      setDownloadUrl('');
      setSuccessMessage('PDF enviado e convertido para HTML com sucesso.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro inesperado no upload.';
      setErrorMessage(message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleOptimize = async () => {
    setErrorMessage('');
    setSuccessMessage('');

    if (!canOptimize) {
      setErrorMessage('Preencha todos os campos antes de otimizar.');
      return;
    }

    setIsOptimizing(true);

    try {
      const optimizeResponse = await fetch(`${API_BASE_URL}/resumes/${resumeId}/optimize`, {
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

      const generateResponse = await fetch(
        `${API_BASE_URL}/resumes/${resumeId}/generate-pdf`,
        {
          method: 'POST',
        },
      );

      const generatePayload = (await generateResponse.json()) as GeneratePdfResponse & {
        message?: string;
      };

      if (!generateResponse.ok) {
        throw new Error(generatePayload.message || 'Erro ao gerar PDF final.');
      }

      setDownloadUrl(`${API_BASE_URL}${generatePayload.downloadUrl}`);
      setDownloadFileName(generatePayload.fileName || 'curriculo-otimizado.pdf');
      setSuccessMessage('Currículo otimizado com sucesso. Preview e download disponíveis.');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Erro inesperado na otimização.';
      setErrorMessage(message);
    } finally {
      setIsOptimizing(false);
    }
  };

  const copyHtmlToClipboard = async (htmlValue: string, label: string) => {
    setCopyMessage('');
    setCopyMessageType('success');

    if (!htmlValue.trim()) {
      setCopyMessage(`Nenhum ${label} disponível para copiar.`);
      setCopyMessageType('error');
      return;
    }

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(htmlValue);
        setCopyMessage(`${label} copiado para a área de transferência.`);
        setCopyMessageType('success');
        return;
      }
    } catch {
      // Fallback abaixo.
    }

    const copiedWithFallback = fallbackCopyToClipboard(htmlValue);
    if (copiedWithFallback) {
      setCopyMessage(`${label} copiado para a área de transferência.`);
      setCopyMessageType('success');
    } else {
      setCopyMessage('Não foi possível copiar automaticamente. Tente novamente.');
      setCopyMessageType('error');
    }
  };

  const handleCopyOptimizedHtml = async () => {
    await copyHtmlToClipboard(optimizedHtml, 'HTML otimizado');
  };

  const handleCopyOriginalHtml = async () => {
    await copyHtmlToClipboard(originalHtml, 'HTML original extraído');
  };

  return (
    <main className="page">
      <section className="card">
        <h1>ATS Optimizer</h1>
        <p className="subtitle">
          Faça upload do currículo em PDF, informe a vaga e gere uma versão otimizada para ATS.
        </p>

        <form className="upload-form" onSubmit={handleUpload}>
          <label htmlFor="resume-file">Currículo em PDF</label>
          <input
            id="resume-file"
            type="file"
            accept="application/pdf"
            onChange={(event) => setFile(event.target.files?.[0] || null)}
          />

          <button type="submit" disabled={isUploading}>
            {isUploading ? 'Enviando...' : 'Enviar e converter PDF'}
          </button>
        </form>

        {resumeId && (
          <p className="status">
            ID do currículo carregado: <strong>{resumeId}</strong>
          </p>
        )}

        <label htmlFor="job-description">Descrição da vaga</label>
        <textarea
          id="job-description"
          value={jobDescription}
          onChange={(event) => setJobDescription(event.target.value)}
          placeholder="Cole aqui a descrição completa da vaga"
          rows={8}
        />

        <label htmlFor="immutable-data">Dados que não podem ser alterados</label>
        <textarea
          id="immutable-data"
          value={immutableData}
          onChange={(event) => setImmutableData(event.target.value)}
          placeholder="Ex.: Nome, telefone, e-mail, LinkedIn, datas de experiência, empresa atual, cidade"
          rows={6}
        />

        <button type="button" className="optimize" disabled={!canOptimize} onClick={handleOptimize}>
          {isOptimizing ? 'Otimizando...' : 'Otimizar currículo para ATS'}
        </button>

        {errorMessage && <p className="message error">{errorMessage}</p>}
        {successMessage && <p className="message success">{successMessage}</p>}

        {downloadUrl && (
          <a className="download" href={downloadUrl} download={downloadFileName}>
            Baixar PDF otimizado
          </a>
        )}
      </section>

      <section className="card preview-card">
        <h2>Preview HTML otimizado</h2>
        <button type="button" onClick={handleCopyOptimizedHtml} disabled={!optimizedHtml.trim()}>
          Copiar HTML otimizado
        </button>
        {copyMessage && <p className={`message ${copyMessageType}`}>{copyMessage}</p>}

        {optimizedHtml ? (
          <iframe title="Preview do currículo otimizado" srcDoc={optimizedHtml} className="preview" />
        ) : (
          <p className="empty">O preview será exibido após a otimização.</p>
        )}

        <details>
          <summary>Ver HTML original extraído (debug)</summary>
          <button
            type="button"
            className="copy-original-button"
            onClick={handleCopyOriginalHtml}
            disabled={!originalHtml.trim()}
          >
            Copiar HTML original extraído
          </button>
          <pre>{originalHtml || 'Nenhum HTML original disponível.'}</pre>
        </details>
      </section>
    </main>
  );
}

export default App;
