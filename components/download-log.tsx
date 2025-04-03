"use client";

import * as React from "react";
import { useEffect, useRef, forwardRef, useImperativeHandle } from "react";

export type LogLevel = "debug" | "info" | "warning" | "error";

export type DownloadLogRef = {
  addLog: (level: LogLevel, message: string) => void;
  clear: () => void;
};

const DownloadLog = forwardRef<DownloadLogRef, { className?: string }>(
  ({ className }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [logs, setLogs] = React.useState<
      { level: LogLevel; message: string; timestamp: string }[]
    >([]);

    const addLog = (level: LogLevel, message: string) => {
      const timestamp = new Date().toLocaleTimeString();
      // Log to browser console using the appropriate method.
      switch (level) {
        case "debug":
          console.debug(`[yt-dlp][${timestamp}] ${message}`);
          break;
        case "info":
          console.log(`[yt-dlp][${timestamp}] ${message}`);
          break;
        case "warning":
          console.warn(`[yt-dlp][${timestamp}] ${message}`);
          break;
        case "error":
          console.error(`[yt-dlp][${timestamp}] ${message}`);
          break;
      }
      setLogs((prev) => [...prev, { level, message, timestamp }]);
    };

    const clear = () => {
      setLogs([]);
    };

    useImperativeHandle(ref, () => ({
      addLog,
      clear,
    }));

    // Auto-scroll to bottom when new logs arrive.
    useEffect(() => {
      if (containerRef.current) {
        containerRef.current.scrollTop = containerRef.current.scrollHeight;
      }
    }, [logs]);

    return (
      <div
        ref={containerRef}
        className={`h-[300px] overflow-y-auto bg-background border rounded-md p-4 font-mono text-sm ${
          className || ""
        }`}
      >
        {logs.map((log, index) => (
          <div
            key={index}
            className={`whitespace-pre-wrap break-words my-1 ${
              log.level === "debug"
                ? "text-muted-foreground"
                : log.level === "info"
                ? "text-green-500"
                : log.level === "warning"
                ? "text-yellow-500"
                : "text-red-500"
            }`}
          >
            <span className="text-muted-foreground">[{log.timestamp}] </span>
            {log.message}
          </div>
        ))}
      </div>
    );
  }
);

DownloadLog.displayName = "DownloadLog";

export { DownloadLog };
