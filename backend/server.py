from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pymongo import MongoClient
from pydantic import BaseModel
from typing import List, Optional
import os
from dotenv import load_dotenv
import uuid
from datetime import datetime, timedelta
import math
from emergentintegrations.llm.chat import LlmChat, UserMessage
import asyncio

load_dotenv()

app = FastAPI()

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# MongoDB connection
MONGO_URL = os.environ.get('MONGO_URL')
client = MongoClient(MONGO_URL)
db = client.hyperlocal_events

# Collections
events_collection = db.events
chats_collection = db.chats
messages_collection = db.messages

# OpenAI API Key
OPENAI_API_KEY = os.environ.get('OPENAI_API_KEY')

class Event(BaseModel):
    id: Optional[str] = None
    title: str
    description: str
    category: str
    date: str
    time: str
    location: str
    address: str
    latitude: float
    longitude: float
    organizer: str
    price: Optional[str] = "Free"
    image_url: Optional[str] = None

class ChatMessage(BaseModel):
    message: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    preferences: Optional[List[str]] = []

class ChatResponse(BaseModel):
    response: str
    recommended_events: List[dict] = []

def calculate_distance(lat1, lon1, lat2, lon2):
    """Calculate distance between two points using Haversine formula"""
    R = 6371  # Earth's radius in kilometers
    
    lat1_rad = math.radians(lat1)
    lon1_rad = math.radians(lon1)
    lat2_rad = math.radians(lat2)
    lon2_rad = math.radians(lon2)
    
    dlat = lat2_rad - lat1_rad
    dlon = lon2_rad - lon1_rad
    
    a = math.sin(dlat/2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlon/2)**2
    c = 2 * math.asin(math.sqrt(a))
    
    return R * c

@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "service": "hyperlocal-events-api"}

@app.post("/api/events")
async def create_event(event: Event):
    try:
        event_data = event.dict()
        event_data['id'] = str(uuid.uuid4())
        event_data['created_at'] = datetime.now().isoformat()
        
        events_collection.insert_one(event_data)
        return {"message": "Event created successfully", "id": event_data['id']}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/events")
