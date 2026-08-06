/**
 * Skill 编辑器组件
 * 
 * 支持手动编辑 SKILL.md 或上传 ZIP 包
 */

import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { AnimatePresence } from '../../lib/motion';
import type { Skill, SkillCreate } from '../../types/platform';
import { skillApi } from '../../api/platform';
import {
  CloseIcon,
  SaveIcon,
  UploadIcon,
  FileIcon,
  TrashIcon,
  CodeIcon,
} from '../common/Icons';
import { toast } from '../../utils/toast';

interface SkillEditorProps {
  agentId: string;
  skills: Skill[];
  onSkillsChange: (skills: Skill[]) => void;
}

export const SkillEditor: React.FC<SkillEditorProps> = ({
  agentId,
  skills,
  onSkillsChange,
}) => {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const handleCreateSkill = async (data: SkillCreate) => {
    const skill = await skillApi.create(agentId, data);
    onSkillsChange([...skills, skill]);
    setShowCreateForm(false);
  };
  
  const handleUploadZip = async (file: File) => {
    setUploading(true);
    try {
      const skill = await skillApi.uploadZip(agentId, file);
      onSkillsChange([...skills, skill]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '上传失败');
    } finally {
      setUploading(false);
    }
  };
  
  const handleDeleteSkill = async (skillId: string) => {
    if (!confirm('确定要删除这个技能吗？')) return;
    
    await skillApi.delete(agentId, skillId);
    onSkillsChange(skills.filter(s => s.id !== skillId));
  };
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleUploadZip(file);
      e.target.value = '';
    }
  };
  
  return (
    <div className="space-y-4" data-testid="agent-skill-editor">
      <div className="flex items-center justify-between" data-testid="agent-skill-editor-header">
        <h3 className="text-sm font-medium text-zinc-400" data-testid="agent-skill-editor-title">技能包</h3>
        <div className="flex items-center gap-2" data-testid="agent-skill-editor-actions">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            data-testid="agent-skill-upload-zip"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs
              bg-surface-200 hover:bg-surface-300 text-zinc-300
              disabled:opacity-50 transition-colors"
          >
            <UploadIcon size={12} />
            {uploading ? '上传中...' : '上传 ZIP'}
          </button>
          <button
            onClick={() => setShowCreateForm(true)}
            data-testid="agent-skill-create-manual"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs
              bg-accent/20 hover:bg-accent/30 text-accent transition-colors"
          >
            <CodeIcon size={12} />
            手动创建
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".zip"
          onChange={handleFileChange}
          className="hidden"
          data-testid="agent-skill-upload-input"
        />
      </div>
      
      {/* Skill 列表 */}
      {skills.length === 0 ? (
        <div className="text-center py-6 text-zinc-500 text-sm" data-testid="agent-skill-empty">
          还没有添加任何技能
        </div>
      ) : (
        <div className="space-y-2" data-testid="agent-skill-list">
          {skills.map((skill) => (
            <SkillItem
              key={skill.id}
              skill={skill}
              onDelete={() => handleDeleteSkill(skill.id)}
            />
          ))}
        </div>
      )}
      
      {/* 创建表单 */}
      <AnimatePresence>
        {showCreateForm && (
          <SkillCreateForm
            onSave={handleCreateSkill}
            onClose={() => setShowCreateForm(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

// Skill 列表项
const SkillItem: React.FC<{
  skill: Skill;
  onDelete: () => void;
}> = ({ skill, onDelete }) => {
  const [expanded, setExpanded] = useState(false);
  
  return (
    <div className="agent-skill-item rounded-lg bg-surface-200 border border-surface-300 overflow-hidden" data-testid={`agent-skill-item-${skill.id}`}>
      <div
        className="agent-skill-item__header flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-surface-300 transition-colors"
        onClick={() => setExpanded(!expanded)}
        data-testid={`agent-skill-toggle-${skill.id}`}
      >
        <div className="agent-skill-item__meta flex items-center gap-2">
          <FileIcon size={14} className="text-secondary" />
          <span className="agent-skill-item__name text-sm text-white font-medium" data-testid={`agent-skill-name-${skill.id}`}>{skill.name}</span>
          <span className="agent-skill-item__content-type text-xs text-zinc-500 px-1.5 py-0.5 rounded bg-surface-300" data-testid={`agent-skill-content-type-${skill.id}`}>
            {skill.content_type}
          </span>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="agent-skill-item__delete p-1 rounded hover:bg-red-500/20 text-zinc-500 hover:text-red-400 transition-colors"
          data-testid={`agent-skill-delete-${skill.id}`}
        >
          <TrashIcon size={12} />
        </button>
      </div>
      
      <AnimatePresence>
        {expanded && skill.skill_md_content && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="agent-skill-item__content overflow-hidden"
            data-testid={`agent-skill-content-${skill.id}`}
          >
            <div className="px-3 pb-3 border-t border-surface-300">
              <pre className="agent-skill-item__md mt-2 p-2 rounded bg-black/20 text-xs text-zinc-400 font-mono overflow-auto max-h-40" data-testid={`agent-skill-md-${skill.id}`}>
                {skill.skill_md_content}
              </pre>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Skill 创建表单
const SkillCreateForm: React.FC<{
  onSave: (data: SkillCreate) => Promise<void>;
  onClose: () => void;
}> = ({ onSave, onClose }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [content, setContent] = useState(DEFAULT_SKILL_MD);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      setError('请输入技能名称');
      return;
    }
    
    setSaving(true);
    setError(null);
    
    try {
      await onSave({
        name: name.trim(),
        description: description.trim() || undefined,
        skill_md_content: content,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
      setSaving(false);
    }
  };
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
      data-testid="agent-skill-create-backdrop"
    >
      <motion.div
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.95 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-surface-100 rounded-2xl w-full max-w-xl max-h-[80vh] overflow-hidden flex flex-col"
        data-testid="agent-skill-create-modal"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-surface-200" data-testid="agent-skill-create-header">
          <h3 className="font-semibold text-white" data-testid="agent-skill-create-title">创建技能</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-200 text-zinc-400" data-testid="agent-skill-create-close">
            <CloseIcon size={16} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-4" data-testid="agent-skill-create-form">
          {error && (
            <div className="p-2 rounded-lg bg-red-500/20 text-red-400 text-sm" data-testid="agent-skill-create-error">{error}</div>
          )}
          
          <div>
            <label className="block text-sm text-zinc-400 mb-1">技能名称 *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：code-review"
              data-testid="agent-skill-create-name"
              className="w-full px-3 py-2 bg-surface-200 border border-surface-300 rounded-lg
                text-white text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          
          <div>
            <label className="block text-sm text-zinc-400 mb-1">描述</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="简短描述这个技能的作用"
              data-testid="agent-skill-create-description"
              className="w-full px-3 py-2 bg-surface-200 border border-surface-300 rounded-lg
                text-white text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          
          <div>
            <label className="block text-sm text-zinc-400 mb-1">SKILL.md 内容</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={10}
              data-testid="agent-skill-create-content"
              className="w-full px-3 py-2 bg-surface-200 border border-surface-300 rounded-lg
                text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-accent resize-none"
            />
          </div>
        </form>
        
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-surface-200" data-testid="agent-skill-create-footer">
          <button
            type="button"
            onClick={onClose}
            data-testid="agent-skill-create-cancel"
            className="px-3 py-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-surface-200 text-sm"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            data-testid="agent-skill-create-submit"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent text-white text-sm
              hover:bg-accent/90 disabled:opacity-50"
          >
            <SaveIcon size={14} />
            {saving ? '保存中...' : '创建'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

const DEFAULT_SKILL_MD = `---
name: my-skill
description: 描述这个技能的作用和触发条件
---

# 技能名称

## 用途
描述这个技能用于什么场景

## 使用方法
1. 步骤一
2. 步骤二

## 注意事项
- 注意事项一
`;
