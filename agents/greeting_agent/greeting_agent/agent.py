# Copyright 2025 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

from google.adk.agents import LlmAgent

def greeting_agent_fn(request):
    """A function-based agent that conditionally returns markdown."""
    user_input = request.get_user_input() or ""

    if "markdown" in user_input.lower():
        # Use the markdown prompt if the keyword is present
        prompt = """You are a friendly agent that greets the user.

Your response MUST be formatted in Markdown and include the following elements:
- A level 1 heading (`#`)
- A bulleted list
- **Bold text**
- A code block with a simple "hello world" example in Python.
"""
    else:
        # Otherwise, use the standard simple prompt
        prompt = "You are a friendly agent that greets the user. Your response should be short and sweet."

    return request.with_prompt(prompt)

greeting_agent = LlmAgent(
    model="gemini-2.5-flash",
    name="greeting_agent",
    description="A simple agent that says hello. Type 'markdown' for a formatted response."
)

root_agent = greeting_agent