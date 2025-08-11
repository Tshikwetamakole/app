import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Send, Plus, Calendar, Clock, DollarSign, Users, MessageCircle, Settings, Sparkles } from 'lucide-react';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from './components/ui/card';
import { Badge } from './components/ui/badge';
import { Textarea } from './components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './components/ui/dialog';
import './App.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

function App() {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [userLocation, setUserLocation] = useState(null);
  const [events, setEvents] = useState([]);
  const [recommendedEvents, setRecommendedEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('chat');
  const [preferences, setPreferences] = useState([]);
  const [showAddEvent, setShowAddEvent] = useState(false);
  const messagesEndRef = useRef(null);

  const [newEvent, setNewEvent] = useState({
    title: '',
    description: '',
    category: '',
    date: '',
    time: '',
    location: '',
    address: '',
    latitude: '',
    longitude: '',
    organizer: '',
    price: 'Free',
    image_url: ''
  });

  const categories = [
    'Music', 'Food & Drink', 'Arts & Culture', 'Sports & Fitness', 
    'Business & Networking', 'Health & Wellness', 'Technology', 
    'Education', 'Community', 'Entertainment'
  ];

  useEffect(() => {
    requestLocation();
    fetchEvents();
    
    // Add welcome message
    setMessages([{
      id: 1,
      type: 'bot',
      content: "Hi! I'm your hyperlocal events assistant. I can help you discover amazing local events based on your location and interests. What kind of events are you looking for?",
      timestamp: new Date().toLocaleTimeString()
    }]);
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const requestLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          });
        },
        (error) => {
          console.error('Location error:', error);
          // Use default NYC location for demo
          setUserLocation({
            latitude: 40.7589,
            longitude: -73.9851
          });
        }
      );
    } else {
      // Default location
      setUserLocation({
        latitude: 40.7589,
        longitude: -73.9851
      });
    }
  };

  const fetchEvents = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/events`);
      const data = await response.json();
      setEvents(data);
    } catch (error) {
      console.error('Error fetching events:', error);
    }
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return;

    const userMessage = {
      id: Date.now(),
      type: 'user',
      content: inputMessage,
      timestamp: new Date().toLocaleTimeString()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const response = await fetch(`${BACKEND_URL}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: inputMessage,
          latitude: userLocation?.latitude,
          longitude: userLocation?.longitude,
          preferences: preferences
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const data = await response.json();

      const botMessage = {
        id: Date.now() + 1,
        type: 'bot',
        content: data.response,
        timestamp: new Date().toLocaleTimeString()
      };

      setMessages(prev => [...prev, botMessage]);
      setRecommendedEvents(data.recommended_events || []);

    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage = {
        id: Date.now() + 1,
        type: 'bot',
        content: "I'm sorry, I'm having trouble connecting right now. Please try again in a moment.",
        timestamp: new Date().toLocaleTimeString()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleAddEvent = async () => {
    try {
      const eventData = {
        ...newEvent,
        latitude: parseFloat(newEvent.latitude),
        longitude: parseFloat(newEvent.longitude)
      };

      const response = await fetch(`${BACKEND_URL}/api/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventData),
      });

      if (response.ok) {
        setShowAddEvent(false);
        setNewEvent({
          title: '', description: '', category: '', date: '', time: '',
          location: '', address: '', latitude: '', longitude: '',
          organizer: '', price: 'Free', image_url: ''
        });
        fetchEvents();
      }
    } catch (error) {
      console.error('Error adding event:', error);
    }
  };

  const addPreference = (category) => {
    if (!preferences.includes(category)) {
      setPreferences([...preferences, category]);
    }
  };

  const removePreference = (category) => {
    setPreferences(preferences.filter(p => p !== category));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl">
                <MapPin className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">HyperLocal Events</h1>
                <p className="text-sm text-slate-600">Discover events near you</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              {userLocation && (
                <div className="flex items-center text-sm text-slate-600 bg-slate-100 px-3 py-1 rounded-full">
                  <MapPin className="h-4 w-4 mr-1" />
                  Location detected
                </div>
              )}
              
              <nav className="flex space-x-2">
                <Button
                  variant={activeTab === 'chat' ? 'default' : 'ghost'}
                  onClick={() => setActiveTab('chat')}
                  size="sm"
                  className="flex items-center space-x-2"
                >
                  <MessageCircle className="h-4 w-4" />
                  <span>Chat</span>
                </Button>
                <Button
                  variant={activeTab === 'events' ? 'default' : 'ghost'}
                  onClick={() => setActiveTab('events')}
                  size="sm"
                  className="flex items-center space-x-2"
                >
                  <Calendar className="h-4 w-4" />
                  <span>Events</span>
                </Button>
                <Button
                  variant={activeTab === 'admin' ? 'default' : 'ghost'}
                  onClick={() => setActiveTab('admin')}
                  size="sm"
                  className="flex items-center space-x-2"
                >
                  <Settings className="h-4 w-4" />
                  <span>Admin</span>
                </Button>
              </nav>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {activeTab === 'chat' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Chat Interface */}
            <div className="lg:col-span-2">
              <Card className="h-[600px] flex flex-col bg-white/90 backdrop-blur-sm border-slate-200">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center space-x-2">
                    <Sparkles className="h-5 w-5 text-indigo-500" />
                    <span>Event Assistant</span>
                  </CardTitle>
                </CardHeader>
                
                <CardContent className="flex-1 flex flex-col">
                  {/* Messages Area */}
                  <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2">
                    {messages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                            message.type === 'user'
                              ? 'bg-indigo-500 text-white'
                              : 'bg-slate-100 text-slate-800'
                          }`}
                        >
                          <p className="text-sm">{message.content}</p>
                          <span className="text-xs opacity-70 mt-1 block">
                            {message.timestamp}
                          </span>
                        </div>
                      </div>
                    ))}
                    {isLoading && (
                      <div className="flex justify-start">
                        <div className="bg-slate-100 rounded-2xl px-4 py-3">
                          <div className="flex space-x-1">
                            <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></div>
                            <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                            <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                          </div>
                        </div>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Input Area */}
                  <div className="flex space-x-2">
                    <Input
                      value={inputMessage}
                      onChange={(e) => setInputMessage(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder="Ask about local events..."
                      className="flex-1"
                      disabled={isLoading}
                    />
                    <Button 
                      onClick={handleSendMessage} 
                      disabled={isLoading}
                      className="px-4"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Recommendations Sidebar */}
            <div className="space-y-6">
              {/* Preferences */}
              <Card className="bg-white/90 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-sm">Your Preferences</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {preferences.map((pref) => (
                      <Badge 
                        key={pref} 
                        variant="secondary" 
                        className="cursor-pointer"
                        onClick={() => removePreference(pref)}
                      >
                        {pref} ×
                      </Badge>
                    ))}
                  </div>
                  <Select onValueChange={addPreference}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Add preference" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.filter(cat => !preferences.includes(cat)).map((category) => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>

              {/* Recommended Events */}
              {recommendedEvents.length > 0 && (
                <Card className="bg-white/90 backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle className="text-sm">Recommended Events</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {recommendedEvents.map((event) => (
                      <div key={event.id} className="p-3 bg-slate-50 rounded-lg">
                        <h4 className="font-medium text-sm text-slate-900">{event.title}</h4>
                        <p className="text-xs text-slate-600 mb-2">{event.description}</p>
                        <div className="flex items-center justify-between text-xs text-slate-500">
                          <span className="flex items-center">
                            <MapPin className="h-3 w-3 mr-1" />
                            {event.distance}km away
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {event.category}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}

        {activeTab === 'events' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {events.map((event) => (
              <Card key={event.id} className="bg-white/90 backdrop-blur-sm hover:shadow-lg transition-shadow">
                {event.image_url && (
                  <div className="aspect-video bg-slate-200 rounded-t-lg overflow-hidden">
                    <img 
                      src={event.image_url} 
                      alt={event.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <Badge variant="secondary">{event.category}</Badge>
                    <span className="text-sm font-medium text-indigo-600">{event.price}</span>
                  </div>
                  <CardTitle className="text-lg">{event.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-600 text-sm mb-4">{event.description}</p>
                  <div className="space-y-2 text-sm text-slate-500">
                    <div className="flex items-center">
                      <Calendar className="h-4 w-4 mr-2" />
                      {event.date}
                    </div>
                    <div className="flex items-center">
                      <Clock className="h-4 w-4 mr-2" />
                      {event.time}
                    </div>
                    <div className="flex items-center">
                      <MapPin className="h-4 w-4 mr-2" />
                      {event.location}
                    </div>
                    <div className="flex items-center">
                      <Users className="h-4 w-4 mr-2" />
                      {event.organizer}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {activeTab === 'admin' && (
          <div className="max-w-2xl mx-auto">
            <Card className="bg-white/90 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Event Management
                  <Dialog open={showAddEvent} onOpenChange={setShowAddEvent}>
                    <DialogTrigger asChild>
                      <Button className="flex items-center space-x-2">
                        <Plus className="h-4 w-4" />
                        <span>Add Event</span>
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>Add New Event</DialogTitle>
                      </DialogHeader>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                          <label className="block text-sm font-medium mb-1">Event Title</label>
                          <Input
                            value={newEvent.title}
                            onChange={(e) => setNewEvent({...newEvent, title: e.target.value})}
                            placeholder="Enter event title"
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="block text-sm font-medium mb-1">Description</label>
                          <Textarea
                            value={newEvent.description}
                            onChange={(e) => setNewEvent({...newEvent, description: e.target.value})}
                            placeholder="Enter event description"
                            rows={3}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">Category</label>
                          <Select value={newEvent.category} onValueChange={(value) => setNewEvent({...newEvent, category: value})}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                            <SelectContent>
                              {categories.map((category) => (
                                <SelectItem key={category} value={category}>
                                  {category}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">Price</label>
                          <Input
                            value={newEvent.price}
                            onChange={(e) => setNewEvent({...newEvent, price: e.target.value})}
                            placeholder="e.g., Free, $10, $25"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">Date</label>
                          <Input
                            type="date"
                            value={newEvent.date}
                            onChange={(e) => setNewEvent({...newEvent, date: e.target.value})}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">Time</label>
                          <Input
                            type="time"
                            value={newEvent.time}
                            onChange={(e) => setNewEvent({...newEvent, time: e.target.value})}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">Location Name</label>
                          <Input
                            value={newEvent.location}
                            onChange={(e) => setNewEvent({...newEvent, location: e.target.value})}
                            placeholder="e.g., Central Park"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">Organizer</label>
                          <Input
                            value={newEvent.organizer}
                            onChange={(e) => setNewEvent({...newEvent, organizer: e.target.value})}
                            placeholder="Enter organizer name"
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="block text-sm font-medium mb-1">Full Address</label>
                          <Input
                            value={newEvent.address}
                            onChange={(e) => setNewEvent({...newEvent, address: e.target.value})}
                            placeholder="Enter full address"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">Latitude</label>
                          <Input
                            value={newEvent.latitude}
                            onChange={(e) => setNewEvent({...newEvent, latitude: e.target.value})}
                            placeholder="e.g., 40.7589"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">Longitude</label>
                          <Input
                            value={newEvent.longitude}
                            onChange={(e) => setNewEvent({...newEvent, longitude: e.target.value})}
                            placeholder="e.g., -73.9851"
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="block text-sm font-medium mb-1">Image URL (optional)</label>
                          <Input
                            value={newEvent.image_url}
                            onChange={(e) => setNewEvent({...newEvent, image_url: e.target.value})}
                            placeholder="Enter image URL"
                          />
                        </div>
                        <div className="col-span-2 pt-4">
                          <Button onClick={handleAddEvent} className="w-full">
                            Add Event
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-600 mb-4">
                  Use the admin panel to add new local events. Events will be automatically available for recommendations based on user location and preferences.
                </p>
                <div className="space-y-2">
                  <h4 className="font-medium">Current Events: {events.length}</h4>
                  <p className="text-sm text-slate-600">
                    Events are automatically filtered by location when users chat with the assistant.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;