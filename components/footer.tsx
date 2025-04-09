"use client";

import { FiGithub, FiMail, FiSun, FiMoon, FiMonitor } from "react-icons/fi";
import { useTheme } from "next-themes";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useState, useEffect } from "react";

export function Footer() {
  const currentYear = new Date().getFullYear();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const ThemeIcon = () => {
    if (!mounted) return <FiSun className="h-4 w-4" />;
    if (theme === "dark") return <FiMoon className="h-4 w-4" />;
    if (theme === "system") return <FiMonitor className="h-4 w-4" />;
    return <FiSun className="h-4 w-4" />;
  };

  return (
    <footer className="border-t flex justify-center">
      <div className="container max-w-5xl flex flex-col items-center gap-4 py-10 min-md:h-18 p-8 md:flex-row md:py-0">
        <div className="flex flex-col items-center gap-4 px-8 md:flex-row md:gap-2 md:px-0">
          <p className="text-center text-sm leading-loose text-muted-foreground md:text-left">
            Built by Om Shejul
          </p>
          <span className="text-muted-foreground hidden md:inline">•</span>
          <p className="text-center text-sm leading-loose text-muted-foreground md:text-left">
            © {currentYear} All rights reserved.
          </p>
        </div>
        <div className="flex flex-1 items-center justify-end space-x-2">
          <a
            href="https://github.com/omshejul/cli-tools-frontend"
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground px-4 rounded-md hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            <span className="flex items-center gap-2 py-2">
              <FiGithub className="h-4 w-4" />
              <span className="text-xs">Source Code</span>
            </span>
          </a>

          <a
            href="mailto:download@omshejul.com"
            className="text-muted-foreground px-4 rounded-md hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            <span className="flex items-center gap-2 py-2">
              <FiMail className="h-4 w-4" />
              <span className="text-xs">Email me</span>
            </span>
          </a>

          <DropdownMenu>
            <DropdownMenuTrigger className="text-muted-foreground px-4 rounded-md hover:bg-accent hover:text-accent-foreground transition-colors">
              <span className="flex items-center gap-2 py-2">
                <ThemeIcon />
                <span className="text-xs">Theme</span>
              </span>
            </DropdownMenuTrigger>
            {mounted && (
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => setTheme("light")}
                  className="flex items-center gap-2"
                >
                  <FiSun className="h-4 w-4" />
                  <span className="text-xs">Light</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setTheme("dark")}
                  className="flex items-center gap-2"
                >
                  <FiMoon className="h-4 w-4" />
                  <span className="text-xs">Dark</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setTheme("system")}
                  className="flex items-center gap-2"
                >
                  <FiMonitor className="h-4 w-4" />
                  <span className="text-xs">System</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            )}
          </DropdownMenu>
        </div>
      </div>
    </footer>
  );
}
