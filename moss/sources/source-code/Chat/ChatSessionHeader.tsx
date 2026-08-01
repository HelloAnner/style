import React from 'react';
import { track } from '../../utils/track';
import { useUiStore } from '../../stores/uiStore';
import { useFrontendConfigStore } from '../../stores/frontendConfigStore';
import { FineDesignTooltip } from '../common/FineDesignTooltip';
import { SidebarIcon } from '../Sidebar/icons/SidebarIcon';

type HeaderAction = 'star' | 'board' | 'automation' | 'share' | 'files';

interface ChatSessionHeaderProps {
  agentName: string;
  sessionTitle: string;
  isAutoSession?: boolean;
  hasActiveSession: boolean;
  isNewSession?: boolean;
  glassActive?: boolean;
  starred?: boolean;
  onToggleStar?: () => void;
  showBoardAction?: boolean;
  onOpenBoard?: () => void;
  onOpenAutomation?: () => void;
  onShare?: (anchorRect?: DOMRect | null) => void;
  onOpenFiles?: () => void;
  showUtilityActions?: boolean;
  disabledActions?: Partial<Record<HeaderAction, boolean>>;
}

const headerButtonStyle: React.CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: 8,
  border: 0,
  padding: 0,
  background: 'transparent',
  color: 'var(--text-primary)',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  cursor: 'pointer',
  transition: 'background 0.15s ease, color 0.15s ease',
};

const headerButtonLabelStyle: React.CSSProperties = {
  fontSize: 13,
  lineHeight: '20px',
  fontWeight: 400,
  whiteSpace: 'nowrap',
};

const boardNewBadgeStyle: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  left: -22,
  height: 14,
  minWidth: 27,
  padding: '0 4px',
  borderRadius: 999,
  border: '1px solid var(--bg-primary)',
  background: 'var(--moss-home-title-accent)',
  color: 'var(--text-on-accent)',
  fontSize: 9,
  lineHeight: '12px',
  fontWeight: 700,
  letterSpacing: 0,
  textAlign: 'center',
  boxSizing: 'border-box',
  pointerEvents: 'none',
  overflow: 'hidden',
};

const BOARD_NEW_BADGE_START_DATE = '2026-06-30';
const BOARD_NEW_BADGE_VISIBLE_DAYS = 30;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const isEnglishLocale = () => {
  if (typeof navigator === 'undefined') return false;
  const language = navigator.languages?.[0] || navigator.language || '';
  return language.toLowerCase().startsWith('en');
};

const parseLocalDate = (dateText: string) => {
  const [year, month, day] = dateText.split('-').map(Number);
  return new Date(year, month - 1, day);
};

const isBoardNewBadgeVisible = (now = new Date()) => {
  const startDate = parseLocalDate(BOARD_NEW_BADGE_START_DATE);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const elapsedDays = Math.floor((today.getTime() - startDate.getTime()) / ONE_DAY_MS);
  return elapsedDays >= 0 && elapsedDays < BOARD_NEW_BADGE_VISIBLE_DAYS;
};

const headerActionLabels = {
  zh: {
    share: '分享',
    board: '智能看板',
    newBadge: 'NEW',
    automation: '自动化',
    files: '我的文件',
    star: '收藏',
    unstar: '取消收藏',
    disabledInBoard: '看板模块下暂不可用',
    disabledNow: '当前暂不可用',
  },
  en: {
    share: 'Share',
    board: 'Smart board',
    newBadge: 'NEW',
    automation: 'Automation',
    files: 'My files',
    star: 'Save',
    unstar: 'Unsave',
    disabledInBoard: 'Unavailable in board mode',
    disabledNow: 'Currently unavailable',
  },
};

const BookmarkIcon = () => (
  <svg width="16" height="16" viewBox="0 0 192 215.044" fill="none" aria-hidden="true">
    <path d="M160.826 0.0107422C178.117 0.448952 192 14.6031 192 32V191L191.996 191.462C191.651 210.799 169.648 221.8 153.972 210.474L153.6 210.2L105.6 174.2C99.9108 169.934 92.0892 169.934 86.4004 174.2L38.4004 210.2L38.0283 210.474C22.3517 221.8 0.349381 210.799 0.00390625 191.462L0 191L0 32C0 14.3269 14.3269 5.15408e-07 32 0H160L160.826 0.0107422ZM32 18C24.268 18 18 24.268 18 32V191C18 195.944 23.6442 198.766 27.5996 195.8L75.5996 159.8C87.4996 150.875 103.793 150.736 115.83 159.382L116.4 159.8L164.4 195.8C168.356 198.766 174 195.944 174 191V32C174 24.268 167.732 18 160 18H32ZM129 76C133.971 76 138 80.0294 138 85C138 89.9706 133.971 94 129 94H63C58.0294 94 54 89.9706 54 85C54 80.0294 58.0294 76 63 76H129Z" fill="currentColor" fillOpacity="0.85" />
  </svg>
);

