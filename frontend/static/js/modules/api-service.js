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
    static async delete(endpoint) {
        try {
            const url = `/api/${endpoint}`;
            console.log(`Attempting to delete: ${url}`);

            // Try DELETE
            let response = await fetch(url, { method: 'DELETE' });
            console.log(`DELETE response status for ${endpoint}:`, response.status);
            if (response.ok) return response.json().catch(() => ({}));
            let errorText = await response.text();
            console.error(`DELETE failed. Response: ${errorText}`);

            // Try POST to /delete
            if (response.status === 405) {
                const postUrl = url.endsWith('/delete') ? url : `${url}/delete`;
                console.log(`Trying POST for deletion: ${postUrl}`);
                response = await fetch(postUrl, { method: 'POST' });
                console.log(`POST delete response status for ${endpoint}:`, response.status);
                if (response.ok) return response.json().catch(() => ({}));
                errorText = await response.text();
                console.error(`POST failed. Response: ${errorText}`);
            }

            // Try PATCH as a last resort
            if (response.status === 405) {
                console.log(`Trying PATCH for deletion: ${url}`);
                response = await fetch(url, { method: 'PATCH' });
                console.log(`PATCH delete response status for ${endpoint}:`, response.status);
                if (response.ok) return response.json().catch(() => ({}));
                errorText = await response.text();
                console.error(`PATCH failed. Response: ${errorText}`);
            }

            throw new Error(`Server returned ${response.status}: ${errorText}`);
        } catch (error) {
            console.error(`Delete operation failed for ${endpoint}:`, error);
            throw error;
        }
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
      
    async deleteSession(id) {
        // Always use the correct endpoint and method for session deletion
        const url = `${this.baseUrl}/sessions/${id}/delete`;
        console.log(`Deleting session via: ${url}`);
        const response = await fetch(url, { method: 'DELETE' });
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Server returned ${response.status}: ${errorText}`);
        }
        return response.json().catch(() => ({}));
    }
      
    async addPlayerToSession(sessionId, data) {
        return this.post(`sessions/${sessionId}/entries`, data);
    }
    async updatePlayerInSession(sessionId, playerId, data) {
        return this.put(`sessions/${sessionId}/entries/${playerId}`, data);
    }
}
