import asyncio
import httpx
import os
import pytest
import pytest_asyncio
import subprocess
import time

# Mark all tests in this file as asyncio
pytestmark = pytest.mark.asyncio

AGENT_HOST_SCRIPT = os.path.abspath("backend/agent_host.py")
GREETING_AGENT_PATH = os.path.abspath("agents/greeting_agent")
TEST_PORT = 8001

@pytest.fixture(scope="module")
def setup_test_venv():
    """
    Creates a dedicated virtual environment for the test agent and installs
    the host dependencies. This is a module-level fixture, so it runs once.
    """
    venv_path = os.path.join(GREETING_AGENT_PATH, ".venv_test")
    python_executable = os.path.join(venv_path, "bin", "python")
    host_requirements_path = os.path.abspath("backend/agent_host_requirements.txt")
    agent_requirements_path = os.path.join(GREETING_AGENT_PATH, "requirements.txt")

    # Create venv
    if not os.path.exists(venv_path):
        subprocess.run(["python3", "-m", "venv", venv_path], check=True)

    # Install host and agent dependencies
    subprocess.run(
        [python_executable, "-m", "pip", "install", "-r", host_requirements_path],
        check=True
    )
    subprocess.run(
        [python_executable, "-m", "pip", "install", "-r", agent_requirements_path],
        check=True
    )
    
    yield python_executable
    
    # Teardown (optional, can be useful for cleanup)
    # import shutil
    # shutil.rmtree(venv_path)


import tempfile

@pytest_asyncio.fixture
async def running_agent_host(setup_test_venv):
    """
    Starts the agent_host.py script as a subprocess and yields control.
    Terminates the process after the test is complete.
    """
    python_executable = setup_test_venv
    
    env = os.environ.copy()
    dotenv_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '.env'))
    if os.path.exists(dotenv_path):
        with open(dotenv_path, 'r') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#'):
                    key, value = line.split('=', 1)
                    env[key] = value
    
    # The agent host expects GOOGLE_API_KEY, but the .env file provides GEMINI_API_KEY.
    if "GEMINI_API_KEY" in env:
        api_key = env["GEMINI_API_KEY"]
        if api_key.startswith('"') and api_key.endswith('"'):
            api_key = api_key[1:-1]
        elif api_key.startswith("'") and api_key.endswith("'"):
            api_key = api_key[1:-1]
        env["GOOGLE_API_KEY"] = api_key

    # Create a temporary file to capture stderr
    stderr_log_file = tempfile.NamedTemporaryFile(delete=False, mode='w+', encoding='utf-8')

    # Start the agent host as a subprocess
    process = await asyncio.create_subprocess_exec(
        python_executable,
        AGENT_HOST_SCRIPT,
        "--agent-path", GREETING_AGENT_PATH,
        "--port", str(TEST_PORT),
        stdout=asyncio.subprocess.PIPE,
        stderr=stderr_log_file,
        env=env
    )

    # Wait for the server to start by polling the /health endpoint
    health_url = f"http://localhost:{TEST_PORT}/health"
    start_time = time.time()
    while True:
        # Check if the process has exited unexpectedly
        if process.returncode is not None:
            stderr_log_file.seek(0)
            stderr_output = stderr_log_file.read()
            stderr_log_file.close()
            os.remove(stderr_log_file.name)
            raise RuntimeError(f"Agent host process exited with code {process.returncode}. Stderr: {stderr_output}")

        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(health_url, timeout=1)
                if response.status_code == 200:
                    break
        except httpx.ConnectError:
            pass
        
        if time.time() - start_time > 30: # 30 second timeout
            process.terminate()
            await process.wait()
            stderr_log_file.seek(0)
            stderr_output = stderr_log_file.read()
            stderr_log_file.close()
            os.remove(stderr_log_file.name)
            raise RuntimeError(f"Agent host did not start in time. Stderr: {stderr_output}")
        
        await asyncio.sleep(0.5)

    try:
        yield f"http://localhost:{TEST_PORT}", stderr_log_file.name
    finally:
        # Teardown: terminate the process and clean up the log file
        process.terminate()
        await process.wait()
        
        # Print the stderr log file for debugging
        with open(stderr_log_file.name, 'r') as f:
            print("\n--- Agent Host Stderr ---")
            print(f.read())
            print("-------------------------\n")

        stderr_log_file.close()
        os.remove(stderr_log_file.name)


import json

async def test_agent_host_responds_correctly(running_agent_host):
    """
    Tests that the agent host starts correctly and responds to a prompt.
    """
    agent_url, stderr_log_path = running_agent_host
    
    final_response = ""
    async with httpx.AsyncClient() as client:
        async with client.stream(
            "POST",
            agent_url,
            json={
                "user_id": "test_user",
                "session_id": "test_session",
                "new_message": {
                    "parts": [{"text": "Hello"}]
                }
            },
            timeout=10
        ) as response:
            assert response.status_code == 200
            async for line in response.aiter_lines():
                if line.strip():
                    event = json.loads(line)
                    if event.get("event_type") == "model_chunk":
                        final_response += event.get("text", "")

    with open(stderr_log_path, 'r') as f:
        stderr_output = f.read()

    if response.status_code == 500:
        pytest.fail(f"Agent host returned 500 Internal Server Error. Stderr:\n{stderr_output}")

    assert final_response, f"Agent response was empty. Stderr:\n{stderr_output}"
