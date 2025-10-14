import json
from google.adk.plugins import BasePlugin

class EventStreamingPlugin(BasePlugin):
    def __init__(self, pipe_writer):
        self.name = "event_streaming_plugin"
        self._pipe_writer = pipe_writer

    async def before_tool_callback(self, tool, tool_args, tool_context) -> None:
        event = json.dumps({
            "event": "before_tool_call",
            "tool_call": tool_args
        })
        self._pipe_writer.write(event + '\n')
        self._pipe_writer.flush()

    async def after_tool_callback(self, tool, tool_args, tool_context, result) -> None:
        tool_result_payload = result
        if hasattr(result, 'to_dict'):
            tool_result_payload = result.to_dict()

        event = json.dumps({
            "event": "after_tool_call",
            "tool_call": tool_args,
            "tool_result": tool_result_payload
        })
        self._pipe_writer.write(event + '\n')
        self._pipe_writer.flush()