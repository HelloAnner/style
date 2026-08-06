/**
 * Charts 代码块渲染器
 * 
 * 将 Markdown 中的 charts 代码块渲染为可视化图表
 * 支持的图表类型：
 * - table: 数据表格
 * - comparison: 对比图
 * - bar: 柱状图
 * - list: 列表
 * - timeline: 时间线
 * - metrics/metric: 指标卡片
 * - pie: 饼图
 * - radar: 雷达图
 * - line: 折线图
 * - combo: 组合图
 * - mindmap: 思维导图
 * - flowchart: 流程图
 * - matrix: 矩阵图
 * - roadmap: 路线图
 * - glossary: 术语表
 * - summary: 摘要
 * - rating: 评分
 * - scorecard: 计分卡
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';

interface ChartRendererProps {
  data: string;
}

// ========== 错误边界：捕获渲染错误，优雅降级 ==========
interface ErrorBoundaryProps {
  fallback: ReactNode;
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class ChartErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_: Error): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.warn('Chart render error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

// ========== 表格图表 ==========
const TableChartRenderer: React.FC<{ chart: any }> = ({ chart }) => {
  if (!chart.columns || !Array.isArray(chart.columns) || !chart.data || !Array.isArray(chart.data)) {
    return null;
  }
  
  return (
    <div className="my-4">
      {chart.title && (
        <h4 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
          {chart.title}
        </h4>
      )}
      <div className="overflow-x-auto rounded-lg" style={{ border: '1px solid var(--border-subtle)' }}>
        <table className="min-w-full">
          <thead>
            <tr style={{ background: 'var(--table-header-bg)' }}>
              {chart.columns.map((col: string, i: number) => (
                <th
                  key={i}
                  className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider"
                  style={{ color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-subtle)' }}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {chart.data.map((row: any[], rowIndex: number) => (
              <tr
                key={rowIndex}
                className="transition-colors"
                style={{ background: rowIndex % 2 === 0 ? 'transparent' : 'var(--bg-tertiary)' }}
              >
                {(Array.isArray(row) ? row : []).map((cell: any, cellIndex: number) => (
                  <td
                    key={cellIndex}
                    className="px-4 py-3 text-sm"
                    style={{ 
                      color: cellIndex === 0 ? 'var(--text-primary)' : 'var(--text-secondary)',
                      fontWeight: cellIndex === 0 ? 500 : 400,
                      borderBottom: '1px solid var(--border-subtle)',
                    }}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ========== 对比图 ==========
const ComparisonChartRenderer: React.FC<{ chart: any }> = ({ chart }) => {
  if (!chart.items || !Array.isArray(chart.items) || chart.items.length === 0) return null;
  
  const firstItem = chart.items[0];
  const compareKeys = Object.keys(firstItem).filter(k => k !== 'dimension' && k !== '维度');
  const dimensionKey = 'dimension' in firstItem ? 'dimension' : '维度';
  
  // 为每个竞品分配颜色
  const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];
  
  return (
    <div className="my-4">
      {chart.title && (
        <h4 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
          {chart.title}
        </h4>
      )}
      {/* 对比表格 */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
          <thead>
            <tr>
              <th 
                className="text-left px-4 py-3 text-xs font-semibold sticky left-0"
                style={{ 
                  background: 'var(--bg-secondary)', 
                  color: 'var(--text-muted)',
                  borderBottom: '2px solid var(--border-subtle)'
                }}
              >
                对比维度
              </th>
              {compareKeys.map((key: string, ki: number) => (
                <th 
                  key={ki} 
                  className="text-center px-4 py-3 text-xs font-semibold min-w-[140px]"
                  style={{ 
                    background: 'var(--bg-secondary)', 
                    color: colors[ki % colors.length],
                    borderBottom: `2px solid ${colors[ki % colors.length]}`
                  }}
                >
                  {key}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {chart.items.map((item: any, index: number) => (
              <tr key={index}>
                <td 
                  className="px-4 py-3 text-xs font-medium sticky left-0"
                  style={{ 
                    background: 'var(--bg-primary)', 
                    color: 'var(--text-secondary)',
                    borderBottom: '1px solid var(--border-subtle)'
                  }}
                >
                  {item[dimensionKey]}
                </td>
                {compareKeys.map((key: string, ki: number) => {
                  const value = item[key];
                  const isHighlight = typeof value === 'string' && (
                    value.includes('第一') || 
                    value.includes('最') || 
                    value.includes('★') ||
                    value.includes('领先')
                  );
                  return (
                    <td 
                      key={ki} 
                      className="px-4 py-3 text-center"
                      style={{ 
                        background: isHighlight ? `${colors[ki % colors.length]}15` : 'var(--bg-primary)',
                        color: 'var(--text-primary)',
                        borderBottom: '1px solid var(--border-subtle)'
                      }}
                    >
                      <span className={isHighlight ? 'font-semibold' : ''}>
                        {value}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ========== 柱状图 ==========
const BarChartRenderer: React.FC<{ chart: any }> = ({ chart }) => {
  const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];
  
  // 支持多种数据格式
  // 格式1: { labels, datasets }
  // 格式2: { data: [{ category/competitor/metric/name, value/score/count, ... }] }
  // 格式3 (YAML): { data: [{ name, value }], xAxis, yAxis }
  
  if (chart.data && Array.isArray(chart.data)) {
    // 格式2/3: 简化数据格式
    const items = chart.data;
    const valueKey = items[0] ? Object.keys(items[0]).find(k => 
      ['value', 'score', 'count', 'improvement', 'rate'].includes(k) || typeof items[0][k] === 'number'
    ) : null;
    const labelKey = items[0] ? Object.keys(items[0]).find(k => 
      ['name', 'category', 'competitor', 'metric', 'industry', 'label'].includes(k) || 
      (typeof items[0][k] === 'string' && k !== valueKey)
    ) : null;
    
    if (!valueKey || !labelKey) return null;
    
    const maxValue = Math.max(...items.map((d: any) => Math.abs(Number(d[valueKey]) || 0))) || 1;
    
    return (
      <div className="my-4">
        {chart.title && (
          <h4 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
            {chart.title}
          </h4>
        )}
        {/* 坐标轴标签 */}
        {(chart.xAxis || chart.yAxis) && (
          <div className="flex gap-4 mb-2 text-xs" style={{ color: 'var(--text-muted)' }}>
            {chart.yAxis && <span>Y轴: {chart.yAxis}</span>}
            {chart.xAxis && <span>X轴: {chart.xAxis}</span>}
          </div>
        )}
        <div className="space-y-2">
          {items.map((item: any, i: number) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-32 text-xs truncate" style={{ color: 'var(--text-secondary)' }}>
                {item[labelKey]}
              </div>
              <div className="flex-1 h-6 rounded overflow-hidden" style={{ background: 'var(--bg-tertiary)' }}>
                <div
                  className="h-full rounded transition-all duration-500"
                  style={{
                    width: `${(Math.abs(Number(item[valueKey])) / maxValue) * 100}%`,
                    background: item.highlight ? '#10B981' : colors[i % colors.length],
                  }}
                />
              </div>
              <span className="text-xs w-16 text-right" style={{ color: 'var(--text-muted)' }}>
                {item[valueKey]}{item.unit || item.rate || ''}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  
  // 格式1: 传统格式
  if (!chart.labels || !Array.isArray(chart.labels) || !chart.datasets || !Array.isArray(chart.datasets)) {
    return null;
  }
  
  const maxValue = Math.max(...chart.datasets.flatMap((d: any) => d.data || [])) || 1;
  
  return (
    <div className="my-4">
      {chart.title && (
        <h4 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
          {chart.title}
        </h4>
      )}
      <div className="space-y-4">
        {chart.labels.map((label: string, i: number) => (
          <div key={i}>
            <div className="text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>{label}</div>
            <div className="space-y-1">
              {chart.datasets.map((dataset: any, di: number) => (
                <div key={di} className="flex items-center gap-2">
                  <div className="flex-1 h-6 rounded overflow-hidden" style={{ background: 'var(--bg-tertiary)' }}>
                    <div
                      className="h-full rounded transition-all duration-500"
                      style={{
                        width: `${((dataset.data?.[i] || 0) / maxValue) * 100}%`,
                        background: dataset.color || colors[di % colors.length],
                      }}
                    />
                  </div>
                  <span className="text-xs w-12 text-right" style={{ color: 'var(--text-muted)' }}>
                    {dataset.data?.[i]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
        {chart.datasets.length > 1 && (
          <div className="flex gap-4 mt-2 pt-2" style={{ borderTop: '1px solid var(--border-subtle)' }}>
            {chart.datasets.map((dataset: any, di: number) => (
              <div key={di} className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded" style={{ background: dataset.color || colors[di % colors.length] }} />
                <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{dataset.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ========== 列表 ==========
const ListChartRenderer: React.FC<{ chart: any }> = ({ chart }) => {
  if (!chart.items || !Array.isArray(chart.items)) return null;
  
  return (
    <div className="my-4">
      {chart.title && (
        <h4 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
          {chart.title}
        </h4>
      )}
      <ul className="space-y-2">
        {chart.items.map((item: any, i: number) => (
          <li
            key={i}
            className="flex items-start gap-2 p-2 rounded"
            style={{ background: 'var(--bg-tertiary)' }}
          >
            {typeof item === 'string' ? (
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{item}</span>
            ) : (
              <div>
                <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{item.title}</div>
                {item.description && (
                  <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{item.description}</div>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};

// ========== 时间线 ==========
const TimelineChartRenderer: React.FC<{ chart: any }> = ({ chart }) => {
  // 支持 events 和 data 两种字段名
  const events = chart.events || chart.data;
  if (!events || !Array.isArray(events)) return null;
  
  return (
    <div className="my-4">
      {chart.title && (
        <h4 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
          {chart.title}
        </h4>
      )}
      <div className="relative pl-4" style={{ borderLeft: '2px solid var(--border-subtle)' }}>
        {events.map((event: any, i: number) => (
          <div key={i} className="relative pb-4 last:pb-0">
            <div
              className="absolute w-3 h-3 rounded-full -left-[7px]"
              style={{ background: '#3B82F6', top: 4 }}
            />
            <div className="pl-4">
              <div className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                {event.date || event.period || event.year}
              </div>
              <div className="text-sm font-medium mt-0.5" style={{ color: 'var(--text-primary)' }}>
                {event.title || event.events}
              </div>
              {(event.description || event.revenue) && (
                <div className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                  {event.description || event.revenue}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ========== 指标卡片（metrics/metric） ==========
const MetricsChartRenderer: React.FC<{ chart: any }> = ({ chart }) => {
  // 支持 items 和 data 两种字段名
  const items = chart.items || chart.data;
  if (!items || !Array.isArray(items)) return null;
  
  return (
    <div className="my-4">
      {chart.title && (
        <h4 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
          {chart.title}
        </h4>
      )}
      <div className={`grid gap-3 ${items.length <= 2 ? 'grid-cols-2' : items.length <= 4 ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-2 md:grid-cols-3'}`}>
        {items.map((item: any, i: number) => (
          <div
            key={i}
            className="p-4 rounded-lg"
            style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)' }}
          >
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{item.label}</div>
            <div 
              className="text-xl font-semibold mt-1" 
              style={{ color: item.color ? item.color : 'var(--text-primary)' }}
            >
              {item.value}
            </div>
            {item.change && (
              <div
                className="text-xs mt-1 flex items-center gap-1"
                style={{
                  color: item.trend === 'up' ? '#10B981' : item.trend === 'down' ? '#EF4444' : 'var(--text-muted)',
                }}
              >
                {item.trend === 'up' && '↑'}
                {item.trend === 'down' && '↓'}
                {item.change}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// ========== 饼图（SVG 实现） ==========
const PieChartRenderer: React.FC<{ chart: any }> = ({ chart }) => {
  if (!chart.data || !Array.isArray(chart.data)) return null;
  
  const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];
  const total = chart.data.reduce((sum: number, item: any) => sum + (Number(item.value) || 0), 0);
  
  // 计算每个扇形的路径
  const size = 160;
  const center = size / 2;
  const radius = 60;
  
  let currentAngle = -90; // 从顶部开始
  const segments = chart.data.map((item: any, i: number) => {
    const value = Number(item.value) || 0;
    const percentage = total > 0 ? (value / total) * 100 : 0;
    const angle = (percentage / 100) * 360;
    const startAngle = currentAngle;
    const endAngle = currentAngle + angle;
    currentAngle = endAngle;
    
    // 计算弧线路径
    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;
    const x1 = center + radius * Math.cos(startRad);
    const y1 = center + radius * Math.sin(startRad);
    const x2 = center + radius * Math.cos(endRad);
    const y2 = center + radius * Math.sin(endRad);
    const largeArc = angle > 180 ? 1 : 0;
    
    const path = angle >= 360 
      ? `M ${center} ${center - radius} A ${radius} ${radius} 0 1 1 ${center - 0.01} ${center - radius} Z`
      : `M ${center} ${center} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;
    
    return {
      ...item,
      path,
      color: item.highlight ? '#10B981' : colors[i % colors.length],
      percentage: percentage.toFixed(1),
    };
  });
  
  return (
    <div className="my-4">
      {chart.title && (
        <h4 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
          {chart.title}
        </h4>
      )}
      <div className="flex items-start gap-6 flex-wrap">
        {/* SVG 饼图 */}
        <svg width={size} height={size} className="flex-shrink-0">
          {segments.map((seg: any, i: number) => (
            <path
              key={i}
              d={seg.path}
              fill={seg.color}
              stroke="var(--bg-primary)"
              strokeWidth="2"
              className="transition-opacity hover:opacity-80"
            />
          ))}
          {/* 中心圆（环形图效果） */}
          <circle cx={center} cy={center} r={radius * 0.5} fill="var(--bg-primary)" />
        </svg>
        {/* 图例 */}
        <div className="flex flex-col gap-2 flex-1 min-w-[200px]">
          {segments.map((seg: any, i: number) => (
            <div key={i} className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: seg.color }} />
              <span className="text-sm flex-1" style={{ color: 'var(--text-secondary)' }}>
                {seg.label || seg.category || seg.name}
              </span>
              <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                {seg.value}
              </span>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                ({seg.percentage}%)
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ========== 雷达图（SVG 实现） ==========
const RadarChartRenderer: React.FC<{ chart: any }> = ({ chart }) => {
  if (!chart.dimensions || !Array.isArray(chart.dimensions) || !chart.series || !Array.isArray(chart.series)) {
    return null;
  }
  
  const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444'];
  const dimensions = chart.dimensions;
  const numDimensions = dimensions.length;
  
  // 雷达图尺寸配置
  const radius = 80;
  const labelPadding = 55; // 标签区域
  const size = (radius + labelPadding) * 2;
  const center = size / 2;
  const levels = 5; // 网格层数
  const angleStep = (2 * Math.PI) / numDimensions;
  
  // 计算最大值（用于归一化）
  const maxValue = Math.max(
    ...chart.series.flatMap((s: any) => s.data || []),
    10
  );
  
  // 计算多边形顶点
  const getPoint = (index: number, value: number) => {
    const angle = angleStep * index - Math.PI / 2; // 从顶部开始
    const r = (value / maxValue) * radius;
    return {
      x: center + r * Math.cos(angle),
      y: center + r * Math.sin(angle),
    };
  };
  
  // 生成网格线
  const gridLines = Array.from({ length: levels }, (_, i) => {
    const r = ((i + 1) / levels) * radius;
    const points = Array.from({ length: numDimensions }, (_, j) => {
      const angle = angleStep * j - Math.PI / 2;
      return `${center + r * Math.cos(angle)},${center + r * Math.sin(angle)}`;
    }).join(' ');
    return points;
  });
  
  // 生成轴线
  const axisLines = Array.from({ length: numDimensions }, (_, i) => {
    const angle = angleStep * i - Math.PI / 2;
    return {
      x2: center + radius * Math.cos(angle),
      y2: center + radius * Math.sin(angle),
    };
  });
  
  // 生成数据多边形
  const dataPolygons = chart.series.map((s: any, si: number) => {
    const points = (s.data || []).map((value: number, i: number) => {
      const p = getPoint(i, value || 0);
      return `${p.x},${p.y}`;
    }).join(' ');
    return { points, color: colors[si % colors.length], name: s.name };
  });
  
  // 维度标签位置
  const labelPositions = dimensions.map((_: string, i: number) => {
    const angle = angleStep * i - Math.PI / 2;
    const labelRadius = radius + 18;
    return {
      x: center + labelRadius * Math.cos(angle),
      y: center + labelRadius * Math.sin(angle),
      anchor: Math.abs(Math.cos(angle)) < 0.1 ? 'middle' : Math.cos(angle) > 0 ? 'start' : 'end',
    };
  });
  
  return (
    <div className="my-4">
      {chart.title && (
        <h4 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
          {chart.title}
        </h4>
      )}
      {/* 左右布局：雷达图 + 图例/数值表 */}
      <div className="flex items-start gap-8">
        {/* 左侧：SVG 雷达图 */}
        <svg width={size} height={size} className="flex-shrink-0">
          {/* 网格 */}
          {gridLines.map((points, i) => (
            <polygon
              key={`grid-${i}`}
              points={points}
              fill="none"
              stroke="var(--border-subtle)"
              strokeWidth="1"
              opacity={0.5}
            />
          ))}
          {/* 轴线 */}
          {axisLines.map((line, i) => (
            <line
              key={`axis-${i}`}
              x1={center}
              y1={center}
              x2={line.x2}
              y2={line.y2}
              stroke="var(--border-subtle)"
              strokeWidth="1"
              opacity={0.5}
            />
          ))}
          {/* 数据多边形 */}
          {dataPolygons.map((poly: any, i: number) => (
            <g key={`data-${i}`}>
              <polygon
                points={poly.points}
                fill={poly.color}
                fillOpacity={0.2}
                stroke={poly.color}
                strokeWidth="2"
              />
              {/* 数据点 */}
              {(chart.series[i].data || []).map((value: number, j: number) => {
                const p = getPoint(j, value || 0);
                return (
                  <circle
                    key={`point-${i}-${j}`}
                    cx={p.x}
                    cy={p.y}
                    r={4}
                    fill={poly.color}
                  />
                );
              })}
            </g>
          ))}
          {/* 维度标签 */}
          {dimensions.map((dim: string, i: number) => (
            <text
              key={`label-${i}`}
              x={labelPositions[i].x}
              y={labelPositions[i].y}
              textAnchor={labelPositions[i].anchor}
              dominantBaseline="middle"
              className="text-xs"
              fill="var(--text-secondary)"
            >
              {dim}
            </text>
          ))}
        </svg>
        
        {/* 右侧：图例 + 数值表格 */}
        <div className="pt-2">
          {/* 图例 */}
          <div className="flex gap-4 mb-4 flex-wrap">
            {chart.series.map((s: any, i: number) => (
              <div key={i} className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded" style={{ background: colors[i % colors.length] }} />
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{s.name}</span>
              </div>
            ))}
          </div>
          {/* 数值表格 */}
          <div className="space-y-1">
            {dimensions.map((dim: string, di: number) => (
              <div key={di} className="flex items-center gap-3 text-sm">
                <span className="w-20 truncate" style={{ color: 'var(--text-muted)' }}>{dim}</span>
                {chart.series.map((s: any, si: number) => (
                  <span key={si} className="w-12 text-center font-medium" style={{ color: colors[si % colors.length] }}>
                    {s.data?.[di] ?? '-'}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// ========== 折线图（SVG 实现） ==========
const LineChartRenderer: React.FC<{ chart: any }> = ({ chart }) => {
  if (!chart.xAxis || !Array.isArray(chart.xAxis) || !chart.series || !Array.isArray(chart.series)) {
    return null;
  }
  
  const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444'];
  const width = 400;
  const height = 200;
  const padding = { top: 20, right: 20, bottom: 40, left: 50 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  
  // 计算数据范围
  const allValues = chart.series.flatMap((s: any) => (s.data || []).filter((v: any) => v != null));
  const maxValue = Math.max(...allValues, 1);
  const minValue = Math.min(...allValues.filter((v: number) => v > 0), 0);
  const valueRange = maxValue - minValue || 1;
  
  const numPoints = chart.xAxis.length;
  const xStep = chartWidth / Math.max(numPoints - 1, 1);
  
  // 生成折线路径
  const linePaths = chart.series.map((s: any) => {
    const points = (s.data || []).map((value: number | null, i: number) => {
      if (value == null) return null;
      const x = padding.left + i * xStep;
      const y = padding.top + chartHeight - ((value - minValue) / valueRange) * chartHeight;
      return `${x},${y}`;
    }).filter(Boolean);
    return points.join(' L ');
  });
  
  // Y 轴刻度
  const yTicks = 5;
  const yTickValues = Array.from({ length: yTicks }, (_, i) => 
    minValue + (valueRange * i) / (yTicks - 1)
  );
  
  return (
    <div className="my-4">
      {chart.title && (
        <h4 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
          {chart.title}
        </h4>
      )}
      {/* 图例 */}
      <div className="flex gap-4 mb-2">
        {chart.series.map((s: any, i: number) => (
          <div key={i} className="flex items-center gap-1.5">
            <div className="w-4 h-0.5" style={{ background: colors[i % colors.length] }} />
            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{s.name}</span>
          </div>
        ))}
      </div>
      {/* SVG 折线图 */}
      <svg width={width} height={height} className="overflow-visible">
        {/* 网格线 */}
        {yTickValues.map((_, i) => {
          const y = padding.top + (chartHeight * i) / (yTicks - 1);
          return (
            <line
              key={`grid-${i}`}
              x1={padding.left}
              y1={y}
              x2={width - padding.right}
              y2={y}
              stroke="var(--border-subtle)"
              strokeWidth="1"
              opacity={0.3}
            />
          );
        })}
        {/* Y 轴标签 */}
        {yTickValues.map((value, i) => {
          const y = padding.top + chartHeight - (chartHeight * i) / (yTicks - 1);
          return (
            <text
              key={`y-label-${i}`}
              x={padding.left - 8}
              y={y}
              textAnchor="end"
              dominantBaseline="middle"
              className="text-xs"
              fill="var(--text-muted)"
            >
              {value.toFixed(value >= 100 ? 0 : 1)}
            </text>
          );
        })}
        {/* X 轴标签 */}
        {chart.xAxis.map((label: string, i: number) => (
          <text
            key={`x-label-${i}`}
            x={padding.left + i * xStep}
            y={height - padding.bottom + 20}
            textAnchor="middle"
            className="text-xs"
            fill="var(--text-muted)"
          >
            {label}
          </text>
        ))}
        {/* 折线 */}
        {linePaths.map((path: string, i: number) => (
          <g key={`line-${i}`}>
            {/* 面积填充 */}
            <path
              d={`M ${padding.left},${padding.top + chartHeight} L ${path} L ${padding.left + (chart.series[i].data?.length - 1) * xStep},${padding.top + chartHeight} Z`}
              fill={colors[i % colors.length]}
              fillOpacity={0.1}
            />
            {/* 折线 */}
            <path
              d={`M ${path}`}
              fill="none"
              stroke={colors[i % colors.length]}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* 数据点 */}
            {(chart.series[i].data || []).map((value: number | null, j: number) => {
              if (value == null) return null;
              const x = padding.left + j * xStep;
              const y = padding.top + chartHeight - ((value - minValue) / valueRange) * chartHeight;
              return (
                <circle
                  key={`point-${i}-${j}`}
                  cx={x}
                  cy={y}
                  r={4}
                  fill={colors[i % colors.length]}
                />
              );
            })}
          </g>
        ))}
      </svg>
      {/* 注释 */}
      {chart.annotations && Array.isArray(chart.annotations) && (
        <div className="flex flex-wrap gap-2 mt-2">
          {chart.annotations.map((ann: any, i: number) => (
            <span key={i} className="text-xs px-2 py-1 rounded" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>
              {ann.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

// ========== 组合图（SVG 柱状图+折线图） ==========
const ComboChartRenderer: React.FC<{ chart: any }> = ({ chart }) => {
  if (!chart.xAxis || !Array.isArray(chart.xAxis) || !chart.series || !Array.isArray(chart.series)) {
    return null;
  }
  
  const barSeries = chart.series.filter((s: any) => s.type === 'bar');
  const lineSeries = chart.series.filter((s: any) => s.type === 'line');
  
  const width = 450;
  const height = 220;
  const padding = { top: 20, right: 50, bottom: 50, left: 60 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  
  const numBars = chart.xAxis.length;
  const barGroupWidth = chartWidth / numBars;
  const barWidth = Math.min(barGroupWidth * 0.6, 40);
  
  // 柱状图数值范围
  const barValues = barSeries.flatMap((s: any) => (s.data || []).filter((v: any) => v != null));
  const barMax = Math.max(...barValues, 1);
  
  // 折线图数值范围（百分比）
  const lineValues = lineSeries.flatMap((s: any) => (s.data || []).filter((v: any) => v != null));
  const lineMax = Math.max(...lineValues, 100);
  
  return (
    <div className="my-4">
      {chart.title && (
        <h4 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
          {chart.title}
        </h4>
      )}
      {/* 图例 */}
      <div className="flex gap-4 mb-3">
        {chart.series.map((s: any, i: number) => (
          <div key={i} className="flex items-center gap-1.5">
            <div 
              className={s.type === 'line' ? 'w-4 h-0.5' : 'w-3 h-3 rounded'} 
              style={{ background: s.type === 'bar' ? '#3B82F6' : '#10B981' }} 
            />
            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{s.name}</span>
          </div>
        ))}
      </div>
      {/* SVG 组合图 */}
      <svg width={width} height={height} className="overflow-visible">
        {/* 网格线 */}
        {[0, 1, 2, 3, 4].map((i) => {
          const y = padding.top + (chartHeight * i) / 4;
          return (
            <line
              key={`grid-${i}`}
              x1={padding.left}
              y1={y}
              x2={width - padding.right}
              y2={y}
              stroke="var(--border-subtle)"
              strokeWidth="1"
              opacity={0.3}
            />
          );
        })}
        {/* 左侧 Y 轴标签（柱状图） */}
        {[0, 1, 2, 3, 4].map((i) => {
          const y = padding.top + chartHeight - (chartHeight * i) / 4;
          const value = (barMax * i) / 4;
          return (
            <text
              key={`y-left-${i}`}
              x={padding.left - 8}
              y={y}
              textAnchor="end"
              dominantBaseline="middle"
              className="text-xs"
              fill="#3B82F6"
            >
              {value.toFixed(value >= 10 ? 0 : 1)}
            </text>
          );
        })}
        {/* 右侧 Y 轴标签（折线图百分比） */}
        {lineSeries.length > 0 && [0, 1, 2, 3, 4].map((i) => {
          const y = padding.top + chartHeight - (chartHeight * i) / 4;
          const value = (lineMax * i) / 4;
          return (
            <text
              key={`y-right-${i}`}
              x={width - padding.right + 8}
              y={y}
              textAnchor="start"
              dominantBaseline="middle"
              className="text-xs"
              fill="#10B981"
            >
              {value.toFixed(0)}%
            </text>
          );
        })}
        {/* X 轴标签 */}
        {chart.xAxis.map((label: string, i: number) => (
          <text
            key={`x-label-${i}`}
            x={padding.left + barGroupWidth * i + barGroupWidth / 2}
            y={height - padding.bottom + 20}
            textAnchor="middle"
            className="text-xs"
            fill="var(--text-muted)"
          >
            {label}
          </text>
        ))}
        {/* 柱状图 */}
        {barSeries.map((s: any, si: number) => (
          <g key={`bar-series-${si}`}>
            {(s.data || []).map((value: number | null, i: number) => {
              if (value == null) return null;
              const barHeight = (value / barMax) * chartHeight;
              const x = padding.left + barGroupWidth * i + (barGroupWidth - barWidth) / 2;
              const y = padding.top + chartHeight - barHeight;
              return (
                <g key={`bar-${si}-${i}`}>
                  <rect
                    x={x}
                    y={y}
                    width={barWidth}
                    height={barHeight}
                    fill="#3B82F6"
                    rx={2}
                    opacity={0.8}
                  />
                  <text
                    x={x + barWidth / 2}
                    y={y - 5}
                    textAnchor="middle"
                    className="text-xs"
                    fill="var(--text-secondary)"
                  >
                    {value}
                  </text>
                </g>
              );
            })}
          </g>
        ))}
        {/* 折线图 */}
        {lineSeries.map((s: any, si: number) => {
          const points = (s.data || []).map((value: number | null, i: number) => {
            if (value == null) return null;
            const x = padding.left + barGroupWidth * i + barGroupWidth / 2;
            const y = padding.top + chartHeight - (value / lineMax) * chartHeight;
            return { x, y, value };
          }).filter(Boolean);
          
          const pathD = points.map((p: any, i: number) => 
            `${i === 0 ? 'M' : 'L'} ${p.x},${p.y}`
          ).join(' ');
          
          return (
            <g key={`line-series-${si}`}>
              <path
                d={pathD}
                fill="none"
                stroke="#10B981"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {points.map((p: any, i: number) => (
                <g key={`line-point-${si}-${i}`}>
                  <circle cx={p.x} cy={p.y} r={5} fill="#10B981" />
                  <text
                    x={p.x}
                    y={p.y - 10}
                    textAnchor="middle"
                    className="text-xs"
                    fill="#10B981"
                  >
                    {p.value}%
                  </text>
                </g>
              ))}
            </g>
          );
        })}
      </svg>
      {/* 注释 */}
      {chart.annotations && Array.isArray(chart.annotations) && (
        <div className="flex flex-wrap gap-2 mt-2">
          {chart.annotations.map((ann: any, i: number) => (
            <span key={i} className="text-xs px-2 py-1 rounded" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>
              {ann.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

// ========== 思维导图 ==========
const MindmapChartRenderer: React.FC<{ chart: any }> = ({ chart }) => {
  if (!chart.root || !chart.children || !Array.isArray(chart.children)) return null;
  
  // 递归渲染子节点（支持多层嵌套）
  const renderChildItem = (item: any): React.ReactNode => {
    // 如果是字符串，直接返回
    if (typeof item === 'string') {
      return item;
    }
    // 如果是对象，提取 name 或其他可显示属性
    if (typeof item === 'object' && item !== null) {
      return item.name || item.title || item.label || JSON.stringify(item);
    }
    return String(item);
  };
  
  const renderChildren = (children: any[], depth: number = 0): React.ReactNode => {
    return (
      <ul className="space-y-1">
        {children.map((item: any, j: number) => (
          <li key={j} className="text-xs pl-2" style={{ color: 'var(--text-secondary)', borderLeft: '2px solid var(--border-subtle)' }}>
            {renderChildItem(item)}
            {/* 如果子项还有 children，递归渲染 */}
            {item && typeof item === 'object' && item.children && Array.isArray(item.children) && (
              <div className="mt-1 ml-2">
                {renderChildren(item.children, depth + 1)}
              </div>
            )}
          </li>
        ))}
      </ul>
    );
  };
  
  return (
    <div className="my-4">
      {chart.title && (
        <h4 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
          {chart.title}
        </h4>
      )}
      <div className="p-4 rounded-lg" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)' }}>
        {/* 根节点 */}
        <div className="text-center mb-4">
          <span className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: '#3B82F6', color: 'white' }}>
            {typeof chart.root === 'string' ? chart.root : (chart.root?.name || chart.root?.title || '')}
          </span>
        </div>
        {/* 子节点 */}
        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(chart.children.length, 3)}, 1fr)` }}>
          {chart.children.map((child: any, i: number) => (
            <div key={i} className="p-3 rounded-lg" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
              <div className="text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
                {typeof child === 'string' ? child : (child.name || child.title || '')}
              </div>
              {child.note && (
                <div className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
                  {child.note}
                </div>
              )}
              {child.children && Array.isArray(child.children) && (
                renderChildren(child.children, 0)
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ========== 流程图 ==========
const FlowchartRenderer: React.FC<{ chart: any }> = ({ chart }) => {
  if (!chart.nodes || !Array.isArray(chart.nodes)) return null;
  
  // 找出所有被引用为 children 的节点 ID
  const childIds = new Set<string>();
  chart.nodes.forEach((node: any) => {
    if (node.children && Array.isArray(node.children)) {
      node.children.forEach((id: string) => childIds.add(id));
    }
  });
  
  // 只渲染根节点（没有被其他节点引用的节点）
  const rootNodes = chart.nodes.filter((node: any) => !childIds.has(node.id));
  
  // 递归渲染节点
  const renderNode = (node: any, depth: number = 0) => {
    const children = node.children?.map((childId: string) => 
      chart.nodes.find((n: any) => n.id === childId)
    ).filter(Boolean) || [];
    
    return (
      <div 
        key={node.id} 
        className="p-3 rounded-lg"
        style={{ 
          background: depth === 0 ? 'var(--bg-tertiary)' : 'var(--bg-secondary)', 
          border: '1px solid var(--border-subtle)',
        }}
      >
        <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
          {node.label}
        </div>
        {node.description && (
          <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            {node.description}
          </div>
        )}
        {children.length > 0 && (
          <div className="mt-3 pl-3 space-y-2" style={{ borderLeft: '2px solid var(--border-subtle)' }}>
            {children.map((child: any) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };
  
  return (
    <div className="my-4">
      {chart.title && (
        <h4 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
          {chart.title}
        </h4>
      )}
      <div className="space-y-3">
        {rootNodes.map((node: any) => renderNode(node, 0))}
      </div>
    </div>
  );
};

// ========== 矩阵图 ==========
const MatrixChartRenderer: React.FC<{ chart: any }> = ({ chart }) => {
  if (!chart.quadrants || !Array.isArray(chart.quadrants)) return null;
  
  return (
    <div className="my-4">
      {chart.title && (
        <h4 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
          {chart.title}
        </h4>
      )}
      <div className="grid grid-cols-2 gap-3">
        {chart.quadrants.map((q: any, i: number) => (
          <div key={i} className="p-3 rounded-lg" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)' }}>
            <div className="text-xs font-semibold mb-2" style={{ color: '#3B82F6' }}>
              {q.name}
            </div>
            {q.items && Array.isArray(q.items) && (
              <ul className="space-y-1">
                {q.items.map((item: string, j: number) => (
                  <li key={j} className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    • {item}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
      {(chart.xAxis || chart.yAxis) && (
        <div className="flex gap-4 mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
          {chart.xAxis && <span>X轴: {chart.xAxis}</span>}
          {chart.yAxis && <span>Y轴: {chart.yAxis}</span>}
        </div>
      )}
    </div>
  );
};

// ========== 路线图 ==========
const RoadmapChartRenderer: React.FC<{ chart: any }> = ({ chart }) => {
  if (!chart.phases || !Array.isArray(chart.phases)) return null;
  
  return (
    <div className="my-4">
      {chart.title && (
        <h4 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
          {chart.title}
        </h4>
      )}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {chart.phases.map((phase: any, i: number) => (
          <div 
            key={i} 
            className="flex-shrink-0 p-3 rounded-lg min-w-[180px]"
            style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)' }}
          >
            <div className="text-xs font-semibold mb-1" style={{ color: '#3B82F6' }}>
              {phase.year}
            </div>
            <div className="text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
              {phase.focus}
            </div>
            {phase.goals && Array.isArray(phase.goals) && (
              <ul className="space-y-1">
                {phase.goals.map((goal: string, j: number) => (
                  <li key={j} className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    • {goal}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// ========== 术语表 ==========
const GlossaryChartRenderer: React.FC<{ chart: any }> = ({ chart }) => {
  if (!chart.terms || !Array.isArray(chart.terms)) return null;
  
  return (
    <div className="my-4">
      {chart.title && (
        <h4 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
          {chart.title}
        </h4>
      )}
      <div className="space-y-2">
        {chart.terms.map((term: any, i: number) => (
          <div key={i} className="flex gap-3 p-2 rounded" style={{ background: 'var(--bg-tertiary)' }}>
            <span className="text-sm font-semibold shrink-0" style={{ color: '#3B82F6', minWidth: 100 }}>
              {term.term}
            </span>
            <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              {term.definition}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ========== 摘要 ==========
const SummaryChartRenderer: React.FC<{ chart: any }> = ({ chart }) => {
  if (!chart.insights || !Array.isArray(chart.insights)) return null;
  
  return (
    <div className="my-4">
      {chart.title && (
        <h4 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
          {chart.title}
        </h4>
      )}
      <div className="space-y-3">
        {chart.insights.map((insight: any, i: number) => (
          <div key={i} className="p-3 rounded-lg" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)' }}>
            <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              {insight.title}
            </div>
            {insight.description && (
              <div className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                {insight.description}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// ========== 评分 ==========
const RatingChartRenderer: React.FC<{ chart: any }> = ({ chart }) => {
  if (!chart.ratings || !Array.isArray(chart.ratings)) return null;
  
  return (
    <div className="my-4">
      {chart.title && (
        <h4 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
          {chart.title}
        </h4>
      )}
      <div className="space-y-2">
        {chart.ratings.map((rating: any, i: number) => (
          <div key={i} className="flex items-center gap-3 p-2 rounded" style={{ background: 'var(--bg-tertiary)' }}>
            <span className="text-sm shrink-0" style={{ color: 'var(--text-secondary)', minWidth: 150 }}>
              {rating.dimension}
            </span>
            {rating.score != null && rating.max != null ? (
              <div className="flex items-center gap-2">
                <div className="flex gap-0.5">
                  {Array.from({ length: rating.max }).map((_, j) => (
                    <span key={j} style={{ color: j < rating.score ? '#F59E0B' : 'var(--text-muted)' }}>★</span>
                  ))}
                </div>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {rating.score}/{rating.max}
                </span>
              </div>
            ) : (
              <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                {rating.label || rating.level}
              </span>
            )}
            {rating.note && (
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                ({rating.note})
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// ========== 计分卡 ==========
const ScorecardChartRenderer: React.FC<{ chart: any }> = ({ chart }) => {
  if (!chart.items || !Array.isArray(chart.items)) return null;
  
  return (
    <div className="my-4">
      {chart.title && (
        <h4 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
          {chart.title}
        </h4>
      )}
      <div className="space-y-2">
        {chart.items.map((item: any, i: number) => (
          <div key={i} className="flex items-center gap-3 p-2 rounded" style={{ background: 'var(--bg-tertiary)' }}>
            <span className="text-sm shrink-0" style={{ color: 'var(--text-secondary)', minWidth: 120 }}>
              {item.dimension}
            </span>
            <div className="flex-1 flex items-center gap-2">
              <div className="flex-1 h-2 rounded overflow-hidden" style={{ background: 'var(--bg-secondary)' }}>
                <div
                  className="h-full rounded"
                  style={{ 
                    width: `${((item.score || 0) / (item.max || 5)) * 100}%`,
                    background: '#3B82F6',
                  }}
                />
              </div>
              <span className="text-xs shrink-0" style={{ color: 'var(--text-muted)' }}>
                {item.score}/{item.max}
              </span>
            </div>
            {item.comment && (
              <span className="text-xs shrink-0" style={{ color: '#10B981' }}>
                {item.comment}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// ========== 原始内容展示（未识别或解析失败时） ==========
const RawContentRenderer: React.FC<{ rawData: string }> = ({ rawData }) => {
  return (
    <div className="my-4">
      <pre 
        className="text-xs overflow-auto p-4 rounded-lg whitespace-pre-wrap"
        style={{ 
          background: 'var(--code-block-bg)', 
          color: 'var(--text-secondary)',
          border: '1px solid var(--code-block-border)',
        }}
      >
        {rawData}
      </pre>
    </div>
  );
};

// ========== JSON 预处理（修复常见格式问题） ==========
const preprocessJson = (jsonStr: string): string => {
  let result = jsonStr;
  
  // 修复范围值：将 15-23 转换为 "15-23"（但不影响负数如 -50）
  // 匹配模式：冒号后面跟着 数字-数字 的格式（不是字符串）
  result = result.replace(/:\s*(\d+)\s*-\s*(\d+)\s*([,\}\]])/g, ': "$1-$2"$3');
  
  // 修复百分比值：将 50% 转换为 "50%"
  result = result.replace(/:\s*(\d+(?:\.\d+)?)\s*%\s*([,\}\]])/g, ': "$1%"$2');
  
  return result;
};

// ========== 简单 YAML 解析器（支持图表格式）==========
const parseSimpleYaml = (yamlStr: string): any => {
  const lines = yamlStr.split('\n');
  const result: any = {};
  let currentArray: any[] | null = null;
  let currentArrayKey = '';
  let currentItem: any = null;
  let inArray = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    
    // 跳过空行和注释
    if (!trimmed || trimmed.startsWith('#')) continue;
    
    // 计算缩进级别
    const indent = line.search(/\S/);
    
    // 检查是否是数组项开始 (- )
    if (trimmed.startsWith('- ')) {
      // 保存之前的项
      if (currentItem && currentArray) {
        currentArray.push(currentItem);
      }
      
      // 解析数组项的第一个属性
      const itemContent = trimmed.substring(2).trim();
      
      if (itemContent.includes(':')) {
        // - key: value 格式
        const [key, ...valueParts] = itemContent.split(':');
        const value = valueParts.join(':').trim();
        currentItem = { [key.trim()]: parseYamlValue(value) };
      } else {
        // - value 格式（简单值）
        currentItem = parseYamlValue(itemContent);
      }
      
      inArray = true;
      continue;
    }
    
    // 检查是否是键值对
    if (trimmed.includes(':')) {
      const colonIndex = trimmed.indexOf(':');
      const key = trimmed.substring(0, colonIndex).trim();
      const valueStr = trimmed.substring(colonIndex + 1).trim();
      
      if (inArray && indent > 0 && currentItem && typeof currentItem === 'object') {
        // 在数组项内部的属性
        currentItem[key] = parseYamlValue(valueStr);
      } else if (!valueStr) {
        // 值为空，表示开始一个数组或对象
        // 保存之前的数组
        if (currentArray && currentArrayKey) {
          if (currentItem) {
            currentArray.push(currentItem);
            currentItem = null;
          }
          result[currentArrayKey] = currentArray;
        }
        
        // 开始新数组
        currentArray = [];
        currentArrayKey = key;
        currentItem = null;
        inArray = false;
      } else {
        // 普通键值对
        if (currentArray && currentArrayKey) {
          // 保存之前的数组
          if (currentItem) {
            currentArray.push(currentItem);
            currentItem = null;
          }
          result[currentArrayKey] = currentArray;
          currentArray = null;
          currentArrayKey = '';
          inArray = false;
        }
        result[key] = parseYamlValue(valueStr);
      }
    }
  }
  
  // 保存最后的数组
  if (currentArray && currentArrayKey) {
    if (currentItem) {
      currentArray.push(currentItem);
    }
    result[currentArrayKey] = currentArray;
  }
  
  return result;
};

// 解析 YAML 值
const parseYamlValue = (value: string): any => {
  if (!value) return '';
  
  // 移除引号
  if ((value.startsWith('"') && value.endsWith('"')) || 
      (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  
  // 检查是否是数字
  if (/^-?\d+$/.test(value)) {
    return parseInt(value, 10);
  }
  if (/^-?\d+\.\d+$/.test(value)) {
    return parseFloat(value);
  }
  
  // 布尔值
  if (value.toLowerCase() === 'true') return true;
  if (value.toLowerCase() === 'false') return false;
  
  // null
  if (value.toLowerCase() === 'null' || value === '~') return null;
  
  return value;
};

// 检查是否是 YAML 格式
const isYamlFormat = (data: string): boolean => {
  const trimmed = data.trim();
  // YAML 格式通常以 "key:" 开头，而不是 "{" 或 "["
  return !trimmed.startsWith('{') && !trimmed.startsWith('[') && 
         /^[a-zA-Z_][a-zA-Z0-9_]*\s*:/.test(trimmed);
};

// ========== 主渲染组件 ==========
export const ChartRenderer: React.FC<ChartRendererProps> = ({ data }) => {
  let chartData: any;
  
  // 首先检查是否是 YAML 格式
  if (isYamlFormat(data)) {
    try {
      chartData = parseSimpleYaml(data);
    } catch (e) {
      console.warn('YAML parse failed:', e);
      return <RawContentRenderer rawData={data} />;
    }
  } else {
    // 尝试 JSON 解析
    try {
      chartData = JSON.parse(data);
    } catch {
      // 解析失败，尝试预处理后再解析
      try {
        const preprocessed = preprocessJson(data);
        chartData = JSON.parse(preprocessed);
      } catch {
        // 最后尝试 YAML 解析（可能是没有明显 YAML 特征的格式）
        try {
          chartData = parseSimpleYaml(data);
        } catch {
          // 仍然失败，显示原内容
          return <RawContentRenderer rawData={data} />;
        }
      }
    }
  }
  
  // 如果没有 type 字段，显示原内容
  if (!chartData || !chartData.type) {
    return <RawContentRenderer rawData={data} />;
  }
  
  // 错误时的降级显示
  const fallback = <RawContentRenderer rawData={data} />;
  
  // 根据类型渲染不同的图表（使用错误边界包裹，渲染失败时显示原内容）
  const renderChart = () => {
    switch (chartData.type) {
      case 'table':
        return <TableChartRenderer chart={chartData} />;
      case 'comparison':
        return <ComparisonChartRenderer chart={chartData} />;
      case 'bar':
        return <BarChartRenderer chart={chartData} />;
      case 'list':
        return <ListChartRenderer chart={chartData} />;
      case 'timeline':
        return <TimelineChartRenderer chart={chartData} />;
      case 'metrics':
      case 'metric':
        return <MetricsChartRenderer chart={chartData} />;
      case 'pie':
        return <PieChartRenderer chart={chartData} />;
      case 'radar':
        return <RadarChartRenderer chart={chartData} />;
      case 'line':
        return <LineChartRenderer chart={chartData} />;
      case 'combo':
        return <ComboChartRenderer chart={chartData} />;
      case 'mindmap':
        return <MindmapChartRenderer chart={chartData} />;
      case 'flowchart':
        return <FlowchartRenderer chart={chartData} />;
      case 'matrix':
        return <MatrixChartRenderer chart={chartData} />;
      case 'roadmap':
        return <RoadmapChartRenderer chart={chartData} />;
      case 'glossary':
        return <GlossaryChartRenderer chart={chartData} />;
      case 'summary':
        return <SummaryChartRenderer chart={chartData} />;
      case 'rating':
        return <RatingChartRenderer chart={chartData} />;
      case 'scorecard':
        return <ScorecardChartRenderer chart={chartData} />;
      default:
        // 未识别的类型，显示原内容
        return <RawContentRenderer rawData={data} />;
    }
  };
  
  // 使用错误边界包裹，任何渲染错误都会优雅降级显示原内容
  return (
    <ChartErrorBoundary fallback={fallback}>
      {renderChart()}
    </ChartErrorBoundary>
  );
};

export default ChartRenderer;
