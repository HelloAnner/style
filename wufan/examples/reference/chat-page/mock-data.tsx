import React from 'react';
import type {
  WufanExecutionNotice,
  WufanMessage,
  WufanSessionGroup,
} from './types';

export const exampleSessionGroups: WufanSessionGroup[] = [
  {
    label: '今天',
    sessions: [
      {
        id: 'workspace-query',
        title: '查询空间信息',
        active: true,
      },
      {
        id: 'weekly-summary',
        title: '整理本周项目进展',
      },
    ],
  },
  {
    label: '过去 7 天',
    sessions: [
      {
        id: 'design-review',
        title: '设计评审要点',
      },
    ],
  },
];

export const exampleMessages: WufanMessage[] = [
  {
    id: 'user-1',
    role: 'user',
    author: '你',
    time: '10:24',
    content: <p>帮我查询一下当前空间的基本信息，并整理成容易阅读的摘要。</p>,
  },
  {
    id: 'agent-1',
    role: 'agent',
    author: '小悟',
    time: '10:24',
    feedback: {
      sessionId: 'session-workspace-query',
      runId: 'run-agent-1',
    },
    trace: {
      id: 'trace-agent-1',
      status: 'completed',
      durationMs: 521_000,
      initialExpanded: true,
      sources: Array.from({ length: 133 }, (_, index) => ({
        id: `source-${index + 1}`,
        title: `空间信息来源 ${index + 1}`,
        url: `https://example.com/sources/${index + 1}`,
        domain: 'example.com',
      })),
      steps: [
        {
          id: 'note-1',
          kind: 'note',
          seq: 10,
          status: 'completed',
          content:
            '这是一个典型的跨领域深度分析任务，需要三路独立闭环并行执行，最后由我汇总形成合作优先级建议。先读取客户洞察技能完成前置约束，同时锁定三个主体的准确信息，为后续检索做准备。',
        },
        {
          id: 'tool-1',
          kind: 'tool',
          seq: 11,
          toolName: 'read',
          displayName: '读取文件',
          summary: '阅读 "skills/customer-insight/SKILL.md"',
          status: 'completed',
          icon: 'read',
          durationMs: 126,
        },
        {
          id: 'note-2',
          kind: 'note',
          seq: 20,
          status: 'completed',
          content:
            '技能已读取。完整约束已经进入当前执行上下文，接下来会并行核验三家企业的注册主体、统一社会信用代码与跨境主体差异，并把冲突留到汇总阶段统一解释。',
        },
        ...['比亚迪股份有限公司', '蔚来控股有限公司', '理想汽车'].map(
          (_company, index) => ({
            id: `tool-company-${index + 1}`,
            kind: 'tool' as const,
            seq: 21 + index,
            toolName: 'enterprise_search',
            displayName: 'MOSS-企业列表搜索',
            summary: 'MOSS-企业列表搜索',
            status: 'completed' as const,
            icon: 'search' as const,
            durationMs: 860 + index * 170,
          }),
        ),
        {
          id: 'note-3',
          kind: 'note',
          seq: 30,
          status: 'completed',
          content:
            '主体已锁定： 比亚迪股份有限公司（91440300192317458F） 蔚来控股有限公司（91340111MA2RAD3M4R） 理想汽车：首选返回的是开曼主体（72892972，非境内统一社会信用代码）。',
        },
      ],
    },
    content: (
      <>
        <p>已经找到当前空间的信息，摘要如下：</p>
        <h3>空间概览</h3>
        <ul>
          <li>
            <strong>空间名称：</strong>产品设计协作空间
          </li>
          <li>
            <strong>空间类型：</strong>团队工作空间
          </li>
          <li>
            <strong>当前状态：</strong>正常运行
          </li>
        </ul>
        <h3>使用建议</h3>
        <p>
          可以继续让我整理成员分工、最近任务或自动化执行情况。我会保持同一会话上下文。
        </p>
      </>
    ),
  },
];

export const exampleExecutionNotices: WufanExecutionNotice[] = [
  {
    id: 'notice-success-01',
    title: '每周客户洞察摘要',
    summary: '三家企业的主体核验与合作优先级分析已经完成。',
    status: 'success',
    createdAt: '2026-07-30T10:32:41+08:00',
    referenceType: 'session',
    referenceId: 'session-workspace-query',
  },
];
