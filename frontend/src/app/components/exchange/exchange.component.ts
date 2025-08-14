import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ExchangeService } from '../../services/exchange.service';
import { WebSocketService } from '../../services/websocket.service';
import { Subscription } from 'rxjs';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-exchange',
  templateUrl: './exchange.component.html',
  styleUrls: ['./exchange.component.css']
})
export class ExchangeComponent implements OnInit, OnDestroy {
  // Session info
  sessionId: string = '';
  token: string = '';
  jwtToken: string = '';
  role: 'A' | 'B' = 'A';
  sessionState: string = 'created';
  expiresAt: Date | null = null;
  
  // Files
  myFile: any = null;
  peerFile: any = null;
  selectedFile: File | null = null;
  uploadProgress: number = 0;
  isUploading: boolean = false;
  
  // Acceptance states
  iAccepted: boolean = false;
  peerAccepted: boolean = false;
  
  // Download URLs
  downloadUrls: any = null;
  
  // Subscriptions
  private subscriptions: Subscription[] = [];
  
  // Messages
  statusMessage: string = '';
  errorMessage: string = '';
  successMessage: string = '';
  
  // UI states
  isLoading: boolean = false;
  isDragging: boolean = false;
  
  constructor(
    private route: ActivatedRoute,
    private exchangeService: ExchangeService,
    private wsService: WebSocketService
  ) {}
  
