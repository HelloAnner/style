/// <reference lib="webworker" />

import * as XLSX from 'xlsx';
import {
  createSpreadsheetPreview,
  extractSpreadsheetPage,
  readSpreadsheetWorkbook,
  shouldPreparePreviewFirst,
  type ExcelPreviewWorkerRequest,
  type ExcelPreviewWorkerResponse,
} from './excelPreviewParser';

const workerScope = self as DedicatedWorkerGlobalScope;
let fullWorkbook: XLSX.WorkBook | null = null;

function postError(error: unknown) {
  const response: ExcelPreviewWorkerResponse = {
    type: 'error',
    message: error instanceof Error ? error.message : '加载失败',
  };
  workerScope.postMessage(response);
}

function prepareFullWorkbook(buffer: ArrayBuffer, fileName: string, pageSize: number) {
  fullWorkbook = readSpreadsheetWorkbook(buffer, fileName);
  const { sheets } = createSpreadsheetPreview(fullWorkbook, pageSize);
  workerScope.postMessage({ type: 'workbook-ready', sheets } satisfies ExcelPreviewWorkerResponse);
}

workerScope.onmessage = (event: MessageEvent<ExcelPreviewWorkerRequest>) => {
  try {
    if (event.data.type === 'page') {
      if (!fullWorkbook) throw new Error('工作簿仍在准备中，请稍后重试');
      const response: ExcelPreviewWorkerResponse = {
        type: 'page-ready',
        ...extractSpreadsheetPage(
          fullWorkbook,
          event.data.sheetIndex,
          event.data.page,
          event.data.pageSize,
        ),
      };
      workerScope.postMessage(response);
      return;
    }

    const { buffer, fileName, pageSize } = event.data;
    const preparePreviewFirst = shouldPreparePreviewFirst(buffer.byteLength);
    const workbook = readSpreadsheetWorkbook(
      buffer,
      fileName,
      preparePreviewFirst ? pageSize : undefined,
    );
    const response: ExcelPreviewWorkerResponse = {
      type: 'preview-ready',
      ...createSpreadsheetPreview(workbook, pageSize),
      preparingFullWorkbook: preparePreviewFirst,
    };
    workerScope.postMessage(response);

    if (preparePreviewFirst) {
      setTimeout(() => {
        try {
          prepareFullWorkbook(buffer, fileName, pageSize);
        } catch (error) {
          postError(error);
        }
      }, 0);
    } else {
      fullWorkbook = workbook;
      workerScope.postMessage({
        type: 'workbook-ready',
        sheets: response.sheets,
      } satisfies ExcelPreviewWorkerResponse);
    }
  } catch (error) {
    postError(error);
  }
};
