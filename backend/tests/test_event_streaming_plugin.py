import json
import io
import pytest
from backend.event_streaming_plugin import EventStreamingPlugin

# Mock objects to simulate the ADK's tool and result objects
class MockTool:
    def __init__(self, name="test_tool"):
        self.name = name

class MockToolResult:
    def to_dict(self):
        return {"result": "success"}

@pytest.fixture
def mock_pipe():
    """Fixture to create a mock pipe writer for capturing output."""
    return io.StringIO()

@pytest.fixture
def plugin(mock_pipe):
    """Fixture to create an EventStreamingPlugin instance."""
    return EventStreamingPlugin(pipe_writer=mock_pipe)

@pytest.mark.asyncio
async def test_before_tool_callback(plugin, mock_pipe):
    """Verify that before_tool_callback writes a correctly formatted event."""
    mock_tool = MockTool()
    tool_args = {"arg": "value"}
    
    await plugin.before_tool_callback(tool=mock_tool, tool_args=tool_args, tool_context=None)
    
    event_str = mock_pipe.getvalue().strip()
    event = json.loads(event_str)
    
    assert event["event"] == "before_tool_call"
    assert event["tool_call"]["name"] == "test_tool"
    assert event["tool_call"]["args"] == tool_args

@pytest.mark.asyncio
async def test_after_tool_callback(plugin, mock_pipe):
    """Verify that after_tool_callback writes a correctly formatted event."""
    mock_tool = MockTool()
    tool_args = {"arg": "value"}
    mock_result = MockToolResult()
    
    await plugin.after_tool_callback(tool=mock_tool, tool_args=tool_args, tool_context=None, result=mock_result)
    
    event_str = mock_pipe.getvalue().strip()
    event = json.loads(event_str)
    
    assert event["event"] == "after_tool_call"
    assert event["tool_call"]["name"] == "test_tool"
    assert event["tool_call"]["args"] == tool_args
    assert event["tool_result"] == mock_result.to_dict()

@pytest.mark.asyncio
async def test_after_tool_callback_suppresses_agent_tool(plugin, mock_pipe):
    """Verify that after_tool_callback does not fire for AgentTool instances."""
    # The AgentTool class is part of the google.adk.tools module
    from google.adk.tools import AgentTool
    
    # Mock an agent object that the AgentTool can wrap
    class MockAgent:
        name = "mock_agent_tool"
        description = "A mock agent tool"

    # Instantiate AgentTool correctly, with only the agent object
    mock_agent_tool = AgentTool(
        agent=MockAgent()
    )
    
    tool_args = {"arg": "value"}
    mock_result = MockToolResult()
    
    await plugin.after_tool_callback(tool=mock_agent_tool, tool_args=tool_args, tool_context=None, result=mock_result)
    
    # The pipe should be empty because the event is suppressed
    assert mock_pipe.getvalue() == ""