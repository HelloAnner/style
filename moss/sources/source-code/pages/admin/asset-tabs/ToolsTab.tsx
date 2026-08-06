/**
 * 资产管理 → 工具 Tab。
 *
 * 当前使用 mock 数据展示，等后端租户级工具 API 就绪后替换。
 * TODO: 接入后端 /api/tools 接口（租户级工具池）
 */


// ── Mock 数据 ──
// TODO: 替换为真实 API 调用（后端租户级工具接口待设计）

interface ToolItem {
  id: string;
  name: string;
  description: string;
}

const MOCK_TOOLS: ToolItem[] = [
  { id: 'web-search', name: 'web_search', description: '搜索互联网获取最新信息' },
  { id: 'code-interpreter', name: 'code_interpreter', description: '执行 Python 代码，支持数据分析与可视化' },
  { id: 'file-read', name: 'file_read', description: '读取本地文件内容' },
  { id: 'file-write', name: 'file_write', description: '向本地文件写入内容' },
  { id: 'bash', name: 'bash', description: '执行 Shell 命令' },
];

const toTestIdSegment = (value: string) => value.replace(/[^a-zA-Z0-9_-]+/g, '-');

// ── 工具行 ──

function ToolRow({ tool }: { tool: ToolItem }) {
  const toolId = toTestIdSegment(tool.id);

  return (
    <div
      className="tools-tab-tool-row"
      data-testid={`tools-tab-tool-row-${toolId}`}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
        padding: '12px 16px',
        border: '1px solid var(--border-subtle)',
        borderRadius: '8px',
        background: 'var(--bg-secondary)',
      }}
    >
      <div
        style={{
          width: '32px',
          height: '32px',
          borderRadius: '6px',
          background: 'var(--bg-tertiary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          fontSize: '14px',
          color: 'var(--text-muted)',
          fontFamily: 'monospace',
        }}
      >
        {'{}'}
      </div>
      <div>
        <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', fontFamily: 'monospace' }}>
          {tool.name}
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
          {tool.description}
        </div>
      </div>
    </div>
  );
}

// ── Tab 主体 ──

export function ToolsTab() {
  return (
    <div data-testid="tools-tab">
      <div
        data-testid="tools-tab-header"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '12px',
          padding: '8px 12px',
          borderRadius: '8px',
          background: 'var(--warning-bg-soft)',
          border: '1px solid var(--warning-border-soft)',
        }}
      >
        <span style={{ fontSize: '12px', color: 'var(--warning)' }}>
          当前展示 mock 数据，租户级工具 API 尚未就绪。
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }} data-testid="tools-tab-list">
        {MOCK_TOOLS.map((tool) => (
          <ToolRow key={tool.id} tool={tool} />
        ))}
      </div>
    </div>
  );
}
