import React, { useMemo, useRef, useState } from 'react';
import { exampleMessages, exampleSessionGroups } from './mock-data';
import type {
  WufanChatPageProps,
  WufanMessage,
  WufanSessionGroup,
} from './types';
import './wufan-chat.css';

type IconName =
  | 'archive'
  | 'automation'
  | 'bot'
  | 'check'
  | 'chevron-down'
  | 'chevrons-left'
  | 'copy'
  | 'globe'
  | 'history'
  | 'image'
  | 'lightning'
  | 'menu'
  | 'message'
  | 'moon'
  | 'more'
  | 'paperclip'
  | 'plus'
  | 'search'
  | 'send'
  | 'sparkles'
  | 'star'
  | 'sun'
  | 'thumbs-down'
  | 'thumbs-up'
  | 'user'
  | 'users';

const ICON_PATHS: Record<IconName, React.ReactNode> = {
  archive: (
    <>
      <rect width="18" height="4" x="3" y="3" rx="1" />
      <path d="M5 7v13h14V7M10 11h4" />
    </>
  ),
  automation: (
    <>
      <path d="M4 7h16M7 4v6M4 17h16M17 14v6" />
      <circle cx="7" cy="7" r="2" />
      <circle cx="17" cy="17" r="2" />
    </>
  ),
  bot: (
    <>
      <rect width="16" height="12" x="4" y="8" rx="3" />
      <path d="M9 12h.01M15 12h.01M9 16h6M12 8V4M9 4h6" />
    </>
  ),
  check: <path d="m5 12 4 4L19 6" />,
  'chevron-down': <path d="m6 9 6 6 6-6" />,
  'chevrons-left': <path d="m11 17-5-5 5-5M18 17l-5-5 5-5" />,
  copy: (
    <>
      <rect width="14" height="14" x="8" y="8" rx="2" />
      <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" />
    </>
  ),
  history: (
    <>
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 3v5h5M12 7v5l3 2" />
    </>
  ),
  image: (
    <>
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="m21 15-5-5L5 21" />
    </>
  ),
  lightning: <path d="m13 2-9 12h8l-1 8 9-12h-8l1-8Z" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  message: (
    <>
      <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z" />
      <path d="M8 9h8M8 13h5" />
    </>
  ),
  moon: <path d="M20 15.5A8.5 8.5 0 0 1 8.5 4 8.5 8.5 0 1 0 20 15.5Z" />,
  more: (
    <>
      <circle cx="5" cy="12" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
    </>
  ),
  paperclip: <path d="m21.4 11.6-8.5 8.5a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 1 1 5.7 5.7l-9.2 9.2a2 2 0 1 1-2.8-2.8l8.5-8.5" />,
  plus: <path d="M12 5v14M5 12h14" />,
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </>
  ),
  send: (
    <>
      <path d="m22 2-7 20-4-9-9-4Z" />
      <path d="M22 2 11 13" />
    </>
  ),
  sparkles: (
    <>
      <path d="m12 3-1.2 3.4a4 4 0 0 1-2.4 2.4L5 10l3.4 1.2a4 4 0 0 1 2.4 2.4L12 17l1.2-3.4a4 4 0 0 1 2.4-2.4L19 10l-3.4-1.2a4 4 0 0 1-2.4-2.4Z" />
      <path d="m19 17-.5 1.5L17 19l1.5.5L19 21l.5-1.5L21 19l-1.5-.5Z" />
    </>
  ),
  star: <path d="m12 2 3 6.1 6.7 1-4.9 4.7 1.2 6.7-6-3.1-6 3.1 1.2-6.7-4.9-4.7 6.7-1Z" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  'thumbs-down': <path d="M17 14V3H5.5L3 10v4h6l-1 5a2 2 0 0 0 2 2l5-7h2a3 3 0 0 0 3-3V6a3 3 0 0 0-3-3" />,
  'thumbs-up': <path d="M7 10v11H3V10h4Zm0 9h10a3 3 0 0 0 3-3v-5a3 3 0 0 0-3-3h-2l1-5a2 2 0 0 0-2-2L9 8H7" />,
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </>
  ),
  users: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" />
    </>
  ),
};

function Icon({
  name,
  size = 16,
}: {
  name: IconName;
  size?: number;
}): React.ReactElement {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICON_PATHS[name]}
    </svg>
  );
}

function WufanLogo(): React.ReactElement {
  return (
    <div className="wufan-logo" aria-label="悟帆AI">
      <svg viewBox="0 0 70 70" aria-hidden="true">
        <path d="M 40 6 A 29 29 0 1 0 40 64 A 20.5 25.2 0 1 1 40 6 Z" />
        <circle cx="37" cy="22" r="4.2" />
        <circle cx="51" cy="19" r="4.2" />
      </svg>
      <span>悟帆AI</span>
    </div>
  );
}

