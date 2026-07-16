import { ReactNode } from "react";
import { ThemeModeProvider } from "../helpers/themeMode";
import { TooltipProvider } from "./Tooltip";
import { SonnerToaster } from "./SonnerToaster";

export const GlobalContextProviders = ({
  children,
}: {
  children: ReactNode;
}) => {
  return (
    <ThemeModeProvider>
      <TooltipProvider>
        {children}
        <SonnerToaster />
      </TooltipProvider>
    </ThemeModeProvider>
  );
};