const UnbookmarkIcon = () => (
  <svg width="16" height="16" viewBox="0 0 232.439 215.044" fill="none" aria-hidden="true">
    <path d="M211.979 191L211.975 191.462C211.629 210.799 189.627 221.8 173.951 210.474L173.578 210.2L125.578 174.2C119.89 169.934 112.068 169.934 106.379 174.2L58.3792 210.2L58.0072 210.474C42.3305 221.799 20.3282 210.799 19.9828 191.462L19.9789 191V160.44C19.9789 156.367 22.7148 152.801 26.6494 151.747C32.3655 150.215 37.9789 154.522 37.9789 160.44V191C37.9789 195.944 43.6231 198.766 47.5785 195.8L95.5785 159.8C107.478 150.875 123.772 150.736 135.809 159.382L136.379 159.8L184.379 195.8C188.335 198.766 193.979 195.944 193.979 191V113.817C193.979 109.744 196.715 106.178 200.649 105.124C206.366 103.592 211.979 107.899 211.979 113.817V191ZM180.805 0.0107422C198.096 0.448952 211.979 14.6031 211.979 32V60.4697L221.108 58.0244C225.909 56.738 230.844 59.5876 232.13 64.3887C233.417 69.1898 230.568 74.1245 225.767 75.4111L11.3314 132.869C6.53039 134.156 1.59565 131.307 0.308937 126.506C-0.977524 121.705 1.87113 116.769 6.67222 115.482L19.9789 111.916V32C19.9789 14.327 34.3059 0.000155146 51.9789 0H179.979L180.805 0.0107422ZM51.9789 18C44.247 18.0002 37.9789 24.2681 37.9789 32V107.094L193.979 65.293V32C193.979 24.268 187.711 18 179.979 18H51.9789Z" fill="currentColor" fillOpacity="0.85" />
  </svg>
);

const AutomationIcon = () => (
  <svg width="16" height="16" viewBox="0.95 1 14.1 14" fill="none" aria-hidden="true">
    <path d="M3.67851 7.42445C3.95097 7.49748 4.11267 7.77754 4.03966 8.05C3.96886 8.31421 3.70248 8.47574 3.43547 8.4164L2.12492 8.12508C2.17795 10.6714 3.89562 12.9825 6.47942 13.6748C8.9422 14.3347 11.4589 13.3276 12.8315 11.3451C12.979 11.1322 13.2408 11.0219 13.491 11.089C13.8479 11.1846 14.0238 11.5882 13.8183 11.8952C12.1974 14.317 9.15989 15.5577 6.18828 14.7615C3.00179 13.9077 0.920861 10.9876 1.0006 7.82906C1.00799 7.2337 1.58279 6.8629 2.1579 7.017L3.67851 7.42445ZM2.50901 4.91112C2.1521 4.81549 1.97614 4.41189 2.18166 4.10483C3.80265 1.68306 6.84014 0.442302 9.81175 1.23854C12.931 2.07434 14.9908 4.89009 15.0016 7.97127C15.0016 7.97127 15.0029 8.03011 15.0004 8.12508C14.9996 8.16906 14.9984 8.21309 14.9968 8.25716C14.978 8.72282 14.5267 9.01233 14.0766 8.8917L12.3246 8.42226C12.0522 8.34925 11.8904 8.06918 11.9634 7.79671C12.0342 7.5325 12.3006 7.37098 12.5676 7.43031L13.8697 7.71968C13.7517 5.23515 12.0517 3.00344 9.52055 2.32521C7.05778 1.66532 4.54114 2.67248 3.16851 4.65493C3.02104 4.86791 2.75923 4.97816 2.50901 4.91112Z" fill="currentColor" fillOpacity="0.85" />
    <path d="M7.40082 5.13898C7.62369 4.6217 8.35 4.61994 8.57562 5.13605L10.6655 9.91925C10.8492 10.3399 10.5438 10.8128 10.0883 10.8128C9.83464 10.8128 9.60578 10.659 9.50726 10.4232L9.185 9.65167C9.16729 9.60975 9.12667 9.58234 9.08148 9.58234H6.88812C6.84283 9.58234 6.80127 9.60959 6.78363 9.65167L6.45746 10.4339C6.36187 10.6631 6.13941 10.8128 5.89301 10.8128C5.4524 10.8125 5.1561 10.3565 5.33148 9.94855L7.40082 5.13898ZM8.10785 7.09991C8.06123 6.99136 7.9084 6.99138 7.86176 7.09991L7.31293 8.38116C7.29401 8.42572 7.32638 8.47488 7.37445 8.47491H8.59515C8.64314 8.47479 8.67553 8.42567 8.65668 8.38116L8.10785 7.09991Z" fill="currentColor" fillOpacity="0.85" />
  </svg>
);