async def get_events():
    try:
        events = list(events_collection.find({}, {"_id": 0}))
        return events
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/events/nearby")
async def get_nearby_events(lat: float, lng: float, radius: float = 10.0):
    try:
        events = list(events_collection.find({}, {"_id": 0}))
        nearby_events = []
        
        for event in events:
            distance = calculate_distance(lat, lng, event['latitude'], event['longitude'])
            if distance <= radius:
                event['distance'] = round(distance, 2)
                nearby_events.append(event)
        
        # Sort by distance
        nearby_events.sort(key=lambda x: x['distance'])
        return nearby_events
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/chat")
async def chat_with_bot(chat_request: ChatMessage):
    try:
        user_message = chat_request.message
        user_lat = chat_request.latitude
        user_lng = chat_request.longitude
        user_preferences = chat_request.preferences or []
        
        # Get nearby events if location provided
        nearby_events = []
        if user_lat and user_lng:
            events = list(events_collection.find({}, {"_id": 0}))
            for event in events:
                distance = calculate_distance(user_lat, user_lng, event['latitude'], event['longitude'])
                if distance <= 15.0:  # 15km radius
                    event['distance'] = round(distance, 2)
                    nearby_events.append(event)
            nearby_events.sort(key=lambda x: x['distance'])
        
        # Prepare context for LLM
        context = f"""
        You are a helpful hyperlocal events assistant. Help users discover local events based on their location and preferences.
        
        User's message: {user_message}
        User's location: {"Provided" if user_lat and user_lng else "Not provided"}
        User's preferences: {', '.join(user_preferences) if user_preferences else "Not specified"}
        
        Available nearby events:
        """
        
        for event in nearby_events[:10]:  # Limit to top 10 events
            context += f"""
            - {event['title']} ({event['category']})
              Date: {event['date']} at {event['time']}
              Location: {event['location']} ({event['distance']}km away)
              Description: {event['description']}
              Price: {event['price']}
            """
        
        context += """
        
        Provide helpful, friendly responses about local events. If the user asks about events:
        1. Recommend relevant events based on their preferences and location
        2. Provide brief, engaging descriptions
        3. Mention practical details like distance, date, and price
        4. Ask follow-up questions to better understand their interests
        
        If no location is provided, politely ask for their location to provide better recommendations.
        Keep responses conversational and helpful.
        """
        
        # Initialize LLM chat
        chat = LlmChat(
            api_key=OPENAI_API_KEY,
            session_id=f"chat_{uuid.uuid4()}",
            system_message=context
        ).with_model("openai", "gpt-4o-mini")
        
        # Send message to LLM
        llm_message = UserMessage(text=user_message)
        response = await chat.send_message(llm_message)
        
        # Store chat message
        chat_data = {
            "id": str(uuid.uuid4()),
            "user_message": user_message,
            "bot_response": response,
            "latitude": user_lat,
            "longitude": user_lng,
            "preferences": user_preferences,
            "timestamp": datetime.now().isoformat(),
            "recommended_events": [event['id'] for event in nearby_events[:5]]
        }
        chats_collection.insert_one(chat_data)
        
        return ChatResponse(
            response=response,
            recommended_events=nearby_events[:5]  # Return top 5 events
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chat error: {str(e)}")

@app.delete("/api/events/{event_id}")
async def delete_event(event_id: str):
    try:
        result = events_collection.delete_one({"id": event_id})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Event not found")
        return {"message": "Event deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.on_event("startup")
async def create_sample_events():
    """Create sample events if none exist"""
    if events_collection.count_documents({}) == 0:
        sample_events = [
            {
                "id": str(uuid.uuid4()),
                "title": "Downtown Jazz Night",
                "description": "Live jazz music featuring local artists in the heart of downtown",
                "category": "Music",
                "date": "2025-01-25",
                "time": "7:00 PM",
                "location": "Blue Note Cafe",
                "address": "123 Main St, Downtown",
                "latitude": 40.7589,
                "longitude": -73.9851,
                "organizer": "Blue Note Entertainment",
                "price": "$15",
                "image_url": "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f",
                "created_at": datetime.now().isoformat()
            },
            {
                "id": str(uuid.uuid4()),
                "title": "Community Farmers Market",
                "description": "Fresh local produce, artisanal foods, and handmade crafts",
                "category": "Food & Drink",
                "date": "2025-01-26",
                "time": "9:00 AM",
                "location": "City Park",
                "address": "456 Park Ave, Riverside",
                "latitude": 40.7505,
                "longitude": -73.9934,
                "organizer": "Riverside Community Association",
                "price": "Free",
                "image_url": "https://images.unsplash.com/photo-1488459716781-31db52582fe9",
                "created_at": datetime.now().isoformat()
            },
            {
                "id": str(uuid.uuid4()),
                "title": "Tech Startup Networking",
                "description": "Connect with local entrepreneurs and tech professionals",
                "category": "Business & Networking",
                "date": "2025-01-27",
                "time": "6:30 PM",
                "location": "Innovation Hub",
                "address": "789 Tech Blvd, Silicon Valley",
                "latitude": 40.7614,
                "longitude": -73.9776,
                "organizer": "TechConnect NYC",
                "price": "$25",
                "image_url": "https://images.unsplash.com/photo-1515169067868-5387ec356754",
                "created_at": datetime.now().isoformat()
            },
            {
                "id": str(uuid.uuid4()),
                "title": "Morning Yoga in the Park",
                "description": "Start your day with mindful movement and meditation",
                "category": "Health & Wellness",
                "date": "2025-01-28",
                "time": "7:30 AM",
                "location": "Sunset Park",
                "address": "321 Sunset Dr, Westside",
                "latitude": 40.7449,
                "longitude": -73.9895,
                "organizer": "Zen Wellness Studio",
                "price": "$20",
                "image_url": "https://images.unsplash.com/photo-1506629905189-51508327e5ce",
                "created_at": datetime.now().isoformat()
            },
            {
                "id": str(uuid.uuid4()),
                "title": "Local Art Gallery Opening",
                "description": "Featuring works by emerging local artists",
                "category": "Arts & Culture",
                "date": "2025-01-29",
                "time": "6:00 PM",
                "location": "Metropolitan Art Space",
                "address": "654 Gallery St, Arts District",
                "latitude": 40.7688,
                "longitude": -73.9845,
                "organizer": "Metro Arts Collective",
                "price": "Free",
                "image_url": "https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b",
                "created_at": datetime.now().isoformat()
            },
            {
                "id": str(uuid.uuid4()),
                "title": "Family Fun Run",
                "description": "3K fun run for families with kids activities",
                "category": "Sports & Fitness",
                "date": "2025-01-30",
                "time": "8:00 AM",
                "location": "Riverside Trail",
                "address": "789 River Rd, Riverside",
                "latitude": 40.7531,
                "longitude": -73.9712,
                "organizer": "Riverside Running Club",
                "price": "$10",
                "image_url": "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b",
                "created_at": datetime.now().isoformat()
            }
        ]
        
        events_collection.insert_many(sample_events)
        print("Sample events created successfully")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)