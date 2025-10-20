import React, { useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface AgentCode {
  name: string;
  code: string;
}

interface CodeViewerModalProps {
  agentCode: {
    main_agent: AgentCode;
    sub_agents: AgentCode[];
  } | null;
  onClose: () => void;
}

const CodeViewerModal: React.FC<CodeViewerModalProps> = ({ agentCode, onClose }) => {
  const [activeTab, setActiveTab] = useState('main');

  if (!agentCode) {
    return null;
  }

  const { main_agent, sub_agents } = agentCode;
  const hasSubAgents = sub_agents && sub_agents.length > 0;

  const activeCode = activeTab === 'main'
    ? main_agent.code
    : sub_agents.find(agent => agent.name === activeTab)?.code || '';

  const activeFilename = activeTab === 'main'
    ? `${main_agent.name}/agent.py`
    : `${activeTab}/agent.py`;


  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
      <div className="bg-gray-800 text-white rounded-lg shadow-xl w-3/p h-3/4 flex flex-col">
        <div className="p-4 border-b border-gray-700 flex justify-between items-center">
          <h2 className="text-xl font-semibold">{activeFilename}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl"
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        {hasSubAgents && (
          <div className="flex border-b border-gray-700">
            <button
              className={`px-4 py-2 ${activeTab === 'main' ? 'bg-gray-700' : ''}`}
              onClick={() => setActiveTab('main')}
            >
              {main_agent.name}
            </button>
            {sub_agents.map(agent => (
              <button
                key={agent.name}
                className={`px-4 py-2 ${activeTab === agent.name ? 'bg-gray-700' : ''}`}
                onClick={() => setActiveTab(agent.name)}
              >
                {agent.name}
              </button>
            ))}
          </div>
        )}

        <div className="flex-grow overflow-auto">
          <SyntaxHighlighter
            language="python"
            style={atomDark}
            customStyle={{ margin: 0, height: '100%' }}
            codeTagProps={{ style: { fontFamily: 'inherit' } }}
          >
            {activeCode}
          </SyntaxHighlighter>
        </div>
      </div>
    </div>
  );
};

export default CodeViewerModal;
