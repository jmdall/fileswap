// import NodeClam from 'clamscan';
import config from '../config.js';

let clamScanner = null;

async function initScanner() {
  // Désactivé pour le développement initial
  // TODO: Activer ClamAV en production
  return null;
  
  /*
  if (!clamScanner && config.clamav.host) {
    try {
      const ClamScan = new NodeClam().init({
        clamdscan: {
          host: config.clamav.host,
          port: config.clamav.port
        }
      });
      clamScanner = await ClamScan;
    } catch (error) {
      console.warn('ClamAV not available:', error.message);
    }
  }
  return clamScanner;
  */
}

export async function scanFile(buffer) {
  const scanner = await initScanner();
  
  if (!scanner) {
    // Si ClamAV n'est pas disponible en dev, on skip
    return { 
      clean: true, 
      skipped: true,
      message: 'Scanner not available (dev mode)'
    };
  }
  
  try {
    const result = await scanner.scanBuffer(buffer);
    
    return {
      clean: !result.isInfected,
      virus: result.viruses?.join(', '),
      scanned: true
    };
  } catch (error) {
    console.error('Scan failed:', error);
    // En cas d'erreur, on préfère bloquer par sécurité
    return {
      clean: false,
      error: error.message,
      scanned: false
    };
  }
}
