import requests
from bs4 import BeautifulSoup
import re

def get_real_vehicle_details(vehicle_number):
    """
    Fetches real vehicle details from carinfo.app
    """
    vehicle_number = vehicle_number.upper().replace(" ", "")
    url = f"https://www.carinfo.app/rc-details/{vehicle_number}"
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    
    try:
        response = requests.get(url, headers=headers, timeout=10)
        if response.status_code != 200:
            return None
            
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Check for "Not Found" or "Invalid" patterns observed in carinfo.app
        text_content = soup.get_text(separator="|")
        if "Oops!" in text_content or "Invalid Vehicle Number" in text_content:
            return {"error": "INVALID"}
            
        # Based on the observed structure of carinfo.app
        # Values often appear after labels like "Owner Name", "Make & Model"
        
        data = {
            "vehicle_number": vehicle_number,
            "vehicle_type": "Car", # Default fallback
            "model": "Generic Vehicle",
            "owner_name": "N/A",
            "reg_date": "N/A",
            "rto": "N/A"
        }
        
        # Heuristic extraction from text blocks
        parts = [p.strip() for p in text_content.split("|") if p.strip()]
        
        for i, part in enumerate(parts):
            if "Make & Model" in part and i + 1 < len(parts):
                data["model"] = parts[i+1]
            elif "Owner Name" in part and i + 1 < len(parts):
                data["owner_name"] = parts[i+1]
            elif "Registered RTO" in part and i + 1 < len(parts):
                data["rto"] = parts[i+1]
            elif "State" in part and i + 1 < len(parts):
                data["state"] = parts[i+1]
                
        # Determine vehicle type based on model or keywords
        model_lower = data.get("model", "generic").lower()
        bike_keywords = [
            "scooter", "bike", "honda act", "royal enfield", "yamaha", "tvs", "hero", 
            "suzuki access", "pulsar", "apache", "bullet", "classic 350", "scooty", 
            "jupiter", "dio", "passion", "splendor", "glamour", "unicorn", "cb shine",
            "access 125", "vespa", "aprilia", "duke", "rc 200", "rc 390", "himalayan",
            "interceptor", "meteor", "r15", "mt-15"
        ]
        
        if any(kw in model_lower for kw in bike_keywords):
            data["vehicle_type"] = "Bike"
        else:
            data["vehicle_type"] = "Car"
            
        return data
        
    except Exception as e:
        print(f"Scraping error: {e}")
        return None

if __name__ == "__main__":
    # Test with a known plate
    print(get_real_vehicle_details("TN37EC9637"))