const ShareIcon = () => (
  <svg width="16" height="16" viewBox="0 0 220 220" fill="none" aria-hidden="true">
    <path d="M109.502 0C114.45 0 118.462 4.0112 118.462 8.95928C118.462 13.9073 114.45 17.9186 109.502 17.9186V17.9215C58.8761 18.1894 17.9186 59.3108 17.9186 110C17.9186 160.855 59.1448 202.081 110 202.081C160.855 202.081 202.081 160.855 202.081 110C202.081 109.834 202.079 109.668 202.079 109.502H202.081C202.081 104.554 206.093 100.543 211.041 100.543C215.989 100.543 220 104.554 220 109.502C220 109.533 219.997 109.565 219.997 109.596C219.998 109.73 220 109.865 220 110C220 170.751 170.751 220 110 220C49.2487 220 0 170.751 0 110C0 49.4828 48.8698 0.382455 109.298 0.00486072C109.366 0.00334248 109.434 0 109.502 0Z" fill="currentColor" fillOpacity="0.85" />
    <path d="M157.285 13.1307C157.285 9.81544 161.1 7.95255 163.715 9.99072L207.963 44.4892C212.052 47.6777 212.052 53.8619 207.963 57.0503L163.715 91.5477C161.1 93.586 157.285 91.7231 157.285 88.4077V59.6225H156.544C118.609 59.6219 87.8558 90.3748 87.8555 128.31V129.052C87.8555 134 83.8441 138.011 78.8963 138.011C73.9483 138.011 69.9371 134 69.937 129.052V128.31C69.9372 80.4786 108.713 41.7032 156.544 41.704H157.285V13.1307Z" fill="currentColor" fillOpacity="0.85" />
  </svg>
);

