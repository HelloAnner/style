/**
 * AI 技能创建器 — 卡片渲染容器。
 *
 * 从 skillDraftStore 读取当前 session 下所有活跃的草稿 / 删除确认卡片：
 *   - 实时 SSE 推送的卡片通过 responseMessageId / jobId 归属到对应 assistant 消息,
 *     由 ChatContainer.threadMessageFooter 挂到 AgentMessage 的 bodyExtra 槽
 *     (正文之后、反馈/追问之前),与正文等宽;
 *   - 刷新恢复但缺归属信息的"浮动卡片"由 ChatThreadPane.threadFooter 渲染在消息流末尾兜底。
 *
 * 状态同步:
 *   - 草稿激活成功后通过 onStatusChange 把 status 写回 store,刷新页面后 listBySession 仍能恢复;
 *   - 删除确认 completed / cancelled 都写回 store 保留终态,刷新会话后 useRestoreSkillDraftCards
 *     会调 skillDeleteConfirmationsApi.listBySession 用 DB 真实状态覆盖,避免 RuntimeEvent
 *     历史重放把卡片复活为「待确认」。
 *
 * 注意:本组件不主动调 listBySession;由 useRestoreSkillDraftCards hook 在 session 加载时注入数据。
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useDraftCardsByMessageOrJob,
  useDeleteCardsByMessageOrJob,
  useFloatingDraftCardsBySession,
  useFloatingDeleteCardsBySession,
  useSkillDraftStore,
} from '../../stores/skillDraftStore';
import { SkillDraftCard, type SkillDraftCardData } from './SkillDraftCard';
import { SkillDeleteCard } from './SkillDeleteCard';
import { SkillDraftDetailModal } from '../Skills/SkillDraftDetailModal';

interface Props {
  sessionId: string | null | undefined;
  responseMessageId?: string | null;
  jobId?: string | null;
  hidden?: boolean;
}

export const SkillCreatorCardStrip: React.FC<Props> = ({ sessionId, responseMessageId, jobId, hidden = false }) => {
  const navigate = useNavigate();
  const draftCardsByMessage = useDraftCardsByMessageOrJob(sessionId, responseMessageId, jobId);
  const deleteCardsByMessage = useDeleteCardsByMessageOrJob(sessionId, responseMessageId, jobId);
  const floatingDraftCards = useFloatingDraftCardsBySession(sessionId);
  const floatingDeleteCards = useFloatingDeleteCardsBySession(sessionId);
  const isMessageScoped = Boolean(responseMessageId || jobId);
  const draftCards = isMessageScoped ? draftCardsByMessage : floatingDraftCards;
  const deleteCards = isMessageScoped ? deleteCardsByMessage : floatingDeleteCards;
  const markDraftStatus = useSkillDraftStore((state) => state.markDraftStatus);
  const markDeleteStatus = useSkillDraftStore((state) => state.markDeleteStatus);
  const [detailDraftId, setDetailDraftId] = useState<string | null>(null);

  if (hidden || (draftCards.length === 0 && deleteCards.length === 0)) {
    return null;
  }

  return (
    <>
      <div
        className="pt-2 space-y-2"
        style={{ width: '100%', minWidth: 0 }}
        data-testid="skill-creator-card-strip"
      >
        {draftCards.map((card) => (
          <SkillDraftCard
            key={card.draft_id}
            data={card}
            restored={false}
            onViewDetail={(draftId) => setDetailDraftId(draftId)}
            onViewExistingSkill={(skillId) => {
              navigate(`/admin?tab=skills&focusSkillId=${encodeURIComponent(skillId)}`);
            }}
            onStatusChange={(status: SkillDraftCardData['status'], extra) =>
              markDraftStatus(card.draft_id, status, extra)
            }
          />
        ))}
        {deleteCards.map((card) => (
          <SkillDeleteCard
            key={card.skill_id}
            data={card}
            onTerminated={(state) => {
              markDeleteStatus(card.skill_id, state);
            }}
          />
        ))}
      </div>
      <SkillDraftDetailModal
        draftId={detailDraftId}
        onClose={() => setDetailDraftId(null)}
      />
    </>
  );
};
