import { useRef, useState, type ReactNode } from "react";
import { motion, useMotionValue, useTransform, animate, type PanInfo } from "framer-motion";
import { CheckCircle2, Trash2 } from "lucide-react";

const SWIPE_THRESHOLD = 100;
const SWIPE_VELOCITY_THRESHOLD = 500;

interface SwipeableTaskProps {
  children: ReactNode;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  disabled?: boolean;
}

export function SwipeableTask({ children, onSwipeLeft, onSwipeRight, disabled }: SwipeableTaskProps) {
  const x = useMotionValue(0);
  const [triggered, setTriggered] = useState(false);
  const actionLockRef = useRef(false);

  const leftBgOpacity = useTransform(x, [-SWIPE_THRESHOLD, -30, 0], [1, 0.3, 0]);
  const rightBgOpacity = useTransform(x, [0, 30, SWIPE_THRESHOLD], [0, 0.3, 1]);

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    if (disabled || actionLockRef.current || triggered) return;

    const offset = info.offset.x;
    const velocity = info.velocity.x;

    const swipedLeft = offset < -SWIPE_THRESHOLD || velocity < -SWIPE_VELOCITY_THRESHOLD;
    const swipedRight = offset > SWIPE_THRESHOLD || velocity > SWIPE_VELOCITY_THRESHOLD;

    if (swipedLeft && onSwipeLeft) {
      actionLockRef.current = true;
      setTriggered(true);
      animate(x, -400, { duration: 0.25 }).then(() => {
        onSwipeLeft();
        setTimeout(() => {
          actionLockRef.current = false;
          setTriggered(false);
          x.set(0);
        }, 300);
      });
    } else if (swipedRight && onSwipeRight) {
      actionLockRef.current = true;
      setTriggered(true);
      animate(x, 400, { duration: 0.25 }).then(() => {
        onSwipeRight();
        setTimeout(() => {
          actionLockRef.current = false;
          setTriggered(false);
          x.set(0);
        }, 300);
      });
    } else {
      animate(x, 0, { type: "spring", stiffness: 500, damping: 30 });
    }
  };

  return (
    <div className="relative overflow-hidden rounded-lg" data-testid="swipeable-task-container">
      <motion.div
        className="absolute inset-0 flex items-center justify-end px-6 bg-green-500 dark:bg-green-600 rounded-lg"
        style={{ opacity: leftBgOpacity }}
        data-testid="swipe-action-done"
      >
        <div className="flex items-center gap-2 text-white font-medium text-sm">
          <CheckCircle2 className="h-5 w-5" />
          Done
        </div>
      </motion.div>

      <motion.div
        className="absolute inset-0 flex items-center justify-start px-6 bg-red-500 dark:bg-red-600 rounded-lg"
        style={{ opacity: rightBgOpacity }}
        data-testid="swipe-action-delete"
      >
        <div className="flex items-center gap-2 text-white font-medium text-sm">
          <Trash2 className="h-5 w-5" />
          Delete
        </div>
      </motion.div>

      <motion.div
        style={{ x }}
        drag={disabled ? false : "x"}
        dragDirectionLock
        dragElastic={0.3}
        dragConstraints={{ left: -200, right: 200 }}
        onDragEnd={handleDragEnd}
        className="relative z-10 touch-pan-y"
        data-testid="swipeable-task-content"
      >
        {children}
      </motion.div>
    </div>
  );
}
