import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class WebSocketService {
  private socket: WebSocket | null = null;
  private messagesSubject = new Subject<any>();
  public messages$ = this.messagesSubject.asObservable();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  
  connect(token: string) {
    // Close existing connection if any
    this.disconnect();
    
    // Build WebSocket URL based on environment
    let finalUrl: string;
    
    if (environment.production) {
      // In production, use the configured WebSocket URL
      finalUrl = `${environment.wsUrl}/ws?token=${token}`;
    } else {
      // In development, use local URL
      finalUrl = `${environment.wsUrl}/ws?token=${token}`;
    }
    
    console.log('Connecting to WebSocket:', finalUrl);
    
    try {
      this.socket = new WebSocket(finalUrl);
      
      this.socket.onopen = () => {
        console.log('WebSocket connected');
        this.reconnectAttempts = 0;
        this.messagesSubject.next({ type: 'connected' });
      };
      
      this.socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log('WebSocket message:', message);
          this.messagesSubject.next(message);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };
      
      this.socket.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.messagesSubject.next({ type: 'error', message: 'Connection error' });
      };
      
      this.socket.onclose = () => {
        console.log('WebSocket disconnected');
        this.messagesSubject.next({ type: 'disconnected' });
        
        // Attempt to reconnect
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
          
          setTimeout(() => {
            this.connect(token);
          }, this.reconnectDelay * this.reconnectAttempts);
        }
      };
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
      this.messagesSubject.next({ type: 'error', message: 'Failed to connect' });
    }
  }
  
  disconnect() {
    if (this.socket) {
      this.reconnectAttempts = this.maxReconnectAttempts; // Prevent auto-reconnect
      this.socket.close();
      this.socket = null;
    }
  }
  
  send(message: any) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket is not connected');
    }
  }
  
  isConnected(): boolean {
    return this.socket !== null && this.socket.readyState === WebSocket.OPEN;
  }
}
