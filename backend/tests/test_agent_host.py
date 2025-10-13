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



@pytest_asyncio.fixture
async def running_agent_host(setup_test_venv):
    """
    Starts the agent_host.py script as a subprocess, captures its stderr,
    and yields control. Terminates the process after the test is complete.
    """
    python_executable = setup_test_venv
    
    env = os.environ.copy()

    stderr_capture = []
    async def _read_stream(stream, storage):
        while True:
            line = await stream.readline()
            if line:
                storage.append(line.decode('utf-8'))
            else:
                break

    process = await asyncio.create_subprocess_exec(
        python_executable,
        AGENT_HOST_SCRIPT,
        "--agent-path", GREETING_AGENT_PATH,
        "--port", str(TEST_PORT),
        "--verbose",
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        env=env
    )

    stderr_task = asyncio.create_task(_read_stream(process.stderr, stderr_capture))

    health_url = f"http://localhost:{TEST_PORT}/health"
    start_time = time.time()
    is_healthy = False
    while time.time() - start_time < 30:
        if process.returncode is not None:
            break 
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(health_url, timeout=1)
                if response.status_code == 200:
                    is_healthy = True
                    break
        except httpx.ConnectError:
            await asyncio.sleep(0.5)
    
    if not is_healthy:
        process.terminate()
        await process.wait()
        stderr_task.cancel()
        stderr_output = "".join(stderr_capture)
        raise RuntimeError(f"Agent host did not start in time. Stderr: {stderr_output}")

    try:
        yield f"http://localhost:{TEST_PORT}", stderr_capture
    finally:
        process.terminate()
        await process.wait()
        stderr_task.cancel()
        
        print("\n--- Agent Host Stderr (Teardown) ---")
        print("".join(stderr_capture))
        print("-------------------------------------\n")


async def test_agent_host_responds_correctly(running_agent_host):
    """
    Tests that the agent host starts correctly and responds to a prompt.
    """
    agent_url, stderr_capture = running_agent_host
    
    final_response = ""
    async with httpx.AsyncClient() as client:
        response = await client.post(
            agent_url,
            json={"prompt": "Hello"},
            timeout=10
        )

    stderr_output = "".join(stderr_capture)
    print(f"\n--- Agent Host Stderr ---\n{stderr_output}\n-------------------------\n")

    assert response.status_code == 200, f"Expected status code 200, but got {response.status_code}. Stderr:\n{stderr_output}"
    
    response_json = response.json()
    final_response = response_json.get("response")

    assert final_response, f"Agent response was empty. Stderr:\n{stderr_output}"