const FilesIcon = () => (
  <svg width="16" height="16" viewBox="0 0 212 200" fill="none" aria-hidden="true">
    <path d="M60.0205 0C67.1365 0 74.0499 2.37239 79.667 6.74121L98.333 21.2588C103.774 25.491 110.432 27.8498 117.312 27.9932L117.979 28H180C197.673 28 212 42.3269 212 60V168C212 169.748 211.857 171.462 211.588 173.134C211.566 173.271 211.544 173.409 211.521 173.546C211.454 173.924 211.38 174.299 211.301 174.673C211.271 174.811 211.242 174.95 211.211 175.088C211.2 175.134 211.189 175.18 211.179 175.227C211.134 175.42 211.088 175.612 211.04 175.804C210.996 175.978 210.951 176.151 210.904 176.323C210.884 176.4 210.864 176.478 210.843 176.555C210.81 176.672 210.776 176.789 210.742 176.905C210.702 177.045 210.661 177.184 210.619 177.322C210.585 177.435 210.549 177.547 210.514 177.659C210.474 177.785 210.434 177.912 210.393 178.037C210.357 178.146 210.319 178.255 210.282 178.363C210.239 178.49 210.196 178.616 210.151 178.742C210.095 178.899 210.037 179.055 209.979 179.211C209.945 179.3 209.912 179.389 209.878 179.478C209.822 179.622 209.765 179.766 209.707 179.909C209.675 179.988 209.645 180.067 209.613 180.146C209.549 180.302 209.482 180.458 209.415 180.613C209.377 180.701 209.34 180.789 209.302 180.877C209.245 181.007 209.186 181.136 209.127 181.265C209.082 181.363 209.038 181.462 208.992 181.56C208.943 181.665 208.892 181.769 208.842 181.873C208.776 182.01 208.71 182.146 208.643 182.281C208.595 182.377 208.546 182.473 208.497 182.568C208.434 182.692 208.37 182.815 208.306 182.938C208.25 183.043 208.193 183.148 208.136 183.253C208.07 183.374 208.003 183.495 207.936 183.615C207.884 183.708 207.831 183.8 207.778 183.892C207.702 184.024 207.626 184.157 207.548 184.288C207.498 184.372 207.448 184.455 207.397 184.538C207.324 184.66 207.25 184.782 207.175 184.902C207.105 185.014 207.035 185.125 206.964 185.235C206.899 185.337 206.833 185.438 206.767 185.539C206.702 185.638 206.636 185.736 206.57 185.834C206.496 185.945 206.421 186.056 206.345 186.166C206.27 186.274 206.194 186.381 206.118 186.488C206.054 186.578 205.991 186.668 205.926 186.758C205.845 186.87 205.762 186.981 205.68 187.092C205.607 187.189 205.535 187.286 205.462 187.382C205.39 187.476 205.318 187.569 205.245 187.662C205.165 187.765 205.085 187.867 205.004 187.969C204.92 188.074 204.835 188.177 204.75 188.281C204.676 188.372 204.601 188.461 204.526 188.551C204.453 188.638 204.379 188.726 204.305 188.812C204.213 188.92 204.12 189.026 204.027 189.132C203.948 189.223 203.867 189.313 203.786 189.402C203.705 189.492 203.624 189.583 203.542 189.672C203.457 189.764 203.371 189.856 203.285 189.947C203.199 190.038 203.113 190.129 203.026 190.219C202.925 190.323 202.823 190.427 202.721 190.53C202.657 190.594 202.594 190.657 202.53 190.721C202.432 190.818 202.333 190.915 202.233 191.011C202.132 191.109 202.031 191.206 201.929 191.303C201.853 191.374 201.776 191.446 201.699 191.517C201.599 191.609 201.497 191.701 201.396 191.793C201.31 191.87 201.223 191.947 201.137 192.023C201.036 192.112 200.935 192.199 200.834 192.286C200.738 192.368 200.642 192.449 200.546 192.53C200.452 192.609 200.357 192.688 200.262 192.766C200.175 192.837 200.088 192.908 200 192.979C199.882 193.073 199.763 193.167 199.644 193.26C199.564 193.322 199.484 193.384 199.403 193.445C199.29 193.532 199.175 193.618 199.061 193.703C198.973 193.768 198.884 193.833 198.796 193.897C198.672 193.988 198.547 194.077 198.421 194.166C198.351 194.215 198.282 194.264 198.212 194.312C198.075 194.407 197.938 194.5 197.8 194.593C197.72 194.646 197.641 194.7 197.561 194.753C197.455 194.822 197.349 194.891 197.243 194.959C197.131 195.031 197.019 195.102 196.906 195.172C196.801 195.237 196.696 195.303 196.59 195.367C196.484 195.432 196.377 195.495 196.271 195.559C196.157 195.626 196.043 195.691 195.929 195.757C195.826 195.816 195.724 195.876 195.62 195.934C195.482 196.011 195.343 196.086 195.204 196.161C195.132 196.2 195.061 196.24 194.988 196.278C194.846 196.354 194.702 196.427 194.559 196.501C194.469 196.547 194.379 196.593 194.288 196.639C194.162 196.702 194.036 196.763 193.909 196.824C193.8 196.877 193.691 196.929 193.581 196.98C193.493 197.022 193.405 197.062 193.317 197.103C193.17 197.17 193.023 197.237 192.874 197.303C192.784 197.342 192.693 197.381 192.603 197.42C192.463 197.48 192.323 197.539 192.183 197.597C192.099 197.631 192.015 197.665 191.931 197.699C191.775 197.762 191.618 197.824 191.461 197.885C191.378 197.917 191.294 197.947 191.211 197.979C191.065 198.033 190.92 198.087 190.773 198.14C190.658 198.181 190.542 198.22 190.427 198.26C190.3 198.304 190.173 198.347 190.045 198.39C189.908 198.435 189.77 198.478 189.633 198.521C189.537 198.552 189.44 198.583 189.344 198.612C189.188 198.66 189.032 198.705 188.876 198.75C188.78 198.778 188.685 198.806 188.589 198.833C188.445 198.873 188.3 198.91 188.155 198.948C188.05 198.976 187.945 199.005 187.84 199.031C187.665 199.075 187.49 199.116 187.314 199.157C187.245 199.173 187.176 199.191 187.106 199.207C186.967 199.239 186.827 199.267 186.688 199.297C186.557 199.325 186.427 199.353 186.297 199.379C186.139 199.41 185.981 199.44 185.822 199.469C185.742 199.484 185.662 199.499 185.581 199.514C185.431 199.54 185.281 199.564 185.13 199.588C185.005 199.608 184.881 199.629 184.756 199.647C184.716 199.653 184.676 199.658 184.637 199.664C184.421 199.695 184.204 199.726 183.986 199.753C183.875 199.767 183.764 199.777 183.652 199.79C183.508 199.806 183.364 199.824 183.22 199.839C183.04 199.857 182.859 199.872 182.679 199.887C182.594 199.894 182.51 199.902 182.425 199.908C182.341 199.915 182.256 199.919 182.172 199.925C181.726 199.955 181.277 199.978 180.826 199.989L180 200H32C31.1769 200 30.3612 199.968 29.5537 199.907C29.4382 199.898 29.3231 199.887 29.208 199.877C29.0577 199.864 28.9075 199.852 28.7578 199.837C28.6204 199.823 28.4835 199.807 28.3467 199.791C28.2169 199.776 28.0873 199.762 27.958 199.746C27.8529 199.733 27.7483 199.717 27.6436 199.703C27.4765 199.68 27.3097 199.658 27.1436 199.633C27.0888 199.624 27.0342 199.615 26.9795 199.606C26.7722 199.574 26.5653 199.541 26.3594 199.504C26.2983 199.493 26.2377 199.48 26.1768 199.469C25.9747 199.432 25.773 199.394 25.5723 199.354C25.4808 199.335 25.39 199.313 25.2988 199.294C25.1465 199.261 24.9943 199.23 24.8428 199.195C24.7213 199.168 24.6005 199.138 24.4795 199.108C24.3311 199.073 24.1827 199.038 24.0352 199C23.9656 198.982 23.8965 198.963 23.8271 198.944C23.649 198.897 23.4709 198.851 23.2939 198.801C23.1652 198.764 23.0373 198.725 22.9092 198.688C22.7967 198.654 22.6842 198.621 22.5723 198.587C22.433 198.544 22.2947 198.499 22.1562 198.454C22.0406 198.417 21.9247 198.38 21.8096 198.342C21.7015 198.306 21.5939 198.268 21.4863 198.23C21.349 198.183 21.2116 198.135 21.0752 198.086C20.9375 198.036 20.8009 197.983 20.6641 197.932C20.5666 197.895 20.4691 197.858 20.3721 197.82C20.2403 197.769 20.1095 197.715 19.9785 197.662C19.8648 197.616 19.7508 197.571 19.6377 197.523C19.5239 197.476 19.411 197.426 19.2979 197.377C19.1673 197.32 19.0368 197.264 18.9072 197.206C18.8022 197.159 18.6982 197.11 18.5938 197.062C18.4758 197.007 18.3574 196.953 18.2402 196.897C18.1015 196.831 17.9638 196.763 17.8262 196.695C17.7291 196.647 17.6317 196.6 17.5352 196.551C17.4335 196.499 17.3325 196.446 17.2314 196.394C17.0966 196.323 16.9619 196.253 16.8281 196.181C16.7332 196.129 16.6393 196.077 16.5449 196.024C16.4264 195.959 16.308 195.893 16.1904 195.826C16.0681 195.756 15.9465 195.685 15.8252 195.614C15.7264 195.556 15.6274 195.498 15.5293 195.439C15.4181 195.373 15.3076 195.305 15.1973 195.236C15.0918 195.171 14.9865 195.105 14.8818 195.039C14.7559 194.959 14.6306 194.878 14.5059 194.797C14.4217 194.742 14.3375 194.687 14.2539 194.631C14.1394 194.554 14.0255 194.477 13.9121 194.399C13.7999 194.322 13.6883 194.244 13.5771 194.166C13.4925 194.106 13.4083 194.046 13.3242 193.985C13.2075 193.901 13.0911 193.817 12.9756 193.731C12.8698 193.653 12.7649 193.574 12.6602 193.494C12.5699 193.426 12.4801 193.357 12.3906 193.287C12.2844 193.205 12.1784 193.122 12.0732 193.038C11.9671 192.954 11.8618 192.868 11.7568 192.782C11.6698 192.711 11.5833 192.639 11.4971 192.567C11.3937 192.481 11.2907 192.394 11.1885 192.307C11.1003 192.231 11.0131 192.155 10.9258 192.078C10.8102 191.977 10.6951 191.875 10.5811 191.772C10.5128 191.711 10.4447 191.649 10.377 191.587C10.2656 191.485 10.1548 191.382 10.0449 191.278C9.96252 191.201 9.8804 191.123 9.79883 191.044C9.68627 190.935 9.57483 190.826 9.46387 190.716C9.40341 190.656 9.34319 190.596 9.2832 190.535C9.17831 190.429 9.07412 190.323 8.9707 190.216C8.88165 190.124 8.79302 190.031 8.70508 189.938C8.61504 189.842 8.52637 189.745 8.4375 189.648C8.36499 189.57 8.29243 189.491 8.2207 189.411C8.12022 189.3 8.0208 189.187 7.92188 189.074C7.85057 188.993 7.77948 188.911 7.70898 188.829C7.61542 188.72 7.52278 188.61 7.43066 188.5C7.35462 188.409 7.27915 188.317 7.2041 188.226C7.13265 188.138 7.06175 188.05 6.99121 187.962C6.89473 187.841 6.79788 187.721 6.70312 187.599C6.64446 187.523 6.58729 187.446 6.5293 187.37C6.43649 187.248 6.34402 187.126 6.25293 187.003C6.1874 186.914 6.12322 186.825 6.05859 186.735C5.97341 186.618 5.8883 186.5 5.80469 186.381C5.75063 186.304 5.69695 186.227 5.64355 186.149C5.54765 186.01 5.45215 185.871 5.3584 185.73C5.31277 185.662 5.26777 185.593 5.22266 185.524C5.13425 185.39 5.04638 185.254 4.95996 185.118C4.89199 185.011 4.82551 184.903 4.75879 184.795C4.69744 184.696 4.63646 184.596 4.57617 184.496C4.50445 184.377 4.43349 184.258 4.36328 184.138C4.30244 184.034 4.24133 183.93 4.18164 183.825C4.11765 183.713 4.05583 183.599 3.99316 183.486C3.92815 183.369 3.86241 183.252 3.79883 183.134C3.7476 183.039 3.69775 182.943 3.64746 182.847C3.58065 182.719 3.51338 182.592 3.44824 182.464C3.3966 182.362 3.34648 182.26 3.2959 182.157C3.22937 182.023 3.16332 181.888 3.09863 181.752C3.03825 181.625 2.97966 181.498 2.9209 181.37C2.8807 181.283 2.83924 181.196 2.7998 181.108C2.7394 180.974 2.68164 180.838 2.62305 180.703C2.57225 180.586 2.5211 180.469 2.47168 180.351C2.42743 180.245 2.38494 180.138 2.3418 180.032C2.29138 179.908 2.24031 179.784 2.19141 179.659C2.1461 179.543 2.10258 179.427 2.05859 179.311C2.00775 179.176 1.9563 179.042 1.90723 178.906C1.86869 178.8 1.83236 178.693 1.79492 178.586C1.74892 178.455 1.70254 178.323 1.6582 178.191C1.62248 178.085 1.58835 177.978 1.55371 177.871C1.50438 177.719 1.45531 177.566 1.4082 177.413C1.38256 177.33 1.35799 177.246 1.33301 177.162C1.28573 177.004 1.23824 176.845 1.19336 176.686C1.16168 176.573 1.13203 176.46 1.10156 176.347C1.06496 176.211 1.02802 176.075 0.993164 175.938C0.959879 175.808 0.929139 175.677 0.897461 175.546C0.807124 175.172 0.720646 174.797 0.643555 174.418C0.614038 174.273 0.588096 174.127 0.560547 173.981C0.537543 173.86 0.512834 173.738 0.491211 173.616C0.406111 173.136 0.332912 172.651 0.269531 172.163C0.194809 171.588 0.134581 171.008 0.0908203 170.424C0.0511975 169.895 0.0243242 169.362 0.0107422 168.826L0 168V32C2.79044e-06 14.6031 13.8825 0.44895 31.1738 0.0107422L32 0H60.0205ZM32 98C24.268 98 18 104.268 18 112V168C18 175.732 24.268 182 32 182H180C187.732 182 194 175.732 194 168V112C194 104.268 187.732 98 180 98H32ZM32 18C24.268 18 18 24.268 18 32V83.2178C22.2289 81.157 26.9792 80 32 80H180L180.826 80.0107C185.542 80.1303 190.004 81.2721 194 83.2197V60C194 52.268 187.732 46 180 46H117.979C106.861 46 96.0589 42.2941 87.2822 35.4678L68.6162 20.9492C66.1587 19.0379 63.1338 18 60.0205 18H32Z" fill="currentColor" fillOpacity="0.85" />
  </svg>
);

