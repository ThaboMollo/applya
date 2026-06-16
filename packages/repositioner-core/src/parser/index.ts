import { DocumentParser, ParsedDocument } from '../interfaces/parser.interface';

/**
 * MVP stub parser — uses mammoth (DOCX) and pdf-parse (PDF).
 * Replace by pointing the container to DoclingClient once the Docling Serve
 * container is running. The interface is identical; no downstream changes needed.
 *
 * See spec §5 Stage 1 for the full Docling integration plan.
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
    return {
      text: result.value,
      sections: [],
      fullyParsed: false,
    };
  }

  private async parsePdf(buffer: Buffer): Promise<ParsedDocument> {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require('pdf-parse') as typeof import('pdf-parse');
    const result = await pdfParse(buffer);
    return {
      text: result.text,
      sections: [],
      fullyParsed: false,
    };
  }
}

/**
 * Docling Serve client — calls the containerized Python service over HTTP.
 * Use this in production once the Docling Serve container is running on Fly.io/Railway.
 *
 * Docling Serve endpoint: POST /v1alpha/convert/source
 * Returns: DoclingDocument JSON
 */
export class DoclingClient implements DocumentParser {
  constructor(private readonly baseUrl: string) {}

  async parse(fileBuffer: Buffer, mimeType: string): Promise<ParsedDocument> {
    // TODO:
    // 1. POST fileBuffer to this.baseUrl + '/v1alpha/convert/source'
    //    with appropriate Content-Type header
    // 2. Parse DoclingDocument JSON from response
    // 3. Extract text + sections from the DoclingDocument
    // 4. Return ParsedDocument with fullyParsed: true
    throw new Error('DoclingClient not implemented — use MvpStubParser for now');
  }
}
