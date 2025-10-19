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

# This agent uses a single, robust prompt to handle conditional logic,
# avoiding the need for a separate Python function which was causing regressions.
greeting_agent = LlmAgent(
    model="gemini-2.5-flash",
    name="greeting_agent",
    description="A simple agent that says hello. Type 'markdown' for a formatted response.",
    instruction="""You are a friendly agent that greets the user. Your response should be short and sweet.

However, if the user's message contains the specific keyword "markdown", you MUST ignore the previous instruction and instead respond with a message formatted in Markdown that includes ALL of the following elements:
- A level 1 heading (`#`)
- A bulleted list
- **Bold text**
- A code block with a simple "hello world" example in Python.
- A link to the [Google ADK documentation](https://google.github.io/adk-docs/).
""",
)

root_agent = greeting_agent