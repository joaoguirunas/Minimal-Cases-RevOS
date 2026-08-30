import { Outlet, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import MobileAppHeader from "@/components/mobile/MobileAppHeader";
import MobileBottomTabs from "@/components/mobile/MobileBottomTabs";

const MobileShell = () => {
  const location = useLocation();

  return (
    <div className="h-[100dvh] flex flex-col bg-background overflow-hidden">
      <MobileAppHeader />
      <main className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="h-full"
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>
      <MobileBottomTabs />
    </div>
  );
};

export default MobileShell;