  ngOnInit() {
    // Get parameters from URL
    this.route.queryParams.subscribe(params => {
      this.sessionId = params['sid'];
      this.token = params['token'];
      
      if (this.sessionId && this.token) {
        this.joinSession();
      } else {
        this.errorMessage = 'Paramètres de session manquants';
      }
    });
    
    // Listen to WebSocket messages
    this.subscriptions.push(
      this.wsService.messages$.subscribe(message => {
        this.handleWebSocketMessage(message);
      })
    );
  }
  
  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.wsService.disconnect();
  }
  
  async joinSession() {
    this.isLoading = true;
    this.errorMessage = '';
    
    try {
      const response = await this.exchangeService.joinSession(this.sessionId, this.token);
      
      // Store JWT token
      this.jwtToken = response.token;
      localStorage.setItem('exchangeToken', response.token);
      this.role = response.role;
      this.sessionState = response.state;
      this.expiresAt = new Date(response.expiresAt);
      
      // Connect to WebSocket
      this.wsService.connect(response.token);
      
      // Get initial status
      await this.refreshStatus();
      
      this.successMessage = `Connecté en tant que participant ${this.role}`;
    } catch (error: any) {
      this.errorMessage = error.error?.message || 'Erreur lors de la connexion';
    } finally {
      this.isLoading = false;
    }
  }
  
  async refreshStatus() {
    try {
      const status = await this.exchangeService.getSessionStatus(this.sessionId);
      
      this.sessionState = status.session.state;
      this.myFile = status.me.file;
      this.peerFile = status.peer.file;
      this.iAccepted = status.me.accepted;
      this.peerAccepted = status.peer.accepted;
      
      // Log pour debug
      if (this.peerFile) {
        console.log('Peer file info:', this.peerFile);
        if (this.peerFile.previewUrl) {
          console.log('Preview URL:', this.peerFile.previewUrl);
          console.log('Full preview URL:', this.getPreviewUrl(this.peerFile.previewUrl));
        }
      }
      
    } catch (error: any) {
      console.error('Error refreshing status:', error);
    }
  }
  
  onFileSelect(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.handleFile(file);
    }
  }
  
  onDragOver(event: DragEvent) {
    event.preventDefault();
    this.isDragging = true;
  }
  
  onDragLeave(event: DragEvent) {
    event.preventDefault();
    this.isDragging = false;
  }
  
  onDrop(event: DragEvent) {
    event.preventDefault();
    this.isDragging = false;
    
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.handleFile(files[0]);
    }
  }
  
  handleFile(file: File) {
    // Check file size
    const maxSize = 2 * 1024 * 1024 * 1024; // 2GB
    if (file.size > maxSize) {
      this.errorMessage = 'Fichier trop volumineux (max 2GB)';
      return;
    }
    
    this.selectedFile = file;
    this.uploadFile();
  }
  
  async uploadFile() {
    if (!this.selectedFile) return;
    
    this.isUploading = true;
    this.uploadProgress = 0;
    this.errorMessage = '';
    
    try {
      // Get presigned URL
      const presignResponse = await this.exchangeService.getPresignedUrl(
        this.selectedFile.name,
        this.selectedFile.size,
        this.selectedFile.type || 'application/octet-stream'
      );
      
      // Upload to S3
      await this.uploadToS3(this.selectedFile, presignResponse.uploadUrl);
      
      // Confirm upload completion
      await this.exchangeService.completeUpload(
        presignResponse.fileId,
        presignResponse.storageKey
      );
      
      this.myFile = {
        id: presignResponse.fileId,
        filename: this.selectedFile.name,
        size: this.selectedFile.size,
        status: 'processing'
      };
      
      this.statusMessage = 'Fichier en cours de traitement...';
      this.selectedFile = null;
      
    } catch (error: any) {
      this.errorMessage = error.error?.message || 'Erreur lors de l\'upload';
    } finally {
      this.isUploading = false;
      this.uploadProgress = 0;
    }
  }
  
  private uploadToS3(file: File, presignedUrl: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          this.uploadProgress = Math.round((e.loaded / e.total) * 100);
        }
      });
      
      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          reject(new Error(`Upload failed: ${xhr.status}`));
        }
      });
      
      xhr.addEventListener('error', () => {
        reject(new Error('Upload failed'));
      });
      
      xhr.open('PUT', presignedUrl);
      xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
      xhr.send(file);
    });
  }
  
  async acceptExchange() {
    if (!this.canAccept()) return;
    
    this.isLoading = true;
    this.errorMessage = '';
    
    try {
      const response = await this.exchangeService.acceptExchange(this.sessionId);
      this.iAccepted = true;
      
      if (response.state === 'released') {
        this.sessionState = 'released';
        this.downloadUrls = response.downloadUrls;
        this.successMessage = 'Échange validé ! Les fichiers sont disponibles.';
      } else {
        this.statusMessage = 'En attente de l\'acceptation de l\'autre participant...';
      }
    } catch (error: any) {
      this.errorMessage = error.error?.message || 'Erreur lors de l\'acceptation';
    } finally {
      this.isLoading = false;
    }
  }
  
  async rejectExchange() {
    if (confirm('Êtes-vous sûr de vouloir annuler cet échange ?')) {
      this.isLoading = true;
      try {
        await this.exchangeService.rejectExchange(this.sessionId);
        this.sessionState = 'cancelled';
        this.statusMessage = 'Échange annulé';
      } catch (error: any) {
        this.errorMessage = error.error?.message || 'Erreur lors de l\'annulation';
      } finally {
        this.isLoading = false;
      }
    }
  }
  
  canAccept(): boolean {
    return this.sessionState === 'ready' && 
           !this.iAccepted && 
           this.myFile?.status === 'ready' && 
           this.peerFile?.status === 'ready';
  }
  
  downloadFile(type: 'mine' | 'peer') {
    if (!this.downloadUrls) return;
    
    const url = type === 'mine' ? 
      this.downloadUrls[this.role] : 
      this.downloadUrls[this.role === 'A' ? 'B' : 'A'];
    
    // Add base URL if needed
    const fullUrl = url.startsWith('http') ? url : `${environment.apiUrl}${url}`;
    window.open(fullUrl, '_blank');
  }
  
  private handleWebSocketMessage(message: any) {
    switch (message.type) {
      case 'connected':
        console.log('WebSocket connected');
        break;
        
      case 'file_ready':
        this.refreshStatus();
        this.statusMessage = 'Un fichier est prêt';
        break;
        
      case 'session_ready':
        this.sessionState = 'ready';
        this.successMessage = 'Les deux fichiers sont prêts. Vous pouvez maintenant accepter l\'échange.';
        this.refreshStatus();
        break;
        
      case 'peer_accepted':
        this.peerAccepted = true;
        this.statusMessage = 'L\'autre participant a accepté l\'échange';
        break;
        
      case 'released':
        this.sessionState = 'released';
        this.downloadUrls = message.downloadUrls;
        this.successMessage = 'Échange validé ! Les fichiers sont disponibles.';
        break;
        
      case 'cancelled':
        this.sessionState = 'cancelled';
        this.statusMessage = 'L\'échange a été annulé';
        break;
        
      case 'file_blocked':
        this.errorMessage = `Fichier bloqué : ${message.reason}`;
        break;
        
      case 'error':
        this.errorMessage = message.message;
        break;
    }
  }
  
  formatFileSize(bytes: number): string {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }
  
  getTimeRemaining(): string {
    if (!this.expiresAt) return '';
    
    const now = new Date().getTime();
    const expires = this.expiresAt.getTime();
    const diff = expires - now;
    
    if (diff <= 0) return 'Expiré';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    return `${hours}h ${minutes}min`;
  }
  
  getStatusClass(status: string): string {
    switch (status) {
      case 'ready': return 'status-ready';
      case 'processing': return 'status-processing';
      case 'uploading': return 'status-uploading';
      case 'scanning': return 'status-scanning';
      case 'blocked': return 'status-blocked';
      default: return '';
    }
  }
  
  getStatusText(status: string): string {
    switch (status) {
      case 'ready': return 'Prêt';
      case 'processing': return 'Traitement...';
      case 'uploading': return 'Upload...';
      case 'scanning': return 'Scan antivirus...';
      case 'blocked': return 'Bloqué';
      default: return status;
    }
  }
  
  getPreviewUrl(url: string): string {
    // L'URL est déjà une URL présignée S3 complète
    // Pas besoin de la transformer
    return url;
  }
  
  onPreviewError(event: any) {
    console.error('Preview failed to load:', event);
    console.error('Image src was:', event.target.src);
    // Ne pas masquer l'image pour debug
    // event.target.style.display = 'none';
    event.target.alt = 'Erreur de chargement de l\'aperçu';
  }
}
