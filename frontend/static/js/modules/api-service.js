// API service for handling API requests
export default class ApiService {
    constructor(baseUrl = '/api') {
        this.baseUrl = baseUrl;
    }
    
    // Helper method for handling API errors
    async handleResponse(response) {
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
            throw new Error(errorData.error || `API error: ${response.status}`);
        }
        return response.json();
    }
    
    // GET requests
    async get(endpoint) {
        const response = await fetch(`${this.baseUrl}/${endpoint}`);
        return this.handleResponse(response);
    }
    
    // POST requests
    async post(endpoint, data) {
        const response = await fetch(`${this.baseUrl}/${endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        return this.handleResponse(response);
    }
    
    // PUT requests
    async put(endpoint, data = {}) {
        const response = await fetch(`${this.baseUrl}/${endpoint}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: Object.keys(data).length ? JSON.stringify(data) : undefined
        });
        return this.handleResponse(response);
    }
    
    // DELETE requests
    async delete(endpoint) {
        const response = await fetch(`${this.baseUrl}/${endpoint}`, {
            method: 'DELETE'
        });
        return this.handleResponse(response);
    }
    
    // --- Dashboard API ---
    async getDashboard() {
        return this.get('dashboard');
    }
      // --- Players API ---
    async getPlayers() {
        return this.get('players');
    }
    
    async getPlayer(id) {
        return this.get(`players/${id}/stats`);
    }
    
    async getPlayerHistory(id) {
        return this.get(`players/${id}/history`);
    }
    
    async createPlayer(data) {
        return this.post('players', data);
    }
    
    async incrementSevenTwoWins(playerId) {
        return this.put(`players/${playerId}/seven-two-wins/increment`);
    }
    
    async decrementSevenTwoWins(playerId) {
        return this.put(`players/${playerId}/seven-two-wins/decrement`);
    }
    
    // --- Sessions API ---
    async getSessions() {
        return this.get('sessions');
    }
    
    async getSession(id) {
        return this.get(`sessions/${id}`);
    }
    
    async createSession(data) {
        return this.post('sessions', data);
    }
    
    async endSession(id) {
        return this.put(`sessions/${id}/end`);
    }
    
    async reactivateSession(id) {
        return this.put(`sessions/${id}/reactivate`);
    }
      async addPlayerToSession(sessionId, data) {
        return this.post(`sessions/${sessionId}/entries`, data);
    }
      async updatePlayerInSession(sessionId, playerId, data) {
        return this.put(`sessions/${sessionId}/entries/${playerId}`, data);
    }
}
