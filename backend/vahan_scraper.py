import requests
from bs4 import BeautifulSoup
import re
import json

def get_real_vehicle_details(vehicle_number):
    """
    Fetches real vehicle details from carinfo.app
    """
    vehicle_number = vehicle_number.upper().replace(" ", "")
    url = f"https://www.carinfo.app/rc-details/{vehicle_number}"
    
    session = requests.Session()
    session.headers.update(headers)
    
    try:
        # Step 1: Visit home page once to establish a real session/cookies
        session.get("https://www.carinfo.app/", timeout=5)
        
        # Step 2: Fetch vehicle details
        response = session.get(url, timeout=12)
        
        if response.status_code != 200:
            print(f"Scraper blocked or failed (HTTP {response.status_code}) for {vehicle_number}")
            return {"error": "SITE_BLOCKADE", "status_code": response.status_code}
            
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Check for "Not Found" or "Invalid" patterns
        text_content = soup.get_text(separator="|")
        if "Oops!" in text_content or "Invalid Vehicle Number" in text_content:
            return {"error": "INVALID"}
            
        data = {
            "vehicle_number": vehicle_number,
            "vehicle_type": "Car", # Default fallback
            "model": "Generic Vehicle",
            "owner_name": "N/A",
            "reg_date": "N/A",
            "rto": "N/A",
            "image_url": None
        }

        # 1. Try robust extraction from __NEXT_DATA__ JSON
        next_data_script = soup.find('script', id='__NEXT_DATA__')
        if next_data_script:
            try:
                js_data = json.loads(next_data_script.string)
                details = js_data.get('props', {}).get('pageProps', {}).get('initialState', {}).get('rcDetails', {}).get('initialValues', {})
                if details:
                    data["model"] = details.get('modelName') or details.get('makeModel') or data["model"]
                    data["owner_name"] = details.get('ownerName') or data["owner_name"]
                    data["rto"] = details.get('registeredRto') or details.get('rtoAddress') or data["rto"]
                    data["reg_date"] = details.get('registrationDate') or data["reg_date"]
            except Exception as e:
                print(f"JSON extraction failed: {e}")

        # 2. Heuristic fallback
        if data["model"] == "Generic Vehicle":
            parts = [p.strip() for p in text_content.split("|") if p.strip()]
            for i, part in enumerate(parts):
                p_lower = part.lower()
                if ("make & model" in p_lower or "model name" in p_lower or "vehicle model" in p_lower) and i + 1 < len(parts):
                    data["model"] = parts[i+1]
                elif ("owner name" in p_lower or "registered owner" in p_lower) and i + 1 < len(parts):
                    data["owner_name"] = parts[i+1]
                elif "registered rto" in p_lower and i + 1 < len(parts):
                    data["rto"] = parts[i+1]

        # Determine vehicle type based on model or keywords
        model_lower = data.get("model", "generic").lower()

        truck_keywords = [
            # Heavy trucks / lorries
            "truck", "lorry", "tipper", "trailer", "tanker", "dumper",
            "container", "hcv", "lcv", "mcv", "heavy commercial",
            "light commercial", "medium commercial",
            # Tata trucks & LCVs
            "tata ace", "tata 407", "tata 608", "tata prima", "tata ultra",
            "tata signa", "tata xenon", "tata yodha",
            # Ashok Leyland
            "ashok leyland", "dost", "bada dost", "partner",
            # Mahindra commercial
            "mahindra bolero pickup", "supro", "jeeto", "treo zor",
            # Eicher
            "eicher", "pro 3000", "pro 6000",
            # Force / SML Isuzu
            "force trump", "sml isuzu", "samrat",
            # Tempo / Vans
            "tempo", "tempo traveller", "force traveller", "winger",
            "minibus", "minivan", "school bus",
            # Auto-rickshaw / 3-wheeler commercial
            "auto rickshaw", "e-rickshaw", "three wheeler", "3 wheeler",
            "piaggio ape", "mahindra alfa", "bajaj maxima",
            # Generic
            "bus", "van", "ambulance", "pickup",
        ]

        bike_keywords = [
            # Honda
            "activa", "honda act", "dio", "unicorn", "cb shine", "cb hornet", "cbr",
            "cb350", "cb300", "navi", "grazia", "aviator",
            # TVS
            "tvs", "apache", "jupiter", "ntorq", "scooty", "ronin", "raider",
            # Hero
            "hero motocorp", "splendor", "passion", "glamour", "destini", "maestro",
            "pleasure", "xpulse", "xtreme",
            # Bajaj
            "bajaj", "pulsar", "avenger", "dominar", "chetak", "platina", "ct100",
            # Royal Enfield
            "royal enfield", "bullet", "classic 350", "himalayan", "interceptor",
            "meteor", "thunderbird", "hunter 350",
            # Yamaha
            "yamaha", "r15", "mt-15", "fz", "fzs", "fazer", "fascino", "ray",
            "mt-03", "r3", "aerox",
            # Suzuki
            "suzuki access", "access 125", "burgman", "gixxer", "intruder",
            # KTM
            "ktm", "duke", "rc 200", "rc 390",
            # Kawasaki
            "kawasaki", "ninja", "z400", "versys",
            # Aprilia / Vespa
            "aprilia", "vespa", "sr 125", "sr 160",
            # Generic
            "scooter", "bike", "moped", "motorcycle", "two wheeler", "2 wheeler",
        ]

        car_keywords = [
            # Maruti Suzuki
            "maruti", "swift", "baleno", "dzire", "alto", "wagon r", "ertiga",
            "brezza", "ciaz", "celerio", "ignis", "xl6", "vitara",
            # Hyundai
            "hyundai", "i10", "i20", "creta", "venue", "verna", "tucson", "alcazar",
            "aura", "exter", "ioniq",
            # Tata passenger
            "tata nexon", "tata punch", "tata altroz", "tata tiago", "tata tigor",
            "tata harrier", "tata safari", "tata curvv",
            # Mahindra passenger
            "mahindra xuv", "mahindra thar", "mahindra scorpio", "mahindra bolero",
            "mahindra be", "mahindra xe",
            # Honda passenger
            "honda city", "honda amaze", "honda elevate", "honda jazz",
            "honda wr-v", "honda cr-v",
            # Toyota
            "toyota", "innova", "fortuner", "camry", "glanza", "urban cruiser",
            "hyryder", "hilux",
            # Kia
            "kia", "seltos", "sonet", "carens", "carnival",
            # Skoda / Volkswagen
            "skoda", "slavia", "kushaq", "octavia", "superb",
            "volkswagen", "virtus", "taigun", "polo", "vento",
            # Renault / Nissan
            "renault", "kwid", "kiger", "triber", "duster",
            "nissan", "magnite",
            # Ford / Jeep
            "ford", "endeavour", "jeep", "compass", "meridian",
            # MG / BYD
            "mg hector", "mg astor", "mg gloster", "mg comet",
            "byd atto", "byd seal",
            # Luxury
            "bmw", "mercedes", "audi", "volvo", "jaguar", "land rover",
            "lexus", "porsche",
            # Generic
            "sedan", "suv", "hatchback", "mpv", "crossover", "coupe", "convertible",
            "car", "four wheeler", "4 wheeler",
        ]

        if any(kw in model_lower for kw in truck_keywords):
            data["vehicle_type"] = "Truck"
        elif any(kw in model_lower for kw in bike_keywords):
            data["vehicle_type"] = "Bike"
        elif any(kw in model_lower for kw in car_keywords):
            data["vehicle_type"] = "Car"
        else:
            data["vehicle_type"] = "Car"  # Safe default

        return data
        
    except Exception as e:
        print(f"Scraping error: {e}")
        return None

