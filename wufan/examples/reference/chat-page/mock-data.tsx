import React from 'react';
import type { WufanMessage, WufanSessionGroup } from './types';

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
