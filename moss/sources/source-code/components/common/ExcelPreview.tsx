/**
 * Excel / CSV 文件预览器。
 * 大文件在 Worker 中解析，主线程一次只接收并渲染当前页。
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  Loader2,
  Table2,
} from 'lucide-react';
import { fetchMedia } from '../../lib/media';
import {
  EXCEL_PREVIEW_PAGE_SIZE,
  formatCellValue,
  getColumnName,
  type ExcelPreviewSheetMetadata,
  type ExcelPreviewWorkerRequest,
  type ExcelPreviewWorkerResponse,
} from './excelPreviewParser';
import './ExcelPreview.css';

interface ExcelPreviewProps {
  fileUrl: string;
  fileName: string;
  className?: string;
}

function pageKey(sheetIndex: number, page: number) {
  return `${sheetIndex}:${page}`;
}

export const ExcelPreview: React.FC<ExcelPreviewProps> = ({
  fileUrl,
  fileName,
  className = '',
}) => {
  const [sheets, setSheets] = useState<ExcelPreviewSheetMetadata[]>([]);
  const [activeSheetIndex, setActiveSheetIndex] = useState(0);
  const [rows, setRows] = useState<unknown[][]>([]);
  const [loading, setLoading] = useState(true);
  const [pageLoading, setPageLoading] = useState(false);
  const [preparingFullWorkbook, setPreparingFullWorkbook] = useState(false);
  const [workbookReady, setWorkbookReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const workerRef = useRef<Worker | null>(null);
  const activeSheetIndexRef = useRef(0);
  const firstPagesRef = useRef(new Map<string, unknown[][]>());
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const sheetTabsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const abortController = new AbortController();
    const worker = new Worker(new URL('./excelPreview.worker.ts', import.meta.url), { type: 'module' });
    let cancelled = false;
    workerRef.current = worker;

    const fail = (message: string) => {
      if (cancelled) return;
      setError(message);
      setLoading(false);
      setPageLoading(false);
      setPreparingFullWorkbook(false);
    };

    worker.onmessage = (event: MessageEvent<ExcelPreviewWorkerResponse>) => {
      if (cancelled) return;

      if (event.data.type === 'error') {
        fail(event.data.message);
        return;
      }

      if (event.data.type === 'preview-ready') {
        const firstPages = new Map<string, unknown[][]>();
        event.data.firstPages.forEach((previewPage) => {
          firstPages.set(pageKey(previewPage.sheetIndex, 1), previewPage.rows);
        });
        firstPagesRef.current = firstPages;
        activeSheetIndexRef.current = 0;
        setSheets(event.data.sheets);
        setRows(firstPages.get(pageKey(0, 1)) ?? []);
        setActiveSheetIndex(0);
        setPage(1);
        setPreparingFullWorkbook(event.data.preparingFullWorkbook);
        setLoading(false);
        return;
      }

      if (event.data.type === 'workbook-ready') {
        setSheets(event.data.sheets);
        setWorkbookReady(true);
        setPreparingFullWorkbook(false);
        return;
      }

      if (event.data.sheetIndex !== activeSheetIndexRef.current) return;
      setRows(event.data.rows);
      setPage(event.data.page);
      setPageLoading(false);
      if (tableContainerRef.current) {
        tableContainerRef.current.scrollTop = 0;
        tableContainerRef.current.scrollLeft = 0;
      }
    };
    worker.onerror = () => fail('Excel 解析进程异常');

    const loadExcel = async () => {
      setLoading(true);
      setError(null);
      setSheets([]);
      setRows([]);
      setWorkbookReady(false);
      setPreparingFullWorkbook(false);
      firstPagesRef.current.clear();

      try {
        const response = await fetchMedia(fileUrl, { signal: abortController.signal });
        if (!response.ok) throw new Error(`加载失败: ${response.status}`);

        const arrayBuffer = await response.arrayBuffer();
        if (cancelled) return;
        const request: ExcelPreviewWorkerRequest = {
          type: 'load',
          buffer: arrayBuffer,
          fileName,
          pageSize: EXCEL_PREVIEW_PAGE_SIZE,
        };
        worker.postMessage(request, [arrayBuffer]);
      } catch (loadError) {
        if (abortController.signal.aborted) return;
        fail(loadError instanceof Error ? loadError.message : '加载失败');
      }
    };

    void loadExcel();

    return () => {
      cancelled = true;
      abortController.abort();
      worker.terminate();
      if (workerRef.current === worker) workerRef.current = null;
    };
  }, [fileUrl, fileName]);

  const activeSheet = sheets[activeSheetIndex];
  const totalRows = activeSheet?.totalRows ?? 0;
  const totalPages = Math.ceil(totalRows / EXCEL_PREVIEW_PAGE_SIZE) || 1;

  const requestPage = useCallback((targetPage: number) => {
    const boundedPage = Math.min(Math.max(1, targetPage), totalPages);
    const firstPage = firstPagesRef.current.get(pageKey(activeSheetIndex, boundedPage));
    if (firstPage) {
      setRows(firstPage);
      setPage(boundedPage);
      if (tableContainerRef.current) {
        tableContainerRef.current.scrollTop = 0;
        tableContainerRef.current.scrollLeft = 0;
      }
      return;
    }
    if (!workbookReady || !workerRef.current) return;

    setPageLoading(true);
    const request: ExcelPreviewWorkerRequest = {
      type: 'page',
      sheetIndex: activeSheetIndex,
      page: boundedPage,
      pageSize: EXCEL_PREVIEW_PAGE_SIZE,
    };
    workerRef.current.postMessage(request);
  }, [activeSheetIndex, totalPages, workbookReady]);

  const handleSheetChange = useCallback((index: number) => {
    activeSheetIndexRef.current = index;
    setActiveSheetIndex(index);
    setPage(1);
    setRows(firstPagesRef.current.get(pageKey(index, 1)) ?? []);
    setPageLoading(false);
    if (tableContainerRef.current) {
      tableContainerRef.current.scrollTop = 0;
      tableContainerRef.current.scrollLeft = 0;
    }
  }, []);

  const scrollTabs = useCallback((direction: 'left' | 'right') => {
    sheetTabsRef.current?.scrollBy({
      left: direction === 'left' ? -150 : 150,
      behavior: 'smooth',
    });
  }, []);

  if (loading) {
    return (
      <div className={`excel-preview-state ${className}`} role="status" aria-live="polite">
        <Loader2 size={32} className="excel-preview-state-icon animate-spin" />
        <div className="excel-preview-state-title">正在解析 Excel 文件...</div>
        <div>{fileName}</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`excel-preview-state error ${className}`} role="alert">
        <AlertCircle size={48} className="excel-preview-state-icon" />
        <div className="excel-preview-state-title">Excel 加载失败</div>
        <div>{error}</div>
      </div>
    );
  }

  if (sheets.length === 0 || !activeSheet) {
    return (
      <div className={`excel-preview-state ${className}`}>
        <FileSpreadsheet size={48} className="excel-preview-state-icon" />
        <div className="excel-preview-state-title">Excel 文件为空</div>
        <div>该文件不包含任何数据</div>
      </div>
    );
  }

  return (
    <div className={`excel-preview ${className}`}>
      <div className="excel-preview-toolbar">
        <div className="excel-preview-info">
          <Table2 size={18} className="excel-preview-info-icon" />
          <span className="excel-preview-sheet-name" title={activeSheet.name}>
            {activeSheet.name}
          </span>
          <span className="excel-preview-meta">
            {totalRows.toLocaleString()} 行 × {activeSheet.headers.length} 列
          </span>
        </div>

        {totalPages > 1 && (
          <div className="excel-preview-pagination">
            <button
              type="button"
              onClick={() => requestPage(page - 1)}
              disabled={page === 1 || pageLoading}
              className="excel-preview-icon-btn"
              aria-label="上一页"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="excel-preview-page-text">
              第 {page} / {totalPages} 页
            </span>
            <button
              type="button"
              onClick={() => requestPage(page + 1)}
              disabled={!workbookReady || page === totalPages || pageLoading}
              className="excel-preview-icon-btn"
              aria-label="下一页"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>

      {(preparingFullWorkbook || pageLoading) && (
        <div className="excel-preview-progress" role="status" aria-live="polite">
          <Loader2 size={14} className="animate-spin" />
          {preparingFullWorkbook ? '已显示第 1 页，正在后台准备其余页面...' : '正在读取当前页...'}
        </div>
      )}

      <div
        ref={tableContainerRef}
        className="excel-preview-table-container"
        data-testid="excel-preview-table-container"
        aria-busy={pageLoading}
      >
        <table className="excel-preview-table">
          <thead>
            <tr>
              <th className="excel-preview-row-num">#</th>
              {activeSheet.headers.map((header, colIndex) => (
                <th
                  key={colIndex}
                  style={{ minWidth: activeSheet.columnWidths[colIndex] || 80, maxWidth: 400 }}
                >
                  <div className="excel-preview-header-label">
                    <span className="excel-preview-col-name">{getColumnName(colIndex)}</span>
                    <span className="excel-preview-header-text">{header}</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.map((row, rowIndex) => {
              const actualRowNum = (page - 1) * EXCEL_PREVIEW_PAGE_SIZE + rowIndex + 2;
              return (
                <tr key={actualRowNum}>
                  <td className="excel-preview-row-num">{actualRowNum}</td>
                  {activeSheet.headers.map((_, colIndex) => {
                    const cellValue = row[colIndex];
                    const displayValue = formatCellValue(cellValue);
                    const isNumber = typeof cellValue === 'number';
                    const isEmpty = cellValue === null || cellValue === undefined || cellValue === '';

                    return (
                      <td
                        key={colIndex}
                        className={isNumber ? 'excel-preview-cell-number' : ''}
                        style={{ minWidth: activeSheet.columnWidths[colIndex] || 80, maxWidth: 400 }}
                        title={displayValue.length > 50 ? displayValue : undefined}
                      >
                        <span className={`excel-preview-cell-content ${isEmpty ? 'excel-preview-cell-empty' : ''}`}>
                          {displayValue || '—'}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>

        {rows.length === 0 && (
          <div className="excel-preview-table-empty">该工作表没有数据</div>
        )}
      </div>

      {sheets.length > 1 && (
        <div className="excel-preview-tabs">
          <button
            type="button"
            onClick={() => scrollTabs('left')}
            className="excel-preview-icon-btn"
            aria-label="向左滚动"
          >
            <ChevronLeft size={16} />
          </button>

          <div ref={sheetTabsRef} className="excel-preview-tabs-scroll">
            {sheets.map((sheet, index) => (
              <button
                key={sheet.name}
                type="button"
                onClick={() => handleSheetChange(index)}
                className={`excel-preview-tab ${index === activeSheetIndex ? 'active' : ''}`}
              >
                <Table2 size={12} />
                <span>{sheet.name}</span>
                <span className="excel-preview-tab-count">({sheet.totalRows.toLocaleString()})</span>
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => scrollTabs('right')}
            className="excel-preview-icon-btn"
            aria-label="向右滚动"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
};

export default ExcelPreview;
