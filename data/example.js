// Example plan used by "See an example". Places and coordinates are real; prices, dates and details are made up to show the layout.
window.EP_EXAMPLE = {
  "format": "escape-planner/1",
  "trip": {
    "title": "Winter sun week (example)",
    "start_date": "2027-02-13", "end_date": "2027-02-20", "nights": 7,
    "currency": "USD",
    "budget": {"min": 3000, "max": 4500, "covers": "2 travelers from Chicago"},
    "travelers": [{"label": "Main group", "people": 2, "from": "Chicago", "airports": ["ORD", "MDW"]}],
    "priorities": ["Warm weather", "Good food", "Culture & history"],
    "researched_on": "",
    "assumptions": ["Example data: every price here is invented for illustration."]
  },
  "destinations": [
    {
      "id": "lisbon", "name": "Lisbon", "country": "Portugal", "area": "Lisbon",
      "tagline": "Best for food and easy sightseeing",
      "summary": "Hilly old neighborhoods, tiled facades and long seafood lunches. Mild rather than hot in February.",
      "why": ["Walkable city with many day trips", "Food is a highlight"],
      "lat": 38.7167, "lon": -9.1333, "airport": "LIS", "wikipedia": "Lisbon",
      "weather": {"high": 15, "low": 9, "unit": "C", "summary": "Mild, with some rainy days.", "source": {"title": "", "url": ""}},
      "entry": {"status": "Depends on passport", "details": "Example only. Check the official rules for your passports.", "source": {"title": "", "url": ""}},
      "costs": {"flights": [1100, 1600], "lodging": [900, 1300], "other": [800, 1200], "total": [2800, 4100], "notes": "Example figures."},
      "activities": [
        {"name": "Ride an old tram through Alfama", "description": "A slow ride past viewpoints and old lanes.", "price": "Example price", "url": ""},
        {"name": "Day trip to Sintra", "description": "Palaces and gardens in the hills; book timed entry.", "price": "Example price", "url": ""}
      ],
      "food": {"summary": "Grilled fish, custard tarts and small neighborhood restaurants.", "try": ["Pastel de nata", "Grilled sardines", "Bifana"]},
      "stay": {"area": "Baixa or Príncipe Real", "suggestion": "A two-bedroom apartment near a metro stop.", "url": ""},
      "tradeoffs": "Not beach weather in February; steep streets.",
      "safety": {"weather_risks": "Rain and wind on some days.", "advisory": "Example only — check your government's current advisory.", "tips": "Keep an indoor museum day in reserve.", "sources": []},
      "routes": [
        {
          "title": "Lisbon + Porto", "tag": "Two cities by train", "summary": "Add Porto's riverside and wine cellars.",
          "stops": [
            {"name": "Lisbon", "lat": 38.7167, "lon": -9.1333, "airport": "LIS", "nights": 4, "highlights": ["Alfama", "Belém"]},
            {"name": "Porto", "lat": 41.1496, "lon": -8.611, "airport": "OPO", "nights": 3, "highlights": ["Ribeira", "Port cellars"]}
          ],
          "legs": [{"from": "Lisbon", "to": "Porto", "mode": "train", "duration": "about 3 h (example)", "note": ""}],
          "costs": {"total": [3000, 4400], "breakdown": [{"label": "Flights", "range": [1150, 1700]}, {"label": "Lodging", "range": [950, 1350]}, {"label": "Train", "range": [100, 150]}, {"label": "Food & activities", "range": [800, 1200]}]},
          "tradeoffs": "One hotel change; fly home from Porto.", "entry": "", "safety": ""
        }
      ],
      "sources": []
    },
    {
      "id": "oaxaca", "name": "Oaxaca", "country": "Mexico", "area": "Oaxaca City",
      "tagline": "Best for food and culture",
      "summary": "Markets, mezcal, colonial streets and nearby ruins. Dry and sunny in winter.",
      "lat": 17.0654, "lon": -96.7237, "airport": "OAX", "wikipedia": "Oaxaca City",
      "weather": {"high": 28, "low": 10, "unit": "C", "summary": "Warm, dry days and cool nights.", "source": {"title": "", "url": ""}},
      "entry": {"status": "Depends on passport", "details": "Example only. Check the official rules for your passports.", "source": {"title": "", "url": ""}},
      "costs": {"flights": [900, 1400], "lodging": [600, 900], "other": [700, 1000], "total": [2200, 3300], "notes": "Example figures."},
      "activities": [
        {"name": "Monte Albán", "description": "Hilltop ruins above the valley.", "price": "Example price", "url": ""},
        {"name": "Cooking class", "description": "Market visit and mole-making.", "price": "Example price", "url": ""}
      ],
      "food": {"summary": "Moles, tlayudas and market breakfasts.", "try": ["Mole negro", "Tlayuda", "Chocolate de agua"]},
      "stay": {"area": "Centro or Jalatlaco", "suggestion": "A small guesthouse near the zócalo.", "url": ""},
      "tradeoffs": "Usually a connection on the way; high altitude nights are chilly.",
      "safety": {"weather_risks": "Very little rain in February.", "advisory": "Example only — check your government's current advisory.", "tips": "Plan day trips with a licensed guide.", "sources": []},
      "routes": [
        {
          "title": "Mexico City + Oaxaca", "tag": "Big city, then markets", "summary": "Start with museums, finish with food.",
          "stops": [
            {"name": "Mexico City", "lat": 19.4285, "lon": -99.1277, "airport": "MEX", "nights": 3, "highlights": ["Chapultepec", "Coyoacán"]},
            {"name": "Oaxaca", "lat": 17.0654, "lon": -96.7237, "airport": "OAX", "nights": 4, "highlights": ["Monte Albán", "Mercado 20 de Noviembre"]}
          ],
          "legs": [{"from": "Mexico City", "to": "Oaxaca", "mode": "flight", "from_airport": "MEX", "to_airport": "OAX", "duration": "", "note": ""}],
          "costs": {"total": [2500, 3700], "breakdown": [{"label": "Flights", "range": [1050, 1550]}, {"label": "Lodging", "range": [700, 1050]}, {"label": "Food & activities", "range": [750, 1100]}]},
          "tradeoffs": "Two short flights instead of one.", "entry": "", "safety": ""
        }
      ],
      "sources": []
    },
    {
      "id": "san-juan", "name": "San Juan", "country": "Puerto Rico (U.S.)", "area": "Old San Juan & Condado",
      "tagline": "Easiest beach week",
      "summary": "Beaches, forts and rainforest day trips, with simple travel from the mainland U.S.",
      "lat": 18.4663, "lon": -66.1057, "airport": "SJU", "wikipedia": "San Juan, Puerto Rico",
      "weather": {"high": 83, "low": 72, "unit": "F", "summary": "Warm with passing showers.", "source": {"title": "", "url": ""}},
      "entry": {"status": "Depends on passport", "details": "Example only. Check the official rules for your documents.", "source": {"title": "", "url": ""}},
      "costs": {"flights": [700, 1100], "lodging": [1200, 1800], "other": [900, 1300], "total": [2800, 4200], "notes": "Example figures."},
      "activities": [
        {"name": "Castillo San Felipe del Morro", "description": "Walls and lawns above the sea.", "price": "Example price", "url": ""},
        {"name": "El Yunque rainforest", "description": "Short trails and waterfalls.", "price": "Example price", "url": ""}
      ],
      "food": {"summary": "Mofongo, seafood and beach kiosks.", "try": ["Mofongo", "Alcapurrias"]},
      "stay": {"area": "Condado", "suggestion": "Beachfront apartment.", "url": ""},
      "tradeoffs": "Popular week; lodging costs more than the other options.",
      "safety": {"weather_risks": "Rip currents on some beaches.", "advisory": "Example only.", "tips": "Check beach conditions before swimming.", "sources": []},
      "routes": [
        {
          "title": "San Juan + Culebra", "tag": "Add a quiet island", "summary": "Three nights on a small island with clear water.",
          "stops": [
            {"name": "San Juan", "lat": 18.4663, "lon": -66.1057, "airport": "SJU", "nights": 4, "highlights": ["Old San Juan"]},
            {"name": "Culebra", "lat": 18.303, "lon": -65.301, "airport": "CPX", "nights": 3, "highlights": ["Flamenco Beach"]}
          ],
          "legs": [
            {"from": "San Juan", "to": "Culebra", "mode": "ferry", "duration": "drive to Ceiba, then ferry (example)", "note": ""},
            {"from": "Culebra", "to": "San Juan", "mode": "ferry", "duration": "", "note": "Fly home from San Juan."}
          ],
          "costs": {"total": [3000, 4400], "breakdown": [{"label": "Flights", "range": [700, 1100]}, {"label": "Lodging", "range": [1250, 1850]}, {"label": "Ferries & car", "range": [150, 250]}, {"label": "Food & activities", "range": [900, 1200]}]},
          "tradeoffs": "Ferries can sell out or cancel in rough seas.", "entry": "", "safety": ""
        }
      ],
      "sources": []
    },
    {
      "id": "tenerife", "name": "Tenerife", "country": "Spain (Canary Islands)", "area": "Adeje",
      "tagline": "Most reliable winter sun in Europe",
      "summary": "Mild south-coast beaches with a volcano and forests inland.",
      "lat": 28.1227, "lon": -16.726, "airport": "TFS", "wikipedia": "Tenerife",
      "weather": {"high": 22, "low": 15, "unit": "C", "summary": "Mild and mostly dry on the south coast.", "source": {"title": "", "url": ""}},
      "entry": {"status": "Depends on passport", "details": "Example only. Check the official rules for your passports.", "source": {"title": "", "url": ""}},
      "costs": {"flights": [1400, 2000], "lodging": [800, 1200], "other": [700, 1000], "total": [2900, 4200], "notes": "Example figures."},
      "activities": [
        {"name": "Teide National Park", "description": "Volcanic landscapes; much colder at altitude.", "price": "Example price", "url": ""},
        {"name": "Whale watching", "description": "Boat trips from the south coast.", "price": "Example price", "url": ""}
      ],
      "food": {"summary": "Wrinkled potatoes with mojo, grilled fish.", "try": ["Papas arrugadas", "Mojo picón"]},
      "stay": {"area": "Costa Adeje", "suggestion": "Apartment with a kitchen.", "url": ""},
      "tradeoffs": "Long trip from Chicago, usually with a connection.",
      "safety": {"weather_risks": "Wind and rough seas some days.", "advisory": "Example only.", "tips": "Check road and trail status before going up the mountain.", "sources": []},
      "routes": [],
      "sources": []
    }
  ]
};
