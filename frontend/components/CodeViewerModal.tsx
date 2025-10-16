import React from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface CodeViewerModalProps {
  agentCode: {
    filename: string;
    content: string;
  } | null;
  onClose: () => void;
}

const CodeViewerModal: React.FC<CodeViewerModalProps> = ({ agentCode, onClose }) => {
  if (!agentCode) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
      <div className="bg-gray-800 text-white rounded-lg shadow-xl w-3/4 h-3/4 flex flex-col">
        <div className="p-4 border-b border-gray-700 flex justify-between items-center">
          <h2 className="text-xl font-semibold">{agentCode.filename}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl"
            aria-label="Close"
          >
            &times;
          </button>
        </div>
        <div className="flex-grow overflow-auto">
          <SyntaxHighlighter
            language="python"
            style={atomDark}
            customStyle={{ margin: 0, height: '100%' }}
            codeTagProps={{ style: { fontFamily: 'inherit' } }}
          >
            {agentCode.content}
          </SyntaxHighlighter>
        </div>
      </div>
    </div>
  );
};

export default CodeViewerModal;
