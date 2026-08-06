import * as XLSX from 'xlsx';

export const LARGE_SPREADSHEET_THRESHOLD_BYTES = 10 * 1024 * 1024;
export const EXCEL_PREVIEW_PAGE_SIZE = 100;

export interface ExcelPreviewSheetMetadata {
  name: string;
  headers: string[];
  columnWidths: number[];
  totalRows: number;
}

export interface ExcelPreviewPage {
  sheetIndex: number;
  page: number;
  rows: unknown[][];
}

export interface ExcelPreviewData {
  sheets: ExcelPreviewSheetMetadata[];
  firstPages: ExcelPreviewPage[];
}

export type ExcelPreviewWorkerRequest =
  | {
    type: 'load';
    buffer: ArrayBuffer;
    fileName: string;
    pageSize: number;
  }
  | {
    type: 'page';
    sheetIndex: number;
    page: number;
    pageSize: number;
  };

export type ExcelPreviewWorkerResponse =
  | ({
    type: 'preview-ready';
    preparingFullWorkbook: boolean;
  } & ExcelPreviewData)
  | { type: 'workbook-ready'; sheets: ExcelPreviewSheetMetadata[] }
  | ({ type: 'page-ready' } & ExcelPreviewPage)
  | { type: 'error'; message: string };

type WorksheetWithFullRange = XLSX.WorkSheet & { '!fullref'?: string };

export function shouldPreparePreviewFirst(byteLength: number): boolean {
  return byteLength >= LARGE_SPREADSHEET_THRESHOLD_BYTES;
}

export function getColumnName(index: number): string {
  let name = '';
  let num = index;
  while (num >= 0) {
    name = String.fromCharCode((num % 26) + 65) + name;
    num = Math.floor(num / 26) - 1;
  }
  return name;
}

export function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') {
    if (value > 25569 && value < 50000) {
      try {
        const date = new Date((value - 25569) * 86400 * 1000);
        const y = date.getUTCFullYear();
        const m = date.getUTCMonth() + 1;
        const d = date.getUTCDate();
        if (y >= 1900 && y <= 2100) {
          return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        }
      } catch {
        // 不是有效日期时按普通数字展示。
      }
    }
    if (Number.isInteger(value)) return value.toLocaleString();
    return value.toLocaleString(undefined, { maximumFractionDigits: 4 });
  }
  return String(value);
}

function calculateColumnWidths(data: unknown[][], maxRows = 100): number[] {
  if (data.length === 0) return [];

  const maxCols = Math.max(...data.slice(0, maxRows).map((row) => row.length));
  const widths = new Array(maxCols).fill(80);
  const sampleRows = data.slice(0, Math.min(maxRows, data.length));

  for (let col = 0; col < maxCols; col += 1) {
    let maxLen = 0;
    for (const row of sampleRows) {
      maxLen = Math.max(maxLen, formatCellValue(row[col]).length);
    }
    widths[col] = Math.min(Math.max(maxLen * 10 + 24, 60), 300);
  }

  return widths;
}

function hasGarbledText(text: string): boolean {
  return /[\u00c0-\u00ff]{3,}|[\ufffd]{2,}/.test(text);
}

function decodeCsv(buffer: ArrayBuffer): string {
  for (const encoding of ['utf-8', 'gbk', 'gb18030', 'big5']) {
    try {
      const decoded = new TextDecoder(encoding, { fatal: true }).decode(buffer);
      if (!hasGarbledText(decoded)) return decoded;
    } catch {
      // 继续尝试下一个编码。
    }
  }
  return new TextDecoder('utf-8', { fatal: false }).decode(buffer);
}

function getSheetRange(worksheet: WorksheetWithFullRange): XLSX.Range | null {
  const rangeRef = worksheet['!fullref'] ?? worksheet['!ref'];
  if (!rangeRef) return null;
  try {
    return XLSX.utils.decode_range(rangeRef);
  } catch {
    return null;
  }
}

export function readSpreadsheetWorkbook(
  buffer: ArrayBuffer,
  fileName: string,
  previewDataRowLimit?: number,
): XLSX.WorkBook {
  const options: XLSX.ParsingOptions = {
    cellDates: true,
    cellFormula: false,
    cellHTML: false,
    cellStyles: false,
    dense: true,
    sheetRows: previewDataRowLimit ? previewDataRowLimit + 1 : 0,
  };

  return fileName.toLowerCase().endsWith('.csv')
    ? XLSX.read(decodeCsv(buffer), { ...options, type: 'string' })
    : XLSX.read(buffer, { ...options, type: 'array' });
}

export function extractSpreadsheetPage(
  workbook: XLSX.WorkBook,
  sheetIndex: number,
  page: number,
  pageSize: number,
): ExcelPreviewPage {
  const sheetName = workbook.SheetNames[sheetIndex];
  const worksheet = workbook.Sheets[sheetName] as WorksheetWithFullRange | undefined;
  const range = worksheet ? getSheetRange(worksheet) : null;
  const startRow = (range?.s.r ?? 0) + 1 + (page - 1) * pageSize;

  if (!worksheet || !range || startRow > range.e.r) {
    return { sheetIndex, page, rows: [] };
  }

  const rows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
    header: 1,
    defval: null,
    range: {
      s: { r: startRow, c: range.s.c },
      e: { r: Math.min(range.e.r, startRow + pageSize - 1), c: range.e.c },
    },
  }) as unknown[][];

  return { sheetIndex, page, rows };
}

export function createSpreadsheetPreview(
  workbook: XLSX.WorkBook,
  pageSize: number,
): ExcelPreviewData {
  const firstPages = workbook.SheetNames.map((_, sheetIndex) => (
    extractSpreadsheetPage(workbook, sheetIndex, 1, pageSize)
  ));

  const sheets = workbook.SheetNames.map((name, sheetIndex) => {
    const worksheet = workbook.Sheets[name] as WorksheetWithFullRange;
    const range = getSheetRange(worksheet);
    const headerRows = range
      ? XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
        header: 1,
        defval: null,
        range: {
          s: { r: range.s.r, c: range.s.c },
          e: { r: range.s.r, c: range.e.c },
        },
      }) as unknown[][]
      : [];
    const rawHeaders = headerRows[0] ?? [];
    const columnCount = range ? range.e.c - range.s.c + 1 : rawHeaders.length;
    const headers = Array.from({ length: columnCount }, (_, index) => {
      const value = rawHeaders[index];
      return value === null || value === undefined || value === ''
        ? getColumnName(index)
        : String(value);
    });
    const sample = [rawHeaders, ...firstPages[sheetIndex].rows];

    return {
      name,
      headers,
      columnWidths: calculateColumnWidths(sample),
      totalRows: range ? Math.max(0, range.e.r - range.s.r) : 0,
    };
  });

  return { sheets, firstPages };
}
