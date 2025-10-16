import React, { useRef, useEffect } from 'react';

interface LogViewerProps {
  logs: string[];
}

export const LogViewer: React.FC<LogViewerProps> = ({ logs }) => {
  const logContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  useEffect(() => {
    logContainerRef.current?.focus();
  }, []);

  return (
    <div 
      ref={logContainerRef} 
      className="bg-black p-4 h-full overflow-y-auto font-mono text-sm text-adk-text-secondary outline-none"
      tabIndex={0}
    >
        {logs.map((log, index) => (
            <div key={index} className="whitespace-pre-wrap">{`> ${log}`}</div>
        ))}
    </div>
  );
};