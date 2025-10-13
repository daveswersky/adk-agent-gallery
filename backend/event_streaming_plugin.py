import json
from multiprocessing import Queue
from google.adk.plugins import BasePlugin

class EventStreamingPlugin(BasePlugin):
    """An ADK Plugin that streams tool events to a queue."""

    def __init__(self, queue: Queue):
        self._queue = queue

    def before_tool_callback(self, tool_name: str, tool_input: str) -> None:
        """Called before a tool is executed."""
        event = {
            "type": "tool_start",
            "tool_name": tool_name,
            "tool_input": tool_input,
        }
        self._queue.put(json.dumps(event))

    def after_tool_callback(self, tool_name: str, tool_output: str) -> None:
        """Called after a tool is executed."""
        event = {
            "type": "tool_end",
            "tool_name": tool_name,
            "tool_output": tool_output,
        }
        self._queue.put(json.dumps(event))
