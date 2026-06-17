import { DocumentParser, ParsedDocument, ParsedSection } from '../interfaces/parser.interface';

/**
 * MVP stub parser — uses mammoth (DOCX) and pdf-parse (PDF).
 * Used when DOCLING_SERVE_URL is not set.
 */
export class MvpStubParser implements DocumentParser {
  async parse(fileBuffer: Buffer, mimeType: string): Promise<ParsedDocument> {
    if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      return this.parseDocx(fileBuffer);
    }
    if (mimeType === 'application/pdf') {
      return this.parsePdf(fileBuffer);
    }
    throw new Error(`Unsupported MIME type: ${mimeType}. Only PDF and DOCX are supported.`);
  }

  private async parseDocx(buffer: Buffer): Promise<ParsedDocument> {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mammoth = require('mammoth') as typeof import('mammoth');
    const result = await mammoth.extractRawText({ buffer });
    return { text: result.value, sections: [], fullyParsed: false };
  }

  private async parsePdf(buffer: Buffer): Promise<ParsedDocument> {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require('pdf-parse') as typeof import('pdf-parse');
    const result = await pdfParse(buffer);
    return { text: result.text, sections: [], fullyParsed: false };
  }
}

/**
 * Docling Serve client — calls the containerised Python service over HTTP.
 *
 * Run locally:  docker compose up docling-serve
 * Set env var:  DOCLING_SERVE_URL=http://localhost:5001
 *
 * API: POST /v1alpha/convert/source
 *   Body: { file_source: { base64_string, filename, media_type } }
 *   Response: { document: { export_formats: { md?, text? }, sections? } }
 */
export class DoclingClient implements DocumentParser {
  constructor(private readonly baseUrl: string) {}

  async parse(fileBuffer: Buffer, mimeType: string): Promise<ParsedDocument> {
    await this.assertHealthy();

    const ext = mimeType.includes('pdf') ? 'pdf' : 'docx';
    const filename = `resume.${ext}`;

    const body = {
      file_source: {
        base64_string: fileBuffer.toString('base64'),
        filename,
        media_type: mimeType,
      },
      options: {
        to_formats: ['md', 'text'],
        return_as_file: false,
      },
    };

    const response = await fetch(`${this.baseUrl}/v1alpha/convert/source`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120_000), // Docling can be slow on cold start
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => response.statusText);
      throw new Error(`Docling Serve error ${response.status}: ${detail}`);
    }

    const data = await response.json() as DoclingResponse;
    return extractParsedDocument(data);
  }

  /**
   * Poll /health until Docling is ready, with a total timeout.
   * Necessary because scale-to-zero cold starts take 60-90s while ML models load.
   */
  private async assertHealthy(): Promise<void> {
    const deadline = Date.now() + 120_000; // 2 min total
    const interval = 5_000;

    while (Date.now() < deadline) {
      try {
        const res = await fetch(`${this.baseUrl}/health`, {
          signal: AbortSignal.timeout(5_000),
        });
        if (res.ok) return; // healthy
      } catch {
        // not up yet — keep polling
      }
      await new Promise((r) => setTimeout(r, interval));
    }

    throw new Error(
      `Docling Serve at ${this.baseUrl} did not become healthy within 2 minutes. ` +
      `Check the deployment logs on Fly.io / Railway.`,
    );
  }
}

// ── Response parsing ──────────────────────────────────────────────────────────

interface DoclingResponse {
  document?: {
    export_formats?: {
      md?: string;
      text?: string;
    };
    // Older Docling Serve versions surface text at the top level
    md_content?: string;
    text_content?: string;
    // Structured sections when available
    sections?: Array<{ heading?: string; text?: string }>;
  };
  // Some versions wrap in a 'result' key
  result?: DoclingResponse['document'];
  // Error detail
  detail?: string;
}

function extractParsedDocument(data: DoclingResponse): ParsedDocument {
  const doc = data.document ?? data.result ?? {};

  // Prefer markdown (preserves structure better for LLM extraction)
  const text =
    doc.export_formats?.md ??
    doc.export_formats?.text ??
    doc.md_content ??
    doc.text_content ??
    '';

  if (!text) {
    throw new Error('Docling Serve returned an empty document — the file may be image-only or corrupt.');
  }

  const sections: ParsedSection[] = (doc.sections ?? []).map((s) => ({
    heading: s.heading ?? null,
    body: s.text ?? '',
  }));

  return {
    text,
    sections,
    fullyParsed: true,
    rawDoclingDocument: data,
  };
}
