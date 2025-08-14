#!/usr/bin/env node

/**
 * Script pour remplacer les variables d'environnement dans les fichiers de production
 * Exécuté avant le build sur Vercel
 */

const fs = require('fs');
const path = require('path');

// Récupérer les variables d'environnement de Vercel
const API_URL = process.env.ANGULAR_APP_API_URL || process.env.REACT_APP_API_URL || 'http://localhost:3000';
const WS_URL = process.env.ANGULAR_APP_WS_URL || process.env.REACT_APP_WS_URL || 'ws://localhost:3000';

console.log('🔧 Configuration des variables d\'environnement...');
console.log(`API_URL: ${API_URL}`);
console.log(`WS_URL: ${WS_URL}`);

// Chemin du fichier environment.prod.ts
const envFilePath = path.join(__dirname, 'src', 'environments', 'environment.prod.ts');

// Template du fichier
const envContent = `// Configuration pour la production
// Généré automatiquement par prebuild.js

export const environment = {
  production: true,
  apiUrl: '${API_URL}',
  wsUrl: '${WS_URL}'
};
`;

// Écrire le fichier
fs.writeFileSync(envFilePath, envContent);
console.log('✅ Fichier environment.prod.ts généré avec succès !');
