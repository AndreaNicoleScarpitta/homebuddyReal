import { motion } from "framer-motion";
import { Home } from "lucide-react";

interface SplashScreenProps {
  onComplete: () => void;
}

export function SplashScreen({ onComplete }: SplashScreenProps) {
  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background"
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      onAnimationComplete={() => {
        setTimeout(onComplete, 1500);
      }}
    >
      <div className="text-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ 
            type: "spring",
            stiffness: 260,
            damping: 20,
            delay: 0.1
          }}
          className="mx-auto mb-6"
        >
          <div className="h-20 w-20 rounded-2xl bg-primary flex items-center justify-center mx-auto shadow-lg shadow-primary/30">
            <Home className="h-10 w-10 text-white" />
          </div>
        </motion.div>
        
        <motion.h1
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-3xl font-heading font-bold text-foreground"
        >
          Home Buddy
        </motion.h1>
        
        <motion.p
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-muted-foreground mt-2"
        >
          Your home maintenance assistant
        </motion.p>
        
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ delay: 0.7, duration: 0.8 }}
          className="mt-8 h-1 w-32 bg-primary/20 rounded-full mx-auto overflow-hidden"
        >
          <motion.div
            initial={{ x: "-100%" }}
            animate={{ x: "100%" }}
            transition={{ 
              delay: 0.7,
              duration: 1,
              repeat: 0,
              ease: "easeInOut"
            }}
            className="h-full w-1/2 bg-primary rounded-full"
          />
        </motion.div>
      </div>
    </motion.div>
  );
}
