import { AnimatePresence as _AnimatePresence } from 'framer-motion';
import type { FC, PropsWithChildren } from 'react';

type AnimatePresenceProps = PropsWithChildren<Parameters<typeof _AnimatePresence>[0]>;

export const AnimatePresence = _AnimatePresence as unknown as FC<AnimatePresenceProps>;
