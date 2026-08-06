/**
 * ProjectPanel — 项目管理面板（右侧面板）
 *
 * 功能：项目列表、项目详情、阶段流程图、人类检查点审阅
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  listProjects,
  getProject,
  startProject,
  reviewStage,
  deleteProject,
  type ProjectData,
} from '../../api/projects';
import { toast } from '../../utils/toast';

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft: { label: '草稿', color: 'var(--text-muted)' },
  active: { label: '运行中', color: '#22c55e' },
  paused: { label: '已暂停', color: '#eab308' },
  completed: { label: '已完成', color: '#3b82f6' },
  archived: { label: '已归档', color: 'var(--text-muted)' },
};

const STAGE_STATUS: Record<string, { icon: string; color: string }> = {
  pending: { icon: '⏳', color: 'var(--text-muted)' },
  running: { icon: '🔄', color: '#22c55e' },
  awaiting_review: { icon: '👤', color: '#eab308' },
  completed: { icon: '✅', color: '#3b82f6' },
  failed: { icon: '❌', color: '#ef4444' },
  skipped: { icon: '⏭️', color: 'var(--text-muted)' },
};

interface ProjectPanelProps {
  onClose: () => void;
}

type View = 'list' | 'detail';

export const ProjectPanel: React.FC<ProjectPanelProps> = ({ onClose }) => {
  const [view, setView] = useState<View>('list');
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [selected, setSelected] = useState<ProjectData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('');

  const loadProjects = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listProjects(filter || undefined);
      setProjects(data);
    } catch (e) {
      console.error('Failed to load projects:', e);
    }
    setLoading(false);
  }, [filter]);

  useEffect(() => { loadProjects(); }, [loadProjects]);

  const openDetail = async (id: string) => {
    try {
      const data = await getProject(id);
      setSelected(data);
      setView('detail');
    } catch (e) {
      console.error('Failed to load project:', e);
    }
  };

  const handleStart = async () => {
    if (!selected) return;
    try {
      await startProject(selected.id);
      await openDetail(selected.id);
    } catch (e: any) {
      toast.error(e.message || '启动失败');
    }
  };

  const handleReview = async (stageKey: string, decision: 'approve' | 'reject') => {
    if (!selected) return;
    const comment = decision === 'reject' ? prompt('请输入驳回原因：') || '' : '';
    try {
      await reviewStage(selected.id, stageKey, decision, comment);
      await openDetail(selected.id);
    } catch (e: any) {
      toast.error(e.message || '审阅失败');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确认删除此项目？')) return;
    try {
      await deleteProject(id);
      setView('list');
      setSelected(null);
      loadProjects();
    } catch (e: any) {
      toast.error(e.message || '删除失败');
    }
  };

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

  if (view === 'detail' && selected) {
    const status = STATUS_LABELS[selected.status] || STATUS_LABELS.draft;
    const stages = selected.stages || [];

    return (
      <div className="project-panel project-panel-detail" style={panelStyle}>
        <div className="project-panel-header" style={headerStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={() => { setView('list'); setSelected(null); }} data-testid="project-panel-back" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 16 }}>←</button>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{selected.display_name}</span>
            <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: `${status.color}20`, color: status.color }}>{status.label}</span>
          </div>
          <div className="project-panel-detail-actions" style={{ display: 'flex', gap: 6 }}>
            {selected.status === 'draft' && (
              <button onClick={handleStart} data-testid="project-panel-start" style={{ fontSize: 12, padding: '4px 12px', borderRadius: 6, background: '#22c55e20', color: '#22c55e', border: '1px solid #22c55e40', cursor: 'pointer' }}>启动</button>
            )}
            <button onClick={() => handleDelete(selected.id)} data-testid="project-panel-delete" style={{ fontSize: 12, padding: '4px 12px', borderRadius: 6, background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border-subtle)', cursor: 'pointer' }}>删除</button>
          </div>
        </div>

        <div className="project-panel-content" style={{ flex: 1, overflow: 'auto', padding: 16 }}>
          {selected.goal && (
            <div style={{ marginBottom: 16, padding: '10px 12px', borderRadius: 8, background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>目标</div>
              <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5 }}>{selected.goal}</div>
            </div>
          )}

          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>阶段流程</div>
          <div className="project-panel-stages" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {(selected.stages_config || []).map((sc, i) => {
              const stageRecord = stages.find(s => s.stage_key === sc.key);
              const st = STAGE_STATUS[stageRecord?.status || 'pending'] || STAGE_STATUS.pending;
              const isReviewable = stageRecord?.status === 'awaiting_review';

              return (
                <div key={sc.key}>
                  <div
                    className="project-panel-stage"
                    data-testid={`project-panel-stage-${sc.key}`}
                    style={{
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: `1px solid ${isReviewable ? '#eab30840' : 'var(--border-subtle)'}`,
                    background: isReviewable ? '#eab30808' : 'var(--bg-secondary)',
                  }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 14 }}>{st.icon}</span>
                      <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', flex: 1 }}>{sc.display_name || sc.key}</span>
                      <span style={{ fontSize: 10, color: st.color }}>{stageRecord?.status || 'pending'}</span>
                    </div>

                    {stageRecord?.result_summary && (
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 6, lineHeight: 1.5, paddingLeft: 22 }}>
                        {stageRecord.result_summary.slice(0, 200)}
                      </div>
                    )}

                    {isReviewable && (
                      <div style={{ display: 'flex', gap: 6, marginTop: 8, paddingLeft: 22 }}>
                        <button onClick={() => handleReview(sc.key, 'approve')} data-testid={`project-panel-stage-approve-${sc.key}`} style={{ fontSize: 11, padding: '4px 12px', borderRadius: 6, background: '#22c55e20', color: '#22c55e', border: '1px solid #22c55e40', cursor: 'pointer' }}>通过</button>
                        <button onClick={() => handleReview(sc.key, 'reject')} data-testid={`project-panel-stage-reject-${sc.key}`} style={{ fontSize: 11, padding: '4px 12px', borderRadius: 6, background: '#ef444420', color: '#ef4444', border: '1px solid #ef444440', cursor: 'pointer' }}>驳回</button>
                      </div>
                    )}
                  </div>

                  {i < (selected.stages_config || []).length - 1 && (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '2px 0' }}>
                      <div style={{ width: 1, height: 12, background: 'var(--border-subtle)' }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="project-panel project-panel-list" style={panelStyle}>
      <div className="project-panel-header" style={headerStyle}>
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>项目</span>
        <button onClick={onClose} data-testid="project-panel-close" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 16 }}>×</button>
      </div>

      <div className="project-panel-filters" style={{ padding: '8px 16px', display: 'flex', gap: 4, flexShrink: 0 }}>
        {['', 'active', 'draft', 'completed'].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            fontSize: 11, padding: '3px 10px', borderRadius: 6, cursor: 'pointer',
            background: filter === f ? 'var(--hover-bg-strong)' : 'transparent',
            border: `1px solid ${filter === f ? 'var(--text-muted)' : 'var(--border-subtle)'}`,
            color: filter === f ? 'var(--text-primary)' : 'var(--text-muted)',
          }}>
            {f === '' ? '全部' : f === 'active' ? '运行中' : f === 'draft' ? '草稿' : '已完成'}
          </button>
        ))}
      </div>

      <div className="project-panel-content" style={{ flex: 1, overflow: 'auto', padding: '8px 16px' }}>
        {loading ? (
          <div className="project-panel-loading" style={{ color: 'var(--text-muted)', fontSize: 12, padding: 20, textAlign: 'center' }}>加载中...</div>
        ) : projects.length === 0 ? (
          <div className="project-panel-empty" style={{ color: 'var(--text-muted)', fontSize: 12, padding: 20, textAlign: 'center' }}>暂无项目</div>
        ) : (
          <div className="project-panel-list-items" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {projects.map(p => {
              const st = STATUS_LABELS[p.status] || STATUS_LABELS.draft;
              return (
                <div
                  key={p.id}
                  onClick={() => openDetail(p.id)}
                  className="project-panel-item"
                  data-testid={`project-panel-item-${p.id}`}
                  style={{
                    padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
                    border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)',
                    transition: 'border-color 0.15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--text-muted)')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border-subtle)')}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', flex: 1 }}>{p.display_name}</span>
                    <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: `${st.color}20`, color: st.color }}>{st.label}</span>
                  </div>
                  {p.goal && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.4 }}>{p.goal.slice(0, 80)}</div>}
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>{(p.stages_config || []).length} 阶段</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProjectPanel;