const NAVIGATION: Array<{ icon: IconName; label: string; active?: boolean }> = [
  { icon: 'plus', label: '新任务', active: true },
  { icon: 'automation', label: '自动化' },
  { icon: 'bot', label: 'AI 员工' },
  { icon: 'sparkles', label: '价值中心' },
];

function Sidebar({
  groups,
  open,
  onClose,
}: {
  groups: WufanSessionGroup[];
  open: boolean;
  onClose: () => void;
}): React.ReactElement {
  return (
    <>
      <button
        className={`wufan-sidebar-scrim${open ? ' is-open' : ''}`}
        type="button"
        aria-label="关闭任务列表"
        onClick={onClose}
      />
      <aside
        className={`wufan-sidebar${open ? ' is-open' : ''}`}
        data-cvo-id="cvo-sidebar-inner"
        aria-label="悟帆任务导航"
      >
        <div className="wufan-sidebar__header">
          <WufanLogo />
          <button
            className="wufan-icon-button"
            type="button"
            aria-label="收起侧栏"
            onClick={onClose}
          >
            <Icon name="chevrons-left" />
          </button>
        </div>

        <nav className="wufan-primary-nav" aria-label="主要功能">
          {NAVIGATION.map((item) => (
            <button
              className={`wufan-nav-item${item.active ? ' is-active' : ''}`}
              type="button"
              key={item.label}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="wufan-sidebar__divider" />

        <div className="wufan-task-heading">
          <span>任务</span>
          <div>
            <button className="wufan-icon-button is-small" type="button" aria-label="搜索任务">
              <Icon name="search" size={14} />
            </button>
            <button className="wufan-icon-button is-small" type="button" aria-label="任务菜单">
              <Icon name="more" size={14} />
            </button>
          </div>
        </div>

        <div className="wufan-session-list">
          {groups.map((group) => (
            <section className="wufan-session-group" key={group.label}>
              <h2>{group.label}</h2>
              {group.sessions.map((session) => (
                <button
                  className={`wufan-session${session.active ? ' is-active' : ''}`}
                  type="button"
                  key={session.id}
                >
                  <span>{session.title}</span>
                  {session.active ? <Icon name="more" size={14} /> : null}
                </button>
              ))}
            </section>
          ))}
        </div>

        <div className="wufan-sidebar__footer">
          <button className="wufan-nav-item" type="button">
            <Icon name="globe" />
            <span>探索空间</span>
          </button>
          <button className="wufan-user-row" type="button">
            <span className="wufan-user-avatar">午</span>
            <span className="wufan-user-row__label">
              <strong>午饭示例</strong>
              <small>个人空间</small>
            </span>
            <Icon name="more" size={15} />
          </button>
        </div>
      </aside>
    </>
  );
}

function ChatHeader({
  agentName,
  sessionTitle,
  theme,
  onOpenSidebar,
  onThemeChange,
}: {
  agentName: string;
  sessionTitle: string;
  theme: 'light' | 'dark';
  onOpenSidebar: () => void;
  onThemeChange?: WufanChatPageProps['onThemeChange'];
}): React.ReactElement {
  return (
    <header className="wufan-chat-header">
      <div className="wufan-chat-header__title">
        <button
          className="wufan-icon-button wufan-mobile-menu"
          type="button"
          aria-label="打开任务列表"
          onClick={onOpenSidebar}
        >
          <Icon name="menu" />
        </button>
        <strong>{agentName}</strong>
        <span className="wufan-chat-header__slash">/</span>
        <Icon name="message" size={14} />
        <span className="wufan-chat-header__session">{sessionTitle}</span>
        <button className="wufan-icon-button is-small" type="button" aria-label="收藏任务">
          <Icon name="star" size={14} />
        </button>
      </div>
      <div className="wufan-chat-header__actions">
        {onThemeChange ? (
          <button
            className="wufan-icon-button"
            type="button"
            aria-label={theme === 'light' ? '切换暗色主题' : '切换明色主题'}
            onClick={() => onThemeChange(theme === 'light' ? 'dark' : 'light')}
          >
            <Icon name={theme === 'light' ? 'moon' : 'sun'} />
          </button>
        ) : null}
        <button className="wufan-icon-button" type="button" aria-label="会话历史">
          <Icon name="history" />
        </button>
        <button className="wufan-icon-button" type="button" aria-label="归档">
          <Icon name="archive" />
        </button>
        <button className="wufan-icon-button" type="button" aria-label="更多操作">
          <Icon name="more" />
        </button>
      </div>
    </header>
  );
}

function AgentAvatar(): React.ReactElement {
  return <span className="wufan-agent-avatar" aria-hidden="true" />;
}

function UserAvatar(): React.ReactElement {
  return (
    <span className="wufan-message-user-avatar" aria-hidden="true">
      <Icon name="user" size={15} />
    </span>
  );
}

function MessageBubble({ message }: { message: WufanMessage }): React.ReactElement {
  const isUser = message.role === 'user';
  return (
    <article className={`wufan-message is-${message.role}`}>
      {isUser ? <UserAvatar /> : <AgentAvatar />}
      <div className="wufan-message__content">
        <div className="wufan-message__meta">
          <strong>{message.author}</strong>
          <time>{message.time}</time>
        </div>
        <div className="wufan-message__bubble">{message.content}</div>
        <div className="wufan-message__tools" aria-label="消息操作">
          <button type="button" aria-label="复制">
            <Icon name="copy" size={14} />
          </button>
          {!isUser ? (
            <>
              <button type="button" aria-label="有帮助">
                <Icon name="thumbs-up" size={14} />
              </button>
              <button type="button" aria-label="没有帮助">
                <Icon name="thumbs-down" size={14} />
              </button>
            </>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function Composer({
  modelLabel,
  onSend,
}: {
  modelLabel: string;
  onSend: (value: string) => void;
}): React.ReactElement {
  const [draft, setDraft] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const canSend = draft.trim().length > 0;

  const send = () => {
    const value = draft.trim();
    if (!value) {
      return;
    }
    onSend(value);
    setDraft('');
    if (textareaRef.current) {
      textareaRef.current.style.height = '24px';
    }
  };

  return (
    <div className="wufan-composer-wrap">
      <div className="wufan-composer" data-cvo-id="cvo-chat-composer">
        <textarea
          ref={textareaRef}
          rows={1}
          value={draft}
          placeholder="给小悟发送消息..."
          aria-label="消息内容"
          onChange={(event) => {
            setDraft(event.target.value);
            event.currentTarget.style.height = '24px';
            event.currentTarget.style.height = `${Math.min(event.currentTarget.scrollHeight, 160)}px`;
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              send();
            }
          }}
        />
        <div className="wufan-composer__toolbar">
          <div className="wufan-composer__tools">
            <button type="button" aria-label="添加附件">
              <Icon name="paperclip" />
            </button>
            <button type="button" className="wufan-tool-pill">
              <Icon name="lightning" size={14} />
              <span>深度思考</span>
            </button>
            <button type="button" className="wufan-tool-pill">
              <span>{modelLabel}</span>
              <Icon name="chevron-down" size={13} />
            </button>
          </div>
          <button
            className={`wufan-send-button${canSend ? ' is-active' : ''}`}
            type="button"
            aria-label="发送消息"
            disabled={!canSend}
            onClick={send}
          >
            <Icon name="send" size={17} />
          </button>
        </div>
      </div>
      <p className="wufan-composer-note">AI 生成内容可能存在错误，请核对重要信息。</p>
    </div>
  );
}

export function WufanChatPage({
  theme,
  agentName = '小悟',
  sessionTitle = '查询空间信息',
  sessionGroups = exampleSessionGroups,
  initialMessages = exampleMessages,
  modelLabel = 'Qwen 3.7 Plus',
  onSend,
  onThemeChange,
  className,
}: WufanChatPageProps): React.ReactElement {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sentMessages, setSentMessages] = useState<WufanMessage[]>([]);
  const messages = useMemo(
    () => [...initialMessages, ...sentMessages],
    [initialMessages, sentMessages],
  );

  const handleSend = (value: string) => {
    setSentMessages((current) => [
      ...current,
      {
        id: `local-${Date.now()}`,
        role: 'user',
        author: '你',
        time: new Intl.DateTimeFormat('zh-CN', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        }).format(new Date()),
        content: <p>{value}</p>,
      },
    ]);
    onSend?.(value);
  };

  return (
    <main
      className={`wufan-chat-page${className ? ` ${className}` : ''}`}
      data-theme={theme}
      data-cvo-id="cvo-chat-page-reference"
    >
      <div className="wufan-background" aria-hidden="true" />
      <div className="wufan-app-shell">
        <Sidebar
          groups={sessionGroups}
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
        <section className="wufan-chat-panel" aria-label={`${sessionTitle} 对话`}>
          <ChatHeader
            agentName={agentName}
            sessionTitle={sessionTitle}
            theme={theme}
            onOpenSidebar={() => setSidebarOpen(true)}
            onThemeChange={onThemeChange}
          />
          <div className="wufan-message-scroll">
            <div className="wufan-message-list" aria-live="polite">
              {messages.map((message) => (
                <MessageBubble message={message} key={message.id} />
              ))}
            </div>
          </div>
          <Composer modelLabel={modelLabel} onSend={handleSend} />
        </section>
      </div>
    </main>
  );
}
