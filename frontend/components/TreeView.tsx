import React from 'react';
import { Agent, AgentStatus } from '../types';
import { PlayIcon, StopIcon, SpinnerIcon, CodeBracketIcon } from './icons';

const StatusBadge: React.FC<{ status: AgentStatus }> = ({ status }) => {
  const baseClasses = "px-2 py-1 text-xs font-semibold rounded-full inline-flex items-center";
  let specificClasses = "";
  let text = status;

  switch (status) {
    case AgentStatus.RUNNING:
      specificClasses = "bg-status-running/20 text-status-running";
      break;
    case AgentStatus.STOPPED:
      specificClasses = "bg-status-stopped/20 text-status-stopped";
      break;
    case AgentStatus.STARTING:
    case AgentStatus.STOPPING:
      specificClasses = "bg-status-starting/20 text-status-starting";
      text = status;
      break;
    case AgentStatus.ERROR:
      specificClasses = "bg-red-800/50 text-red-400";
      break;
  }

  return <span className={`${baseClasses} ${specificClasses}`}>{text}</span>;
};

interface TreeNode {
  name: string;
  path: string;
  children?: TreeNode[];
  agent?: Agent;
}

interface TreeViewProps {
  agents: Agent[];
  selectedAgent: Agent | null;
  onStart: (id: string) => void;
  onStop: (id: string) => void;
  onSelectAgent: (agent: Agent) => void;
  onViewCode: (agent: Agent) => void;
}

const buildTree = (agents: Agent[]): TreeNode[] => {
  const root: TreeNode = { name: 'root', path: '', children: [] };
  const nodes: { [path: string]: TreeNode } = { '': root };

  const sortedAgents = [...agents].sort((a, b) => a.name.localeCompare(b.name));

  for (const agent of sortedAgents) {
    const pathParts = agent.name.split('/');
    for (let i = 0; i < pathParts.length; i++) {
      const part = pathParts[i];
      const currentPath = pathParts.slice(0, i + 1).join('/');
      const parentPath = pathParts.slice(0, i).join('/');
      const isLeaf = i === pathParts.length - 1;

      if (!nodes[currentPath]) {
        const newNode: TreeNode = {
          name: part,
          path: currentPath,
        };

        if (isLeaf) {
          newNode.agent = agent; // Store the original agent object
        } else {
          newNode.children = [];
        }

        const parentNode = nodes[parentPath];
        parentNode.children?.push(newNode);
        nodes[currentPath] = newNode;
      }
    }
  }
  return root.children || [];
};

const TreeNodeComponent: React.FC<{
  node: TreeNode,
  selectedAgent: Agent | null,
  onStart: (id: string) => void,
  onStop: (id: string) => void,
  onSelectAgent: (agent: Agent) => void;
  onViewCode: (agent: Agent) => void;
}> = ({ node, selectedAgent, onStart, onStop, onSelectAgent, onViewCode }) => {
  const [isOpen, setIsOpen] = React.useState(true);
  const isFolder = !!node.children;

  const handleToggle = () => {
    setIsOpen(!isOpen);
  };

  if (isFolder) {
    return (
      <div>
        <div onClick={handleToggle} className="cursor-pointer flex items-center py-1">
          <span className="w-6 text-lg">{isOpen ? '📂' : '📁'}</span>
          <span className="font-mono text-sm text-adk-text">{node.name}</span>
        </div>
        {isOpen && (
          <div className="pl-4 border-l border-adk-dark-3">
            {node.children.map((child) => (
              <TreeNodeComponent
                key={child.path}
                node={child}
                selectedAgent={selectedAgent}
                onStart={onStart}
                onStop={onStop}
                onSelectAgent={onSelectAgent}
                onViewCode={onViewCode}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  const agent = node.agent;
  if (!agent) return null;

  const isRunning = agent.status === AgentStatus.RUNNING;
  const isStopped = agent.status === AgentStatus.STOPPED;
  const isActive = selectedAgent?.id === agent.id;

  return (
    <div
      className={`flex items-center justify-between p-2 rounded-md transition-colors ${isActive ? 'bg-adk-accent/20' : ''} ${isRunning ? `cursor-pointer hover:bg-adk-dark-3 border border-status-running` : 'border border-transparent'}`}
      onClick={() => isRunning && onSelectAgent(agent)}
    >
      <div className="flex items-center">
        <span className="font-mono text-sm text-adk-text">{node.name}</span>
      </div>
      <div className="flex items-center space-x-2">
        <button
            onClick={(e) => { e.stopPropagation(); onViewCode(agent); }}
            className="p-1 text-sm font-medium rounded-md bg-adk-dark-3 text-adk-text-secondary hover:bg-adk-dark-3/80 transition-colors"
        >
            <CodeBracketIcon className="w-4 h-4" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onStart(agent.id); }}
          disabled={!isStopped}
          className={`p-1 text-sm font-medium rounded-md transition-colors ${isStopped ? 'bg-status-running/20 text-status-running hover:bg-status-running/40' : 'bg-adk-dark-3 text-adk-text-secondary'} disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {agent.status === AgentStatus.STARTING ? <SpinnerIcon className="animate-spin w-4 h-4" /> : <PlayIcon className="w-4 h-4" />}
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onStop(agent.id); }}
          disabled={!isRunning}
          className={`p-1 text-sm font-medium rounded-md transition-colors ${isRunning ? 'bg-status-stopped/20 text-status-stopped hover:bg-status-stopped/40' : 'bg-adk-dark-3 text-adk-text-secondary'} disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {agent.status === AgentStatus.STOPPING ? <SpinnerIcon className="animate-spin w-4 h-4" /> : <StopIcon className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
};

const TreeView: React.FC<TreeViewProps> = ({ agents, selectedAgent, onStart, onStop, onSelectAgent, onViewCode }) => {
  const tree = buildTree(agents);

  return (
    <div className="space-y-1">
      {tree.map((node) => (
        <TreeNodeComponent
          key={node.path}
          node={node}
          selectedAgent={selectedAgent}
          onStart={onStart}
          onStop={onStop}
          onSelectAgent={onSelectAgent}
          onViewCode={onViewCode}
        />
      ))}
    </div>
  );
};

export default TreeView;
