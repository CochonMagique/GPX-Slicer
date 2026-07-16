import { ReactNode } from "react";

// Simple wrapper for the splitter page
const IndexLayout = ({ children }: { children: ReactNode }) => {
  return (
    <div 
      className="index-layout" 
      style={{ 
        minHeight: "100vh",
        overflowX: "hidden",
      }}
    >
      {children}
    </div>
  );
};

export default [IndexLayout];