
import csv
import os

def calculate_impact(disruption_event: str) -> str:
    """
    Calculates the impact of a supply chain disruption event.

    For this demo, it checks for specific keywords in the disruption event
    and calculates the total revenue at risk from affected orders.

    Args:
        disruption_event: A string describing the disruption.

    Returns:
        A string summarizing the impact.
    """
    # For the demo, we'll hardcode the logic. A real implementation would be more dynamic.
    if "shanghai" not in disruption_event.lower() and "supplier abc" not in disruption_event.lower():
        return "No direct impact identified for the given event."

    affected_skus = []
    if "shanghai" in disruption_event.lower():
        # Port of Shanghai closure affects products shipped from there.
        affected_skus.append("8675") # ProductX
    if "supplier abc" in disruption_event.lower():
        # Supplier ABC delay affects products they supply.
        if "8675" not in affected_skus:
            affected_skus.append("8675")

    if not affected_skus:
        return "No affected SKUs found for the given event."

    # Determine the absolute path to the data files
    script_dir = os.path.dirname(__file__)
    data_dir = os.path.join(script_dir, '..', 'data')
    orders_file_path = os.path.join(data_dir, 'orders.csv')

    total_revenue_at_risk = 0
    affected_orders = 0

    try:
        with open(orders_file_path, mode='r', encoding='utf-8') as csvfile:
            reader = csv.DictReader(csvfile)
            for row in reader:
                if row['SKU'] in affected_skus:
                    total_revenue_at_risk += float(row['Revenue'])
                    affected_orders += 1
    except FileNotFoundError:
        return f"Error: The file at {orders_file_path} was not found."
    except Exception as e:
        return f"An error occurred: {e}"

    return (
        f"Impact Assessment Complete:\n"
        f"- Disruption: '{disruption_event}'\n"
        f"- Affected SKUs: {', '.join(affected_skus)}\n"
        f"- Number of Affected Orders: {affected_orders}\n"
        f"- Total Revenue at Risk: ${total_revenue_at_risk:,.2f}"
    )
