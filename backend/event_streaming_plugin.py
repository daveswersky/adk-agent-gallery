import json
from google.adk.plugins import BasePlugin
from google.adk.tools import AgentTool
from google.genai.types import Content, Part


class EventStreamingPlugin(BasePlugin):
    def __init__(self, pipe_writer):
        self.name = "event_streaming_plugin"
        self._pipe_writer = pipe_writer

    def _send_event(self, event_name: str, event_data: dict) -> None:
        """Serializes and sends an event to the pipe."""
        event = json.dumps({"event": event_name, "data": event_data})
        self._pipe_writer.write(event + "\n")
        self._pipe_writer.flush()

    async def on_prompt_start(self, prompt: Content) -> None:
        self._send_event("on_prompt_start", {"prompt": prompt.to_dict()})

    async def on_prompt_end(self, prompt: Content) -> None:
        self._send_event("on_prompt_end", {"prompt": prompt.to_dict()})

    async def on_llm_start(
        self, prompt: Content, is_streaming: bool, **kwargs
    ) -> None:
        self._send_event(
            "on_llm_start",
            {"prompt": prompt.to_dict(), "is_streaming": is_streaming},
        )

    async def on_llm_end(self, response: Content) -> None:
        self._send_event("on_llm_end", {"response": response.to_dict()})

    async def on_llm_chunk(self, chunk: Part) -> None:
        self._send_event("on_llm_chunk", {"chunk": chunk.to_dict()})

    async def on_tool_code_generated(self, code: str) -> None:
        self._send_event("on_tool_code_generated", {"code": code})

    async def on_tool_call_start(self, tool_call: Part) -> None:
        self._send_event("on_tool_call_start", {"tool_call": tool_call.to_dict()})

    async def on_tool_call_end(self, tool_result: Part) -> None:
        self._send_event("on_tool_call_end", {"tool_result": tool_result.to_dict()})

    async def before_tool_callback(self, tool, tool_args, tool_context) -> None:
        self._send_event(
            "before_tool_call",
            {"tool_call": {"name": tool.name, "args": tool_args}},
        )

    async def after_tool_callback(
        self, tool, tool_args, tool_context, result
    ) -> None:
        if isinstance(tool, AgentTool):
            return  # Suppress event for agent-to-agent transfers

        tool_result_payload = result
        if hasattr(result, "to_dict"):
            tool_result_payload = result.to_dict()

        self._send_event(
            "after_tool_call",
            {
                "tool_call": {"name": tool.name, "args": tool_args},
                "tool_result": tool_result_payload,
            },
        )