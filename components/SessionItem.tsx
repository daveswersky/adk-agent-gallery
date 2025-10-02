import React, { useState } from 'react';
import { RequestRecord } from '../types';
import { ChevronDownIcon, ChevronRightIcon, CopyIcon } from './icons';

interface SessionItemProps {
  session: {
    agentId: string;
    sessionId: string;
    historyCount: number;
    requestHistory: RequestRecord[];
  };
}

const RequestDetails: React.FC<{ record: RequestRecord }> = ({ record }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copyStatus, setCopyStatus] = useState<'request' | 'response' | null>(null);

  const formatJson = (jsonString: string) => {
    try {
      const parsed = JSON.parse(jsonString);
      return JSON.stringify(parsed, null, 2);
    } catch (e) {
      return jsonString; // Return as is if not valid JSON
    }
  };

  const handleCopy = (content: string, type: 'request' | 'response') => {
    navigator.clipboard.writeText(content).then(() => {
      setCopyStatus(type);
      setTimeout(() => setCopyStatus(null), 2000); // Reset after 2 seconds
    });
  };

  const requestContent = `URL: ${record.request.url}\nMETHOD: ${record.request.method}\nHEADERS: ${JSON.stringify(record.request.headers, null, 2)}\n\nBODY:\n${formatJson(record.request.body)}`;
  const responseContent = `STATUS: ${record.response.status} ${record.response.statusText}\n\nBODY:\n${formatJson(record.response.body)}`;

  return (
    <div className="mt-2 text-xs bg-adk-dark-3 p-2 rounded-md">
      <button onClick={() => setIsExpanded(!isExpanded)} className="flex items-center w-full text-left text-adk-text-secondary hover:text-adk-text">
        {isExpanded ? <ChevronDownIcon className="w-4 h-4 mr-1" /> : <ChevronRightIcon className="w-4 h-4 mr-1" />}
        <span className="font-semibold">{record.request.method}</span>
        <span className="ml-2 truncate">{record.request.url}</span>
        <span className={`ml-auto px-2 py-0.5 rounded-full text-xs font-bold ${record.response.status === 0 || record.response.status >= 400 ? 'bg-red-500' : 'bg-green-500'} text-white`}>
          {record.response.status}
        </span>
      </button>
      {isExpanded && (
        <div className="mt-2 p-2 bg-adk-dark-4 rounded space-y-4">
          <div>
            <div className="flex items-center gap-x-2 mb-1">
                <h4 className="font-bold text-adk-text">Request</h4>
                <button onClick={() => handleCopy(requestContent, 'request')} className="flex items-center text-xs px-2 py-1 rounded bg-adk-dark-2 hover:bg-adk-dark-3 text-adk-text-secondary hover:text-adk-text transition-colors">
                    <CopyIcon className="w-3 h-3 mr-1.5" />
                    {copyStatus === 'request' ? 'Copied!' : 'Copy'}
                </button>
            </div>
            <pre className="whitespace-pre-wrap break-all bg-adk-dark p-2 rounded">{requestContent}</pre>
          </div>
          <div>
            <div className="flex items-center gap-x-2 mb-1">
                <h4 className="font-bold text-adk-text">Response</h4>
                <button onClick={() => handleCopy(responseContent, 'response')} className="flex items-center text-xs px-2 py-1 rounded bg-adk-dark-2 hover:bg-adk-dark-3 text-adk-text-secondary hover:text-adk-text transition-colors">
                    <CopyIcon className="w-3 h-3 mr-1.5" />
                    {copyStatus === 'response' ? 'Copied!' : 'Copy'}
                </button>
            </div>
            <pre className="whitespace-pre-wrap break-all bg-adk-dark p-2 rounded">{responseContent}</pre>
          </div>
        </div>
      )}
    </div>
  );
};

export const SessionItem: React.FC<SessionItemProps> = ({ session }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="p-2 rounded bg-adk-dark-2">
      <div 
        className="grid grid-cols-[auto,1fr,2fr,auto,auto] items-center gap-x-4 cursor-pointer" 
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {isExpanded ? <ChevronDownIcon className="w-4 h-4" /> : <ChevronRightIcon className="w-4 h-4" />}
        <span className="font-semibold text-adk-text truncate" title={session.agentId}>{session.agentId}</span>
        <span className="text-xs truncate" title={session.sessionId}>{session.sessionId}</span>
        <span className="text-xs">{session.historyCount} msgs</span>
        <span className="text-xs">{session.requestHistory.length} reqs</span>
      </div>
      {isExpanded && (
        <div className="mt-2 pl-6 border-l-2 border-adk-dark-3 space-y-2">
          <h3 className="text-sm font-semibold text-adk-text mt-2">Request History</h3>
          {session.requestHistory.length > 0 ? (
            <div className="max-h-60 overflow-y-auto pr-2">
              {session.requestHistory.map((record) => (
                <RequestDetails key={record.timestamp} record={record} />
              ))}
            </div>
          ) : (
            <p className="text-xs text-adk-text-secondary">No requests recorded for this session.</p>
          )}
        </div>
      )}
    </div>
  );
};
