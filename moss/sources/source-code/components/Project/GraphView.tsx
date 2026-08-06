/**
 * GraphView — 任务图谱可视化（右侧面板）
 *
 * 从 /api/graph 获取节点和边数据，用 CSS 渲染简洁的 DAG 视图。
 * 支持：自动化管道节点、项目节点、阶段节点、触发器入口可视化。
 */

import React, { useEffect, useState, useCallback } from 'react';
import { getTaskGraph, type TaskGraph, type GraphNode, type GraphTrigger } from '../../api/projects';

interface GraphViewProps {
  onClose: () => void;
}

const NODE_COLORS: Record<string, { bg: string; border: string; icon: string }> = {
  automation: { bg: '#8b5cf620', border: '#8b5cf650', icon: '⚡' },
  project: { bg: '#3b82f620', border: '#3b82f650', icon: '📁' },
  project_stage: { bg: '#6b728020', border: '#6b728050', icon: '○' },
};

const TRIGGER_ICONS: Record<string, string> = {
  cron: '🕐',
  webhook: '🔗',
  event: '⚡',
};

const STATUS_DOT: Record<string, string> = {
  active: '#22c55e',
  inactive: '#6b7280',
  draft: '#6b7280',
  running: '#22c55e',
  completed: '#3b82f6',
  failed: '#ef4444',
  pending: '#6b7280',
  awaiting_review: '#eab308',
};

export const GraphView: React.FC<GraphViewProps> = ({ onClose }) => {
  const [graph, setGraph] = useState<TaskGraph | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);

  const loadGraph = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getTaskGraph();
      setGraph(data);
    } catch (e) {
      console.error('Failed to load graph:', e);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadGraph(); }, [loadGraph]);

  const panelStyle: React.CSSProperties = {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--bg-primary)',
    borderLeft: '1px solid var(--border-subtle)',
  };

  const headerStyle: React.CSSProperties = {
    padding: '14px 16px',
    borderBottom: '1px solid var(--border-subtle)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexShrink: 0,
  };

  if (loading || !graph) {
    return (
      <div style={panelStyle} data-testid="graph-view">
        <div style={headerStyle} data-testid="graph-view-header">
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>任务图谱</span>
          <button data-testid="graph-view-close" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 16 }}>×</button>
        </div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 12 }} data-testid={loading ? 'graph-view-loading' : 'graph-view-empty'}>
          {loading ? '加载中...' : '无数据'}
        </div>
      </div>
    );
  }

  const topLevelNodes = graph.nodes.filter(n => n.type !== 'project_stage');
  const stagesByParent = new Map<string, GraphNode[]>();
  for (const n of graph.nodes) {
    if (n.type === 'project_stage' && n.parent) {
      const list = stagesByParent.get(n.parent) || [];
      list.push(n);
      stagesByParent.set(n.parent, list);
    }
  }

  const eventEdges = graph.edges.filter(e => e.type === 'event_trigger');
  const triggerMap = new Map<string, GraphTrigger[]>();
  for (const t of graph.triggers) {
    const list = triggerMap.get(t.node_id) || [];
    list.push(t);
    triggerMap.set(t.node_id, list);
  }

  return (
    <div style={panelStyle} data-testid="graph-view">
      <div style={headerStyle} data-testid="graph-view-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>任务图谱</span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {graph.nodes.length} 节点 · {graph.edges.length} 关系
          </span>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button data-testid="graph-view-refresh" onClick={loadGraph} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4, background: 'transparent', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)', cursor: 'pointer' }}>刷新</button>
          <button data-testid="graph-view-close" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 16 }}>×</button>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 16 }} data-testid="graph-view-content">
        {topLevelNodes.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: 12, textAlign: 'center', padding: 40 }} data-testid="graph-view-empty">
            暂无自动化管道或项目
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {/* Event trigger connections */}
            {eventEdges.length > 0 && (
              <div style={{ marginBottom: 8 }} data-testid="graph-view-event-edges">
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>事件触发链</div>
                {eventEdges.map((edge, i) => {
                  const fromNode = graph.nodes.find(n => n.id === edge.from);
                  const toNode = graph.nodes.find(n => n.id === edge.to);
                  return (
                    <div key={i} data-testid={`graph-view-event-edge-${i}`} style={{ fontSize: 11, color: 'var(--text-secondary)', padding: '4px 8px', borderRadius: 4, background: '#8b5cf610', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontWeight: 500 }}>{fromNode?.name || edge.from.slice(0, 8)}</span>
                      <span style={{ color: 'var(--text-muted)' }}>→</span>
                      <span style={{ fontWeight: 500 }}>{toNode?.name || edge.to.slice(0, 8)}</span>
                      <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>{edge.label}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Node cards */}
            {topLevelNodes.map(node => {
              const nc = NODE_COLORS[node.type] || NODE_COLORS.automation;
              const nodeTriggers = triggerMap.get(node.id) || [];
              const stages = stagesByParent.get(node.id) || [];
              const statusColor = STATUS_DOT[node.status] || STATUS_DOT.pending;

              return (
                <div
                  key={node.id}
                  className="graph-view-node-card"
                  data-testid={`graph-view-node-${node.id}`}
                  onClick={() => setSelectedNode(selectedNode?.id === node.id ? null : node)}
                  style={{
                    borderRadius: 10,
                    border: `1px solid ${selectedNode?.id === node.id ? nc.border : 'var(--border-subtle)'}`,
                    background: selectedNode?.id === node.id ? nc.bg : 'var(--bg-secondary)',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{ padding: '10px 12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 14 }}>{nc.icon}</span>
                      <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', flex: 1 }}>{node.name}</span>
                      <div style={{ width: 6, height: 6, borderRadius: 3, background: statusColor }} />
                      <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{node.status}</span>
                    </div>

                    {/* Triggers */}
                    {nodeTriggers.length > 0 && (
                      <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }} data-testid={`graph-view-node-triggers-${node.id}`}>
                        {nodeTriggers.map((t, i) => (
                          <span key={i} data-testid={`graph-view-node-trigger-${node.id}-${i}`} style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: 'var(--bg-tertiary)', color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' }}>
                            {TRIGGER_ICONS[t.type] || '?'} {t.desc}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Node details when selected */}
                    {selectedNode?.id === node.id && (
                      <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-muted)' }}>
                        <div>ID: {node.id.slice(0, 12)}...</div>
                        {node.type === 'automation' && node.trigger_type && <div>触发: {node.trigger_type}</div>}
                      </div>
                    )}
                  </div>

                  {/* Project stages */}
                  {stages.length > 0 && (
                    <div style={{ borderTop: '1px solid var(--border-subtle)', padding: '6px 12px' }} data-testid={`graph-view-node-stages-${node.id}`}>
                      {stages.map(stage => {
                        const stColor = STATUS_DOT[stage.status] || STATUS_DOT.pending;
                        return (
                          <div key={stage.id} className="graph-view-stage-row" data-testid={`graph-view-stage-${stage.id}`} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0' }}>
                            <div style={{ width: 5, height: 5, borderRadius: 3, background: stColor }} />
                            <span style={{ fontSize: 11, color: 'var(--text-secondary)', flex: 1 }}>{stage.name}</span>
                            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{stage.status}</span>
                            {stage.human_review && <span style={{ fontSize: 9, color: '#eab308' }}>👤</span>}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default GraphView;
