
import os

def research_solutions(query: str) -> str:
    """
    Performs Retrieval-Augmented Generation (RAG) by preparing a prompt.

    It reads documents from the knowledge base and combines them with the
    user's query into a detailed prompt for an LLM to execute.

    Args:
        query: The user's question about how to solve a problem.

    Returns:
        A string containing the fully constructed RAG prompt.
    """
    # 1. Locate and read the knowledge base files
    script_dir = os.path.dirname(__file__)
    knowledge_base_dir = os.path.join(script_dir, '..', 'data', 'knowledge_base')

    knowledge_content = []
    sources = []
    try:
        for filename in os.listdir(knowledge_base_dir):
            file_path = os.path.join(knowledge_base_dir, filename)
            if os.path.isfile(file_path):
                with open(file_path, 'r', encoding='utf-8') as f:
                    knowledge_content.append(f.read())
                    sources.append(filename)
    except FileNotFoundError:
        return f"Error: The knowledge base directory at {knowledge_base_dir} was not found."

    if not knowledge_content:
        return "Error: No documents found in the knowledge base."

    knowledge_base_text = "\n\n---\n\n".join(knowledge_content)
    source_list = ", ".join(sources)

    # 2. Construct and return the prompt
    prompt = f"""
    You are an expert supply chain analyst. Your task is to answer the user's question
    based *only* on the provided context from the corporate knowledge base.
    Do not use any external knowledge. After your answer, cite the sources you used.

    **Knowledge Base Context:**
    ---
    {knowledge_base_text}
    ---

    **User Question:**
    {query}

    **Answer:**
    (Begin your answer here)

    *Sources: {source_list}*
    """
    return prompt