export const ChatSessionHeader: React.FC<ChatSessionHeaderProps> = ({
  agentName,
  sessionTitle,
  isAutoSession = false,
  hasActiveSession,
  isNewSession = false,
  glassActive = false,
  starred = false,
  onToggleStar,
  showBoardAction = false,
  onOpenBoard,
  onOpenAutomation,
  onShare,
  onOpenFiles,
  showUtilityActions = hasActiveSession,
  disabledActions,
}) => {
  const shareButtonRef = React.useRef<HTMLButtonElement | null>(null);
  const openAutomation = useUiStore((s) => s.openAutomation);
  const isAutomationOpen = useUiStore((s) => s.rightPanelType === 'automation');
  const isWorkspaceOpen = useUiStore((s) => s.rightPanelType === 'workspace');
  const isBoardOpen = useUiStore((s) => s.rightPanelType === 'board');
  const frontendConfigLoaded = useFrontendConfigStore((s) => s.loaded);
  const dashboardEnabled = useFrontendConfigStore((s) => s.dashboardEnabled);
  const effectiveShowBoardAction = showBoardAction && frontendConfigLoaded && dashboardEnabled;
  const isRightPanelOpen = isAutomationOpen || isWorkspaceOpen || isBoardOpen;
  const [hoveredAction, setHoveredAction] = React.useState<HeaderAction | null>(null);
  const [deferUtilityLabels, setDeferUtilityLabels] = React.useState(false);
  const wasRightPanelOpenRef = React.useRef(isRightPanelOpen);
  const title = hasActiveSession ? sessionTitle : `${agentName}${sessionTitle ? ` / ${sessionTitle}` : ''}`;
  const actionLabels = React.useMemo(() => (isEnglishLocale() ? headerActionLabels.en : headerActionLabels.zh), []);
  const showBoardNewBadge = isNewSession && isBoardNewBadgeVisible();
  const activeButtonBg = '#0b0b0b1a';
  React.useEffect(() => {
    if (isRightPanelOpen) {
      wasRightPanelOpenRef.current = true;
      setDeferUtilityLabels(false);
      return;
    }

    if (!wasRightPanelOpenRef.current) return;
    wasRightPanelOpenRef.current = false;
    setDeferUtilityLabels(true);
    const timer = window.setTimeout(() => setDeferUtilityLabels(false), 300);
    return () => window.clearTimeout(timer);
  }, [isRightPanelOpen]);
  const showUtilityLabels = !hasActiveSession && !isRightPanelOpen && !deferUtilityLabels;
  const actionButtonStyle = (action: HeaderAction, showLabel = false): React.CSSProperties => {
    const disabled = Boolean(disabledActions?.[action]);
    const active =
      (action === 'automation' && isAutomationOpen) ||
      (action === 'board' && isBoardOpen) ||
      (action === 'files' && isWorkspaceOpen);
    return ({
    ...headerButtonStyle,
    position: 'relative',
    width: showLabel ? 'auto' : 32,
    padding: showLabel ? '0 10px' : 0,
    gap: showLabel ? 6 : 0,
    background: !disabled && (hoveredAction === action || active)
      ? activeButtonBg
      : 'transparent',
    color: disabled ? 'var(--text-tertiary)' : 'var(--text-primary)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.42 : 1,
  });
  };
  const actionTooltipLabel = (action: HeaderAction) => {
    if (action === 'share' && disabledActions?.share) return actionLabels.disabledInBoard;
    if (action === 'board' && disabledActions?.board) return actionLabels.disabledNow;
    if ((action === 'automation' || action === 'files') && disabledActions?.[action]) {
      return actionLabels.disabledInBoard;
    }
    if (action === 'star') return starred ? actionLabels.unstar : actionLabels.star;
    return actionLabels[action];
  };
  const actionTooltipProps = (action: HeaderAction) => ({
    content: actionTooltipLabel(action),
    placement: 'bottom' as const,
    tooltipId: `chat-session-${action}-tooltip`,
    testId: `chat-session-${action}`,
    disabled: showUtilityLabels,
    onOpenChange: (open: boolean) => {
      setHoveredAction(open && !disabledActions?.[action] ? action : null);
    },
  });
  const actionHoverProps = (action: HeaderAction) => ({
    onMouseEnter: () => {
      if (!disabledActions?.[action]) setHoveredAction(action);
    },
    onMouseLeave: () => {
      setHoveredAction((current) => (current === action ? null : current));
    },
    onFocus: () => {
      if (!disabledActions?.[action]) setHoveredAction(action);
    },
    onBlur: () => {
      setHoveredAction((current) => (current === action ? null : current));
    },
  });

  return (
    <div
      style={{
        height: 48,
        paddingLeft: hasActiveSession ? 0 : 8,
        paddingRight: hasActiveSession ? 0 : undefined,
        background: hasActiveSession && glassActive ? 'var(--bg-primary)' : 'transparent',
        boxSizing: 'border-box',
        // Active-session headers participate in layout so the message scrollbar starts below them.
        flexShrink: 0,
        position: 'relative',
        zIndex: hasActiveSession ? 30 : undefined,
        overflow: 'visible',
        transition: 'background 180ms ease',
      }}
      data-testid="chat-session-header"
    >
      <div
        className="flex items-center justify-between"
        style={{
          height: '100%',
          padding: hasActiveSession ? '0 16px' : '0 8px',
          borderRadius: 10,
          background: hasActiveSession && glassActive ? 'var(--bg-primary)' : undefined,
          transition: 'background 180ms ease',
        }}
      >
        <div className="flex items-center min-w-0" style={{ gap: 4 }}>
          {isAutoSession && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                padding: '1px 5px',
                borderRadius: 4,
                background: 'var(--accent-bg)',
                color: 'var(--accent-color)',
              }}
            >
              自动化
            </span>
          )}
          {hasActiveSession && (
            <span
              className="truncate"
              style={{
                fontSize: 14,
                lineHeight: '22px',
                fontWeight: 400,
                color: 'var(--text-primary)',
                maxWidth: 'min(520px, 52vw)',
              }}
              data-testid="chat-session-title"
            >
              {title}
            </span>
          )}
          {hasActiveSession && (
            <FineDesignTooltip
              content={starred ? actionLabels.unstar : actionLabels.star}
              placement="bottom"
              tooltipId="chat-session-star-tooltip"
              testId="chat-session-star"
              onOpenChange={(open) => setHoveredAction(open ? 'star' : null)}
            >
              <button
                type="button"
                onClick={() => {
                  track('session_favorite', { sub_event: starred ? 'unfavorite' : 'favorite' });
                  onToggleStar?.();
                }}
                style={actionButtonStyle('star')}
                aria-label={starred ? actionLabels.unstar : actionLabels.star}
                aria-pressed={starred}
                data-testid="chat-session-star-btn"
              >
                {starred ? <UnbookmarkIcon /> : <BookmarkIcon />}
              </button>
            </FineDesignTooltip>
          )}
        </div>

        {showUtilityActions && (
          <div className="flex items-center" style={{ gap: 8 }}>
            {hasActiveSession && (
              <>
                <FineDesignTooltip
                  {...actionTooltipProps('share')}
                >
                  <button
                    type="button"
                    ref={shareButtonRef}
                    onClick={() => {
                      track('share_session', { sub_event: 'share_entry' });
                      onShare?.(shareButtonRef.current?.getBoundingClientRect() ?? null);
                    }}
                    style={actionButtonStyle('share')}
                    {...actionHoverProps('share')}
                    aria-label={actionLabels.share}
                    aria-disabled={disabledActions?.share}
                    disabled={disabledActions?.share}
                    data-testid="chat-session-share-btn"
                  >
                    <ShareIcon />
                  </button>
                </FineDesignTooltip>
                <span
                  aria-hidden="true"
                  style={{
                    width: 1,
                    height: 16,
                    background: 'var(--border-subtle)',
                    flexShrink: 0,
                  }}
                />
              </>
            )}
            <div className="flex items-center" style={{ gap: 8 }}>
              {effectiveShowBoardAction && (
                <FineDesignTooltip
                  {...actionTooltipProps('board')}
                >
                  <button
                    type="button"
                    onClick={onOpenBoard}
                    style={actionButtonStyle('board', showUtilityLabels)}
                    {...actionHoverProps('board')}
                    aria-label={actionLabels.board}
                    aria-pressed={isBoardOpen && !disabledActions?.board}
                    aria-disabled={disabledActions?.board}
                    disabled={disabledActions?.board}
                    data-testid="chat-session-board-btn"
                  >
                    {showBoardNewBadge && (
                      <span
                        aria-hidden="true"
                        className="chat-session-board-new-badge"
                        style={boardNewBadgeStyle}
                      >
                        {actionLabels.newBadge}
                      </span>
                    )}
                    <SidebarIcon name="board" size={16} />
                    {showUtilityLabels && <span style={headerButtonLabelStyle}>{actionLabels.board}</span>}
                  </button>
                </FineDesignTooltip>
              )}
              <FineDesignTooltip
                {...actionTooltipProps('automation')}
              >
                <button
                  type="button"
                  onClick={() => {
                    track('automation', { position: 'right_top' });
                    (onOpenAutomation ?? openAutomation)();
                  }}
                  style={actionButtonStyle('automation', showUtilityLabels)}
                  {...actionHoverProps('automation')}
                  aria-label={actionLabels.automation}
                  aria-pressed={isAutomationOpen && !disabledActions?.automation}
                  aria-disabled={disabledActions?.automation}
                  disabled={disabledActions?.automation}
                  data-testid="chat-session-automation-btn"
                >
                  <AutomationIcon />
                  {showUtilityLabels && <span style={headerButtonLabelStyle}>{actionLabels.automation}</span>}
                </button>
              </FineDesignTooltip>
              <FineDesignTooltip
                {...actionTooltipProps('files')}
                align="end"
              >
                <button
                  type="button"
                  onClick={() => {
                    track('my_files', { position: 'right_top' });
                    onOpenFiles?.();
                  }}
                  style={actionButtonStyle('files', showUtilityLabels)}
                  {...actionHoverProps('files')}
                  aria-label={actionLabels.files}
                  aria-pressed={isWorkspaceOpen && !disabledActions?.files}
                  aria-disabled={disabledActions?.files}
                  disabled={disabledActions?.files}
                  data-testid="chat-session-files-btn"
                >
                  <FilesIcon />
                  {showUtilityLabels && <span style={headerButtonLabelStyle}>{actionLabels.files}</span>}
                </button>
              </FineDesignTooltip>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
