import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { mkdtemp, writeFile } from "fs/promises";
import { spawnSync } from "child_process";
import os from "os";
import path from "path";

export const runtime = "nodejs";
export const maxDuration = 600;

const MAX_BYTES = 200 * 1024 * 1024;

export async function POST(req: NextRequest) {
  let file: File | null = null;
  try {
    const form = await req.formData();
    const entry = form.get("file");
    if (entry instanceof File) file = entry;
  } catch {
    return NextResponse.json({ error: "Could not read the upload." }, { status: 400 });
  }
  if (!file || file.size === 0) {
    return NextResponse.json({ error: "No file received." }, { status: 400 });
  }
  if (!file.name.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json({ error: "Only PDF files are supported." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File is larger than 200 MB." }, { status: 400 });
  }

  const id = randomUUID().slice(0, 8);
  const tmp = await mkdtemp(path.join(os.tmpdir(), "restyle-"));
  const inPdf = path.join(tmp, "input.pdf");
  await writeFile(inPdf, Buffer.from(await file.arrayBuffer()));

  const outDir = path.join(process.cwd(), "public", "jobs", id);
  const python = path.join(process.cwd(), "..", ".venv", "bin", "python");
  const script = path.join(process.cwd(), "..", "scripts", "restyle.py");
  const run = spawnSync(python, [script, inPdf, "--out", outDir], {
    encoding: "utf-8",
    timeout: 9 * 60 * 1000,
  });
  if (run.status !== 0) {
    const detail = (run.stderr || run.error?.message || "unknown error").slice(-1000);
    return NextResponse.json({ error: `Restyling failed: ${detail}` }, { status: 500 });
  }

  const stats = /pages=(.*?) blocks=(\d+) figures=(\d+)/.exec(run.stdout || "");
  return NextResponse.json({
    id,
    url: `/jobs/${id}/restyled.html`,
    file: file.name,
    pages: stats?.[1]?.trim() ?? "?",
    blocks: Number(stats?.[2] ?? 0),
    figures: Number(stats?.[3] ?? 0),
  });
}
