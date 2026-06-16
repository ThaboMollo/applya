/**
 * Stage 1 interface — document parser.
 * Current implementation: DoclingClient (HTTP call to Docling Serve container).
 * MVP stub: MammothParser (DOCX) / PdfParseParser (PDF) behind this same interface.
 *
 * Swap from stub to Docling by changing the concrete class registered with the
 * container — no pipeline code changes required.
 */
export interface DocumentParser {
  /**
   * Parse a resume file (PDF/DOCX/image) into plain text with semantic structure
   * preserved as best as possible.
   *
   * @param fileBuffer - raw file bytes
   * @param mimeType   - 'application/pdf' | 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' | ...
   * @returns DoclingDocument JSON string (when using Docling Serve)
   *          or structured markdown (when using the MVP stub)
   */
  parse(fileBuffer: Buffer, mimeType: string): Promise<ParsedDocument>;
}

export interface ParsedDocument {
  /** Full text with semantic ordering preserved */
  text: string;
  /** Structured sections as detected by the parser */
  sections: ParsedSection[];
  /** True when Docling Serve was used; false for the MVP stub */
  fullyParsed: boolean;
  /** Raw Docling JSON, if available */
  rawDoclingDocument?: unknown;
}

export interface ParsedSection {
  heading: string | null;
  body: string;
}
