import json
from google.adk.plugins import BasePlugin

class EventStreamingPlugin(BasePlugin):
    def __init__(self, pipe_writer):
        self.name = "event_streaming_plugin"
        self._pipe_writer = pipe_writer

    def before_tool_call(self, tool_call) -> None:
        event = json.dumps({
            "event": "before_tool_call",
            "tool_call": tool_call.to_dict()
        })
        self._pipe_writer.write(event + '\n')
        self._pipe_writer.flush()

    def after_tool_call(self, tool_call, tool_result) -> None:
        event = json.dumps({
            "event": "after_tool_call",
            "tool_call": tool_call.to_dict(),
            "tool_result": tool_result.to_dict()
        })
        self._pipe_writer.write(event + '\n')
        self._pipe_writer.flush()