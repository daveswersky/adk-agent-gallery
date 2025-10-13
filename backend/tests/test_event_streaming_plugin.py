import json
import unittest
from multiprocessing import Queue
from backend.event_streaming_plugin import EventStreamingPlugin

class TestEventStreamingPlugin(unittest.TestCase):
    """Unit tests for the EventStreamingPlugin."""

    def setUp(self):
        """Set up a queue and the plugin for each test."""
        self.queue = Queue()
        self.plugin = EventStreamingPlugin(queue=self.queue)

    def test_before_tool_callback(self):
        """Verify that before_tool_callback puts a correctly formatted event on the queue."""
        tool_name = "test_tool"
        tool_input = '{"arg": "value"}'
        
        self.plugin.before_tool_callback(tool_name=tool_name, tool_input=tool_input)
        
        # Get the item and parse it. This will timeout if no item exists.
        event_str = self.queue.get(timeout=1)
        event = json.loads(event_str)

        # Verify that the queue is now empty
        self.assertTrue(self.queue.empty())
        
        # Verify the event content
        self.assertEqual(event["type"], "tool_start")
        self.assertEqual(event["tool_name"], tool_name)
        self.assertEqual(event["tool_input"], tool_input)

    def test_after_tool_callback(self):
        """Verify that after_tool_callback puts a correctly formatted event on the queue."""
        tool_name = "test_tool"
        tool_output = '{"result": "success"}'
        
        self.plugin.after_tool_callback(tool_name=tool_name, tool_output=tool_output)
        
        # Get the item and parse it. This will timeout if no item exists.
        event_str = self.queue.get(timeout=1)
        event = json.loads(event_str)

        # Verify that the queue is now empty
        self.assertTrue(self.queue.empty())
        
        # Verify the event content
        self.assertEqual(event["type"], "tool_end")
        self.assertEqual(event["tool_name"], tool_name)
        self.assertEqual(event["tool_output"], tool_output)

if __name__ == '__main__':
    unittest.main()
