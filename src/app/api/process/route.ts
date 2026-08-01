import { NextRequest, NextResponse } from "next/server";
import { processPdfBuffer } from "@/lib/server/pdfProcessor";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided." }, { status: 400 });
  }

  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (!isPdf) {
    return NextResponse.json({ error: "Only PDF files are supported." }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await processPdfBuffer(buffer);
    return NextResponse.json(result);
  } catch (err) {
    console.error("PDF processing failed:", err);
    return NextResponse.json(
      {
        error:
          "Couldn't process that PDF. It may be scanned images without a text layer, or corrupted.",
      },
      { status: 422 }
    );
  }
}
