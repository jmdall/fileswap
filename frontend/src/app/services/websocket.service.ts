import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

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
    
    // Build WebSocket URL
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname;
    const port = window.location.port || (protocol === 'wss:' ? '443' : '80');
    const wsUrl = `${protocol}//${host}:${port}/ws?token=${token}`;
    
    // For development, use direct backend URL
    const isDev = window.location.hostname === 'localhost';
    const finalUrl = isDev ? `ws://localhost:3000/ws?token=${token}` : wsUrl;
    
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
