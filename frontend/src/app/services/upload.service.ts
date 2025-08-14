// Service Angular pour gérer les uploads vers R2
// frontend/src/app/services/upload.service.ts

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class UploadService {
  
  constructor(private http: HttpClient) {}

  /**
   * Upload un fichier vers R2 en utilisant une URL présignée
   */
  async uploadToR2(file: File, onProgress?: (percent: number) => void): Promise<boolean> {
    try {
      // 1. Obtenir l'URL présignée du backend
      console.log('Requesting presigned URL for:', file.name);
      
      const presignResponse = await firstValueFrom(
        this.http.post<any>('/api/uploads/presign', {
          filename: file.name,
          size: file.size,
          mimeType: file.type
        })
      );

      const { uploadUrl, fileId, storageKey } = presignResponse;
      console.log('Got presigned URL, uploading to R2...');

      // 2. Upload direct vers R2
      const uploadSuccess = await this.uploadFileToR2(
        file, 
        uploadUrl, 
        onProgress
      );

      if (!uploadSuccess) {
        throw new Error('Upload to R2 failed');
      }

      // 3. Confirmer l'upload au backend
      console.log('Upload successful, confirming with backend...');
      
      await firstValueFrom(
        this.http.post('/api/uploads/complete', {
          fileId,
          storageKey
        })
      );

      console.log('File upload completed successfully!');
      return true;

    } catch (error) {
      console.error('Upload failed:', error);
      return false;
    }
  }

  /**
   * Upload direct vers R2 avec une URL présignée
   */
  private uploadFileToR2(
    file: File, 
    presignedUrl: string, 
    onProgress?: (percent: number) => void
  ): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      // Suivi de la progression
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable && onProgress) {
          const percentComplete = Math.round((event.loaded / event.total) * 100);
          onProgress(percentComplete);
        }
      });

      // Succès
      xhr.addEventListener('load', () => {
        if (xhr.status === 200 || xhr.status === 204) {
          console.log('R2 upload successful');
          resolve(true);
        } else {
          console.error('R2 upload failed with status:', xhr.status);
          reject(new Error(`Upload failed with status ${xhr.status}`));
        }
      });

      // Erreur
      xhr.addEventListener('error', () => {
        console.error('R2 upload error');
        reject(new Error('Network error during upload'));
      });

      // Configuration de la requête
      xhr.open('PUT', presignedUrl);
      
      // Headers importants pour R2
      xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
      
      // NE PAS inclure ces headers (ils sont dans l'URL présignée) :
      // - Authorization
      // - x-amz-* headers
      
      // Envoyer le fichier
      xhr.send(file);
    });
  }

  /**
   * Télécharge un fichier depuis R2
   */
  async downloadFromR2(fileId: string, filename: string): Promise<void> {
    try {
      // Obtenir l'URL de téléchargement du backend
      const response = await firstValueFrom(
        this.http.get<any>(`/api/uploads/download-url/${fileId}`)
      );

      const { downloadUrl } = response;

      // Créer un lien temporaire pour télécharger
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      link.style.display = 'none';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

    } catch (error) {
      console.error('Download failed:', error);
      throw error;
    }
  }

  /**
   * Affiche une preview d'image depuis R2
   */
  async getPreviewUrl(fileId: string): Promise<string> {
    try {
      const response = await firstValueFrom(
        this.http.get<any>(`/api/uploads/preview-url/${fileId}`)
      );

      return response.previewUrl;
    } catch (error) {
      console.error('Failed to get preview URL:', error);
      return '';
    }
  }
}

// Exemple d'utilisation dans un composant :
/*
export class UploadComponent {
  uploadProgress = 0;
  
  constructor(private uploadService: UploadService) {}
  
  async onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    
    const file = input.files[0];
    
    // Validation
    if (file.size > 10 * 1024 * 1024 * 1024) { // 10GB
      alert('File too large!');
      return;
    }
    
    // Upload avec suivi de progression
    const success = await this.uploadService.uploadToR2(
      file,
      (percent) => {
        this.uploadProgress = percent;
        console.log(`Upload progress: ${percent}%`);
      }
    );
    
    if (success) {
      alert('Upload successful!');
    } else {
      alert('Upload failed!');
    }
  }
}
*/
