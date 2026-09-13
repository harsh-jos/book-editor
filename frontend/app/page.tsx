"use client";

import { useCallback, useRef, useState } from "react";

type Result = {
  id: string;
  url: string;
  file: string;
  pages: string;
  blocks: number;
  figures: number;
};

export default function Home() {
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [fileName, setFileName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setError("Please choose a PDF file.");
      return;
    }
    setBusy(true);
    setError("");
    setResult(null);
    setFileName(file.name);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/restyle", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Restyling failed.");
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }, []);

  return (
    <>
      <header className="site-header">
        <div className="wrap" style={{ paddingTop: 16, paddingBottom: 16 }}>
          <span className="wordmark">
            Restyle<span className="accent">.</span>
          </span>
          <span className="tagline">Same content, better look. Nothing rewritten.</span>
        </div>
      </header>

      <main className="wrap">
        <div className="grid">
          <section className="card">
            <div
              className={"dropzone" + (dragging ? " over" : "")}
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                const f = e.dataTransfer.files?.[0];
                if (f) upload(f);
              }}
            >
              <strong>{busy ? "Restyling…" : "Drop a PDF here"}</strong>
              <span>{busy ? fileName : "or click to browse — stays on this machine"}</span>
            </div>
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf,.pdf"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) upload(f);
                e.target.value = "";
              }}
            />
            <div className="row">
              <span className="label">Template</span>
              <span className="pill">White paper</span>
            </div>
            {busy && (
              <div className="progress">
                Extracting text and figures, applying the template…
                <div className="bar"><i /></div>
              </div>
            )}
            {error && <p className="error">{error}</p>}
            <p className="note">
              Fonts, spacing, margins and themes live in the Jinja template
              (<code>templates/whitepaper</code>). Styling controls land here next.
            </p>
            <ol className="steps">
              <li><b>1</b>Upload a text-based PDF (books, reports).</li>
              <li><b>2</b>Text order and figures are preserved untouched.</li>
              <li><b>3</b>Preview below, then print to PDF for the final file.</li>
            </ol>
          </section>

          <section>
            {!result && !busy && (
              <div className="empty">
                <strong>No document yet</strong>
                Upload a PDF to see it restyled in the white-paper template.
              </div>
            )}
            {result && (
              <>
                <div className="result-head">
                  <h2>{result.file}</h2>
                </div>
                <div className="chips">
                  <span className="chip"><b>{result.pages}</b></span>
                  <span className="chip"><b>{result.blocks}</b> blocks</span>
                  <span className="chip"><b>{result.figures}</b> figures</span>
                </div>
                <div className="actions">
                  <a className="btn primary" href={result.url} target="_blank" rel="noreferrer">
                    Open full page
                  </a>
                  <button className="btn ghost" onClick={() => inputRef.current?.click()}>
                    Restyle another
                  </button>
                </div>
                <div className="frame">
                  <iframe title="Restyled preview" src={result.url} />
                </div>
              </>
            )}
          </section>
        </div>
      </main>
    </>
  );
}
