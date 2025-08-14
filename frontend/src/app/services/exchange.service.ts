import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ExchangeService {
  private apiUrl = '/api';
  
  constructor(private http: HttpClient) {}
  
  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('exchangeToken');
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : ''
    });
  }
  
  async createSession(): Promise<any> {
    return firstValueFrom(
      this.http.post<any>(`${this.apiUrl}/sessions`, {})
    );
  }
  
  async joinSession(sessionId: string, token: string): Promise<any> {
    return firstValueFrom(
      this.http.post<any>(
        `${this.apiUrl}/sessions/${sessionId}/join`, 
        { token }
      )
    );
  }
  
  async getSessionStatus(sessionId: string): Promise<any> {
    return firstValueFrom(
      this.http.get<any>(
        `${this.apiUrl}/sessions/${sessionId}/status`,
        { headers: this.getHeaders() }
      )
    );
  }
  
  async getPresignedUrl(filename: string, size: number, mimeType: string): Promise<any> {
    return firstValueFrom(
      this.http.post<any>(
        `${this.apiUrl}/uploads/presign`,
        { filename, size, mimeType },
        { headers: this.getHeaders() }
      )
    );
  }
  
  async completeUpload(fileId: string, storageKey: string): Promise<any> {
    return firstValueFrom(
      this.http.post<any>(
        `${this.apiUrl}/uploads/complete`,
        { fileId, storageKey },
        { headers: this.getHeaders() }
      )
    );
  }
  
  async acceptExchange(sessionId: string): Promise<any> {
    return firstValueFrom(
      this.http.post<any>(
        `${this.apiUrl}/sessions/${sessionId}/accept`,
        {},
        { headers: this.getHeaders() }
      )
    );
  }
  
  async rejectExchange(sessionId: string): Promise<any> {
    return firstValueFrom(
      this.http.post<any>(
        `${this.apiUrl}/sessions/${sessionId}/reject`,
        {},
        { headers: this.getHeaders() }
      )
    );
  }
}
