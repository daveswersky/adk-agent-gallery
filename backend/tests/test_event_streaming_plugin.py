import json
import unittest
import io
from backend.event_streaming_plugin import EventStreamingPlugin

# Mock objects to simulate the real tool_call and tool_result objects
class MockToolCall:
    def to_dict(self):
        return {"name": "test_tool", "args": {"arg": "value"}}

class MockToolResult:
    def to_dict(self):
        return {"result": "success"}

class TestEventStreamingPlugin(unittest.TestCase):
    """Unit tests for the EventStreamingPlugin."""

    def setUp(self):
        """Set up a mock pipe writer and the plugin for each test."""
        self.pipe_writer = io.StringIO()
        self.plugin = EventStreamingPlugin(pipe_writer=self.pipe_writer)

    def test_before_tool_call(self):
        """Verify that before_tool_call writes a correctly formatted event to the pipe."""
        mock_tool_call = MockToolCall()
        
        self.plugin.before_tool_call(tool_call=mock_tool_call)
        
        # Get the string from the buffer and parse it
        event_str = self.pipe_writer.getvalue().strip()
        event = json.loads(event_str)
        
        # Verify the event content
        self.assertEqual(event["event"], "before_tool_call")
        self.assertEqual(event["tool_call"], mock_tool_call.to_dict())

    def test_after_tool_call(self):
        """Verify that after_tool_call writes a correctly formatted event to the pipe."""
        mock_tool_call = MockToolCall()
        mock_tool_result = MockToolResult()
        
        self.plugin.after_tool_call(tool_call=mock_tool_call, tool_result=mock_tool_result)
        
        # Get the string from the buffer and parse it
        event_str = self.pipe_writer.getvalue().strip()
        event = json.loads(event_str)
        
        # Verify the event content
        self.assertEqual(event["event"], "after_tool_call")
        self.assertEqual(event["tool_call"], mock_tool_call.to_dict())
        self.assertEqual(event["tool_result"], mock_tool_result.to_dict())

if __name__ == '__main__':
    unittest.main()
