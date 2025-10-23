import React, { useState } from 'react';
import { AgentEvent } from '../types';
import { ChevronDownIcon, ChevronRightIcon } from './icons';
import SyntaxHighlighter from 'react-syntax-highlighter';
import { tomorrowNight } from 'react-syntax-highlighter/dist/esm/styles/hljs';

interface EventViewerProps {
  events: AgentEvent[];
  onClear: () => void;
}

const EventItem: React.FC<{ event: AgentEvent }> = ({ event }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="border-b border-adk-dark-3">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center p-2 text-left hover:bg-adk-dark-2 focus:outline-none"
      >
        {isExpanded ? (
          <ChevronDownIcon className="w-4 h-4 mr-2 text-adk-accent" />
        ) : (
          <ChevronRightIcon className="w-4 h-4 mr-2 text-adk-text-secondary" />
        )}
        <span className="font-semibold text-adk-text">{event.data.event}</span>
      </button>
      {isExpanded && (
        <div className="p-2 bg-adk-dark-1">
          <SyntaxHighlighter language="json" style={tomorrowNight} customStyle={{ background: 'transparent', padding: '0' }}>
            {JSON.stringify(event.data.data, null, 2)}
          </SyntaxHighlighter>
        </div>
      )}
    </div>
  );
};

export const EventViewer: React.FC<EventViewerProps> = ({ events, onClear }) => {
  return (
    <div className="h-full flex flex-col">
      <div className="flex-shrink-0 p-2 border-b border-adk-dark-3 flex justify-end">
        <button
          onClick={onClear}
          className="px-3 py-1 text-xs bg-adk-dark-3 text-adk-text-secondary rounded hover:bg-adk-dark-4 transition-colors"
        >
          Clear
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {events.length > 0 ? (
          events.map((event, index) => (
            <EventItem key={index} event={event} />
          ))
        ) : (
          <div className="flex items-center justify-center h-full text-adk-text-secondary">
            No events to display.
          </div>
        )}
      </div>
    </div>
  );
};
