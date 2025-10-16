import React from 'react';
import { Agent } from '../types';
import { AgentListItem } from './AgentListItem';

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
}

const buildTree = (agents: Agent[]): TreeNode[] => {
  const root: TreeNode = { name: 'root', path: '', children: [] };

  for (const agent of agents) {
    // To keep the leaf node name the same as the agent card, 
    // we'll use the full agent name for the leaf, and parts for dirs.
    const pathParts = agent.name.split('/');
    let currentNode = root;

    for (let i = 0; i < pathParts.length; i++) {
      const part = pathParts[i];
      const currentPath = pathParts.slice(0, i + 1).join('/');
      const isLeaf = i === pathParts.length - 1;

      let childNode = currentNode.children?.find((child) => child.name === part);

      if (!childNode) {
        childNode = { name: part, path: currentPath };
        if (!isLeaf) {
          childNode.children = [];
        } else {
          childNode.agent = agent;
        }
        currentNode.children?.push(childNode);
        // Keep the list sorted
        currentNode.children?.sort((a, b) => {
          // Directories first
          if (a.children && !b.children) return -1;
          if (!a.children && b.children) return 1;
          // Then sort by name
          return a.name.localeCompare(b.name);
        });
      }
      currentNode = childNode;
    }
  }
  return root.children || [];
};

const TreeNodeComponent: React.FC<{ 
  node: TreeNode, 
  selectedAgent: Agent | null,
  onStart: (id: string) => void,
  onStop: (id: string) => void,
  onSelectAgent: (agent: Agent) => void 
}> = ({ node, selectedAgent, onStart, onStop, onSelectAgent }) => {
  const [isOpen, setIsOpen] = React.useState(true); // Default to open

  const isFolder = !!node.children;

  const handleToggle = () => {
    setIsOpen(!isOpen);
  };

  if (isFolder) {
    return (
      <div className="ml-2">
        <div onClick={handleToggle} className="cursor-pointer flex items-center py-1">
          <span className="w-6 text-lg">{isOpen ? '📂' : '📁'}</span>
          <span className="font-semibold">{node.name}</span>
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
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // It's a leaf node, so it must have an agent.
  if (!node.agent) return null;

  return (
    <div className="my-2">
      <AgentListItem
        agent={node.agent}
        displayName={node.name}
        onStart={onStart}
        onStop={onStop}
        onSelect={onSelectAgent}
        isActive={selectedAgent?.id === node.agent.id}
      />
    </div>
  );
};

const TreeView: React.FC<TreeViewProps> = ({ agents, selectedAgent, onStart, onStop, onSelectAgent }) => {
  const tree = buildTree(agents);

  return (
    <div className="space-y-2">
      {tree.map((node) => (
        <TreeNodeComponent 
          key={node.path} 
          node={node} 
          selectedAgent={selectedAgent}
          onStart={onStart}
          onStop={onStop}
          onSelectAgent={onSelectAgent} 
        />
      ))}
    </div>
  );
};

export default TreeView;
